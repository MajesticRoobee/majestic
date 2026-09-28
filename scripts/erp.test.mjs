// The ERP link, exercised directly.
//
// The house runs **ERPRevolution (ERPrev)**. An earlier planning note had
// guessed from the abbreviation that it meant ERPNext, and the first version
// of this connector was written against ERPNext's REST API — every line of the
// transport aimed at the wrong product. That is the mistake this file is
// arranged to make impossible to repeat quietly:
//
//   · the **engine** is proved on neutral rows, so it cannot acquire a
//     vendor's field names by accident
//   · each **adapter** is proved separately on rows shaped the way that
//     vendor shapes them
//   · the **generic reader** is proved against the shapes SME ERPs actually
//     use, because ERPRev's API reference is behind their login and a
//     connector that only works on one guessed spelling is a connector that
//     fails on the first real response
//
// Two of the engine's pieces decide whether an unattended sync is safe:
// `buildFeed` (wrong, and variations land under the wrong parent or stock in
// the wrong city) and `stockGuard` (wrong, and an expired key empties the
// shop silently).
import { createHash, createHmac } from "node:crypto";
import { buildFeed, groupByUnit, stockGuard, matchToShop, matchKey, stockByCode, ERP_SOURCE } from "../worker/erp.js";
import {
  adapterFor, authFor, unwrap, pageQuery, ADAPTERS, ALIASES,
  signRequest, canonicalRequest, sortedQuery, sha256Hex, newNonce, hmacHex,
  ERPREV_HEADERS, EMPTY_BODY_SHA256,
} from "../worker/erp-adapters.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

// ---- 0. The connector is not welded to one vendor ------------------------
console.log("\nWhich ERP is a setting, not a rewrite");

check("ERPrev is the default, because that is the ERP the house has", adapterFor().id, "erprev");
check("...and an unknown name falls back to it rather than throwing", adapterFor("sap-b1").id, "erprev");
check("ERPNext is still reachable for anyone who needs it", adapterFor("erpnext").id, "erpnext");
check("every adapter declares the five endpoints the engine asks for",
  Object.values(ADAPTERS).filter((a) => !["products", "prices", "stock", "warehouses", "groups"].every((k) => k in a.defaults.paths))
    .map((a) => a.id), []);

// The catalogue link tag must not be the vendor's name. It is written into
// `products.external_source` and upserts key on it — so if it said "erpnext"
// and the ERP turned out to be ERPRev, correcting the vendor would orphan
// every link and re-import the whole catalogue as duplicates. That is not
// hypothetical: it is precisely what happened here.
check("the catalogue's link tag survives being pointed at a different ERP", ERP_SOURCE, "erp");

// ---- 1. Credentials, paging, envelopes -----------------------------------
console.log("\nTalking to something we have not seen");

// ERPRev's v2 API signs each request rather than sending a token, so `hmac`
// is its default — see "Signing a request" below. `raw` stays for an API that
// wants the token as the bare Authorization value with no scheme in front of
// it, which is a real shape and one that produces a 401 indistinguishable
// from a wrong key when you get it wrong.
check("the token on its own, for an API that wants it that way", authFor("raw", "k", "s").headers.authorization, "s");
check("ERPrev signs instead, and that is its default", ADAPTERS.erprev.defaults.authStyle, "hmac");
check("...and a signed style sends no credential header of its own", authFor("hmac", "k", "s"), { headers: {}, query: {}, signed: true });
check("bearer", authFor("bearer", "k", "s").headers.authorization, "Bearer s");
check("...falling back to the key when the ERP issues only one token",
  authFor("bearer", "only-token", "").headers.authorization, "Bearer only-token");
check("two headers", authFor("key-secret-headers", "k", "s").headers, { "x-api-key": "k", "x-api-secret": "s" });
check("frappe's token pair", authFor("token", "k", "s").headers.authorization, "token k:s");
check("basic", authFor("basic", "k", "s").headers.authorization, `Basic ${btoa("k:s")}`);
check("query string keeps credentials out of headers", authFor("query", "k", "s").query, { api_key: "k", api_secret: "s" });

// ---- ERPRev's own contract, from its API reference ----------------------
console.log("\nThe things ERPRev's documentation actually specifies");

const rev = ADAPTERS.erprev.defaults;
check("everything lives under the signed v2 API", rev.authStyle, "hmac");
check("lists are cursor-paged, not numbered", rev.pageStyle, "cursor");
check("the endpoints are the ones the reference names",
  [rev.paths.products, rev.paths.stock, rev.paths.warehouses, rev.paths.groups],
  ["/products", "/stocks", "/warehouses", "/product-categories"]);
// Prices ride the product row on ERPRev — there is no price list endpoint to
// point at, and naming one would make every product look unpriced.
check("...and there is no separate price endpoint", rev.paths.prices, "");
check("the envelope and the cursor are where the reference says",
  [rev.envelopeKey, rev.cursorKey], ["data", "page.next_cursor"]);
check("a list caps at 200 rows", rev.pageSize, 200);
check("reachability has an endpoint that needs no key at all", rev.pingPath, "/ping");
check("and the API publishes its own spec, so the guesswork has an answer", rev.specPath, "/docs");

// ---- ERPRev's Signing requests page, to the byte --------------------------
console.log("\nSigning a request, as ERPRev's Signing requests page states it");

