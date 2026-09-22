// The ERP link — the engine.
//
// See docs/SPRINT-3-PLAN.md §7. The ingest half has existed since Sprint 2:
// `syncCatalogue` in worker/integrations.js takes a flat list of SKU rows,
// groups them by parent code into variable products, upserts on the ERP's own
// identifiers so a retry costs nothing, and sets stock *absolutely* because
// the ERP is the system of record for counts. This module is the half that
// was missing: something that calls the ERP and turns what it says into that
// list.
//
// **Nothing here knows which ERP it is talking to.** The vendor lives in
// worker/erp-adapters.js, behind four neutral shapes — product, price, stock,
// warehouse. That boundary was drawn after the first version of this connector
// was written against ERPNext on the strength of a planning document's guess
// that "ERPrev" meant ERPNext. It doesn't: the house runs ERPRevolution, a
// different product from a different company. Everything below survived that
// correction unchanged, and that is the point of the split.
//
// **Why a pull and not a webhook.** Webhooks drop — a network blip, a deploy,
// a Worker restart mid-request — and a stock figure that silently drifts is
// worse than one that is fifteen minutes old. The scheduled pull is the
// reconciler, and it is the only transport that also works when the ERP sits
// behind an office firewall with no inbound path at all.
//
// **Field ownership.** The ERP owns price and stock. The store owns the name,
// the description, the photography, the category and the shelf order — which
// is why the pull sends only what it is authoritative for on an update, and
// the full descriptive row only when creating something we have never seen.
// Otherwise the first sync flattens every piece of merchandising in the admin,
// and the next one does it again an hour later.

import { getSettings, putSettings, allLocations } from "./util.js";
import { syncCatalogue } from "./integrations.js";
import {
  adapterFor, adapterList, authFor, signedHeaders, pageQuery, unwrap,
  AUTH_STYLES, PAGE_STYLES, ALIASES, SIGNING_DEFAULTS,
} from "./erp-adapters.js";

/**
 * The tag written into `products.external_source` and `variants.external_source`.
 *
 * Deliberately **not** the vendor's name. Upserts key on (source, externalId),
 * so if this said "erpnext" and the house turned out to be on ERPRev — which
 * is exactly what happened — then correcting the vendor would orphan every
 * link and re-import the whole catalogue as duplicates. One store has one ERP;
 * the tag says so and nothing more.
 */
export const ERP_SOURCE = "erp";

/** How many rows we ask for at a time. */
const PAGE = 200;
/** A hard stop, so a misconfiguration can't walk a 200,000-row catalogue. */
const MAX_PAGES = 40;

const clampPct = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback;
};

/** The stamp an incremental read is compared against: UTC, to the second. */
const nowStamp = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const parseJson = (v, fallback) => {
  if (v && typeof v === "object") return v;
  try { const o = JSON.parse(String(v || "")); return o && typeof o === "object" ? o : fallback; }
  catch { return fallback; }
};

/**
 * Everything the connector needs, and whether it has it.
 *
 * The key and secret are Worker secrets (`ERP_API_KEY`, `ERP_API_SECRET`),
 * like `PAYSTACK_SECRET_KEY` — never in the database, never sent to a browser.
 * Everything else is configuration the house owns without a deploy, which is
 * what makes pointing this at a different ERP a screen rather than a release.
 */
export async function erpConfig(env) {
  const s = await getSettings(env.DB);
  const adapter = adapterFor(s.erpVendor);
  const baseUrl = String(s.erpBaseUrl || "").trim().replace(/\/+$/, "");
  const hasKey = !!(env.ERP_API_KEY || env.ERP_API_SECRET);
  const paths = { ...adapter.defaults.paths, ...parseJson(s.erpPaths, {}) };
  return {
    adapter,
    vendor: adapter.id,
    on: String(s.erpOn) === "1",
    baseUrl,
    hasKey,
    // Configured means "we could call it". Enabled means "we should".
    configured: !!baseUrl && hasKey && !!paths.products,
    authStyle: AUTH_STYLES[s.erpAuthStyle] ? s.erpAuthStyle : adapter.defaults.authStyle,
    pageStyle: PAGE_STYLES[s.erpPageStyle] ? s.erpPageStyle : adapter.defaults.pageStyle,
    paths,
    // Per-field overrides for an ERP whose spelling isn't on the alias list.
    fields: parseJson(s.erpFields, {}),
    // Where the array sits in the response, when it isn't somewhere obvious.
    envelopeKey: String(s.erpEnvelopeKey || "").trim() || adapter.defaults.envelopeKey || "",
    // Where the next page's cursor sits, for a cursor-paged API.
    cursorKey: String(s.erpCursorKey || "").trim() || adapter.defaults.cursorKey || "",
    // Reachability with no credentials, and the API's own published spec.
    pingPath: String(s.erpPingPath || "").trim() || adapter.defaults.pingPath || "",
    specPath: adapter.defaults.specPath || "",
    pageSize: Math.max(1, Math.min(200, parseInt(s.erpPageSize, 10) || adapter.defaults.pageSize || PAGE)),
    // The signing contract, defaulted to what the vendor documents.
    signing: { ...SIGNING_DEFAULTS, ...parseJson(s.erpSigning, {}) },
    priceList: String(s.erpPriceList || "").trim(),
    publish: String(s.erpPublish) === "1",
    defaultCat: String(s.erpDefaultCat || "perfumes").trim(),
    // See `groupByUnit`. Off unless the house asks for it.
    groupUnits: String(s.erpGroupUnits) === "1",
    emptyGuardPct: clampPct(s.erpEmptyGuardPct, 25),
    syncEveryMins: Math.max(15, parseInt(s.erpSyncEveryMins, 10) || 60),
    lastSync: String(s.erpLastSync || "").trim(),
  };
}

