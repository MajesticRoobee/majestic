// Which ERP, and how to talk to it.
//
// The sync engine in `erp.js` knows nothing about any particular ERP. It knows
// about four neutral shapes — a product, a price, a stock level, a warehouse —
// and everything vendor-specific lives here, in one adapter per ERP.
//
// That split is not architecture for its own sake. The first version of this
// connector was written against ERPNext because a planning document had
// guessed that "ERPrev" meant ERPNext. It didn't: ERPrev is ERPRevolution, a
// different product from a different company. Every line of the transport was
// wrong and none of the engine was, which is exactly the boundary this file
// draws. The next time the guess is wrong, only an adapter changes.
//
// **The generic adapter is the default, and it is not a stopgap.** Most SME
// ERPs expose much the same REST API wearing different names: a list endpoint
// per resource, a page parameter, a JSON envelope, and fields called some
// variation of `sku` / `price` / `qty`. So the generic adapter reads by
// *alias* — it tries every common spelling of each field — and anything it
// guesses wrong is corrected from the admin screen without a deploy. The probe
// in `erp.js` shows the raw keys of a real response, so correcting it is a
// matter of reading rather than of asking.

// ---- the neutral shapes ---------------------------------------------------
//
//   product   { code, name, parentCode, isTemplate, group, description,
//               image, disabled, options: [] }
//   price     { code, price, validFrom }
//   stock     { code, warehouse, onHand, reserved }
//   warehouse { name, isGroup, disabled }
//   group     { name }
//
// `code` is the ERP's own identifier for a sellable item and is the only field
// with no fallback: without it there is nothing to upsert against.

