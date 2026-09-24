// The ERP webhook, exercised directly.
//
// ERPRev → `POST /api/erp/webhook` is the quickest road to "Abuja's shelf
// follows the ERP": it needs no request signing, only the secret ERPRev shows
// for the webhook. Three things decide whether it is safe to leave open to the
// internet, and they are what this file proves:
//
//   · nothing unproven is accepted — not an unsigned body, not a bad
//     signature, not a replay from outside the clock window, and not anything
//     at all while the secret is unset
//   · the records are read out of the envelopes ERPs actually send, and a
//     product's nested stock is counted once, not twice
//   · stock goes to Abuja only where it cannot be another city's
import { verifyDelivery, readEnvelope, classify, shopFor, sameHex, SIGNATURE_HEADERS } from "../worker/erp-webhook.js";
import { hmacHex } from "../worker/erp-adapters.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

const secret = "whsec_test_0123456789";
const raw = JSON.stringify({ event: "stock.updated", data: { product_id: 42, warehouse_id: 7, quantity: 12 } });
const now = 1_760_000_000_000;
const t = Math.floor(now / 1000);

// ---- 1. Proof ------------------------------------------------------------
console.log("\nNothing unproven gets in");

check("with no secret configured, nothing is accepted",
  (await verifyDelivery({ secret: "", raw, headers: { "x-signature": "whatever" }, now })).ok, false);
check("...and it says why, with a 503 rather than a 401",
  (await verifyDelivery({ secret: "", raw, now })).status, 503);
check("an unsigned delivery is refused",
  (await verifyDelivery({ secret, raw, headers: {}, now })).status, 401);

const v1 = await hmacHex(secret, `${t}.${raw}`);
check("a t=,v1= signature over <t>.<body> is accepted (ERPRev's documented webhook shape)",
  (await verifyDelivery({ secret, raw, headers: { "X-ERPRev-Signature": `t=${t},v1=${v1}` }, now })).ok, true);
check("...and reports when it was signed, for ordering events",
  (await verifyDelivery({ secret, raw, headers: { "X-ERPRev-Signature": `t=${t},v1=${v1}` }, now })).at, t * 1000);
check("...but not with the body changed by one character",
  (await verifyDelivery({ secret, raw: raw.replace("12", "13"), headers: { "x-erprev-signature": `t=${t},v1=${v1}` }, now })).ok, false);
check("...nor replayed ten minutes later",
  (await verifyDelivery({ secret, raw, headers: { "x-erprev-signature": `t=${t},v1=${v1}` }, now: now + 600_000 })).ok, false);
check("...nor signed with a different secret",
  (await verifyDelivery({ secret: "another", raw, headers: { "x-erprev-signature": `t=${t},v1=${v1}` }, now })).ok, false);

const bare = await hmacHex(secret, raw);
check("a bare hex digest over the body is accepted", (await verifyDelivery({ secret, raw, headers: { "x-signature": bare }, now })).ok, true);
check("...and sha256=<hex>", (await verifyDelivery({ secret, raw, headers: { "X-Hub-Signature-256": `sha256=${bare}` }, now })).ok, true);
const b64 = btoa(String.fromCharCode(...bare.match(/../g).map((h) => parseInt(h, 16))));
check("...and base64", (await verifyDelivery({ secret, raw, headers: { "x-webhook-signature": b64 }, now })).ok, true);
check("...and says which header it read", (await verifyDelivery({ secret, raw, headers: { "x-signature": bare }, now })).how, "x-signature");

check("the secret on the URL is accepted, for a webhook screen with no signing",
  (await verifyDelivery({ secret, raw, query: { token: secret }, now })).ok, true);
check("...but not a wrong one", (await verifyDelivery({ secret, raw, query: { token: "guess" }, now })).ok, false);
check("...nor a prefix of the right one", (await verifyDelivery({ secret, raw, query: { token: secret.slice(0, -1) }, now })).ok, false);
check("a present-but-wrong signature is not rescued by a right token",
  (await verifyDelivery({ secret, raw, headers: { "x-signature": "00".repeat(32) }, query: { token: secret }, now })).ok, false);

