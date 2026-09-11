// F3 — the integration layer: a scoped, API-key-authed partner API (/api/v1)
// and an MCP-compatible JSON-RPC endpoint (/api/mcp) exposing store data as
// tools to AI agents and external automation.
import { Hono } from "hono";
import { sha256hex, loadProducts, displayDate, optionLabel, makeSku, locationIds, todayInWAT } from "./util.js";
import { rewardOut } from "./rewards.js";

// ---- shared API-key auth ----
async function authKey(env, req, ctx) {
  const hdr = req.header("authorization") || "";
  const key = hdr.startsWith("Bearer ") ? hdr.slice(7) : (req.header("x-api-key") || "");
  if (!key) return null;
  const row = await env.DB.prepare("SELECT * FROM api_keys WHERE key_hash=? AND enabled=1").bind(await sha256hex(key)).first();
  if (!row) return null;
  if (ctx && ctx.waitUntil) ctx.waitUntil(env.DB.prepare("UPDATE api_keys SET last_used=datetime('now') WHERE id=?").bind(row.id).run());
  return row;
}

// ---- shared data readers (used by both v1 and MCP) ----
async function readProducts(env) {
  const products = await loadProducts(env.DB);
  return products.map((p) => ({
    id: p.id, name: p.name, category: p.cat, family: p.family, live: p.live,
    externalId: p.externalId, optionNames: p.optionNames,
    // Variations, SKU-level — this is what an ERP reconciles its feed against.
    // Stock carries one key per store, whatever the house currently has open.
    variants: p.variants.map((v) => ({
      sku: v.sku, externalId: v.externalId, label: v.size, options: v.options,
      ngn: v.ngn, active: v.active, stock: { ...v.stock },
    })),
    prices: p.variants.map((v) => ({ size: v.size, ngn: v.ngn })), // kept for existing consumers
    stock: p.variants.reduce((n, v) => n + Object.values(v.stock).reduce((m, q) => m + q, 0), 0),
  }));
}
async function readInventory(env, productId) {
  const products = await loadProducts(env.DB);
  return products.filter((p) => !productId || p.id === productId).map((p) => ({
    id: p.id, name: p.name,
    // One key per store, whatever the house currently has open.
    variants: p.variants.map((v) => ({ sku: v.sku, size: v.size, ...v.stock })),
  }));
}
async function readOrders(env, limit = 25) {
  const rows = (await env.DB.prepare("SELECT no, customer, city, fulfilled_from, method, pay, pay_status, status, total, placed_at FROM orders ORDER BY placed_at DESC LIMIT ?").bind(Math.min(100, limit)).all()).results;
  return rows.map((o) => ({ no: o.no, customer: o.customer, city: o.city, fulfilledFrom: o.fulfilled_from, method: o.method, pay: o.pay, paid: o.pay_status === "paid", status: o.status, total: o.total, placed: displayDate(new Date(o.placed_at.replace(" ", "T") + "Z")) }));
}
async function readOrder(env, no) {
  const o = await env.DB.prepare("SELECT * FROM orders WHERE no=?").bind(String(no).toUpperCase()).first();
  if (!o) return null;
  const items = (await env.DB.prepare("SELECT product_id, name, size, qty, unit_ngn FROM order_items WHERE order_no=?").bind(o.no).all()).results;
  return { no: o.no, customer: o.customer, phone: o.phone, email: o.email, city: o.city, fulfilledFrom: o.fulfilled_from, method: o.method, pay: o.pay, paid: o.pay_status === "paid", status: o.status, subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, total: o.total, items };
}

// ---- ERP catalogue sync ----
//
// The ERP is the system of record for what exists and what it costs. It sends a
// flat list of SKU rows; each row carries the parent/style code that groups it
// with its siblings, which is what turns the feed into variable products here.
//
// Everything upserts on the ERP's own identifiers — (source, parentId) for the
// product, (source, externalId) for the variation — so re-sending the same feed
// is idempotent. A second run updates in place instead of duplicating the
// catalogue, which means a failed sync can simply be retried.
//
// A product the ERP has never seen but whose slug already exists is *adopted*
// rather than duplicated, so the first sync attaches to the catalogue that is
// already live rather than shadowing it.