// HMAC-SHA256, hex — checked against a published RFC 4231 test vector, so
// this is right in the absolute rather than merely self-consistent.
check("HMAC-SHA256 is HMAC-SHA256",
  await hmacHex("key", "The quick brown fox jumps over the lazy dog"),
  "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
check("the body line of a GET is the SHA-256 of nothing, as the page prints it",
  [await sha256Hex(""), EMPTY_BODY_SHA256], ["e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"]);

check("the four headers are the four the page names",
  Object.values(ERPREV_HEADERS), ["X-Api-Key", "X-Api-Timestamp", "X-Api-Nonce", "X-Api-Signature"]);
check("a nonce is 32 hex characters — 16 random bytes", /^[0-9a-f]{32}$/.test(newNonce()), true);
check("...and never the same twice", newNonce() === newNonce(), false);

check("the query is its key=value pairs sorted and joined by &", sortedQuery("?limit=5&cursor=abc&a=1"), "a=1&cursor=abc&limit=5");
check("no query, no question mark",
  canonicalRequest({ method: "get", path: "/api/v2/customers", timestamp: 1, nonce: "n", bodyHash: "h" }),
  "GET\n/api/v2/customers\n1\nn\nh");
check("five lines exactly, with the sorted query on the path line",
  canonicalRequest({ method: "GET", path: "/api/v2/products", query: "limit=200&cursor=c1", timestamp: 1751620522, nonce: "ab", bodyHash: EMPTY_BODY_SHA256 }).split("\n"),
  ["GET", "/api/v2/products?cursor=c1&limit=200", "1751620522", "ab", EMPTY_BODY_SHA256]);

// Their Node reference client, transcribed from the page and run with
// node:crypto — a different implementation from the Worker's WebCrypto — so
// agreement means agreement with ERPRev, not with ourselves.
function reference({ secret, method, path, query = "", body = "", ts, nonce }) {
  const sq = query.split("&").filter(Boolean).sort().join("&");
  const pwq = sq ? path + "?" + sq : path;
  const hash = createHash("sha256").update(body || "").digest("hex");
  const canonical = [method.toUpperCase(), pwq, ts, nonce, hash].join("\n");
  return { pwq, sig: "v1=" + createHmac("sha256", secret).update(canonical).digest("hex") };
}
const nonce = "0123456789abcdef0123456789abcdef";
const now = 1751620522000;
const ours = await signRequest({ key: "k_live_1", secret: "s3cr3t", method: "get", url: "https://majesticroobee.erprev.com/api/v2/products?limit=200&cursor=eyJpZCI6NDJ9", now, nonce });
const theirs = reference({ secret: "s3cr3t", method: "GET", path: "/api/v2/products", query: "limit=200&cursor=eyJpZCI6NDJ9", ts: 1751620522, nonce });
check("the signature is byte-for-byte what ERPRev's own client computes", ours.headers["X-Api-Signature"], theirs.sig);
check("...and carries the v1= prefix the page insists on", ours.headers["X-Api-Signature"].startsWith("v1="), true);
check("the URL fetched carries the query in the order that was signed",
  ours.url.pathname + ours.url.search, theirs.pwq);
check("the path signed includes /api/v2, as the server receives it", ours.canonical.split("\n")[1].startsWith("/api/v2/products"), true);
check("the timestamp header is unix seconds, and the same one that was signed",
  [ours.headers["X-Api-Timestamp"], ours.canonical.split("\n")[2]], ["1751620522", "1751620522"]);
check("the nonce header is the nonce that was signed", ours.headers["X-Api-Nonce"], nonce);
check("the key id is sent", ours.headers["X-Api-Key"], "k_live_1");
check("the secret itself is never in a header",
  Object.values(ours.headers).some((v) => String(v).includes("s3cr3t")), false);
const withBody = await signRequest({ key: "k", secret: "s", method: "POST", url: "https://x.test/api/v2/orders", body: '{"a":1}', now, nonce });
check("a body is signed by its SHA-256, and still matches the reference",
  withBody.headers["X-Api-Signature"], reference({ secret: "s", method: "POST", path: "/api/v2/orders", body: '{"a":1}', ts: 1751620522, nonce }).sig);
const unsorted = await signRequest({ key: "k", secret: "s", url: "https://x.test/api/v2/p?z=1&a=2", now, nonce });
check("an unsorted query is sorted before signing — the mistake the page warns about",
  unsorted.headers["X-Api-Signature"], reference({ secret: "s", method: "GET", path: "/api/v2/p", query: "a=2&z=1", ts: 1751620522, nonce }).sig);

console.log("\nPaging");
check("a cursor page sends a limit and nothing else the first time",
  pageQuery("cursor", { page: 0, pageSize: 200, cursor: "" }), { limit: 200 });
check("...and the cursor the last response gave, after that",
  pageQuery("cursor", { page: 1, pageSize: 200, cursor: "abc" }), { limit: 200, cursor: "abc" });
check("page numbering", pageQuery("page", { page: 2, pageSize: 200 }), { page: 3, per_page: 200 });
check("row offset", pageQuery("offset", { page: 2, pageSize: 200 }), { limit: 200, offset: 400 });
check("frappe", pageQuery("frappe", { page: 2, pageSize: 200 }), { limit_page_length: 200, limit_start: 400 });
check("an endpoint that returns everything is not paged", pageQuery("none", { page: 0, pageSize: 200 }), {});

// Getting this wrong is the difference between "the ERP returned nothing" and
// a working sync, and every ERP wraps its rows differently.
check("a bare array", unwrap([1, 2]).length, 2);
check("{data:[…]}", unwrap({ data: [1] }).length, 1);
check("{results:[…]}", unwrap({ results: [1, 2, 3] }).length, 3);
check("{items:[…]}", unwrap({ items: [1] }).length, 1);
check("Laravel's paginated {data:{data:[…]}}", unwrap({ data: { data: [1, 2] }, total: 2 }).length, 2);
check("a key the house named by hand", unwrap({ payload: { products: [1, 2, 3] } }, "payload.products").length, 3);
check("something we can't find reads as empty, not as a crash", unwrap({ weird: { nested: 1 } }), []);

// ---- 2. The generic reader, on the shapes SME ERPs actually use ----------
console.log("\nReading a product row without being told the schema");

const erprev = adapterFor("erprev").normalise;
const read = (row, fields) => erprev.product(row, fields);

check("the commonest shape of all",
  (() => { const p = read({ sku: "VR-30", name: "Velvet Reign 30ml", category: "Perfumes", quantity: 12, selling_price: 35000 });
    return [p.code, p.name, p.group, p.inlinePrice, p.inlineStock]; })(),
  ["VR-30", "Velvet Reign 30ml", "Perfumes", 35000, 12]);

check("camelCase reads the same as snake_case",
  (() => { const p = read({ productCode: "A", productName: "B", unitPrice: 9 }); return [p.code, p.name, p.inlinePrice]; })(),
  ["A", "B", 9]);

// An ERP that renders money for humans before putting it in JSON is common,
// and dropping the row would read to the house as "this product has no price".
check("a price formatted for a human still parses", read({ sku: "A", price: "₦35,000.00" }).inlinePrice, 35000);
check("...and a price that is genuinely absent is zero, not NaN", read({ sku: "A" }).inlinePrice, 0);

// `disabled` and `active` say the same thing in opposite directions and an ERP
// usually has one or the other, so both have to be understood — and a row
// that says neither is for sale.
check("disabled=1 is not for sale", read({ sku: "A", disabled: 1 }).disabled, true);
check("active=false is not for sale", read({ sku: "A", active: false }).disabled, true);
check('status "Active" is for sale', read({ sku: "A", status: "Active" }).disabled, false);
check('status "Inactive" is not', read({ sku: "A", status: "Inactive" }).disabled, true);
check("a row with no opinion is for sale", read({ sku: "A" }).disabled, false);

check("an ERP description arrives as plain text, not as somebody's HTML",
  read({ sku: "A", description: "<p>Oud &amp; saffron.</p>" }).description, "Oud & saffron.");
// Entities are decoded before tags are stripped, so an *encoded* tag is
// stripped too rather than surviving as text.
check("...including a tag that arrived HTML-encoded",
  read({ sku: "A", description: "&lt;b&gt;Bold&lt;/b&gt; claim" }).description, "Bold claim");

// The escape hatch, for the field this reader cannot guess.
check("a named override beats every alias",
  read({ sku: "wrong", our_internal_ref: "right" }, { code: "our_internal_ref" }).code, "right");
check("...and an override naming a field that isn't there falls back rather than blanking",
  read({ sku: "still-here" }, { code: "not_a_field" }).code, "still-here");

// The shapes ERPRev's reference actually documents, read with nothing
// configured — which is the test that this adapter is set up from the
// documentation rather than from hope.
console.log("\nERPRev's own product row");
const revRow = {
  id: 1042, name: "Ball Pen Blue", description: "<p>Blue ink</p>", measure: "pcs",
  price: 250, cost_price: 150, reorder_level: 20, category_name: "Stationery",
  barcode: "0123", thumb_image_url: "https://x/p.jpg", qty: 100,
};
check("its id, name and price", (() => { const p = read(revRow); return [p.code, p.name, p.inlinePrice]; })(), ["1042", "Ball Pen Blue", 250]);
check("its category", read(revRow).group, "Stationery");
check("its picture", read(revRow).image, "https://x/p.jpg");
check("its description, with the HTML taken out", read(revRow).description, "Blue ink");
// `measure` is the closest thing ERPRev has to a variation label — "pcs",
// "30ml" — so it becomes the option rather than being dropped.
check("its unit becomes the variation label", read(revRow).options, ["pcs"]);
check("a quantity on the product row is noticed", read(revRow).inlineStock, 100);

console.log("\nPrices, stock and locations");
check("a price row", erprev.price({ sku: "A", price: "1,200", valid_from: "2026-01-01" }), { code: "A", price: 1200, validFrom: "2026-01-01" });
check("a stock row", erprev.stock({ sku: "A", branch: "Abuja Main", available_qty: 9, committed: 2 }),
  { code: "A", warehouse: "Abuja Main", onHand: 9, reserved: 2 });

// **The join that would silently ruin everything.** On a stock row, `id` is
// the stock record's own id — reading it as the product would attach every
// quantity to the wrong product, and nothing anywhere would report an error.
check("a stock row joins on product_id, never on its own id",
  erprev.stock({ id: 77, product_id: 1042, warehouse_id: 3, qty: 12 }),
  { code: "1042", warehouse: "3", onHand: 12, reserved: 0 });

// ...and the location map has to be keyed on what the stock row says. ERPRev
// lists `{id, name}` and its stock rows carry `warehouse_id`, so a map keyed
// on the name is a map nothing matches and every shop comes back empty.
check("a location is keyed on its id and labelled with its name",
  erprev.warehouse({ id: 3, name: "Main Store", location_id: 1 }),
  { key: "3", label: "Main Store", isGroup: false, disabled: false });
check("...and the key it produces is the one a stock row carries",
  erprev.warehouse({ id: 3, name: "Main Store" }).key,
  erprev.stock({ product_id: 1, warehouse_id: 3, qty: 1 }).warehouse);
check("an ERP that names its locations instead still keys on the name",
  erprev.warehouse({ name: "Abuja Main" }).key, "Abuja Main");
check("a location list that is just strings", erprev.warehouse("Abuja Main"),
  { key: "Abuja Main", label: "Abuja Main", isGroup: false, disabled: false });
check("...and one that is objects", erprev.warehouse({ location_name: "Lagos VI", disabled: 1 }),
  { key: "Lagos VI", label: "Lagos VI", isGroup: false, disabled: true });

// These two readers have to agree. A location discovered under one spelling
// and referenced under another is a location the house maps and the stock
// never reaches — and nothing about that failure is visible from the admin.
check("every name a location list might use is one the reader recognises",
  ALIASES.warehouse.filter((k) => erprev.warehouse({ [k]: "Abuja Main" }).key !== "Abuja Main"), []);
check("...and every name a stock row might use, too",
  ALIASES.stockWarehouse.filter((k) => erprev.stock({ product_id: "p", [k]: "Abuja Main" }).warehouse !== "Abuja Main"), []);

console.log("\nThe ERPNext adapter still reads ERPNext");
const frappe = adapterFor("erpnext").normalise;
check("its variant attributes are a child table, not a field",
  frappe.product({ item_code: "D-30", item_name: "Dynasty 30ml", variant_of: "D", attributes: [{ attribute_value: "30ml" }] }).options, ["30ml"]);
check("its template flag", frappe.product({ item_code: "D", has_variants: 1 }).isTemplate, true);
check("its price field", frappe.price({ item_code: "D-30", price_list_rate: 35000 }).price, 35000);
check("its bin", frappe.stock({ item_code: "D-30", warehouse: "Stores - MR", actual_qty: 12, reserved_qty: 5 }),
  { code: "D-30", warehouse: "Stores - MR", onHand: 12, reserved: 5 });

// ---- 3. The engine, on neutral rows --------------------------------------
console.log("\nNeutral rows become the feed the ingest already understands");

const WAREHOUSES = { "Abuja Main": "abuja", "Abuja Overflow": "abuja", "Lagos VI": "lagos" };
const GROUPS = { "Perfume Oils": "perfume-oils" };
const prod = (o) => ({ code: "", name: "", parentCode: "", isTemplate: false, group: "", description: "", image: "", disabled: false, options: [], inlinePrice: 0, ...o });
const feed = (o) => buildFeed({ products: [], prices: [], stock: [], warehouses: WAREHOUSES, groups: GROUPS, defaultCat: "perfumes", known: new Set(), ...o });

const TEMPLATE = prod({ code: "DYNASTY", name: "Dynasty", isTemplate: true, group: "Perfume Oils", description: "Oud and saffron." });
const V30 = prod({ code: "DYNASTY-30", name: "Dynasty 30ml", parentCode: "DYNASTY", group: "Perfume Oils", options: ["30ml"] });
const V50 = prod({ code: "DYNASTY-50", name: "Dynasty 50ml", parentCode: "DYNASTY", group: "Perfume Oils", options: ["50ml"] });
const price = (code, p, extra = {}) => ({ code, price: p, validFrom: "", ...extra });

const both = feed({ products: [TEMPLATE, V30, V50], prices: [price("DYNASTY-30", 35000), price("DYNASTY-50", 52000)] });
check("a template and its variations become two SKUs under one parent",
  both.rows.map((r) => [r.parentId, r.externalId, r.option1, r.priceNgn]),
  [["DYNASTY", "DYNASTY-30", "30ml", 35000], ["DYNASTY", "DYNASTY-50", "50ml", 52000]]);
check("the template itself is never a thing to sell", both.rows.some((r) => r.externalId === "DYNASTY"), false);

// Most of a typical SME catalogue is simple items; dropping them would lose it.
check("a simple item is its own parent with one variation",
  feed({ products: [prod({ code: "CANDLE-1", name: "Amber Candle" })], prices: [price("CANDLE-1", 14000)] })
    .rows.map((r) => [r.parentId, r.externalId, r.option1]), [["CANDLE-1", "CANDLE-1", "One size"]]);

check("a disabled item is left out", feed({ products: [prod({ code: "A", disabled: true })], prices: [price("A", 1)] }).rows.length, 0);

const unpriced = feed({ products: [TEMPLATE, V30], prices: [] });
check("an item with no price is skipped, by name", [unpriced.rows.length, unpriced.skipped[0].item], [0, "DYNASTY-30"]);

// The usual shape for an ERP like ERPRev: no price endpoint at all.
check("a price on the product row is used when there is no price endpoint",
  feed({ products: [prod({ code: "A", name: "A", inlinePrice: 4500 })] }).rows[0].priceNgn, 4500);
check("...and a price endpoint overrides it, because that is the one the house named",
  feed({ products: [prod({ code: "A", name: "A", inlinePrice: 4500 })], prices: [price("A", 5000)] }).rows[0].priceNgn, 5000);

check("the latest dated price wins",
  feed({ products: [prod({ code: "X", name: "X" })],
    prices: [price("X", 1000, { validFrom: "2026-01-01" }), price("X", 1400, { validFrom: "2026-06-01" })] }).rows[0].priceNgn, 1400);

// A variation must have a label or the ingest drops it, so there are two
// fallbacks and neither is empty.
check("no option value falls back to the part of the name the template doesn't explain",
  feed({ products: [TEMPLATE, prod({ code: "DYNASTY-X", name: "Dynasty 100ml", parentCode: "DYNASTY" })], prices: [price("DYNASTY-X", 9)] })
    .rows[0].option1, "100ml");
check("...and with nothing to go on, the code, never nothing",
  feed({ products: [TEMPLATE, prod({ code: "DYNASTY-Z", name: "Unrelated", parentCode: "DYNASTY" })], prices: [price("DYNASTY-Z", 9)] })
    .rows[0].option1, "DYNASTY-Z");

check("a second and third option become the other axes",
  (() => { const r = feed({ products: [TEMPLATE, prod({ code: "D-A", name: "Dynasty", parentCode: "DYNASTY", options: ["50ml", "Gold"] })], prices: [price("D-A", 9)] }).rows[0];
    return [r.option1, r.option2]; })(), ["50ml", "Gold"]);

// ---- 3b. One fragrance, three sizes --------------------------------------
console.log("\nGrouping a flat catalogue back into listings");

// ERPRev's products are flat: three sizes of one perfume are three rows with
// no parent between them. Imported faithfully that is three cards in the shop
// for one fragrance.
const flat = [
  prod({ code: "1042", name: "Velvet Reign 30ml", options: ["30ml"], inlinePrice: 35000 }),
  prod({ code: "1043", name: "Velvet Reign 50ml", options: ["50ml"], inlinePrice: 52000 }),
  prod({ code: "1044", name: "Amber Candle", options: ["pcs"], inlinePrice: 14000 }),
];
check("left alone, each row is its own listing",
  feed({ products: flat }).rows.map((r) => r.parentId), ["1042", "1043", "1044"]);

const grouped = buildFeed({ products: flat, prices: [], stock: [], warehouses: WAREHOUSES, groups: {}, defaultCat: "perfumes", known: new Set(), groupUnits: true });
check("switched on, the two sizes become one listing",
  grouped.rows.map((r) => [r.parentId, r.option1]),
  [["stem:velvet reign", "30ml"], ["stem:velvet reign", "50ml"], ["1044", "pcs"]]);
check("...named for the fragrance, not for one of its bottles", grouped.rows[0].parentName, "Velvet Reign");
check("...and each size keeps its own price and its own code",
  grouped.rows.map((r) => [r.externalId, r.priceNgn]), [["1042", 35000], ["1043", 52000], ["1044", 14000]]);

// The guards on the heuristic. Merging two products that only look related is
// worse than leaving them apart, so it only fires on an exact unit suffix.
check("a name that doesn't end in its own unit is never merged",
  groupByUnit([prod({ code: "a", name: "30ml Travel Atomiser", options: ["pcs"] }),
    prod({ code: "b", name: "Refill Funnel", options: ["pcs"] })]).map((p) => p.parentCode), ["", ""]);
check("a stem only one product has is left alone",
  groupByUnit([prod({ code: "a", name: "Velvet Reign 30ml", options: ["30ml"] })])[0].parentCode, "");
check("case and the separator before the unit don't matter",
  groupByUnit([prod({ code: "a", name: "Velvet Reign - 30ML", options: ["30ml"] }),
    prod({ code: "b", name: "Velvet Reign 50ml", options: ["50ml"] })]).map((p) => p.parentCode),
  ["stem:velvet reign", "stem:velvet reign"]);
check("a product that already has a parent is not re-parented",
  groupByUnit([prod({ code: "a", name: "X 30ml", options: ["30ml"], parentCode: "REAL" }),
    prod({ code: "b", name: "X 50ml", options: ["50ml"], parentCode: "REAL" })]).map((p) => p.parentCode), ["REAL", "REAL"]);
check("a name that is only its unit leaves nothing to group on",
  groupByUnit([prod({ code: "a", name: "30ml", options: ["30ml"] }), prod({ code: "b", name: "30ml", options: ["30ml"] })])
    .map((p) => p.parentCode), ["", ""]);

// ---- 4. Stock lands in the right city, or nowhere ------------------------
console.log("\nStock, through the location map");

const stockRow = (code, warehouse, onHand, reserved = 0) => ({ code, warehouse, onHand, reserved });

check("each location's count lands in its own shop",
  feed({ products: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)],
    stock: [stockRow("DYNASTY-30", "Abuja Main", 12), stockRow("DYNASTY-30", "Lagos VI", 4)] }).rows[0].stock,
  { abuja: 12, lagos: 4 });