/**
 * One call to the ERP.
 *
 * Frappe wants its fields and filters as JSON in the query string and its
 * DocTypes named with spaces; everything else takes a plain path and a page
 * parameter. That is the only dialect difference big enough to live here
 * rather than in the adapter.
 */
async function erpCall(env, cfg, path, { search = {}, anonymous = false } = {}) {
  if (!cfg.baseUrl) throw new Error("No base URL for the ERP yet.");
  if (!anonymous && !cfg.hasKey) throw new Error("No API credentials — set ERP_API_KEY and ERP_API_SECRET as Worker secrets.");
  const auth = anonymous ? { headers: {}, query: {} } : authFor(cfg.authStyle, env.ERP_API_KEY, env.ERP_API_SECRET);
  let url;
  try {
    url = new URL(cfg.baseUrl + (path.startsWith("/") ? path : `/${path}`));
  } catch { throw new Error(`"${cfg.baseUrl}${path}" isn't a valid address — check the base URL.`); }
  for (const [k, v] of Object.entries({ ...search, ...auth.query })) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  // A signed API computes its signature over the path the server will see, so
  // the query string has to be settled before anything is signed.
  const headers = { ...auth.headers, accept: "application/json" };
  if (auth.signed) {
    Object.assign(headers, await signedHeaders(
      { key: env.ERP_API_KEY, secret: env.ERP_API_SECRET, signing: cfg.signing },
      { method: "GET", path: url.pathname + (url.search || ""), body: "" }
    ));
  }

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (e) {
    // A DNS failure or a refused connection is the commonest first result, and
    // "TypeError: fetch failed" tells nobody anything.
    throw new Error(`Couldn't reach ${url.origin} — ${String(e.message || e)}. If the ERP is only on an office network, it can't be pulled from and the push endpoint is the way in.`);
  }
  const text = await res.text();
  if (!res.ok) {
    // ERPRev's error codes are documented and specific, so say what each one
    // actually means rather than "401, check your key".
    const code = (text.match(/"(?:code|type)"\s*:\s*"([\w.]+)"/) || [])[1] || "";
    const known = {
      "auth.missing": "No credentials reached the ERP — the signing headers weren't sent.",
      "auth.invalid": "The ERP rejected the key. If it says \"not a v2 key\", the key was issued on an older build — re-issue it from Manage API Access.",
      "auth.clock_skew": "The signature timestamp is outside the ERP's ±300-second window. This machine's clock and the ERP's disagree.",
      "auth.insufficient_scope": "The key's scopes don't cover this. It needs products.read, stocks.read and warehouses.read.",
      "auth.insufficient_privilege": "The key authenticated, but its attached user lacks the module privilege. Both gates have to pass — give the service user read on products, stock and warehouses.",
      "route.not_found": "That endpoint doesn't exist on this build.",
      "cursor.invalid": "The paging cursor was rejected — the pull will start again from the beginning.",
    }[code];
    const hint = known
      ? `${known} (${res.status} ${code})`
      : res.status === 401 || res.status === 403
        ? `The ERP refused the credentials (${res.status}). Check the key and secret, that "Allow use of API" is ticked in company preferences, and that the signing settings match the ERP's own reference.`
        : res.status === 404
          ? `The ERP answered 404 for ${url.pathname}. That endpoint path is wrong — check it against the API reference.`
          : `The ERP answered ${res.status}.`;
    throw new Error(`${hint}${text && text.length < 300 ? ` It said: ${text.trim()}` : ""}`);
  }
  try { return JSON.parse(text); }
  catch { throw new Error(`${url.pathname} answered with something that isn't JSON — is that the API address, or a web page?`); }
}

// Frappe returns only `name` from a list endpoint unless the fields are
// asked for explicitly. Nothing else here needs telling what it wants.
const FRAPPE_FIELDS = {
  products: ["item_code", "item_name", "variant_of", "has_variants", "item_group", "description", "image", "disabled", "modified"],
  prices: ["item_code", "price_list_rate", "valid_from", "modified"],
  stock: ["item_code", "warehouse", "actual_qty", "reserved_qty", "modified"],
  warehouses: ["name", "is_group", "disabled"],
  groups: ["name"],
};

/** Dig a value out of a response by dotted path — `page.next_cursor`. */
const at = (obj, path) =>
  String(path || "").split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);

/**
 * One page of a list endpoint: the rows, and the cursor for the next page.
 *
 * Returns `{ rows, cursor }` rather than just rows, because a cursor-paged
 * API — which ERPRev's is — has no page number to increment. Asking for
 * "page 3" of a cursor API silently returns page 1 three times.
 */