function slugify(s, fallback = "product") {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || fallback;
}

// Field aliases: ERPs disagree on casing and naming, so accept the common shapes
// rather than forcing a mapping layer on the integrator.
const pick = (row, ...keys) => {
  for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  return undefined;
};

async function syncCatalogue(env, body) {
  const db = env.DB;
  const source = String(body.source || "erp").trim().slice(0, 60) || "erp";
  const rows = Array.isArray(body.items) ? body.items : [];
  const dryRun = !!body.dryRun;
  // New products land as drafts unless the feed explicitly publishes them, so a
  // mis-mapped import can never dump straight onto the storefront.
  const publish = body.publish === true;

  const out = {
    source, dryRun,
    productsCreated: 0, productsAdopted: 0, productsUpdated: 0,
    variantsCreated: 0, variantsUpdated: 0, skipped: 0, errors: [],
  };
  if (!rows.length) return out;

  const cats = new Set((await db.prepare("SELECT id FROM categories").all()).results.map((r) => r.id));
  // Stores are data — a feed can carry stock for whatever the house has open.
  const stores = await locationIds(db);

  // Group the flat SKU feed by the parent code the ERP sends.
  const groups = new Map();
  rows.forEach((row, i) => {
    const parentId = String(pick(row, "parentId", "parent_id", "styleCode", "style_code", "parent") ?? "").trim();
    const externalId = String(pick(row, "externalId", "external_id", "id", "sku") ?? "").trim();
    if (!parentId) {
      out.skipped++;
      out.errors.push({ row: i, error: "No parentId — the ERP must send a parent/style code to group variations." });
      return;
    }
    if (!externalId) {
      out.skipped++;
      out.errors.push({ row: i, error: `Row ${i} under parent "${parentId}" has no externalId or sku.` });
      return;
    }
    if (!groups.has(parentId)) groups.set(parentId, []);
    groups.get(parentId).push({ row, parentId, externalId, index: i });
  });

  for (const [parentId, items] of groups) {
    try {
      const head = items[0].row;
      const name = String(pick(head, "parentName", "parent_name", "productName", "name") ?? "").trim() || parentId;
      const rawCat = String(pick(head, "category", "cat") ?? "").trim();
      const cat = cats.has(rawCat) ? rawCat : null;

      // 1. Find or create the parent product.
      let product = await db.prepare("SELECT * FROM products WHERE external_source=? AND external_id=?")
        .bind(source, parentId).first();
      let productId = product ? product.id : null;

      if (!product) {
        const slug = slugify(name || parentId);
        const bySlug = await db.prepare("SELECT * FROM products WHERE id=?").bind(slug).first();
        if (bySlug && !bySlug.external_id) {
          // Adopt the product already in the catalogue instead of shadowing it.
          product = bySlug;
          productId = bySlug.id;
          if (!dryRun) {
            await db.prepare("UPDATE products SET external_source=?, external_id=? WHERE id=?")
              .bind(source, parentId, productId).run();
          }
          out.productsAdopted++;
        } else {
          // A slug clash with a product owned by another feed gets its own id.
          productId = bySlug ? `${slug}-${slugify(parentId, "erp")}` : slug;
          // A category the feed names but the store doesn't have is a mapping
          // error worth surfacing, not something to silently default away.
          if (rawCat && !cat) throw new Error(`Category "${rawCat}" is not one of: ${[...cats].join(", ")}.`);
          if (!dryRun) {
            await db.prepare(
              `INSERT INTO products (id, name, cat, gender, family, notes, descr, image_url, live, option_names, external_source, external_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              productId, name, cat || "perfumes",
              String(pick(head, "gender", "wornBy") ?? "Unisex"),
              String(pick(head, "family") ?? ""),
              String(pick(head, "notes", "scentNotes") ?? "").trim() || "—",
              String(pick(head, "description", "descr", "desc") ?? "").trim() || "Imported from the ERP — description coming soon.",
              String(pick(head, "imageUrl", "image", "image_url") ?? "").trim() || null,
              publish ? 1 : 0,
              JSON.stringify(normaliseOptionNames(pick(head, "optionNames", "option_names"))),
              source, parentId
            ).run();
          }
          out.productsCreated++;
          product = null; // freshly created; nothing to update below
        }
      }

      // 2. Refresh the parent's descriptive fields when the feed carries them.
      //    Absent fields are left alone, so merchandising done in the admin is
      //    never overwritten by a sparse ERP row.
      if (product) {
        const sets = [], vals = [];
        const put = (col, val) => { if (val !== undefined && val !== "") { sets.push(`${col}=?`); vals.push(val); } };
        put("name", name !== parentId ? name : undefined);
        put("cat", cat || undefined);
        put("gender", pick(head, "gender", "wornBy"));
        put("notes", pick(head, "notes", "scentNotes"));
        put("descr", pick(head, "description", "descr", "desc"));
        const on = pick(head, "optionNames", "option_names");
        if (on) put("option_names", JSON.stringify(normaliseOptionNames(on)));
        if (sets.length) {
          vals.push(productId);
          if (!dryRun) await db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id=?`).bind(...vals).run();
          out.productsUpdated++;
        }
      }

      // 3. Upsert each variation as a SKU-level record.
      for (const { row, externalId, index } of items) {
        const label = optionLabel(
          pick(row, "option1", "size", "variant", "variantName") ?? (Array.isArray(row.options) ? row.options[0] : ""),
          pick(row, "option2") ?? (Array.isArray(row.options) ? row.options[1] : ""),
          pick(row, "option3") ?? (Array.isArray(row.options) ? row.options[2] : "")
        );
        const price = Math.round(Number(pick(row, "priceNgn", "price_ngn", "price") ?? 0));
        if (!label) { out.skipped++; out.errors.push({ row: index, error: `SKU "${externalId}" has no size/option label.` }); continue; }
        if (!price || price < 0) { out.skipped++; out.errors.push({ row: index, error: `SKU "${externalId}" has no usable price.` }); continue; }

        let variant = await db.prepare("SELECT * FROM variants WHERE external_source=? AND external_id=?")
          .bind(source, externalId).first();
        if (!variant && productId) {
          // Adopt a variation already carrying this label on this product.
          variant = await db.prepare("SELECT * FROM variants WHERE product_id=? AND lower(size)=lower(?)")
            .bind(productId, label).first();
        }

        // SKU: the ERP's if it sends one and it is free, otherwise derived.
        let sku = String(pick(row, "sku", "skuCode") ?? "").trim() || (variant && variant.sku) || makeSku(productId, label);
        const clash = await db.prepare("SELECT id FROM variants WHERE sku=? AND id IS NOT ?")
          .bind(sku, variant ? variant.id : -1).first();
        if (clash) sku = `${sku}-${slugify(externalId, "erp")}`;

        const image = String(pick(row, "imageUrl", "image", "image_url") ?? "").trim() || null;
        const compareAt = Math.round(Number(pick(row, "compareAtNgn", "compare_at_ngn", "wasPrice") ?? 0)) || null;
        const sort = Number(pick(row, "sort", "position") ?? 0) || 0;
        const active = pick(row, "active", "enabled") === undefined ? 1 : (row.active ?? row.enabled) ? 1 : 0;

        if (variant) {
          if (!dryRun) {
            await db.prepare(
              `UPDATE variants SET size=?, option1=?, option2=?, option3=?, price_ngn=?, compare_at_ngn=?,
                 sku=?, image_url=COALESCE(?, image_url), active=?, sort=?, external_source=?, external_id=?
               WHERE id=?`
            ).bind(
              label, row.option1 ?? row.size ?? label, row.option2 ?? null, row.option3 ?? null,
              price, compareAt, sku, image, active, sort || variant.sort, source, externalId, variant.id
            ).run();
          }
          out.variantsUpdated++;
        } else {
          if (!dryRun) {
            const vr = await db.prepare(
              `INSERT INTO variants (product_id, size, option1, option2, option3, price_ngn, compare_at_ngn,
                 sku, image_url, active, sort, external_source, external_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              productId, label, row.option1 ?? row.size ?? label, row.option2 ?? null, row.option3 ?? null,
              price, compareAt, sku, image, active, sort, source, externalId
            ).run();
            variant = { id: vr.meta.last_row_id };
            await db.batch(stores.map((l) =>
              db.prepare("INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, 0) ON CONFLICT(variant_id, location_id) DO NOTHING").bind(variant.id, l)
            ));
          }
          out.variantsCreated++;
        }

        // 4. Stock, when the feed carries it, is set absolutely — the ERP is the
        //    system of record for counts, so this is a set and not a delta.
        const stock = row.stock || row.inventory;
        if (stock && typeof stock === "object" && variant && !dryRun) {
          for (const l of stores) {
            const qty = stock[l];
            if (qty === undefined || qty === null || qty === "") continue;
            await db.prepare(
              `INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, MAX(0, ?))
               ON CONFLICT(variant_id, location_id) DO UPDATE SET qty = MAX(0, excluded.qty)`
            ).bind(variant.id, l, Math.round(Number(qty) || 0)).run();
          }
        }

        // 5. The variation's own gallery. Additive — a sync never deletes shots
        //    curated in the admin.
        const gallery = Array.isArray(row.images) ? row.images : [];
        if (gallery.length && variant && !dryRun) {
          for (const [i, g] of gallery.entries()) {
            const url = String(typeof g === "string" ? g : g.url || "").trim();
            if (!url) continue;
            const seen = await db.prepare("SELECT id FROM product_images WHERE product_id=? AND url=?").bind(productId, url).first();
            if (seen) continue;
            await db.prepare("INSERT INTO product_images (product_id, variant_id, url, alt, sort) VALUES (?, ?, ?, ?, ?)")
              .bind(productId, variant.id, url, String((typeof g === "object" && g.alt) || `${name} — ${label}`), i).run();
          }
        }
      }
    } catch (e) {
      out.skipped += items.length;
      out.errors.push({ parent: parentId, error: String(e.message || e) });
    }
  }

  if (!dryRun) {
    await db.prepare(
      "INSERT INTO catalog_syncs (source, products_created, variants_created, variants_updated, skipped, errors) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      source, out.productsCreated + out.productsAdopted, out.variantsCreated, out.variantsUpdated,
      out.skipped, JSON.stringify(out.errors.slice(0, 50))
    ).run();
  }
  return out;
}

function normaliseOptionNames(v) {
  const arr = Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v.trim()] : [];
  const clean = arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
  return clean.length ? clean : ["Size"];
}

// ---- /api/v1 (REST, read scope) ----
export const v1 = new Hono();
v1.use("*", async (c, next) => {
  const k = await authKey(c.env, c.req, c.executionCtx);
  if (!k) return c.json({ error: "Invalid or missing API key." }, 401);
  c.set("apiKey", k);
  return next();
});
// Writing to the catalogue needs a key issued with the "write" scope.
const requireWrite = async (c, next) => {
  const k = c.get("apiKey");
  if (!k || !String(k.scopes || "").split(/[,\s]+/).includes("write"))
    return c.json({ error: "This key is read-only — issue a key with the write scope to sync the catalogue." }, 403);
  return next();
};

v1.get("/products", async (c) => c.json({ products: await readProducts(c.env) }));

// ERP → storefront catalogue sync. Idempotent on the ERP's own ids; pass
// { dryRun: true } to see what a feed would do before it touches anything.
v1.post("/catalog/sync", requireWrite, async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: "Send a JSON body." }, 400); }
  if (!Array.isArray(body.items)) return c.json({ error: "`items` must be an array of SKU rows." }, 400);
  if (body.items.length > 1000) return c.json({ error: "Send at most 1000 rows per call — page the feed." }, 400);
  return c.json(await syncCatalogue(c.env, body));
});

v1.get("/catalog/syncs", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM catalog_syncs ORDER BY id DESC LIMIT 20").all()).results;
  return c.json({ syncs: rows.map((r) => ({ ...r, errors: JSON.parse(r.errors || "[]") })) });
});
v1.get("/inventory", async (c) => c.json({ inventory: await readInventory(c.env, c.req.query("product")) }));
v1.get("/orders", async (c) => c.json({ orders: await readOrders(c.env, parseInt(c.req.query("limit") || "25", 10)) }));
v1.get("/orders/:no", async (c) => { const o = await readOrder(c.env, c.req.param("no")); return o ? c.json(o) : c.json({ error: "Order not found." }, 404); });
v1.get("/customers", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT id, email, name, phone, city, created_at FROM customers ORDER BY created_at DESC LIMIT 100").all()).results;
  return c.json({ customers: rows });
});

// Reward codes, for a CRM or a loyalty dashboard that wants to see what has
// been issued and what has been spent. Read-only: minting belongs to the admin,
// where there is a person to attribute it to.
v1.get("/rewards", async (c) => {
  const limit = Math.min(500, Math.max(1, parseInt(c.req.query("limit") || "100", 10) || 100));
  const status = c.req.query("status");
  const where = status ? "WHERE status=?" : "";
  const st = c.env.DB.prepare(`SELECT * FROM reward_codes ${where} ORDER BY issued_at DESC LIMIT ${limit}`);
  const rows = (await (status ? st.bind(status) : st).all()).results;
  const today = todayInWAT();
  return c.json({ rewards: rows.map((r) => rewardOut(r, today)) });
});

// ---- MCP tools ----
const TOOLS = [
  { name: "list_products", description: "List the Majestic Roobee catalogue with prices and total stock.", inputSchema: { type: "object", properties: {} } },
  { name: "get_inventory", description: "Per-store stock levels; pass productId to filter.", inputSchema: { type: "object", properties: { productId: { type: "string" } } } },
  { name: "list_orders", description: "Recent orders (most recent first).", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  { name: "get_order", description: "Full details of one order by its number (e.g. MR-10234).", inputSchema: { type: "object", properties: { no: { type: "string" } }, required: ["no"] } },
];

async function callTool(env, name, args = {}) {
  if (name === "list_products") return await readProducts(env);
  if (name === "get_inventory") return await readInventory(env, args.productId);
  if (name === "list_orders") return await readOrders(env, args.limit || 25);
  if (name === "get_order") return await readOrder(env, args.no);
  throw new Error("Unknown tool: " + name);
}

// MCP-compatible JSON-RPC over HTTP (single request/response).
export async function handleMcp(c) {
  const key = await authKey(c.env, c.req, c.executionCtx);
  if (!key) return c.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid or missing API key." } }, 401);
  let msg;
  try { msg = await c.req.json(); } catch { return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  const { id, method, params } = msg || {};
  const ok = (result) => c.json({ jsonrpc: "2.0", id, result });
  const err = (code, message) => c.json({ jsonrpc: "2.0", id, error: { code, message } });

  if (method === "initialize") return ok({ protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "majestic-roobee", version: "1.0.0" } });
  if (method === "notifications/initialized" || method === "notifications/cancelled") return new Response(null, { status: 204 });
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    try {
      const result = await callTool(c.env, params?.name, params?.arguments || {});
      return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
    } catch (e) {
      return ok({ content: [{ type: "text", text: "Error: " + String(e.message || e) }], isError: true });
    }
  }
  return err(-32601, "Method not found: " + method);
}