check("two locations mapped to one shop are added, not overwritten",
  feed({ products: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)],
    stock: [stockRow("DYNASTY-30", "Abuja Main", 12), stockRow("DYNASTY-30", "Abuja Overflow", 5)] }).rows[0].stock,
  { abuja: 17 });

check("stock already reserved is not stock we have",
  feed({ products: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)], stock: [stockRow("DYNASTY-30", "Abuja Main", 12, 5)] }).rows[0].stock,
  { abuja: 7 });
check("...and a reservation bigger than the shelf is zero, not a negative",
  feed({ products: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)], stock: [stockRow("DYNASTY-30", "Abuja Main", 2, 9)] }).rows[0].stock,
  { abuja: 0 });

// The point of the map.
check("stock in an unmapped location is not counted anywhere",
  feed({ products: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)], stock: [stockRow("DYNASTY-30", "Somewhere Else", 99)] }).rows[0].stock,
  undefined);

// Sending `{}` is different from sending nothing: the ingest sets counts
// absolutely, so an item with no stock row must send no stock key at all
// rather than emptying a shelf the shop is holding.
check("an item the ERP has never stocked sends no stock at all, rather than zero",
  Object.prototype.hasOwnProperty.call(feed({ products: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)] }).rows[0], "stock"), false);

// An ERP that puts the quantity on the product row and nowhere else is common,
// and is fine — but only while there is one shop it could mean.
const oneShop = buildFeed({ products: [prod({ code: "A", name: "A", inlinePrice: 5, inlineStock: 7 })], prices: [], stock: [],
  warehouses: { "Main": "abuja" }, groups: {}, defaultCat: "perfumes", known: new Set() });