async function erpPage(env, cfg, resource, { page = 0, cursor = "", extra = {} } = {}) {
  const path = cfg.paths[resource];
  if (!path) return { rows: [], cursor: "" };
  const search = { ...pageQuery(cfg.pageStyle, { page, pageSize: cfg.pageSize, cursor }), ...extra };
  // Frappe returns only `name` unless the fields are asked for explicitly.
  if (cfg.adapter.dialect === "frappe" && FRAPPE_FIELDS[resource]) {
    search.fields = JSON.stringify(FRAPPE_FIELDS[resource]);
  }
  const body = await erpCall(env, cfg, path, { search });
  return {
    rows: unwrap(body, cfg.envelopeKey),
    cursor: cfg.cursorKey ? String(at(body, cfg.cursorKey) || "") : "",
  };
}

/** Every page of a list endpoint, to the hard stop. */
async function erpAll(env, cfg, resource, opts = {}) {
  if (!cfg.paths[resource]) return [];
  const out = [];
  let cursor = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const got = await erpPage(env, cfg, resource, { ...opts, page, cursor });
    out.push(...got.rows);
    if (cfg.pageStyle === "none") break;
    if (cfg.pageStyle === "cursor") {
      // Trust the cursor, not the row count: a short page with a cursor after
      // it is normal, and a cursor that repeats itself is a loop.
      if (!got.cursor || got.cursor === cursor) break;
      cursor = got.cursor;
    } else if (got.rows.length < cfg.pageSize) break;
  }
  return out;
}

/**
 * Can we reach it, and does what comes back look like a catalogue?
 *
 * "Is the ERP reachable from the internet" is the first question this work was
 * ever blocked on, and this answers it in five seconds rather than an email
 * thread. It reports what it actually got rather than a green tick, because
 * the useful failure here is not "no" — it is "yes, but none of the fields are
 * where the connector expected them".
 */
export async function erpPing(env) {
  const cfg = await erpConfig(env);
  if (!cfg.baseUrl) return { ok: false, error: "No base URL yet — this is the address of the ERP's API, e.g. https://yourcompany.erprev.com" };
  if (!cfg.hasKey) return { ok: false, error: "No credentials — set ERP_API_KEY and ERP_API_SECRET as Worker secrets (`wrangler secret put ERP_API_KEY`)." };
  if (!cfg.paths.products) return { ok: false, error: "No products endpoint set. Put the ERP's product-list path below — the probe will show what it returns." };

  const started = Date.now();
  const reached = {};
  let firstError = "";

  // **Reachability first, with no credentials at all.** ERPRev's `/ping` needs
  // no key, so this separates "we can't reach your ERP" from "your ERP won't
  // accept this key" — two problems with completely different fixes that a
  // single 401 would otherwise blur together. It also hands back the server's
  // clock, and a signed request whose timestamp is more than 300 seconds off
  // that clock is refused however right the key is.
  let ping = null;
  if (cfg.pingPath) {
    try {
      const body = await erpCall(env, cfg, cfg.pingPath, { anonymous: true });
      const serverTime = body.time || body.server_time || body.timestamp || body.now || "";
      const skew = serverTime ? Math.round(Math.abs(Date.now() - new Date(serverTime).getTime()) / 1000) : null;
      ping = {
        ok: true, status: body.status || "reachable", version: body.version || body.api_version || "",
        serverTime: String(serverTime || ""),
        // ±300s is ERPRev's documented window.
        clockSkewSeconds: Number.isFinite(skew) ? skew : null,
        clockWarning: Number.isFinite(skew) && skew > 240
          ? `This machine's clock is about ${skew}s from the ERP's. Past 300s every signed request is refused as auth.clock_skew.`
          : "",
      };
    } catch (e) {
      ping = { ok: false, error: String(e.message || e) };
    }
    if (ping && !ping.ok) return { ok: false, error: `Couldn't reach the ERP at all — ${ping.error}`, ms: Date.now() - started, ping };
  }
  for (const resource of ["products", "prices", "stock", "warehouses", "groups"]) {
    if (!cfg.paths[resource]) { reached[resource] = "not set"; continue; }
    try {
      const { rows } = await erpPage(env, cfg, resource, { page: 0 });
      reached[resource] = rows.length ? `${rows.length} row(s)` : "reachable, empty";
    } catch (e) {
      reached[resource] = String(e.message || e);
      if (!firstError) firstError = String(e.message || e);
    }
  }
  // Products is the one that has to work. Anything else missing is a feature
  // the house hasn't configured, not a broken connection.
  const productsOk = /row\(s\)|reachable/.test(reached.products || "");
  if (!productsOk) return { ok: false, error: firstError || reached.products, ms: Date.now() - started, reached, ping };

  // Reading the product endpoint is not the same as understanding it, so say
  // which neutral fields actually came back filled in.
  let mapped = null;
  try {
    const { rows } = await erpPage(env, cfg, "products", { page: 0 });
    if (rows.length) {
      const p = cfg.adapter.normalise.product(rows[0], cfg.fields);
      mapped = {
        code: p.code, name: p.name,
        missing: ["code", "name"].filter((k) => !p[k]),
        sawPrice: p.inlinePrice > 0,
        sawStock: p.inlineStock !== undefined,
      };
    }
  } catch { /* the reachability answer stands on its own */ }

  return { ok: true, vendor: cfg.vendor, ms: Date.now() - started, reached, mapped, ping };
}

