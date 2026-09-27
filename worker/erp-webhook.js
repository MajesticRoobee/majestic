// The ERP link — the push half.
//
// The pull (worker/erp.js) calls ERPRev on a schedule and is the reconciler:
// it is what makes the shop's stock *agree* with the ERP's. This is the other
// transport, the one that makes it agree *now*. ERPRev ships outgoing webhooks
// with a delivery log; pointed at `POST /api/erp/webhook`, every stock move and
// price change in the ERP lands on the shop's shelf within seconds rather than
// at the next scheduled pull.
//
// It also does something the pull cannot yet: it works without ERPRev's
// request signing. The pull has to sign every call it makes, and the exact
// bytes ERPRev wants are on a documentation page this project has never seen —
// the live ERP refused every shape tried. A webhook is ERPRev calling *us*, so
// the only secret involved is one the house copies out of ERPRev's webhook
// screen, and there are two ways of proving it (below). That makes this the
// shortest road from "not connected" to "Abuja's shelf follows the ERP".
//
// What it will and will not do:
//
//   · stock is set **absolutely** at the shop the ERP location maps to — the
//     ERP is the system of record for counts, exactly as in the pull
//   · a price is taken from a product event; names, copy, photographs and
//     categories are the shop's and are only written for an item it has never
//     seen (new items land as drafts unless the house says otherwise)
//   · an event older than the last one applied for the same SKU and shop is
//     ignored, so a delayed retry can never put back a count the ERP has
//     already moved past
//   · anything it cannot read is logged, never guessed at, and answered 200 so
//     ERPRev does not retry a payload that will never parse

import { getSettings, allLocations } from "./util.js";
import { syncCatalogue } from "./integrations.js";
import { erpConfig, buildFeed, warehouseMap, effectiveWarehouseMap, ERP_SOURCE, runErpPull, matchToShop, shopVariants, applyToShop } from "./erp.js";
import { hmacHex } from "./erp-adapters.js";

/** ERPRev's signed timestamps must be within this many seconds of ours. */
const SKEW_SECONDS = 300;
/** A payload bigger than this is not a stock event. */
const MAX_ROWS = 500;

// ---- proof that it was ERPRev ------------------------------------------------

// The header names a webhook signature commonly travels in, likeliest first.
// ERPRev's own is not in any page we have, so every one is read and the first
// present is used; which one it was is written to the log, so the house can see.
export const SIGNATURE_HEADERS = [
  "x-erprev-signature", "x-webhook-signature", "x-signature", "x-hub-signature-256",
  "erprev-signature", "webhook-signature", "signature",
];

const hexToBytes = (h) => {
  const s = String(h || "").trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(s) || s.length % 2) return null;
  return Uint8Array.from(s.match(/../g).map((b) => parseInt(b, 16)));
};