/** First present value among several spellings of the same field. */
export function pick(row, keys) {
  for (const k of keys) {
    if (!k) continue;
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v) => {
  if (v === undefined || v === null || v === "") return 0;
  // "₦35,000.00" and "35000" both have to survive: an ERP that renders money
  // for humans before putting it in JSON is common, and dropping the row
  // silently would read as "this product has no price".
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const bool = (v) => v === true || v === 1 || v === "1" || v === "true" || v === "yes" || v === "Y";

/**
 * The array inside whatever envelope the ERP wrapped it in.
 *
 * Bare arrays, `{data:[…]}` (Frappe, Laravel), `{results:[…]}` (DRF),
 * `{items:[…]}`, `{records:[…]}`, and Laravel's paginated `{data:{data:[…]}}`
 * between them cover almost everything. Anything else, and the probe shows the
 * body so somebody can name the key in the admin.
 */
export function unwrap(body, key = "") {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return [];
  if (key) {
    const at = key.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), body);
    if (Array.isArray(at)) return at;
  }
  for (const k of ["data", "results", "items", "records", "rows", "products", "list", "payload"]) {
    const v = body[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object" && Array.isArray(v.data)) return v.data;
  }
  return [];
}

// Every spelling of every field we need, in the order they are tried. An ERP
// that uses a name not on a list here is one override in the admin away from
// working, and the list is where that override's default comes from.
export const ALIASES = {
  code: ["sku", "item_code", "itemCode", "code", "product_code", "productCode", "item_id", "itemId", "id", "reference", "barcode"],
  name: ["item_name", "itemName", "name", "product_name", "productName", "title", "description_short"],
  parentCode: ["variant_of", "variantOf", "parent", "parent_code", "parentCode", "parent_id", "parentId", "template", "template_code", "style_code", "styleCode", "group_code", "model"],
  isTemplate: ["has_variants", "hasVariants", "is_template", "isTemplate", "is_parent", "has_children"],
  group: ["item_group", "itemGroup", "category", "category_name", "categoryName", "product_group", "productGroup", "class", "class_name", "department", "cat"],
  description: ["description", "descr", "details", "long_description", "notes", "body"],
  image: ["image", "image_url", "imageUrl", "thumb_image_url", "thumbImageUrl", "photo", "picture", "thumbnail", "img"],
  disabled: ["disabled", "is_disabled", "inactive", "is_deleted", "deleted", "archived"],
  active: ["active", "enabled", "is_active", "status"],
  option: ["variant", "variant_name", "variantName", "option", "option1", "size", "measure", "unit", "uom", "attribute_value", "spec"],
  price: ["price_list_rate", "priceListRate", "price", "unit_price", "unitPrice", "selling_price", "sellingPrice", "sale_price", "salePrice", "rate", "amount", "retail_price"],
  validFrom: ["valid_from", "validFrom", "effective_from", "effectiveFrom", "start_date", "starts_at"],
  warehouse: ["warehouse", "warehouse_name", "warehouseName", "location", "location_name", "locationName", "store", "store_name", "branch", "branch_name", "site", "outlet"],
  // A stock row points *at* a product and *at* a location, and on an ERP that
  // uses numeric ids — ERPRev does — the row's own `id` is the stock row's,
  // not the product's. Reading `id` there would join every stock row to the
  // wrong product, so these two lists exist separately and put the foreign
  // keys first.
  stockCode: ["product_id", "productId", "sku", "item_code", "itemCode", "product_code", "productCode", "code", "item_id", "barcode"],
  stockWarehouse: ["warehouse_id", "warehouseId", "warehouse", "warehouse_name", "location_id", "locationId", "location", "location_name", "store_id", "store", "branch_id", "branch", "branch_name", "site", "outlet"],
  onHand: ["actual_qty", "actualQty", "qty", "quantity", "stock", "stock_qty", "on_hand", "onHand", "available", "available_qty", "balance", "closing_qty", "in_stock"],
  reserved: ["reserved_qty", "reservedQty", "reserved", "committed", "committed_qty", "allocated", "allocated_qty", "on_order"],
  modified: ["modified", "updated_at", "updatedAt", "last_modified", "lastModified", "date_modified", "changed_at"],
};

/** Field list for one neutral field: the house's override first, then the aliases. */
const fieldsFor = (overrides, key) => {
  const own = str(overrides && overrides[key]);
  return own ? [own, ...ALIASES[key]] : ALIASES[key];
};

// ---- credentials ----------------------------------------------------------
//
// Five shapes between them cover essentially every SME ERP's REST API. Which
// one an ERP wants is a line in its API documentation and a dropdown in the
// admin; getting it wrong produces a 401 the connection test reports verbatim,
// rather than anything silent.
export const AUTH_STYLES = {
  hmac: { label: "Signed request — HMAC-SHA256 (ERPRev v2)" },
  raw: { label: "The token on its own (Authorization: <token>)" },
  bearer: { label: "Bearer token (Authorization: Bearer <token>)" },
  "key-secret-headers": { label: "Two headers (X-API-KEY / X-API-SECRET)" },
  token: { label: "Token pair (Authorization: token <key>:<secret>)" },
  basic: { label: "HTTP Basic (key as username, secret as password)" },
  query: { label: "Query string (?api_key=…&api_secret=…)" },
};

/**
 * The signing contract for a request-signed API.
 *
 * ERPRev's v2 API does not send the secret at all: every request carries an
 * HMAC-SHA256 signature computed over its method, path, timestamp, nonce and
 * body, and the server recomputes it. That is a better design than a bearer
 * token and it is also the one thing a connector cannot improvise — the
 * canonical string has to match byte for byte or every call is a 401.
 *
 * So the pieces are *configuration*, defaulted to the documented shape and
 * editable in the admin, rather than constants compiled into a build. When
 * ERPRev's "Signing requests" page pins the exact order, it is a text field,
 * not a release. `{ph}` placeholders are substituted; `\n` in the template
 * means a real newline.
 */
export const SIGNING_DEFAULTS = {
  // "an HMAC-SHA256 signature over its method, path, timestamp, nonce and
  // body" — ERPRevolution User Guide, The ERPRev API.
  // Written with a *visible* backslash-n rather than a real newline, because
  // this is edited in a one-line text field: a real newline there shows as
  // nothing at all, and the first person to retype the box would silently
  // drop the separators and 401 every request afterwards. `canonicalString`
  // turns the two characters into the one.
  canonical: String.raw`{method}\n{path}\n{timestamp}\n{nonce}\n{body}`,
  keyHeader: "X-Api-Key",          // documented: "the public key id you'll send as X-Api-Key"
  timestampHeader: "X-Timestamp",
  nonceHeader: "X-Nonce",
  signatureHeader: "X-Signature",
  // Some APIs want `t=<ts>,v1=<hex>`; ERPRev's *webhooks* do. Whether its
  // request signing does is on the page we do not have, so it is a switch.
  signatureFormat: "hex",          // "hex" | "t,v1"
  // Whether `{path}` means the path with its query string or without it. A
  // real ambiguity — both are common, and picking the wrong one is a 401 that
  // looks exactly like a wrong key.
  pathMode: "full",                // "full" | "pathname"
};

/**
 * The axes of a signing contract, for `erpNegotiateSigning` to search.
 *
 * ERPRev's API overview says the signature covers "its method, path,
 * timestamp, nonce and body" but the page that pins the exact bytes wasn't
 * among the reference pages we were sent. Rather than wait for it, the
 * connector asks the ERP — and the ERP answers in about twenty seconds.
 *
 * These are kept as **separate axes** rather than a hand-written list of
 * combinations, because a hand-written list is exactly how you miss the one
 * that was right: the first version of this had X-ERPRev headers with a full
 * path and X-ERPRev headers with a t=,v1= signature, and the real answer was
 * X-ERPRev headers with *both*. Crossing the axes cannot miss a corner.
 */
export const SIGNING_HEADER_SETS = [
  { label: "X-Timestamp / X-Nonce / X-Signature", timestampHeader: "X-Timestamp", nonceHeader: "X-Nonce", signatureHeader: "X-Signature" },
  { label: "X-ERPRev-*", timestampHeader: "X-ERPRev-Timestamp", nonceHeader: "X-ERPRev-Nonce", signatureHeader: "X-ERPRev-Signature" },
  { label: "X-Api-*", timestampHeader: "X-Api-Timestamp", nonceHeader: "X-Api-Nonce", signatureHeader: "X-Api-Signature" },
];

/** The orderings and separators worth trying, likeliest first. */
export const SIGNING_SHAPES = [
  String.raw`{method}\n{path}\n{timestamp}\n{nonce}\n{body}`,
  String.raw`{method}\n{path}\n{timestamp}\n{nonce}`,
  String.raw`{method}{path}{timestamp}{nonce}{body}`,
  String.raw`{method}|{path}|{timestamp}|{nonce}|{body}`,
  String.raw`{timestamp}\n{nonce}\n{method}\n{path}\n{body}`,
  String.raw`{method} {path}\n{timestamp}\n{nonce}\n{body}`,
  String.raw`{method}\n{path}\n{body}\n{timestamp}\n{nonce}`,
  // The shape their *webhooks* document, in case both halves share a helper.
  String.raw`{timestamp}.{body}`,
];

export const SIGNING_PATH_MODES = ["full", "pathname"];
export const SIGNING_FORMATS = ["hex", "t,v1"];

/** Fill `{method}` / `{path}` / `{timestamp}` / `{nonce}` / `{body}` / `{query}`. */
export function canonicalString(template, parts) {
  return String(template || SIGNING_DEFAULTS.canonical)
    .replace(/\\n/g, "\n")
    .replace(/\{(\w+)\}/g, (_, k) => (parts[k] === undefined ? "" : String(parts[k])));
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** HMAC-SHA256, hex. WebCrypto, so it works on the Worker with no dependency. */
export async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}

/**
 * The four headers a signed request carries.
 *
 * `now` and `nonce` are injectable so this is testable; in production they are
 * the clock and a random id. ERPRev checks the timestamp against its own clock
 * with a ±300 second window, which is why the connection test reports the
 * server time it saw.
 */
export async function signedHeaders(cfg, { method, path, url, body = "", now = Date.now(), nonce } = {}) {
  const sign = { ...SIGNING_DEFAULTS, ...(cfg.signing || {}) };
  const timestamp = String(Math.floor(now / 1000));
  const n = nonce || crypto.randomUUID();
  // `pathMode` is part of the signing contract, so it is applied *here*
  // rather than by whoever calls this. Hand it a URL and it decides; hand it
  // a `path` string and that string is taken as already decided. Leaving the
  // decision to the caller meant a config that set pathMode and a caller that
  // ignored it were indistinguishable from a working setup until the 401.
  const signedPath = url
    ? (sign.pathMode === "pathname" ? url.pathname : url.pathname + (url.search || ""))
    : String(path || "");
  const message = canonicalString(sign.canonical, {
    method: String(method || "GET").toUpperCase(), path: signedPath, timestamp, nonce: n, body,
  });
  const mac = await hmacHex(cfg.secret, message);
  return {
    [sign.keyHeader]: cfg.key,
    [sign.timestampHeader]: timestamp,
    [sign.nonceHeader]: n,
    [sign.signatureHeader]: sign.signatureFormat === "t,v1" ? `t=${timestamp},v1=${mac}` : mac,
  };
}

export function authFor(style, key, secret) {
  const k = str(key), s = str(secret);
  switch (style) {
    case "hmac":
      // Handled by `signedHeaders`, which is async and needs the request.
      return { headers: {}, query: {}, signed: true };
    case "token":
      return { headers: { authorization: `token ${k}:${s}` }, query: {} };
    case "basic":
      return { headers: { authorization: `Basic ${btoa(`${k}:${s}`)}` }, query: {} };
    case "key-secret-headers":
      return { headers: { "x-api-key": k, ...(s ? { "x-api-secret": s } : {}) }, query: {} };
    case "query":
      return { headers: {}, query: { api_key: k, ...(s ? { api_secret: s } : {}) } };
    case "raw":
      // The header value *is* the token, with no scheme in front of it.
      // Unusual, and easy to miss: sending `Bearer <token>` to an API that
      // wants the bare string gets a 401 that reads exactly like a wrong key,
      // so this is a style of its own rather than something to discover.
      return { headers: { authorization: s || k }, query: {} };
    case "bearer":
    default:
      // A single-credential API usually issues one long token. The house may
      // have put it in either box, so take the secret and fall back to the key
      // rather than sending an empty Bearer and reading the 401 as "wrong key".
      return { headers: { authorization: `Bearer ${s || k}` }, query: {} };
  }
}

// ---- paging ---------------------------------------------------------------
export const PAGE_STYLES = {
  cursor: { label: "?limit=200&cursor=… (cursor — ERPRev v2)" },
  page: { label: "?page=1&per_page=200 (page number)" },
  offset: { label: "?limit=200&offset=0 (row offset)" },
  frappe: { label: "?limit_page_length=200&limit_start=0 (Frappe / ERPNext)" },
  none: { label: "No paging — the endpoint returns everything" },
};

export function pageQuery(style, { page, pageSize, cursor }) {
  switch (style) {
    case "cursor":
      // A cursor API has no page number: the first call sends only a limit and
      // every call after it sends the cursor the last response handed back.
      return cursor ? { limit: pageSize, cursor } : { limit: pageSize };
    case "offset": return { limit: pageSize, offset: page * pageSize };
    case "frappe": return { limit_page_length: pageSize, limit_start: page * pageSize };
    case "none": return {};
    case "page":
    default: return { page: page + 1, per_page: pageSize };
  }
}

// ---- the adapters ---------------------------------------------------------

// One reader, shared. `f` is the house's field overrides, if any.
function genericNormaliseProduct(row, f = {}) {
  const options = [];
  for (const key of ["option", "option2", "option3"]) {
    const v = str(pick(row, key === "option" ? fieldsFor(f, "option") : [f[key], key].filter(Boolean)));
    if (v) options.push(v);
  }
  // `disabled` and `active` say the same thing in opposite directions, and an
  // ERP usually has one or the other. A row that says neither is live: an item
  // in the catalogue with no opinion about it is for sale.
  const disabledRaw = pick(row, fieldsFor(f, "disabled"));
  const activeRaw = pick(row, fieldsFor(f, "active"));
  const disabled = disabledRaw !== undefined
    ? bool(disabledRaw)
    : activeRaw !== undefined
      ? !(bool(activeRaw) || str(activeRaw).toLowerCase() === "active")
      : false;
  return {
    code: str(pick(row, fieldsFor(f, "code"))),
    name: str(pick(row, fieldsFor(f, "name"))),
    parentCode: str(pick(row, fieldsFor(f, "parentCode"))),
    isTemplate: bool(pick(row, fieldsFor(f, "isTemplate"))),
    group: str(pick(row, fieldsFor(f, "group"))),
    // An ERP description is usually HTML pasted from somewhere. It is shop copy
    // only until somebody writes the real thing, so it arrives as plain text.
    description: str(pick(row, fieldsFor(f, "description"))).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    image: str(pick(row, fieldsFor(f, "image"))),
    disabled,
    options,
    // Present only when the price rides the product row; `erp.js` decides
    // whether to believe it.
    inlinePrice: num(pick(row, fieldsFor(f, "price"))),
    inlineStock: pick(row, fieldsFor(f, "onHand")),
  };
}

const genericNormalise = {
  product: genericNormaliseProduct,
  price: (row, f = {}) => ({
    code: str(pick(row, fieldsFor(f, "code"))),
    price: num(pick(row, fieldsFor(f, "price"))),
    validFrom: str(pick(row, fieldsFor(f, "validFrom"))),
  }),
  stock: (row, f = {}) => ({
    // `stockCode` / `stockWarehouse` rather than `code` / `warehouse`: on a
    // stock row the product and the location are foreign keys, and the row's
    // own `id` belongs to the stock record. See the note on ALIASES.
    code: str(pick(row, f.stockCode ? [f.stockCode, ...ALIASES.stockCode] : ALIASES.stockCode)),
    warehouse: str(pick(row, f.stockWarehouse ? [f.stockWarehouse, ...ALIASES.stockWarehouse] : ALIASES.stockWarehouse)),
    onHand: num(pick(row, fieldsFor(f, "onHand"))),
    reserved: num(pick(row, fieldsFor(f, "reserved"))),
  }),
  warehouse: (row) => {
    // A location list is often just strings.
    if (typeof row === "string") return { key: row.trim(), label: row.trim(), isGroup: false, disabled: false };
    const name = str(pick(row, [...ALIASES.warehouse, "name", "title", "label"]));
    const id = str(pick(row, ["id", "warehouse_id", "code"]));
    // **The key is what a stock row will say, not what a person would read.**
    // ERPRev's `/warehouses` gives `{id, name}` and its stock rows carry
    // `warehouse_id` — so a map keyed on the name would be a map nothing ever
    // matches, and every shop would come back empty with no error anywhere.
    // The id wins where there is one; the name is kept for the admin to read.
    return {
      key: id || name,
      label: name || id,
      isGroup: bool(pick(row, ["is_group", "isGroup", "has_children", "is_parent"])),
      disabled: bool(pick(row, [...ALIASES.disabled, "is_closed"])),
    };
  },
  group: (row) => ({
    name: typeof row === "string" ? row.trim() : str(pick(row, [...ALIASES.group, "name", "title", "label", "id", "code"])),
  }),
};


/**
 * ERPRevolution (ERPrev) — and, by construction, most other SME ERPs.
 *
 * Alias-driven rather than hardcoded, because ERPRev's API reference is behind
 * their login and this connector should not be a second guess at a vendor's
 * field names. The paths below are the shapes their Help Centre's inventory
 * section implies; every one of them is editable in the admin, and the probe
 * prints the real keys of a real response so correcting them takes a minute.
 *
 * What this adapter assumes about *any* ERP, and what would have to be true
 * for a very different one:
 *   · a list endpoint per resource, returning JSON
 *   · one row per sellable item, carrying its own code and name
 *   · stock either on the product row or on its own endpoint, per location
 * A vendor that fails those needs its own adapter, not an override.
 */
const erprev = {
  id: "erprev",
  label: "ERPRevolution (ERPrev) — API v2",
  note: "Set up from ERPRev's own API reference. The base URL is your system's address with /api/v2 on the end; the endpoints and field names below are theirs. The one thing still to confirm is the exact signing canonical string — see the note under Authentication.",
  docs: "https://erprev.com/user-guide/developers/",
  defaults: {
    // "Every request is authenticated with an HMAC-SHA256 signature over its
    // method, path, timestamp, nonce and body — the secret never travels."
    authStyle: "hmac",
    // "List endpoints return the standard envelope and cursor pagination" —
    // limit (1–200, default 50), cursor, sort.
    pageStyle: "cursor",
    // Straight from "API endpoints — Products & stock". Prices ride the
    // product row (`price`), so there is no price endpoint to name.
    paths: {
      products: "/products",
      prices: "",
      stock: "/stocks",
      warehouses: "/warehouses",
      groups: "/product-categories",
    },
    // `{ "data": [...], "page": { limit, count, has_more, next_cursor } }`
    envelopeKey: "data",
    cursorKey: "page.next_cursor",
    // Reachability, with no credentials at all.
    pingPath: "/ping",
    // The API publishes its own OpenAPI 3 document here, publicly — which is
    // how the admin can show the real security scheme rather than trusting
    // anything written in this file.
    specPath: "/docs",
    pageSize: 200,
  },
  // ERPRev has no variant/parent concept on a product: `/products` rows are
  // flat, each with its own price, and `measure` ("pcs", "30ml") is the
  // closest thing to a variation label. So every product becomes a one-size
  // listing unless somebody splits it in the shop afterwards.
  priceOnProduct: true,
  scopes: ["products.read", "stocks.read", "warehouses.read"],
  normalise: genericNormalise,
};

/**
 * ERPNext (Frappe). Kept because it was already written and tested, it costs
 * nothing to keep, and "the warehouse system is Frappe even though the ERP
 * isn't" is a real situation.
 *
 * Frappe's REST API is the one genuinely unusual transport here: fields are
 * requested explicitly as a JSON array, filters are JSON, and the DocTypes are
 * named with spaces. Those live in `erp.js`'s request builder, keyed off
 * `dialect`.
 */
const erpnext = {
  id: "erpnext",
  label: "ERPNext / Frappe",
  note: "Reads Item, Item Price and Bin over Frappe's REST API. Needs the price list named exactly as ERPNext names it.",
  dialect: "frappe",
  defaults: {
    authStyle: "token",
    pageStyle: "frappe",
    paths: { products: "/api/resource/Item", prices: "/api/resource/Item Price", stock: "/api/resource/Bin", warehouses: "/api/resource/Warehouse", groups: "/api/resource/Item Group" },
  },
  priceOnProduct: false,
  normalise: {
    ...genericNormalise,
    // ERPNext's variant attributes arrive as a child table, not a flat field.
    product(row, f) {
      const base = genericNormalise.product(row, f);
      const attrs = Array.isArray(row.attributes)
        ? row.attributes.map((a) => str(a.attribute_value)).filter(Boolean)
        : [];
      return { ...base, options: attrs.length ? attrs : base.options };
    },
  },
};

/** The escape hatch: same machinery, nothing pre-filled, every path typed in. */
const custom = {
  id: "custom",
  label: "Another ERP (type the endpoints in)",
  note: "Same reader as ERPrev. Point it at the ERP's list endpoints and, if the field names aren't recognised, name them below.",
  defaults: {
    authStyle: "bearer",
    pageStyle: "page",
    paths: { products: "", prices: "", stock: "", warehouses: "", groups: "" },
  },
  priceOnProduct: true,
  normalise: genericNormalise,
};

export const ADAPTERS = { erprev, erpnext, custom };

/** The adapter the house has chosen, defaulting to ERPrev — which is the ERP they have. */
export const adapterFor = (vendor) => ADAPTERS[str(vendor)] || ADAPTERS.erprev;

/** For the admin's vendor picker. */
export const adapterList = () => Object.values(ADAPTERS).map((a) => ({ id: a.id, label: a.label, note: a.note, docs: a.docs || "", defaults: a.defaults }));
