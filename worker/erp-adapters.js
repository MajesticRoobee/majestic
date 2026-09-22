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
  group: ["item_group", "itemGroup", "category", "category_name", "categoryName", "product_group", "productGroup", "class", "department", "cat"],
  description: ["description", "descr", "details", "long_description", "notes", "body"],
  image: ["image", "image_url", "imageUrl", "photo", "picture", "thumbnail", "img"],
  disabled: ["disabled", "is_disabled", "inactive", "is_deleted", "deleted", "archived"],
  active: ["active", "enabled", "is_active", "status"],
  option: ["variant", "variant_name", "variantName", "option", "option1", "size", "unit", "uom", "attribute_value", "spec"],
  price: ["price_list_rate", "priceListRate", "price", "unit_price", "unitPrice", "selling_price", "sellingPrice", "sale_price", "salePrice", "rate", "amount", "retail_price"],
  validFrom: ["valid_from", "validFrom", "effective_from", "effectiveFrom", "start_date", "starts_at"],
  warehouse: ["warehouse", "warehouse_name", "warehouseName", "location", "location_name", "locationName", "store", "store_name", "branch", "branch_name", "site", "outlet"],
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
  bearer: { label: "Bearer token (Authorization: Bearer <secret>)" },
  "key-secret-headers": { label: "Two headers (X-API-KEY / X-API-SECRET)" },
  token: { label: "Token pair (Authorization: token <key>:<secret>)" },
  basic: { label: "HTTP Basic (key as username, secret as password)" },
  query: { label: "Query string (?api_key=…&api_secret=…)" },
};

export function authFor(style, key, secret) {
  const k = str(key), s = str(secret);
  switch (style) {
    case "token":
      return { headers: { authorization: `token ${k}:${s}` }, query: {} };
    case "basic":
      return { headers: { authorization: `Basic ${btoa(`${k}:${s}`)}` }, query: {} };
    case "key-secret-headers":
      return { headers: { "x-api-key": k, ...(s ? { "x-api-secret": s } : {}) }, query: {} };
    case "query":
      return { headers: {}, query: { api_key: k, ...(s ? { api_secret: s } : {}) } };
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
  page: { label: "?page=1&per_page=200 (page number)" },
  offset: { label: "?limit=200&offset=0 (row offset)" },
  frappe: { label: "?limit_page_length=200&limit_start=0 (Frappe / ERPNext)" },
  none: { label: "No paging — the endpoint returns everything" },
};

export function pageQuery(style, { page, pageSize }) {
  switch (style) {
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
    code: str(pick(row, fieldsFor(f, "code"))),
    warehouse: str(pick(row, fieldsFor(f, "warehouse"))),
    onHand: num(pick(row, fieldsFor(f, "onHand"))),
    reserved: num(pick(row, fieldsFor(f, "reserved"))),
  }),
  warehouse: (row) => {
    // A location list is often just strings.
    if (typeof row === "string") return { name: row.trim(), isGroup: false, disabled: false };
    // The same alias list the *stock* rows are read with, and then the names a
    // list endpoint uses that a stock row wouldn't. These two readers have to
    // agree: a location discovered under one spelling and referenced under
    // another is a location the house maps and the stock never reaches.
    return {
      name: str(pick(row, [...ALIASES.warehouse, "name", "title", "label", "id", "code"])),
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
  label: "ERPRevolution (ERPrev)",
  note: "Alias-driven. If a field comes back empty, run the probe and name the ERP's own spelling of it below.",
  defaults: {
    authStyle: "bearer",
    pageStyle: "page",
    paths: { products: "/api/products", prices: "", stock: "/api/inventory", warehouses: "/api/warehouses", groups: "/api/categories" },
  },
  // Prices usually ride the product row on an ERP like this, so `prices` is
  // empty by default: `erp.js` reads the price off the product when there is
  // no price endpoint configured.
  priceOnProduct: true,
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
export const adapterList = () => Object.values(ADAPTERS).map((a) => ({ id: a.id, label: a.label, note: a.note, defaults: a.defaults }));