/**
 * Read the API's *own* published specification and report what it says.
 *
 * ERPRev publishes a live OpenAPI 3 document at `/api/v2/docs`, publicly. That
 * is worth more than any amount of care taken over this file: it names the
 * security scheme and the real endpoint paths from the running build, so the
 * house can check the settings against the ERP's own answer rather than
 * against a developer's reading of a PDF. Everything vendor-specific in this
 * connector is a guess until something like this confirms it.
 */
export async function erpReadSpec(env) {
  const cfg = await erpConfig(env);
  if (!cfg.baseUrl) return { ok: false, error: "No base URL yet." };
  if (!cfg.specPath) return { ok: false, error: "This adapter doesn't know where the ERP publishes its specification." };
  let doc;
  try {
    doc = await erpCall(env, cfg, cfg.specPath, { anonymous: true });
  } catch (e) {
    return { ok: false, error: `${String(e.message || e)} The specification is meant to be public — if it needs a key on your build, the endpoint paths below have to be checked by hand instead.` };
  }
  const schemes = (doc.components && doc.components.securitySchemes) || {};
  const paths = Object.keys(doc.paths || {});
  const find = (re) => paths.filter((x) => re.test(x) && !/\{/.test(x));
  return {
    ok: true,
    title: (doc.info && doc.info.title) || "",
    version: (doc.info && doc.info.version) || "",
    // The answer to "which headers does the signature actually go in".
    security: Object.entries(schemes).map(([name, v]) => ({
      name, type: v.type, in: v.in || "", header: v.name || "", scheme: v.scheme || "", description: String(v.description || "").slice(0, 300),
    })),
    found: {
      products: find(/products?$/i),
      stock: find(/stocks?$/i),
      warehouses: find(/warehouses?$/i),
      categories: find(/categor/i),
    },
    pathCount: paths.length,
  };
}

/**
 * Show one raw row, exactly as the ERP sent it.
 *
 * This is the whole answer to "we don't have their API documentation". Rather
 * than guessing what ERPRevolution calls a price, point this at the endpoint
 * and read the keys off a real response — then, where the connector guessed
 * wrong, name the right one in the field overrides. Guessing a vendor's schema
 * is what produced the ERPNext connector; looking is what replaces it.
 */
export async function erpProbe(env, { resource = "products", path = "" } = {}) {
  const cfg = await erpConfig(env);
  const target = String(path || "").trim() || cfg.paths[resource];
  if (!target) return { ok: false, error: "Nothing to probe — give it a path, or set one for that resource." };
  try {
    const body = await erpCall(env, cfg, target, { search: pageQuery(cfg.pageStyle, { page: 0, pageSize: 3, cursor: "" }) });
    const rows = unwrap(body, cfg.envelopeKey);
    const sample = rows[0];
    if (!sample) {
      return {
        ok: true, path: target, count: 0,
        note: "Reached it, but no rows came back where the connector looks for them. If the response below has its rows under a key we don't know, name that key as the envelope key.",
        // Truncated hard: this is for reading, and a whole catalogue in an
        // error box helps nobody.
        body: JSON.stringify(body).slice(0, 1500),
      };
    }
    const keys = Object.keys(sample);
    // Which neutral field each alias list found, so the gaps are obvious.
    //
    // Resolved with the list the *reader for this resource* actually uses. A
    // stock row joins on `product_id`, not on its own `id`, so reporting the
    // generic list here would tell somebody the reader had matched the wrong
    // field and invite them to "fix" it with an override that breaks a join
    // which was working.
    const FOR = {
      products: ["code", "name", "parentCode", "isTemplate", "group", "description", "image", "disabled", "active", "option", "price", "modified"],
      prices: ["code", "price", "validFrom"],
      stock: ["stockCode", "stockWarehouse", "onHand", "reserved"],
      warehouses: ["warehouse"],
      groups: ["group"],
    };
    const fields = FOR[resource] || Object.keys(ALIASES);
    const resolved = {};
    for (const field of fields) {
      const hit = [cfg.fields[field], ...(ALIASES[field] || [])].find((k) => k && sample[k] !== undefined && sample[k] !== null && sample[k] !== "");
      // Named so the admin reads "the product this row is about", not a
      // variable name only this file understands.
      const label = { stockCode: "the product it is about", stockWarehouse: "the location it is in", onHand: "quantity", code: "code" }[field] || field;
      resolved[label] = hit || null;
    }
    return { ok: true, path: target, count: rows.length, keys, resolved, sample: JSON.stringify(sample).slice(0, 1500) };
  } catch (e) {
    return { ok: false, path: target, error: String(e.message || e) };
  }
}

/**
 * List the ERP's stock locations, and remember them.
 *
 * The house maps each one to a shop from a dropdown afterwards. Discovering
 * rather than typing matters: the name has to match the ERP's exactly or the
 * stock silently lands nowhere, and "Abuja Branch - Main" is not a string
 * anybody should be retyping from memory.
 *
 * An ERP with no warehouse endpoint is normal — plenty of SME systems put the
 * location on the stock row and nowhere else — so the names seen on stock rows
 * are collected too, which means the map fills itself either way.
 */
export async function erpSyncWarehouses(env) {
  const cfg = await erpConfig(env);
  const db = env.DB;
  const found = new Map();

  for (const raw of await erpAll(env, cfg, "warehouses")) {
    const w = cfg.adapter.normalise.warehouse(raw);
    if (w.key) found.set(w.key, w);
  }
  if (cfg.paths.stock) {
    try {
      for (const raw of (await erpPage(env, cfg, "stock", { page: 0 })).rows) {
        const st = cfg.adapter.normalise.stock(raw, cfg.fields);
        if (st.warehouse && !found.has(st.warehouse)) {
          found.set(st.warehouse, { key: st.warehouse, label: st.warehouse, isGroup: false, disabled: false });
        }
      }
    } catch { /* the location list, where there is one, is the better source */ }
  }

  for (const w of found.values()) {
    // Keyed on what a *stock row* says — an id on ERPRev — with the readable
    // name kept beside it, so the admin shows "Main Store" while the join
    // still matches on the number the stock rows actually carry.
    await db.prepare(
      `INSERT INTO erp_warehouses (warehouse, label, is_group, disabled, seen_at) VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(warehouse) DO UPDATE SET label=excluded.label, is_group=excluded.is_group, disabled=excluded.disabled, seen_at=datetime('now')`
    ).bind(w.key, w.label || w.key, w.isGroup ? 1 : 0, w.disabled ? 1 : 0).run();
  }
  return { found: found.size };
}

/** The same, for the ERP's product categories → ours. */
export async function erpSyncItemGroups(env) {
  const cfg = await erpConfig(env);
  const db = env.DB;
  const names = new Set();
  for (const raw of await erpAll(env, cfg, "groups")) {
    const g = cfg.adapter.normalise.group(raw);
    if (g.name) names.add(g.name);
  }
  if (!names.size && cfg.paths.products) {
    // No category endpoint: take the categories off the products themselves.
    try {
      for (const raw of (await erpPage(env, cfg, "products", { page: 0 })).rows) {
        const p = cfg.adapter.normalise.product(raw, cfg.fields);
        if (p.group) names.add(p.group);
      }
    } catch { /* optional either way */ }
  }
  for (const name of names) {
    await db.prepare(
      `INSERT INTO erp_item_groups (item_group, seen_at) VALUES (?, datetime('now'))
       ON CONFLICT(item_group) DO UPDATE SET seen_at=datetime('now')`
    ).bind(name).run();
  }
  return { found: names.size };
}

/** warehouse → our shop id, for the warehouses somebody has actually mapped. */
export async function warehouseMap(db) {
  const rows = (await db.prepare("SELECT warehouse, location_id FROM erp_warehouses WHERE location_id IS NOT NULL").all()).results;
  return Object.fromEntries(rows.map((r) => [r.warehouse, r.location_id]));
}

async function itemGroupMap(db) {
  const rows = (await db.prepare("SELECT item_group, cat FROM erp_item_groups WHERE cat IS NOT NULL").all()).results;
  return Object.fromEntries(rows.map((r) => [r.item_group, r.cat]));
}

/**
 * Neutral rows in, the flat SKU feed `syncCatalogue` eats out.
 *
 * Pure, and vendor-free: `products`, `prices` and `stock` have already been
 * through an adapter. Exported so the shape can be proved without an ERP to
 * call — which is the only way this could be built at all while the ERP's API
 * documentation is still on its way.
 *
 * The grouping rule: a product with a `parentCode` is a variation of it, and
 * one with neither a parent nor `isTemplate` is a standalone product that
 * becomes its own parent with a single variation under it. That is how a
 * simple item ends up as a one-size listing instead of being dropped, which
 * matters because most of a typical SME catalogue is simple items.
 */
/**
 * "Velvet Reign 30ml" and "Velvet Reign 50ml" → one listing with a size picker.
 *
 * ERPRev has no variant concept: `/products` is flat, one row per sellable
 * thing, each with its own price. Faithfully imported, a perfume catalogue
 * becomes three separate cards for one fragrance — which is true to the ERP
 * and wrong for the shop.
 *
 * So, optionally, a product whose name *ends with its own unit* has that unit
 * taken off to make a stem, and rows sharing a stem become one product with
 * the units as its sizes. Two guards make it safe enough to offer:
 *
 *   · it only ever fires on a name that ends with that row's own `measure`,
 *     so "Amber Candle" (pcs) is untouched while "Velvet Reign 30ml" (30ml)
 *     is not — no fuzzy matching, no edit distance, nothing that could decide
 *     two different fragrances are the same one
 *   · a stem only one product shares is left alone, so nothing is given a
 *     parent it doesn't need
 *
 * Off by default, because merging two products that only *look* related is a
 * worse mistake than leaving them apart, and the house can see the result of
 * a dry run before it commits.
 */
export function groupByUnit(products) {
  const stemOf = (p) => {
    const unit = (p.options[0] || "").trim();
    if (!unit || !p.name) return "";
    const name = p.name.trim();
    if (name.length <= unit.length) return "";
    if (name.slice(-unit.length).toLowerCase() !== unit.toLowerCase()) return "";
    return name.slice(0, -unit.length).replace(/[\s\-–—/,·]+$/, "").trim();
  };
  const counts = new Map();
  for (const p of products) {
    if (p.parentCode || p.isTemplate) continue;
    const stem = stemOf(p);
    if (stem) counts.set(stem, (counts.get(stem) || 0) + 1);
  }
  return products.map((p) => {
    if (p.parentCode || p.isTemplate) return p;
    const stem = stemOf(p);
    // A stem of one is a product, not a family.
    if (!stem || (counts.get(stem) || 0) < 2) return p;
    return { ...p, parentCode: `stem:${stem.toLowerCase()}`, parentName: stem };
  });
}

export function buildFeed({ products, prices = [], stock = [], warehouses, groups, defaultCat, known = new Set(), groupUnits = false }) {
  if (groupUnits) products = groupByUnit(products);
  const priceOf = new Map();
  for (const p of prices) {
    if (!p.code || !(p.price > 0)) continue;
    // Several prices for one item means somebody has dated them. The latest
    // start wins; an undated price sorts first, which is right — an undated
    // price is the standing one.
    const cur = priceOf.get(p.code);
    if (!cur || String(p.validFrom || "") > String(cur.validFrom || "")) priceOf.set(p.code, p);
  }

  // Stock per item, summed into our shops. An ERP can hold one item in several
  // locations that all map to one shop, so this adds rather than overwrites.
  // On hand less what is already promised to somebody else: a bottle reserved
  // against an open order is not a bottle we can sell.
  const stockOf = new Map();
  for (const s of stock) {
    const shop = warehouses[s.warehouse];
    if (!shop || !s.code) continue;
    const free = Math.max(0, Math.round(s.onHand - s.reserved));
    const cur = stockOf.get(s.code) || {};
    cur[shop] = (cur[shop] || 0) + free;
    stockOf.set(s.code, cur);
  }

  const templates = new Map();
  for (const it of products) if (it.isTemplate && it.code) templates.set(it.code, it);

  const rows = [];
  const skipped = [];
  for (const it of products) {
    if (it.isTemplate) continue; // a template is not a thing to sell
    if (it.disabled) continue;   // and neither is a disabled item
    if (!it.code) continue;

    const parentId = it.parentCode || it.code;
    const price = priceOf.get(it.code);
    const rate = price ? price.price : it.inlinePrice;
    if (!(rate > 0)) {
      skipped.push({ item: it.code, error: prices.length ? "No price found for it." : "No price on the product row, and no price endpoint is set." });
      continue;
    }

    const tpl = templates.get(parentId);
    // A variation's label: the ERP's own option/variant values where it sends
    // them, else the part of the item name the template doesn't account for,
    // else the code. Never empty — the ingest refuses a row without one.
    const trimmed = tpl && it.name && tpl.name && it.name.startsWith(tpl.name)
      ? it.name.slice(tpl.name.length).replace(/^[\s\-–—/,]+/, "").trim()
      : "";
    const label = it.options[0] || trimmed || (it.parentCode ? it.code : "One size");

    const row = {
      parentId,
      externalId: it.code,
      sku: it.code,
      option1: label,
      ...(it.options[1] ? { option2: it.options[1] } : {}),
      ...(it.options[2] ? { option3: it.options[2] } : {}),
      priceNgn: Math.round(rate),
      active: true,
    };

    // Stock from the stock endpoint, else from the product row when the ERP
    // puts it there and exactly one shop is mapped — with more than one
    // mapped, a single unlabelled number says nothing about which shop it is
    // in, and guessing would be the warehouse-map mistake by another route.
    let counts = stockOf.get(it.code);
    if (!counts && it.inlineStock !== undefined) {
      const shops = [...new Set(Object.values(warehouses))];
      if (shops.length === 1) counts = { [shops[0]]: Math.max(0, Math.round(Number(it.inlineStock) || 0)) };
      else skipped.push({ item: it.code, warning: true, error: `Stock is on the product row, but ${shops.length} shops are mapped — it can't be told which one. Map one, or set a stock endpoint.` });
    }
    // Only send stock we actually have a figure for. An item nobody has
    // stocked has never been counted, and sending `{}` is different from
    // sending zeroes — the ingest sets what it is given, absolutely.
    if (counts) row.stock = counts;

    // The descriptive fields ride only on the *head* of a group and only for
    // something we have never seen. The ERP owns price and stock; the store
    // owns its own copy and photography, and a sync that resent the ERP's
    // one-line description every hour would erase it every hour.
    const head = tpl || it;
    if (!known.has(parentId) && !rows.some((r) => r.parentId === parentId)) {
      // A synthetic parent carries the stem as its name — "Velvet Reign",
      // not "Velvet Reign 30ml", which is what the listing would otherwise
      // be called.
      row.parentName = head.parentName || head.name || parentId;
      const cat = groups[head.group];
      row.category = cat || defaultCat;
      if (!cat && head.group) skipped.push({ item: it.code, warning: true, error: `Category "${head.group}" isn't mapped — filed under "${defaultCat}".` });
      if (head.description) row.description = head.description;
      if (head.image) row.imageUrl = head.image;
    }
    rows.push(row);
  }
  return { rows, skipped };
}

/**
 * The guard.
 *
 * "Refuse any sync that would zero more than a configured share of the stock"
 * is the single most important line in the connector, because the failure it
 * prevents is silent and total: an API key that has expired, an endpoint
 * renamed, a filter that matches nothing — the ERP answers `[]` with a 200 and
 * everything looks fine, and the next pull sets every shelf to zero and the
 * storefront sells nothing until somebody notices.
 *
 * **What it is a share *of* is the whole design.** Three denominators are
 * available and two of them are wrong:
 *
 *   · *the SKUs in this feed* — wrong, because an incremental run carrying
 *     three sold-out bottles would read as a 100% wipe every time
 *   · *the whole catalogue* — wrong, and wrong in the dangerous direction.
 *     Caught in testing: an ERP managing 37 units alongside a 5,600-unit
 *     catalogue zeroed every one of them, and the guard called it a 1% drop
 *     and let it through. Any shop where the ERP owns part of the catalogue —
 *     which is every shop during onboarding, and every shop with house-made
 *     pieces beside bought-in ones — has that hole.
 *   · *everything this connector manages* — right. The question the guard is
 *     actually asking is "has the ERP just told us most of what it looks
 *     after has vanished", and nothing the ERP has never heard of belongs in
 *     that arithmetic.
 *
 * Measured in units rather than rows, because that is what a shopper meets.
 *
 * On a small footprint this is twitchy — with three SKUs on the shelf, one
 * selling out is a third of everything. That is the right direction to be
 * wrong in: a refusal costs one click, and a false pass costs a day of
 * selling nothing.
 */
export function stockGuard({ before, after, pct }) {
  // Everything the ERP looks after, whether or not this feed mentioned it.
  const managed = Object.values(before).reduce((n, q) => n + q, 0);
  if (managed <= 0) return { ok: true, before: 0, after: 0, managed: 0, dropPct: 0, shareOfManaged: 0 };
  // ...against what this feed says about the part of it the feed speaks to.
  let was = 0, now = 0;
  for (const [sku, qty] of Object.entries(after)) {
    was += before[sku] || 0;
    now += qty;
  }
  const drop = was - now;
  const dropPct = was > 0 ? Math.round((drop / was) * 100) : 0;
  const shareOfManaged = Math.round((drop / managed) * 100);
  return { ok: !(drop > 0 && shareOfManaged > pct), before: was, after: now, managed, dropPct, shareOfManaged };
}

/**
 * Units on hand per SKU, for the SKUs this connector manages.
 *
 * Scoped to `external_source`, which is what makes the guard's denominator
 * the ERP's own footprint rather than the whole shop — see `stockGuard`.
 */
async function stockBySku(db) {
  const rows = (await db.prepare(
    `SELECT v.sku AS sku, COALESCE(SUM(s.qty), 0) AS qty
       FROM variants v LEFT JOIN stock s ON s.variant_id = v.id
      WHERE v.sku IS NOT NULL AND v.external_source = ?
      GROUP BY v.sku`
  ).bind(ERP_SOURCE).all()).results;
  return Object.fromEntries(rows.map((r) => [r.sku, r.qty]));
}

/**
 * One pull: read the ERP, normalise it, build the feed, check the guard, and
 * hand it to the ingest that has been there all along.
 *
 * A dry run does every read and every check and writes nothing — the admin's
 * "show me what this would do" button, and the only honest answer to that
 * question.
 */
export async function erpPull(env, { dryRun = false } = {}) {
  const started = Date.now();
  const cfg = await erpConfig(env);
  if (!cfg.configured) {
    return { ok: false, dryRun, error: "The ERP link isn't configured yet — it needs a base URL, credentials and a products endpoint." };
  }

  const db = env.DB;
  const warehouses = await warehouseMap(db);
  if (!Object.keys(warehouses).length) {
    return {
      ok: false, dryRun,
      error: "No ERP location is mapped to a shop yet. Until one is, a pull would carry prices with no stock behind them — map them under Integrations → Inventory & catalogue link.",
    };
  }
  const groups = await itemGroupMap(db);

  let products, prices, stock;
  try {
    const raw = await erpAll(env, cfg, "products");
    products = raw.map((r) => cfg.adapter.normalise.product(r, cfg.fields)).filter((p) => p.code);
    // A price endpoint is optional: plenty of ERPs put the price on the
    // product, and the feed builder falls back to it.
    prices = cfg.paths.prices
      ? (await erpAll(env, cfg, "prices", cfg.priceList ? { extra: { price_list: cfg.priceList } } : {}))
          .map((r) => cfg.adapter.normalise.price(r, cfg.fields)).filter((p) => p.code)
      : [];
    stock = cfg.paths.stock
      ? (await erpAll(env, cfg, "stock")).map((r) => cfg.adapter.normalise.stock(r, cfg.fields)).filter((s) => s.code)
      : [];
  } catch (e) {
    await logSync(db, { ok: 0, note: String(e.message || e), ms: Date.now() - started, dryRun });
    return { ok: false, dryRun, error: String(e.message || e) };
  }

  if (!products.length) {
    const note = "The ERP returned no products the connector could read. If rows did come back, their field names aren't ones it recognises — run the probe and name them.";
    await logSync(db, { ok: 0, note, ms: Date.now() - started, dryRun });
    return { ok: false, dryRun, error: note, rows: 0 };
  }

  const known = new Set((await db.prepare("SELECT external_id FROM products WHERE external_source=?").bind(ERP_SOURCE).all())
    .results.map((r) => r.external_id));

  const { rows, skipped } = buildFeed({ products, prices, stock, warehouses, groups, defaultCat: cfg.defaultCat, known, groupUnits: cfg.groupUnits });
  if (!rows.length) {
    const note = `Read ${products.length} product(s) but none could be turned into a sellable row — ${(skipped[0] && skipped[0].error) || "no prices came through"}.`;
    await logSync(db, { ok: 0, note, ms: Date.now() - started, dryRun });
    return { ok: false, dryRun, error: note, rows: 0, readErrors: skipped.slice(0, 20) };
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
    const note = `Refused: this pull would cut ${guard.shareOfManaged}% off the stock this ERP looks after — ${guard.before} units down to ${guard.after}, out of ${guard.managed} it manages — past the ${cfg.emptyGuardPct}% guard. Nothing was changed. If the drop is real, raise the guard or run this once by hand.`;
    await logSync(db, { ok: 0, note, ms: Date.now() - started, dryRun });
    return { ok: false, dryRun, error: note, guard };
  }

  const result = await syncCatalogue(env, { source: ERP_SOURCE, items: rows, dryRun, publish: cfg.publish });
  const ms = Date.now() - started;
  const warnings = skipped.filter((x) => x.warning);
  const errors = skipped.filter((x) => !x.warning);
  await logSync(db, {
    ok: 1, ms, dryRun,
    note: `${dryRun ? "Dry run: " : ""}${rows.length} SKU${rows.length === 1 ? "" : "s"} read${errors.length ? `, ${errors.length} skipped` : ""}${guard.before !== guard.after ? `, stock ${guard.before}→${guard.after} units` : ""}.`,
  });
  if (!dryRun) await putSettings(db, { erpLastSync: nowStamp() });

  return {
    ok: true, dryRun, rows: rows.length, guard, vendor: cfg.vendor,
    warehouses: Object.keys(warehouses).length,
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
    .map((r) => ({ warehouse: r.warehouse, label: r.label || r.warehouse, locationId: r.location_id, isGroup: !!r.is_group, disabled: !!r.disabled }));
  const itemGroups = (await db.prepare("SELECT * FROM erp_item_groups ORDER BY item_group").all()).results
    .map((r) => ({ itemGroup: r.item_group, cat: r.cat }));
  const syncs = (await db.prepare("SELECT * FROM catalog_syncs WHERE source=? ORDER BY id DESC LIMIT 12").bind(ERP_SOURCE).all()).results
    .map((r) => ({ id: r.id, at: r.at, direction: r.direction, ms: r.ms, ok: !!r.ok, note: r.note, variantsCreated: r.variants_created, variantsUpdated: r.variants_updated }));
  const owned = await db.prepare("SELECT COUNT(*) AS n FROM variants WHERE external_source=?").bind(ERP_SOURCE).first();
  return {
    config: {
      vendor: cfg.vendor, on: cfg.on, baseUrl: cfg.baseUrl, hasKey: cfg.hasKey, configured: cfg.configured,
      authStyle: cfg.authStyle, pageStyle: cfg.pageStyle, paths: cfg.paths, fields: cfg.fields,
      envelopeKey: cfg.envelopeKey, cursorKey: cfg.cursorKey, pingPath: cfg.pingPath, pageSize: cfg.pageSize,
      signing: cfg.signing,
      priceList: cfg.priceList, publish: cfg.publish, defaultCat: cfg.defaultCat, groupUnits: cfg.groupUnits,
      emptyGuardPct: cfg.emptyGuardPct, syncEveryMins: cfg.syncEveryMins, lastSync: cfg.lastSync,
    },
    vendors: adapterList(),
    authStyles: Object.entries(AUTH_STYLES).map(([id, v]) => ({ id, label: v.label })),
    pageStyles: Object.entries(PAGE_STYLES).map(([id, v]) => ({ id, label: v.label })),
    fieldNames: Object.keys(ALIASES),
    signingDefaults: SIGNING_DEFAULTS,
    stores: (await allLocations(db)).map((l) => ({ id: l.id, city: l.city })),
    warehouses, itemGroups, syncs,
    linkedVariants: owned ? owned.n : 0,
  };
}