/** Constant-time compare of two hex strings (case-insensitive). */
export function sameHex(a, b) {
  const x = hexToBytes(a), y = hexToBytes(b);
  if (!x || !y || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const b64ToHex = (s) => {
  try {
    const bin = atob(String(s).trim());
    return [...bin].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
};

/**
 * Is this delivery genuinely from the ERP?
 *
 * Two ways to prove it, because two kinds of webhook screen exist:
 *
 *   1. **A signature header** — HMAC-SHA256 with the webhook secret. Accepted
 *      as `t=<unix>,v1=<hex>` over `<t>.<body>` (the shape ERPRev documents for
 *      its webhooks, and Stripe's), or as a bare `<hex>` / `sha256=<hex>` /
 *      base64 digest over the body alone. A `t=` older or newer than five
 *      minutes is refused, so a captured delivery cannot be replayed.
 *   2. **The secret in the URL** — `?token=<secret>`, for a webhook screen that
 *      lets you type a URL but not choose headers. Weaker than a signature (it
 *      rides every request) but over HTTPS it is what most SME systems offer.
 *
 * No secret configured means nothing is accepted: an open endpoint that sets
 * stock would let anybody on the internet empty the shop.
 */
export async function verifyDelivery({ secret, raw, headers = {}, query = {}, now = Date.now() }) {
  if (!secret) return { ok: false, status: 503, why: "ERP_WEBHOOK_SECRET isn't set, so no delivery can be trusted." };
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v || "")]));

  for (const name of SIGNATURE_HEADERS) {
    const value = h[name];
    if (!value) continue;
    const parts = Object.fromEntries(value.split(",").map((p) => p.trim().split("=")).filter((kv) => kv.length === 2));
    if (parts.t && (parts.v1 || parts.s || parts.sig)) {
      const t = parseInt(parts.t, 10);
      if (!Number.isFinite(t)) return { ok: false, status: 401, why: `The ${name} header's timestamp isn't a number.` };
      const skew = Math.abs(Math.floor(now / 1000) - t);
      if (skew > SKEW_SECONDS) return { ok: false, status: 401, why: `Signed ${skew}s away from our clock — outside the ${SKEW_SECONDS}s window.` };
      const want = await hmacHex(secret, `${t}.${raw}`);
      return sameHex(want, parts.v1 || parts.s || parts.sig)
        ? { ok: true, how: `${name} (t=,v1=)`, at: t * 1000 }
        : { ok: false, status: 401, why: `The ${name} signature doesn't match — check the webhook secret.` };
    }
    const digest = value.replace(/^sha256=/i, "").trim();
    const want = await hmacHex(secret, raw);
    const given = /^[0-9a-f]+$/i.test(digest) ? digest : b64ToHex(digest);
    return sameHex(want, given)
      ? { ok: true, how: name }
      : { ok: false, status: 401, why: `The ${name} signature doesn't match — check the webhook secret.` };
  }

  const token = String(query.token || query.key || query.secret || "");
  if (token) {
    // Compared as digests, so the comparison takes the same time whatever the
    // length or content of the guess.
    const [a, b] = await Promise.all([hmacHex("erp-webhook", token), hmacHex("erp-webhook", secret)]);
    return sameHex(a, b)
      ? { ok: true, how: "?token=" }
      : { ok: false, status: 401, why: "The token on the webhook URL is wrong." };
  }
  return { ok: false, status: 401, why: "No signature header and no ?token= on the URL — nothing to check the delivery against." };
}

// ---- what the ERP sent -------------------------------------------------------

const firstOf = (o, keys) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
};

/**
 * The event name, and the records it carries, from whatever envelope the ERP
 * uses — `{event, data}`, `{type, payload}`, `{topic, data:{object}}`, a bare
 * record or a bare array. Nested stock lists on a product (`stocks`,
 * `stock_levels`, `inventory`) come out as stock records carrying the
 * product's id, because that is what they mean.
 */
export function readEnvelope(body) {
  if (!body || typeof body !== "object") return { event: "", id: "", records: [], at: 0 };
  const b = body;
  const event = String(firstOf(b, ["event", "type", "topic", "event_type", "eventType", "action"]) || "").toLowerCase();
  const id = String(firstOf(b, ["id", "event_id", "eventId", "delivery_id", "deliveryId", "uuid"]) || "");
  let data = Array.isArray(body) ? body : firstOf(b, ["data", "payload", "object", "record", "records", "items", "resource"]);
  if (data && !Array.isArray(data) && typeof data === "object" && data.object && typeof data.object === "object") data = data.object;
  if (data === undefined && !Array.isArray(body)) data = b;
  const records = (Array.isArray(data) ? data : [data]).filter((r) => r && typeof r === "object").slice(0, MAX_ROWS);
  const at = Date.parse(String(firstOf(b, ["occurred_at", "created_at", "timestamp", "sent_at", "time"]) || "")) || 0;
  return { event, id, records, at };
}

const STOCK_LISTS = ["stocks", "stock_levels", "stockLevels", "inventory", "warehouses_stock", "locations"];
const looksLikeStock = (r) =>
  ["warehouse_id", "warehouseId", "location_id", "locationId", "warehouse", "branch_id"].some((k) => r[k] !== undefined) &&
  ["quantity", "qty", "on_hand", "onHand", "actual_qty", "available", "available_qty", "stock", "balance"].some((k) => r[k] !== undefined);