check("hex comparison is exact", [sameHex("ab", "AB"), sameHex("ab", "ac"), sameHex("ab", "abab"), sameHex("zz", "zz")], [true, false, false, false]);
check("the header list is lower-case, as the lookup expects", SIGNATURE_HEADERS.every((h) => h === h.toLowerCase()), true);

// ---- 2. Reading it -------------------------------------------------------
console.log("\nThe envelopes ERPs send");

check("{event, data:{…}}", readEnvelope({ event: "Stock.Updated", data: { a: 1 } }).records, [{ a: 1 }]);
check("...and the event name is lower-cased", readEnvelope({ event: "Stock.Updated", data: {} }).event, "stock.updated");
check("{type, payload:[…]}", readEnvelope({ type: "product.updated", payload: [{ a: 1 }, { a: 2 }] }).records.length, 2);
check("{topic, data:{object:{…}}}", readEnvelope({ topic: "x", data: { object: { a: 1 } } }).records, [{ a: 1 }]);
check("a bare array", readEnvelope([{ a: 1 }]).records, [{ a: 1 }]);
check("a bare record", readEnvelope({ product_id: 1, quantity: 2 }).records, [{ product_id: 1, quantity: 2 }]);
check("the delivery id, where it has one", readEnvelope({ id: "evt_1", data: {} }).id, "evt_1");
check("nothing in is nothing out", readEnvelope(null).records, []);
check("a flood is capped", readEnvelope({ data: Array.from({ length: 900 }, () => ({})) }).records.length, 500);

console.log("\nStock rows and product rows");

const stockEvt = classify("stock.updated", [{ product_id: 42, warehouse_id: 7, quantity: 12 }]);
check("a stock event is stock", [stockEvt.stock.length, stockEvt.products.length], [1, 0]);
const priceEvt = classify("product.updated", [{ id: 42, name: "Velvet Reign", price: 35000 }]);
check("a product event is a product", [priceEvt.stock.length, priceEvt.products.length], [0, 1]);
check("an unnamed event is judged by its fields",
  classify("", [{ product_id: 1, warehouse_id: 2, qty: 3 }]).stock.length, 1);

// The one that would silently double a count: a product that carries its own
// per-location stock, *and* a total quantity on itself.
const nested = classify("stock.updated", [{ id: 42, name: "Velvet Reign", price: 35000, quantity: 9, stocks: [{ warehouse_id: 7, quantity: 5 }, { warehouse_id: 8, quantity: 4 }] }]);
check("a product's nested stock rows are the stock", nested.stock.length, 2);
check("...each carrying the product's id", nested.stock.map((s) => s.product_id), [42, 42]);
check("...and the product's own total is not counted on top", nested.stock.some((s) => s.id === 42), false);
check("...while its price still counts as a product update", nested.products.length, 1);

// ---- 3. Where it lands ---------------------------------------------------
console.log("\nAbuja, only where it can't be anywhere else");

const opts = (map, known) => ({ map, defaultShop: "abuja", knownLocations: known });
check("a mapped location goes where it is mapped", shopFor("7", opts({ 7: "lagos" }, ["7", "8"])), "lagos");
check("a row with no location goes to the default shop", shopFor("", opts({}, ["7", "8"])), "abuja");
check("the only location the ERP has shown goes to the default shop", shopFor("7", opts({}, ["7"])), "abuja");
check("...including the first time it is seen", shopFor("7", opts({}, [])), "abuja");
check("with two locations known, an unmapped one is not counted", shopFor("8", opts({ 7: "abuja" }, ["7", "8"])), null);
check("...even though the other maps to Abuja", shopFor("8", opts({ 7: "abuja" }, ["7", "8"])) === "abuja", false);
check("with no default shop, nothing is defaulted", shopFor("", { map: {}, defaultShop: "", knownLocations: [] }), null);

console.log(failures ? `\n${failures} failing` : "\nAll good");
process.exit(failures ? 1 : 0);