check("a quantity on the product row counts when exactly one shop is mapped", oneShop.rows[0].stock, { abuja: 7 });
const twoShops = buildFeed({ products: [prod({ code: "A", name: "A", inlinePrice: 5, inlineStock: 7 })], prices: [], stock: [],
  warehouses: { "Main": "abuja", "Other": "lagos" }, groups: {}, defaultCat: "perfumes", known: new Set() });
check("...and refuses to guess when two are, saying why",
  [twoShops.rows[0].stock, twoShops.skipped.some((x) => x.warning && /can't be told which one/.test(x.error))],
  [undefined, true]);

// ---- 5. The ERP owns price and stock; the shop owns its own copy ---------
console.log("\nWho owns which field");

const fresh = feed({ products: [TEMPLATE, V30, V50], prices: [price("DYNASTY-30", 1), price("DYNASTY-50", 2)] });
check("a product the shop has never seen arrives with its name and description",
  [fresh.rows[0].parentName, fresh.rows[0].description], ["Dynasty", "Oud and saffron."]);
check("...on the head of the group only, so the ingest reads it once", fresh.rows[1].parentName, undefined);
check("a mapped category is used", fresh.rows[0].category, "perfume-oils");
check("an unmapped one falls to the default, and says so",
  (() => { const r = feed({ products: [{ ...TEMPLATE, group: "Something Else" }, V30], prices: [price("DYNASTY-30", 1)] });
    return [r.rows[0].category, r.skipped.some((x) => x.warning && /Something Else/.test(x.error))]; })(),
  ["perfumes", true]);

// This is what stops the connector eating the shop's merchandising every hour.
const knownFeed = feed({ products: [TEMPLATE, V30], prices: [price("DYNASTY-30", 35000)], known: new Set(["DYNASTY"]) });
check("a product the shop already has keeps its own name, copy and photograph",
  [knownFeed.rows[0].parentName, knownFeed.rows[0].description, knownFeed.rows[0].imageUrl], [undefined, undefined, undefined]);
check("...but its price still comes from the ERP", knownFeed.rows[0].priceNgn, 35000);

// ---- 6. The guard --------------------------------------------------------
console.log("\nThe line that stops an expired key emptying the shop");

// `before` is everything the ERP looks after — not the whole catalogue. See
// the note on stockGuard for why that distinction is the whole design.
const shelf = { A: 40, B: 30, C: 30 }; // 100 units under the ERP's care

check("an ordinary day passes", stockGuard({ before: shelf, after: { A: 38, B: 30 }, pct: 25 }).ok, true);
check("a rise passes", stockGuard({ before: shelf, after: { A: 80 }, pct: 25 }).ok, true);
check("nothing changing passes", stockGuard({ before: shelf, after: { A: 40, B: 30, C: 30 }, pct: 25 }).ok, true);

const wipe = stockGuard({ before: shelf, after: { A: 0, B: 0, C: 0 }, pct: 25 });
check("a feed that zeroes everything is refused", wipe.ok, false);
check("...and says how far it would have gone", [wipe.before, wipe.after, wipe.shareOfManaged], [100, 0, 100]);

check("a drop past the line is refused", stockGuard({ before: shelf, after: { A: 10, B: 0 }, pct: 25 }).ok, false);
check("a drop under it is allowed", stockGuard({ before: shelf, after: { A: 30, B: 25 }, pct: 25 }).ok, true);

// An incremental run carries only what changed. Three sold-out bottles out of
// a hundred units is a Tuesday, not a wipe.
check("a partial feed can't trip the guard by zeroing three small lines",
  stockGuard({ before: { A: 2, B: 2, C: 96 }, after: { A: 0, B: 0 }, pct: 25 }).ok, true);
check("...but the same three lines are a wipe when they are all the ERP has",
  stockGuard({ before: { A: 2, B: 2 }, after: { A: 0, B: 0 }, pct: 25 }).ok, false);

// The hole this replaced, caught in a live run against a fake ERP: measuring
// the drop against the *whole shop* let an ERP zero everything it managed and
// call it a 1% change, because the shop's other stock dwarfed it. Any shop
// where the ERP owns part of the catalogue had that hole — which is every
// shop during onboarding.
const partial = stockGuard({ before: { A: 20, B: 17 }, after: { A: 0, B: 0 }, pct: 25 });
check("an ERP that manages a corner of the shop cannot quietly zero that corner", partial.ok, false);
check("...and the drop is reported against what it manages, not against the shop",
  [partial.managed, partial.shareOfManaged], [37, 100]);

check("nothing under management cannot be emptied further", stockGuard({ before: {}, after: {}, pct: 25 }).ok, true);
check("the first pull ever, with nothing to lose, passes",
  stockGuard({ before: {}, after: { A: 50 }, pct: 25 }).ok, true);
check("a guard of 0 refuses any drop at all", stockGuard({ before: shelf, after: { A: 39 }, pct: 0 }).ok, false);
check("a guard of 100 lets anything through", stockGuard({ before: shelf, after: { A: 0, B: 0, C: 0 }, pct: 100 }).ok, true);

// ---- Recognising the shop's own products --------------------------------
console.log("\nERPRev items onto the sizes the shop already sells");

// Shaped like production: products typed in by hand, one row per size, with
// the shop's own SKUs and nothing linked to the ERP yet.
const shopRows = [
  { id: 1, productId: "2sexy2resist", productName: "2sexy2resist", size: "30ml", sku: "2sexy2resist-30ml", sizes: 1 },
  { id: 2, productId: "2sexy2resist-edp", productName: "2sexy2resist EDP", size: "30ml", sku: "2sexy2resist-edp-30ml", sizes: 1 },
  { id: 3, productId: "00-1-diffuser", productName: "00.1 diffuser", size: "150ml", sku: "00-1-diffuser-150ml", sizes: 2 },
  { id: 4, productId: "00-1-diffuser", productName: "00.1 diffuser", size: "500ml", sku: "00-1-diffuser-500ml", sizes: 2 },
  { id: 5, productId: "armpitox", productName: "Armpitox", size: "One size", sku: "armpitox-onesize", sizes: 1 },
  { id: 6, productId: "b17", productName: "B17", size: "30ml", sku: "b17-30ml", sizes: 1 },
  { id: 7, productId: "linked", productName: "Already Linked", size: "50ml", sku: "al-50", sizes: 1, extSource: ERP_SOURCE, extId: "900" },
];
const erpItem = (code, name, measure = "", altCodes = []) => ({ code: String(code), name, options: measure ? [measure] : [], altCodes });
const m = matchToShop([
  erpItem(101, "2SEXY2RESIST", "30ml"),            // name, product with one size
  erpItem(102, "2sexy2resist EDP 30ml", "pcs"),     // name already carries the size
  erpItem(103, "00.1 Diffuser", "500ml"),           // name + unit, product with two sizes
  erpItem(104, "00.1 diffuser"),                    // two sizes, no unit — can't tell which
  erpItem(105, "Arm-pit-ox"),                       // punctuation isn't identity… but equal once stripped
  erpItem(106, "Some Packaging Box", "pcs"),        // the shop doesn't sell it
  erpItem(107, "Blue Label", "", ["B17-30ML"]),     // a barcode/SKU equal to the shop's SKU
  erpItem(900, "Renamed In The ERP"),               // linked before: stays linked, whatever its name now
], shopRows);
const to = (code) => (m.matched.get(code) ? m.matched.get(code).variant.sku : null);
check("an ERP name equal to a one-size product's name finds it", to("101"), "2sexy2resist-30ml");
check("a name that already carries the size finds that size", to("102"), "2sexy2resist-edp-30ml");
check("name plus unit finds the right one of several sizes", to("103"), "00-1-diffuser-500ml");
check("a name alone never picks between two sizes", to("104"), null);
check("...it is reported as ambiguous instead", m.ambiguous.some((a) => a.code === "104"), true);
check("case, spaces and punctuation are not identity", to("105"), "armpitox-onesize");
check("the shop's SKU found by the ERP's barcode", [to("107"), m.matched.get("107").how], ["b17-30ml", "barcode"]);
check("an existing link wins over the name", [to("900"), m.matched.get("900").how], ["al-50", "linked"]);
check("something the shop doesn't sell is left unmatched", m.unmatched.map((x) => x.code), ["106"]);
check("and the shop's sizes no ERP item reached are listed", m.shopOnly.map((v) => v.sku), ["00-1-diffuser-150ml"]);
check("keys drop case, spaces and punctuation, and read & as and", [matchKey("00.1 Diffuser – 150 ML"), matchKey("Oud & Rose")], ["001diffuser150ml", "oudandrose"]);

const rivals = matchToShop([erpItem(201, "B17", "30ml"), erpItem(202, "b17 30ml")], shopRows);
check("two ERP items claiming one size: neither gets it", [rivals.matched.size, rivals.ambiguous.length], [0, 2]);
const stolen = matchToShop([erpItem(301, "Already Linked", "50ml")], shopRows);
check("a size linked to another ERP item is never re-linked by name", stolen.matched.size, 0);

check("stock per item per shop is on hand less reserved, summed across locations",
  Object.fromEntries(stockByCode([
    { code: "101", warehouse: "7", onHand: 12, reserved: 2 },
    { code: "101", warehouse: "8", onHand: 5, reserved: 0 },
    { code: "101", warehouse: "9", onHand: 99, reserved: 0 },
  ], { 7: "abuja", 8: "abuja" }).get("101") ? [["abuja", stockByCode([
    { code: "101", warehouse: "7", onHand: 12, reserved: 2 },
    { code: "101", warehouse: "8", onHand: 5, reserved: 0 },
    { code: "101", warehouse: "9", onHand: 99, reserved: 0 },
  ], { 7: "abuja", 8: "abuja" }).get("101").abuja]] : []), { abuja: 15 });

// ERPRev's stock rows name a product by `product_id` — its `id`. A product
// row that also carries a `sku` must still key on `id`, or no stock joins.
const pinned = adapterFor("erprev").normalise.product({ id: 55, sku: "VR-30", name: "Velvet Reign", price: 1 }, ADAPTERS.erprev.defaults.fields);
check("ERPRev products key on id even when they carry a sku", pinned.code, "55");
check("...and the sku is kept for matching the shop's", pinned.altCodes.includes("VR-30"), true);

const later = matchToShop([erpItem(104, "00.1 diffuser")], shopRows.map((v) => (v.id === 4 ? { ...v, extSource: ERP_SOURCE, extId: "103" } : v)));
check("a size-less name stays ambiguous after one of its sizes is linked", [later.ambiguous.length, later.unmatched.length], [1, 0]);

// ---- What the live ERPRev actually sends --------------------------------
console.log("\nThe live ERPRev's rows — PascalCase, strings, HTML entities");

// Verbatim from the probe on the house's own ERPRev (27 Sep). Every product
// came back like this, and the reader — whose aliases were all lower-case —
// found no code in any of 534 rows and read the catalogue as empty.
const liveRow = { SN: "1", ID: "1", Status: "1", Taxable: "1", Name: "OUD ISPAHAN  30ML", Measure: "Pcs", Currency: " &#x20A6;  ", ReOrderLevel: "0", Barcode: "P000001", Description: "", CategoryID: "2", ClassID: "1", Category: "DESIGNER FRAGRANCE OIL", Class: "N/A", ThumbImage: "" };
const live = adapterFor("erprev").normalise.product(liveRow, ADAPTERS.erprev.defaults.fields);
check("its code is its ID", live.code, "1");
check("its name, with the double space closed up", live.name, "OUD ISPAHAN 30ML");
check("its category", live.group, "DESIGNER FRAGRANCE OIL");
check("Status \"1\" is live", live.disabled, false);
check("Status \"0\" is not", adapterFor("erprev").normalise.product({ ...liveRow, Status: "0" }, ADAPTERS.erprev.defaults.fields).disabled, true);
check("its barcode is kept for matching", live.altCodes, ["P000001"]);
check("no price on the row reads as no price, not as zero naira", live.inlinePrice, 0);
check("the SN serial number is never mistaken for the code", live.code === liveRow.SN && liveRow.SN !== liveRow.ID, false);
check("HTML entities are decoded", adapterFor("erprev").normalise.product({ ...liveRow, Name: "Oud &amp; Rose &#x20A6;" }, {}).name, "Oud & Rose ₦");
check("a stock row in the same style reads",
  adapterFor("erprev").normalise.stock({ SN: "1", ID: "77", ProductID: "1", WarehouseID: "3", QtyOnHand: "12", ReservedQty: "2" }, {}),
  { code: "1", warehouse: "3", onHand: 12, reserved: 2 });
check("...and a stock row's own ID is still never the product", adapterFor("erprev").normalise.stock({ ID: "77", Quantity: "1" }, {}).code, "");
check("a location row in the same style reads",
  adapterFor("erprev").normalise.warehouse({ ID: "3", Name: "Abuja Main Store" }), { key: "3", label: "Abuja Main Store", isGroup: false, disabled: false });
check("an exact spelling still wins over a loose one", adapterFor("erprev").normalise.product({ id: "exact", ID: "loose", name: "x" }, ADAPTERS.erprev.defaults.fields).code, "exact");
const liveMatch = matchToShop([live], [{ id: 9, productId: "oud-ispahan", productName: "Oud Ispahan", size: "30ml", sku: "oud-ispahan-30ml", sizes: 2 }, { id: 10, productId: "oud-ispahan", productName: "Oud Ispahan", size: "50ml", sku: "oud-ispahan-50ml", sizes: 2 }]);
check("\"OUD ISPAHAN  30ML\" finds the shop's Oud Ispahan 30ml", liveMatch.matched.get("1") && liveMatch.matched.get("1").variant.sku, "oud-ispahan-30ml");

console.log(failures ? `\n${failures} failing` : "\nAll good");
process.exit(failures ? 1 : 0);