/** Split a delivery's records into stock rows and product rows. */
export function classify(event, records) {
  const stock = [];
  const products = [];
  for (const r of records) {
    const nested = STOCK_LISTS.map((k) => r[k]).find(Array.isArray);
    if (nested) {
      // A product carrying its own per-location stock. The nested rows are the
      // stock; the record itself is only a product — counting its total as
      // well would add the same bottles twice.
      const pid = firstOf(r, ["id", "product_id", "sku", "code"]);
      for (const s of nested) if (s && typeof s === "object") stock.push({ product_id: pid, ...s });
      if (firstOf(r, ["price", "selling_price", "name"]) !== undefined) products.push(r);
      continue;
    }
    if (/stock|inventory|quantity/.test(event) || (looksLikeStock(r) && !/product/.test(event))) stock.push(r);
    else products.push(r);
  }
  return { stock, products };
}

// ---- where a location's stock goes --------------------------------------------

/**
 * Our shop for an ERP location.
 *
 * The mapped shop, always, where the house has mapped one. Past that, the
 * default shop (Abuja, unless changed) — but **only** when that cannot be the
 * Lagos-bottles-on-Abuja's-shelf mistake:
 *
 *   · the row names no location at all (an ERP with one store often doesn't),
 *     or
 *   · the ERP has only ever shown us one location, so there is no other shop
 *     its stock could belong to.
 *
 * With two or more ERP locations known and this one unmapped, it is not
 * counted, exactly as in the pull.
 */
export function shopFor(warehouse, { map, defaultShop, knownLocations }) {
  const key = String(warehouse || "").trim();
  if (key && map[key]) return map[key];
  if (!defaultShop) return null;
  if (!key) return defaultShop;
  const others = knownLocations.filter((w) => w !== key);
  return others.length === 0 ? defaultShop : null;
}

// ---- applying it -------------------------------------------------------------

