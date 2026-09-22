// ERPNext — the pull side of the catalogue link.
//
// See docs/SPRINT-3-PLAN.md §7. The ingest has existed since Sprint 2:
// `syncCatalogue` in worker/integrations.js takes a flat list of SKU rows,
// groups them by parent code into variable products, upserts on the ERP's own
// identifiers so a retry costs nothing, and sets stock *absolutely* because
// the ERP is the system of record for counts. This module is the half that
// was missing: something that calls ERPNext and turns three of its DocTypes
// into that list.
//
// **Why a pull and not a webhook.** ERPNext ships a Webhook DocType and it is
// worth adding later, but webhooks drop — a network blip, a deploy, a Worker
// restart mid-request — and a stock figure that silently drifts is worse than
// one that is fifteen minutes old. The scheduled pull is the reconciler, and
// it is the only transport that also works when ERPNext sits behind an office
// firewall with no inbound path at all.
//
// **The three reads.**
//
//   Item        what exists. `variant_of` is the parent code the sync wants,
//               so an ERPNext Item Variant becomes one of our variations and
//               its template becomes the product.
//   Item Price  what it costs, from one named Price List. An ERP usually
//               carries several — cost, wholesale, retail — and quoting the
//               wrong one on a storefront is a real way to lose money.
//   Bin         what is on the shelf, per warehouse, mapped to our stores
//               through `erp_warehouses`.
//
// **Field ownership.** ERP owns price and stock. The store owns the name,
// the description, the photography, the category and the shelf order — which
// is why the pull sends only what it is authoritative for on an update, and
// the full descriptive row only when creating something we have never seen.
// Otherwise the first sync flattens every piece of merchandising in the admin.

import { getSettings, putSettings, allLocations } from "./util.js";
import { syncCatalogue } from "./integrations.js";

export const ERP_SOURCE = "erpnext";

/** How many rows we ask ERPNext for at a time. Frappe's own cap is 500. */
const PAGE = 200;
/** A hard stop, so a misconfiguration can't walk a 200,000-row catalogue. */
const MAX_PAGES = 40;

const clampPct = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
};

/** The stamp Frappe's `modified` is compared against: UTC, to the second. */
const nowStamp = () => new Date().toISOString().slice(0, 19).replace("T", " ");

/**
 * Everything the connector needs, and whether it has it.
 *
 * The key and secret are Worker secrets (`ERP_API_KEY`, `ERP_API_SECRET`),
 * like `PAYSTACK_SECRET_KEY` — never in the database, never sent to a browser.
 * Everything else is configuration the house owns without a deploy.
 */
export async function erpConfig(env) {
  const s = await getSettings(env.DB);
  const baseUrl = String(s.erpBaseUrl || "").trim().replace(/\/+$/, "");
  const hasKey = !!(env.ERP_API_KEY && env.ERP_API_SECRET);
  return {
    on: String(s.erpOn) === "1",
    baseUrl,
    hasKey,
    // Configured means "we could call it". Enabled means "we should".
    configured: !!baseUrl && hasKey,
    priceList: String(s.erpPriceList || "Standard Selling").trim(),
    publish: String(s.erpPublish) === "1",
    defaultCat: String(s.erpDefaultCat || "perfumes").trim(),
    emptyGuardPct: clampPct(s.erpEmptyGuardPct, 25),
    syncEveryMins: Math.max(15, parseInt(s.erpSyncEveryMins, 10) || 60),
    lastSync: String(s.erpLastSync || "").trim(),
  };
}

/**
 * One call to Frappe's REST API.
 *
 * Auth is a header — `Authorization: token <key>:<secret>` — which is what an
 * ERPNext API key pair is for. No cookie, no session, nothing to expire.
 */
async function erpCall(env, cfg, path, { search = {}, signal } = {}) {
  if (!cfg.configured) throw new Error("ERPNext isn't configured — set the base URL, and the API key and secret as Worker secrets.");
  const url = new URL(cfg.baseUrl + path);
  for (const [k, v] of Object.entries(search)) if (v !== undefined && v !== null) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      authorization: `token ${env.ERP_API_KEY}:${env.ERP_API_SECRET}`,
      accept: "application/json",
    },
    signal,
  });
  const text = await res.text();
  if (!res.ok) {
    // Frappe answers an expired or wrong key with 401/403 and an HTML page, so
    // say what happened rather than handing back a wall of markup.
    const hint = res.status === 401 || res.status === 403
      ? "ERPNext refused the API key — check it is enabled and the integration user has read access."
      : res.status === 404
        ? "ERPNext answered 404 — check the base URL points at the site root, not at a page inside it."
        : `ERPNext answered ${res.status}.`;
    throw new Error(hint);
  }
  let body;
  try { body = JSON.parse(text); } catch { throw new Error("ERPNext answered with something that isn't JSON — is the base URL the site root?"); }
  return body;
}

/** A list read. `fields` and `filters` are Frappe's JSON-in-a-query-param shape. */
async function erpList(env, cfg, doctype, { fields, filters, orderBy, limit = PAGE, start = 0 } = {}) {
  const body = await erpCall(env, cfg, `/api/resource/${encodeURIComponent(doctype)}`, {
    search: {
      fields: JSON.stringify(fields),
      ...(filters && filters.length ? { filters: JSON.stringify(filters) } : {}),
      ...(orderBy ? { order_by: orderBy } : {}),
      limit_page_length: limit,
      limit_start: start,
    },
  });
  return Array.isArray(body.data) ? body.data : [];
}

/** Every page of a list read, to the hard stop. */
async function erpAll(env, cfg, doctype, opts = {}) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await erpList(env, cfg, doctype, { ...opts, start: page * PAGE, limit: PAGE });
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Can we reach it, and who do we look like when we do?
 *
 * The first question of the seven in the plan is "is it reachable from the
 * internet", and this is the button that answers it in five seconds instead of
 * an email thread. It also names the logged-in user, because a key made
 * against Administrator rather than a dedicated integration user is worth
 * noticing before it is in production.
 */
export async function erpPing(env) {
  const cfg = await erpConfig(env);
  if (!cfg.baseUrl) return { ok: false, error: "No base URL — this is the address of the ERPNext site, e.g. https://yourcompany.erpnext.com" };
  if (!cfg.hasKey) return { ok: false, error: "No API key — set ERP_API_KEY and ERP_API_SECRET as Worker secrets (`wrangler secret put ERP_API_KEY`)." };
  const started = Date.now();
  try {
    const who = await erpCall(env, cfg, "/api/method/frappe.auth.get_logged_user");
    const counts = {};
    for (const dt of ["Item", "Item Price", "Bin", "Warehouse"]) {
      try { counts[dt] = (await erpList(env, cfg, dt, { fields: ["name"], limit: 1 })).length ? "readable" : "empty"; }
      catch (e) { counts[dt] = `no access — ${e.message}`; }
    }
    return { ok: true, user: who.message || "?", ms: Date.now() - started, doctypes: counts };
  } catch (e) {
    return { ok: false, error: String(e.message || e), ms: Date.now() - started };
  }
}

/**
 * List the warehouses ERPNext has, and remember them.
 *
 * The house maps each one to a store from a dropdown afterwards. Discovering
 * rather than typing matters: a warehouse name has to match ERPNext's exactly
 * or the stock silently lands nowhere, and "Abuja Branch - MR" is not a string
 * anybody should be retyping from memory.
 */
export async function erpSyncWarehouses(env) {
  const cfg = await erpConfig(env);
  const rows = await erpAll(env, cfg, "Warehouse", {
    fields: ["name", "is_group", "disabled"],
    orderBy: "name asc",
  });
  const db = env.DB;
  for (const w of rows) {
    await db.prepare(
      `INSERT INTO erp_warehouses (warehouse, is_group, disabled, seen_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(warehouse) DO UPDATE SET is_group=excluded.is_group, disabled=excluded.disabled, seen_at=datetime('now')`
    ).bind(w.name, w.is_group ? 1 : 0, w.disabled ? 1 : 0).run();
  }
  return { found: rows.length };
}

/** The same, for item groups → our categories. */
export async function erpSyncItemGroups(env) {
  const cfg = await erpConfig(env);
  const rows = await erpAll(env, cfg, "Item Group", { fields: ["name"], orderBy: "name asc" });
  const db = env.DB;
  for (const g of rows) {
    await db.prepare(
      `INSERT INTO erp_item_groups (item_group, seen_at) VALUES (?, datetime('now'))
       ON CONFLICT(item_group) DO UPDATE SET seen_at=datetime('now')`
    ).bind(g.name).run();
  }
  return { found: rows.length };
}

/** warehouse → our store id, for the warehouses somebody has actually mapped. */
export async function warehouseMap(db) {
  const rows = (await db.prepare("SELECT warehouse, location_id FROM erp_warehouses WHERE location_id IS NOT NULL").all()).results;
  return Object.fromEntries(rows.map((r) => [r.warehouse, r.location_id]));
}