async function log(db, { deliveryId, event, ok, how, applied, note }) {
  try {
    await db.prepare(
      `INSERT INTO erp_webhook_events (delivery_id, event, ok, auth, applied, note) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(deliveryId || null, event || "", ok ? 1 : 0, how || "", applied || 0, String(note || "").slice(0, 500)).run();
  } catch { /* a duplicate delivery id: already logged the first time */ }
}

/**
 * Apply one verified delivery. Exported for the tests, which drive it with the
 * shapes an ERP actually sends.
 */
export async function applyDelivery(env, body, { at = 0, ctx = null } = {}) {
  const db = env.DB;
  const cfg = await erpConfig(env);
  const settings = await getSettings(db);
  const { event, records, at: bodyAt } = readEnvelope(body);
  const when = at || bodyAt || Date.now();
  const { stock, products } = classify(event, records);
  const stores = new Set((await allLocations(db)).map((l) => l.id));
  const defaultShop = stores.has(String(settings.erpDefaultShop ?? "abuja")) ? String(settings.erpDefaultShop ?? "abuja") : "";
  const map = await warehouseMap(db);
  const knownLocations = (await db.prepare("SELECT warehouse FROM erp_warehouses").all()).results.map((r) => r.warehouse);
  const result = { event, stockApplied: 0, stockSkipped: [], productsCreated: 0, productsUpdated: 0, deactivated: 0, unknown: [] };

  // 1. Products: a price change, a new product, or one taken off sale.
  const removed = /delet|archiv|disabl|deactiv/.test(event);
  const normalised = products.map((r) => cfg.adapter.normalise.product(r, cfg.fields)).filter((p) => p.code);
  if (removed) {
    for (const p of normalised) {
      const r = await db.prepare("UPDATE variants SET active=0 WHERE external_source=? AND external_id=?").bind(ERP_SOURCE, p.code).run();
      result.deactivated += (r.meta && r.meta.changes) || 0;
    }
  } else if (normalised.length) {
    // The shop's own sizes first — exactly as the pull recognises them — so a
    // price change lands on the product the shop already sells, keeping its
    // SKU, size, photographs and copy, rather than on a duplicate.
    const match = matchToShop(normalised, await shopVariants(db));
    const updates = [...match.matched].map(([code, m]) => {
      const p = normalised.find((x) => String(x.code) === code);
      return { variantId: m.variant.id, code, price: p ? p.inlinePrice : 0 };
    });
    if (updates.length) { await applyToShop(db, updates); result.productsUpdated += updates.length; }
    for (const a of match.ambiguous) result.unknown.push(`${a.name}: ${a.why} — not linked.`);
    const fresh = match.unmatched;
    if (fresh.length && !cfg.importNew) {
      result.unknown.push(`${fresh.length} item${fresh.length === 1 ? " isn't" : "s aren't"} in the shop, and bringing in new ERP items is off.`);
    }
    const known = new Set((await db.prepare("SELECT external_id FROM products WHERE external_source=?").bind(ERP_SOURCE).all())
      .results.map((r) => r.external_id));
    const groups = Object.fromEntries((await db.prepare("SELECT item_group, cat FROM erp_item_groups WHERE cat IS NOT NULL").all())
      .results.map((r) => [r.item_group, r.cat]));
    // Inline stock on a product row goes to the default shop only when that
    // is unambiguous — the same rule the pull uses.
    const whMap = await effectiveWarehouseMap(db, defaultShop);
    const { rows, skipped } = cfg.importNew && fresh.length
      ? buildFeed({ products: fresh, warehouses: whMap, groups, defaultCat: cfg.defaultCat, known, groupUnits: false })
      : { rows: [], skipped: [] };
    if (rows.length) {
      const r = await syncCatalogue(env, { source: ERP_SOURCE, items: rows, publish: cfg.publish });
      result.productsCreated = r.productsCreated;
      result.productsUpdated += r.variantsUpdated;
      if (r.errors.length) result.unknown.push(...r.errors.map((e) => e.error));
    }
    for (const s of skipped) if (!s.warning) result.unknown.push(`${s.item}: ${s.error}`);
  }

  // 2. Stock: per SKU and shop, summed across ERP locations that map to the
  //    same shop, set absolutely.
  const sums = new Map();
  for (const raw of stock) {
    const s = cfg.adapter.normalise.stock(raw, cfg.fields);
    if (!s.code) { result.stockSkipped.push("A stock row with no product id."); continue; }
    if (s.warehouse && !knownLocations.includes(s.warehouse)) {
      // Remember it, so it appears in the admin's location map to be assigned.
      await db.prepare(
        `INSERT INTO erp_warehouses (warehouse, label, seen_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(warehouse) DO UPDATE SET seen_at=datetime('now')`
      ).bind(s.warehouse, String(firstOf(raw, ["warehouse_name", "location_name", "branch_name"]) || s.warehouse)).run();
      knownLocations.push(s.warehouse);
    }
    const shop = shopFor(s.warehouse, { map, defaultShop, knownLocations });
    if (shop && s.warehouse && !map[s.warehouse]) {
      // Defaulted because it is the only location the ERP has shown us. Write
      // that down, so it stays this shop's when a second location turns up —
      // otherwise the shelf would silently stop following the ERP the moment
      // somebody added a warehouse.
      await db.prepare("UPDATE erp_warehouses SET location_id=? WHERE warehouse=? AND location_id IS NULL").bind(shop, s.warehouse).run();
      map[s.warehouse] = shop;
    }
    if (!shop) { result.stockSkipped.push(`Location "${s.warehouse}" isn't mapped to a shop, so it wasn't counted.`); continue; }
    const k = `${s.code}\u0000${shop}`;
    const cur = sums.get(k) || { code: s.code, shop, qty: 0 };
    cur.qty += Math.max(0, Math.round(s.onHand - s.reserved));
    sums.set(k, cur);
  }
  for (const { code, shop, qty } of sums.values()) {
    const variants = (await db.prepare("SELECT id, sku FROM variants WHERE external_source=? AND external_id=?").bind(ERP_SOURCE, code).all()).results;
    if (!variants.length) { result.unknown.push(`Product ${code} isn't linked to a shop product yet — the next pull will match it.`); continue; }
    for (const v of variants) {
      // Never let an older event overwrite a newer count.
      const mark = await db.prepare("SELECT at_ms FROM erp_stock_marks WHERE variant_id=? AND location_id=?").bind(v.id, shop).first();
      if (mark && mark.at_ms > when) { result.stockSkipped.push(`${v.sku}: an older event than one already applied.`); continue; }
      await db.batch([
        db.prepare(
          `INSERT INTO stock (variant_id, location_id, qty) VALUES (?, ?, ?)
           ON CONFLICT(variant_id, location_id) DO UPDATE SET qty = excluded.qty`
        ).bind(v.id, shop, qty),
        db.prepare(
          `INSERT INTO erp_stock_marks (variant_id, location_id, at_ms) VALUES (?, ?, ?)
           ON CONFLICT(variant_id, location_id) DO UPDATE SET at_ms = excluded.at_ms`
        ).bind(v.id, shop, when),
      ]);
      result.stockApplied++;
    }
  }

  // Something the ERP knows and the shop does not: ask the pull to catch up,
  // after the response has gone, if the pull is set up to run at all.
  if (result.unknown.some((u) => /isn't linked to a shop product yet/.test(u)) && ctx && ctx.waitUntil) {
    ctx.waitUntil(runErpPull(env).catch(() => {}));
  }
  return result;
}

/**
 * The route. Always answers quickly: ERPRev's delivery log shows the status,
 * and a 200 with a note for a payload it could not use stops a pointless
 * retry storm, while a 401 for a bad signature is the one answer that should
 * make somebody look.
 */
export async function handleErpWebhook(env, { raw, headers, query, ctx }) {
  const db = env.DB;
  const v = await verifyDelivery({ secret: env.ERP_WEBHOOK_SECRET, raw, headers, query });
  let body = null;
  try { body = JSON.parse(raw || "null"); } catch { /* reported below */ }
  const { event, id } = readEnvelope(body);
  const deliveryId = String(headers["x-erprev-delivery"] || headers["x-webhook-id"] || headers["x-delivery-id"] || id || "");

  if (!v.ok) {
    await log(db, { deliveryId: null, event, ok: false, how: "", note: v.why });
    return { status: v.status, json: { ok: false, error: v.why } };
  }
  if (!body || typeof body !== "object") {
    await log(db, { deliveryId, event, ok: false, how: v.how, note: "The body isn't JSON." });
    return { status: 200, json: { ok: false, error: "The body isn't JSON." } };
  }
  if (deliveryId) {
    const seen = await db.prepare("SELECT id FROM erp_webhook_events WHERE delivery_id=?").bind(deliveryId).first();
    if (seen) return { status: 200, json: { ok: true, duplicate: true } };
  }
  try {
    const r = await applyDelivery(env, body, { at: v.at || 0, ctx });
    const note = [
      r.stockApplied ? `${r.stockApplied} stock level${r.stockApplied === 1 ? "" : "s"} set` : "",
      r.productsCreated ? `${r.productsCreated} new product${r.productsCreated === 1 ? "" : "s"} (drafts unless publishing is on)` : "",
      r.productsUpdated ? `${r.productsUpdated} price${r.productsUpdated === 1 ? "" : "s"} updated` : "",
      r.deactivated ? `${r.deactivated} taken off sale` : "",
      ...r.stockSkipped.slice(0, 3), ...r.unknown.slice(0, 3),
    ].filter(Boolean).join(" · ") || "Nothing in it the shop could use.";
    await log(db, { deliveryId, event, ok: true, how: v.how, applied: r.stockApplied + r.productsCreated + r.productsUpdated + r.deactivated, note });
    return { status: 200, json: { ok: true, ...r } };
  } catch (e) {
    await log(db, { deliveryId, event, ok: false, how: v.how, note: String(e.message || e) });
    // A 500 asks ERPRev to retry, which is right for a failure on our side.
    return { status: 500, json: { ok: false, error: "Couldn't apply it — it will be retried." } };
  }
}

/** For the admin: the address to paste, whether it can be trusted yet, and the recent deliveries. */
export async function webhookStatus(env, origin) {
  const rows = (await env.DB.prepare("SELECT * FROM erp_webhook_events ORDER BY id DESC LIMIT 15").all()).results;
  return {
    url: `${origin}/api/erp/webhook`,
    hasSecret: !!env.ERP_WEBHOOK_SECRET,
    recent: rows.map((r) => ({ id: r.id, at: r.received_at, event: r.event, ok: !!r.ok, auth: r.auth, applied: r.applied, note: r.note })),
  };
}