async function itemGroupMap(db) {
  const rows = (await db.prepare("SELECT item_group, cat FROM erp_item_groups WHERE cat IS NOT NULL").all()).results;
  return Object.fromEntries(rows.map((r) => [r.item_group, r.cat]));
}

/**
 * Turn ERPNext's three DocTypes into the flat SKU rows `syncCatalogue` eats.
 *
 * Exported and pure so the shape can be tested without an ERPNext to call.
 *
 * The grouping rule is the whole trick, and ERPNext hands it to us: an Item
 * with `variant_of` set *is* a variation, and the value is its template's
 * item_code — which is exactly the `parentId` the sync groups on. An Item with
 * neither `variant_of` nor `has_variants` is a standalone product, so it
 * becomes its own parent with a single variation under it, which is how a
 * simple item ends up as a one-size listing rather than being dropped.
 */
export function buildFeed({ items, prices, bins, warehouses, groups, defaultCat, known = new Set() }) {
  const priceOf = new Map();
  for (const p of prices || []) {
    const rate = Number(p.price_list_rate);
    if (!p.item_code || !Number.isFinite(rate) || rate <= 0) continue;
    // Several prices for one item in one list means somebody has dated them.
    // The highest `valid_from` that has already started is the current one;
    // absent dates sort first, which is right — an undated price is the
    // standing one.
    const cur = priceOf.get(p.item_code);
    if (!cur || String(p.valid_from || "") > String(cur.valid_from || "")) priceOf.set(p.item_code, p);
  }

  // Stock per item, summed into our stores. ERPNext can hold one item in
  // several warehouses that all map to one shop, so this adds rather than
  // overwrites. `actual_qty` less what is already promised to somebody else:
  // a bottle reserved against an open sales order is not a bottle we can sell.
  const stockOf = new Map();
  for (const b of bins || []) {
    const store = warehouses[b.warehouse];
    if (!store || !b.item_code) continue;
    const free = Math.max(0, Math.round(Number(b.actual_qty || 0) - Number(b.reserved_qty || 0)));
    const cur = stockOf.get(b.item_code) || {};
    cur[store] = (cur[store] || 0) + free;
    stockOf.set(b.item_code, cur);
  }

  const templates = new Map();
  for (const it of items || []) if (it.has_variants) templates.set(it.item_code, it);

  const rows = [];
  const skipped = [];
  for (const it of items || []) {
    if (it.has_variants) continue; // a template is not a thing to sell
    if (it.disabled) continue;     // and neither is a disabled item

    const parentId = String(it.variant_of || it.item_code || "").trim();
    const externalId = String(it.item_code || "").trim();
    if (!externalId) continue;

    const price = priceOf.get(externalId);
    if (!price) { skipped.push({ item: externalId, error: `No price in that price list.` }); continue; }

    const tpl = templates.get(parentId);
    // A variation's label: ERPNext's own attribute values where the read
    // carried them, else the part of the item name the template doesn't
    // account for, else the code. Never empty — the sync refuses a row
    // without one, and rightly.
    const attrs = Array.isArray(it.attributes) ? it.attributes.map((a) => String(a.attribute_value || "").trim()).filter(Boolean) : [];
    const trimmed = tpl && it.item_name && it.item_name.startsWith(tpl.item_name)
      ? it.item_name.slice(tpl.item_name.length).replace(/^[\s\-–—/,]+/, "").trim()
      : "";
    const label = attrs[0] || trimmed || (it.variant_of ? externalId : "One size");

    const row = {
      parentId,
      externalId,
      sku: externalId,
      option1: label,
      ...(attrs[1] ? { option2: attrs[1] } : {}),
      ...(attrs[2] ? { option3: attrs[2] } : {}),
      priceNgn: Math.round(Number(price.price_list_rate)),
      active: true,
    };
    const stock = stockOf.get(externalId);
    // Only send stock for an item we actually read a Bin for. An item with no
    // Bin row anywhere has never been stocked, and sending `{}` is different
    // from sending zeroes — the sync sets what it is given, absolutely.
    if (stock) row.stock = stock;

    // The descriptive fields ride only on the *head* of a group and only for
    // something we have never seen. The ERP owns price and stock; the store
    // owns its own copy and photography, and a sync that resent the ERP's
    // one-line description every quarter hour would erase it every quarter
    // hour. `known` is the set of parent codes already in our catalogue.
    const head = tpl || it;
    if (!known.has(parentId) && !rows.some((r) => r.parentId === parentId)) {
      row.parentName = String(head.item_name || parentId).trim();
      const cat = groups[head.item_group];
      row.category = cat || defaultCat;
      if (!cat && head.item_group) skipped.push({ item: externalId, error: `Item group "${head.item_group}" isn't mapped to a category — filed under "${defaultCat}".`, warning: true });
      const desc = String(head.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (desc) row.description = desc;
      if (head.image) row.imageUrl = String(head.image).trim();
    }
    rows.push(row);
  }
  return { rows, skipped };
}

/**
 * The guard.
 *
 * "Refuse any sync that would zero more than a configured share of the
 * catalogue" is the single most important line in the connector, because the
 * failure it prevents is silent and total: an API key that has expired, a
 * price list renamed, a filter that matches nothing — ERPNext answers `[]`
 * with a 200 and everything looks fine, and the next pull sets every shelf in
 * the shop to zero and the storefront sells nothing until somebody notices.
 *
 * Measured in units rather than rows, because that is what a shopper meets.
 */
export function stockGuard({ before, after, pct }) {
  const total = Object.values(before).reduce((n, q) => n + q, 0);
  if (total <= 0) return { ok: true, before: 0, after: 0, dropPct: 0 };
  // Only the SKUs the feed actually spoke about — a feed that is a partial
  // page is not a feed claiming everything else is gone.
  let was = 0, now = 0;
  for (const [sku, qty] of Object.entries(after)) {
    was += before[sku] || 0;
    now += qty;
  }
  const dropPct = was > 0 ? Math.round(((was - now) / was) * 100) : 0;
  // A drop measured against the *whole* catalogue, so a feed touching three
  // SKUs can't trip the guard by halving three bottles.
  const shareOfAll = total > 0 ? Math.round(((was - now) / total) * 100) : 0;
  return {
    ok: !(was > 0 && now < was && shareOfAll > pct),
    before: was, after: now, dropPct, shareOfAll,
  };
}

/** Units on hand per SKU, for the guard to compare against. */
async function stockBySku(db) {
  const rows = (await db.prepare(
    "SELECT v.sku AS sku, COALESCE(SUM(s.qty), 0) AS qty FROM variants v LEFT JOIN stock s ON s.variant_id = v.id WHERE v.sku IS NOT NULL GROUP BY v.sku"
  ).all()).results;
  return Object.fromEntries(rows.map((r) => [r.sku, r.qty]));
}

/**
 * One pull: read ERPNext, build the feed, check the guard, hand it to the
 * ingest that has been there all along.
 *
 * `full` reads everything; the default reads only what ERPNext says has
 * changed since the last successful run, which is what makes an hourly job
 * cheap. A dry run does every read and every check and writes nothing — the
 * admin's "show me what this would do" button.
 */
export async function erpPull(env, { dryRun = false, full = false } = {}) {
  const started = Date.now();
  const cfg = await erpConfig(env);
  if (!cfg.configured) {
    return { ok: false, error: "ERPNext isn't configured yet.", dryRun };
  }

  const db = env.DB;
  const warehouses = await warehouseMap(db);
  if (!Object.keys(warehouses).length) {
    return {
      ok: false, dryRun,
      error: "No ERPNext warehouse is mapped to a store yet. Until one is, a pull would carry prices with no stock behind them — map them under Integrations → ERPNext.",
    };
  }
  const groups = await itemGroupMap(db);

  // Incremental on `modified`, which Frappe maintains on every DocType. The
  // window overlaps by a minute: two writes in the same second as the last
  // run would otherwise be missed forever, and re-reading a row is free.
  const since = full || !cfg.lastSync ? null : cfg.lastSync;
  const itemFilters = [["Item", "disabled", "=", 0]];
  if (since) itemFilters.push(["Item", "modified", ">", since]);

  let items, prices, bins;
  try {
    items = await erpAll(env, cfg, "Item", {
      fields: ["item_code", "item_name", "variant_of", "has_variants", "item_group", "description", "image", "disabled", "modified"],
      filters: itemFilters,
      orderBy: "modified asc",
    });
    // An incremental read of Items misses a *price* or a *stock* change on an
    // item that hasn't itself been edited — which is most of them. So those
    // two are read on their own modified stamp as well, and the union of the
    // three is what gets rebuilt.
    const priceFilters = [["Item Price", "price_list", "=", cfg.priceList], ["Item Price", "selling", "=", 1]];
    if (since) priceFilters.push(["Item Price", "modified", ">", since]);
    prices = await erpAll(env, cfg, "Item Price", {
      fields: ["item_code", "price_list_rate", "valid_from", "modified"],
      filters: priceFilters,
    });
    const binFilters = [["Bin", "warehouse", "in", Object.keys(warehouses)]];
    if (since) binFilters.push(["Bin", "modified", ">", since]);
    bins = await erpAll(env, cfg, "Bin", {
      fields: ["item_code", "warehouse", "actual_qty", "reserved_qty", "modified"],
      filters: binFilters,
    });
  } catch (e) {
    await logSync(db, { ok: 0, note: String(e.message || e), ms: Date.now() - started, dryRun });
    return { ok: false, dryRun, error: String(e.message || e) };
  }

  // An incremental run turns up a price or a stock row for an item the Item
  // read didn't return, because the item itself hasn't changed. Fetch those
  // items by code so the row has something to attach to.
  const touched = new Set([...prices.map((p) => p.item_code), ...bins.map((b) => b.item_code)].filter(Boolean));
  for (const it of items) touched.delete(it.item_code);
  if (touched.size) {
    const codes = [...touched].slice(0, PAGE * 4);
    try {
      const extra = await erpAll(env, cfg, "Item", {
        fields: ["item_code", "item_name", "variant_of", "has_variants", "item_group", "description", "image", "disabled", "modified"],
        filters: [["Item", "item_code", "in", codes]],
      });
      items = items.concat(extra);
    } catch { /* the pull is still valid without them; they come next run */ }
  }

  // Templates of the variations we are about to write, so a variation whose
  // template hasn't changed still gets its name and category on first sight.
  const parents = new Set(items.map((i) => String(i.variant_of || "").trim()).filter(Boolean));
  for (const i of items) parents.delete(i.item_code);
  if (parents.size) {
    try {
      const tpls = await erpAll(env, cfg, "Item", {
        fields: ["item_code", "item_name", "variant_of", "has_variants", "item_group", "description", "image", "disabled", "modified"],
        filters: [["Item", "item_code", "in", [...parents].slice(0, PAGE * 2)]],
      });
      items = items.concat(tpls);
    } catch { /* as above */ }
  }

  // Prices are needed for every item in the run, not only the ones whose price
  // changed — an item edited in ERPNext arrives with no price row beside it
  // and would be skipped as "no price". Read the rest by code.
  const needPrice = items.filter((i) => !i.has_variants && !i.disabled).map((i) => i.item_code)
    .filter((code) => !prices.some((p) => p.item_code === code));
  if (needPrice.length) {
    try {
      const extra = await erpAll(env, cfg, "Item Price", {
        fields: ["item_code", "price_list_rate", "valid_from", "modified"],
        filters: [["Item Price", "price_list", "=", cfg.priceList], ["Item Price", "selling", "=", 1], ["Item Price", "item_code", "in", needPrice.slice(0, PAGE * 4)]],
      });
      prices = prices.concat(extra);
    } catch { /* as above */ }
  }

  const known = new Set((await db.prepare("SELECT external_id FROM products WHERE external_source=?").bind(ERP_SOURCE).all())
    .results.map((r) => r.external_id));

  const { rows, skipped } = buildFeed({
    items, prices, bins, warehouses, groups, defaultCat: cfg.defaultCat, known,
  });

  if (!rows.length) {
    const note = since
      ? "Nothing has changed in ERPNext since the last pull."
      : "ERPNext returned nothing at all. Check the price list name and that the integration user can read Item, Item Price and Bin.";
    // An empty *full* read is the failure the guard exists for, so it is not
    // recorded as a success even though nothing went wrong mechanically.
    await logSync(db, { ok: since ? 1 : 0, note, ms: Date.now() - started, dryRun });
    if (!dryRun && since) await putSettings(db, { erpLastSync: nowStamp() });
    return { ok: !!since, dryRun, note, rows: 0 };
  }

  // The guard, on what the feed says about stock versus what is on the shelf.
  const before = await stockBySku(db);
  const after = {};
  for (const r of rows) {
    if (!r.stock) continue;
    after[r.sku] = Object.values(r.stock).reduce((n, q) => n + q, 0);
  }
  const guard = stockGuard({ before, after, pct: cfg.emptyGuardPct });
  if (!guard.ok) {
    const note = `Refused: this pull would cut catalogue stock by ${guard.shareOfAll}% (${guard.before} units to ${guard.after}), past the ${cfg.emptyGuardPct}% guard. Nothing was changed. If the drop is real, raise the guard or run it from the admin once.`;
    await logSync(db, { ok: 0, note, ms: Date.now() - started, dryRun });
    return { ok: false, dryRun, error: note, guard };
  }

  const result = await syncCatalogue(env, {
    source: ERP_SOURCE,
    items: rows,
    dryRun,
    publish: cfg.publish,
  });
  // syncCatalogue writes its own row for a real run; a dry run writes none, so
  // the pull's own line is what the admin reads either way.
  const ms = Date.now() - started;
  const warnings = skipped.filter((x) => x.warning);
  const errors = skipped.filter((x) => !x.warning);
  await logSync(db, {
    ok: 1, ms, dryRun,
    note: `${dryRun ? "Dry run: " : ""}${rows.length} SKU${rows.length === 1 ? "" : "s"} read${errors.length ? `, ${errors.length} skipped` : ""}${guard.before !== guard.after ? `, stock ${guard.before}→${guard.after} units` : ""}.`,
  });
  if (!dryRun) await putSettings(db, { erpLastSync: nowStamp() });

  return {
    ok: true, dryRun, rows: rows.length, guard,
    warehouses: Object.keys(warehouses).length,
    incremental: !!since,
    ...result,
    warnings: warnings.slice(0, 20),
    readErrors: errors.slice(0, 20),
    ms,
  };
}

async function logSync(db, { ok, note, ms, dryRun }) {
  await db.prepare(
    `INSERT INTO catalog_syncs (source, products_created, variants_created, variants_updated, skipped, errors, direction, ms, ok, note)
     VALUES (?, 0, 0, 0, 0, '[]', ?, ?, ?, ?)`
  ).bind(ERP_SOURCE, dryRun ? "pull (dry run)" : "pull", ms, ok, String(note || "").slice(0, 500)).run();
}

/**
 * The cron's hook.
 *
 * The scheduled run fires every 15 minutes with everything else; this decides
 * whether it is this cadence's turn, so the house can ask for hourly without
 * anyone editing wrangler.jsonc. Never throws — a failed pull is a row in the
 * sync log, not a cron that stops sweeping stock.
 */
export async function runErpPull(env) {
  const cfg = await erpConfig(env);
  if (!cfg.on || !cfg.configured) return { skipped: "off" };
  if (cfg.lastSync) {
    const lastMs = Date.parse(cfg.lastSync.replace(" ", "T") + "Z");
    if (Number.isFinite(lastMs) && Date.now() - lastMs < cfg.syncEveryMins * 60_000) return { skipped: "too soon" };
  }
  try { return await erpPull(env, {}); } catch (e) {
    console.error("erp pull failed", e);
    return { ok: false, error: String(e.message || e) };
  }
}

/** What the admin screen draws. */
export async function erpStatus(env) {
  const cfg = await erpConfig(env);
  const db = env.DB;
  const warehouses = (await db.prepare("SELECT * FROM erp_warehouses ORDER BY warehouse").all()).results
    .map((r) => ({ warehouse: r.warehouse, locationId: r.location_id, isGroup: !!r.is_group, disabled: !!r.disabled }));
  const itemGroups = (await db.prepare("SELECT * FROM erp_item_groups ORDER BY item_group").all()).results
    .map((r) => ({ itemGroup: r.item_group, cat: r.cat }));
  const syncs = (await db.prepare("SELECT * FROM catalog_syncs WHERE source=? ORDER BY id DESC LIMIT 12").bind(ERP_SOURCE).all()).results
    .map((r) => ({ id: r.id, at: r.at, direction: r.direction, ms: r.ms, ok: !!r.ok, note: r.note, variantsCreated: r.variants_created, variantsUpdated: r.variants_updated }));
  const owned = await db.prepare("SELECT COUNT(*) AS n FROM variants WHERE external_source=?").bind(ERP_SOURCE).first();
  return {
    config: {
      on: cfg.on, baseUrl: cfg.baseUrl, hasKey: cfg.hasKey, configured: cfg.configured,
      priceList: cfg.priceList, publish: cfg.publish, defaultCat: cfg.defaultCat,
      emptyGuardPct: cfg.emptyGuardPct, syncEveryMins: cfg.syncEveryMins, lastSync: cfg.lastSync,
    },
    stores: (await allLocations(db)).map((l) => ({ id: l.id, city: l.city })),
    warehouses, itemGroups, syncs,
    linkedVariants: owned ? owned.n : 0,
  };
}
