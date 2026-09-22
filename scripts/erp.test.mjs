// The ERPNext link, exercised directly.
//
// Two pieces here decide whether a scheduled, unattended sync is safe to leave
// running, and both are pure functions so they can be proved without an
// ERPNext to call:
//
//   `buildFeed`   turns Item / Item Price / Bin into the flat SKU rows the
//                 ingest has taken since Sprint 2. Getting this wrong means
//                 variations under the wrong parent, a variation with no
//                 label, or stock counted into the wrong city.
//
//   `stockGuard`  refuses a pull that would empty the shop. This is the most
//                 important function in the connector, because the failure it
//                 prevents is silent: an expired API key, a renamed price
//                 list or a filter that matches nothing makes ERPNext answer
//                 `[]` with a 200, and the next pull sets every shelf to zero.
import { buildFeed, stockGuard } from "../worker/erp.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

const WAREHOUSES = { "Abuja Store - MR": "abuja", "Abuja Overflow - MR": "abuja", "Lagos Store - MR": "lagos" };
const GROUPS = { "Perfume Oils": "perfume-oils" };
const feed = (o) => buildFeed({
  items: [], prices: [], bins: [], warehouses: WAREHOUSES, groups: GROUPS, defaultCat: "perfumes", known: new Set(), ...o,
});

// ERPNext's own shape: a template carries `has_variants`, a variation carries
// `variant_of` pointing at the template's item_code.
const TEMPLATE = { item_code: "DYNASTY", item_name: "Dynasty", has_variants: 1, item_group: "Perfume Oils", description: "<p>Oud and saffron.</p>" };
const V30 = { item_code: "DYNASTY-30", item_name: "Dynasty 30ml", variant_of: "DYNASTY", item_group: "Perfume Oils", attributes: [{ attribute_value: "30ml" }] };
const V50 = { item_code: "DYNASTY-50", item_name: "Dynasty 50ml", variant_of: "DYNASTY", item_group: "Perfume Oils", attributes: [{ attribute_value: "50ml" }] };
const price = (code, rate, extra = {}) => ({ item_code: code, price_list_rate: rate, ...extra });

// ---- 1. Items become the feed the ingest already understands --------------
console.log("\nERPNext's three DocTypes, flattened");

const both = feed({ items: [TEMPLATE, V30, V50], prices: [price("DYNASTY-30", 35000), price("DYNASTY-50", 52000)] });
check("a template and its variants become two SKUs under one parent",
  both.rows.map((r) => [r.parentId, r.externalId, r.option1, r.priceNgn]),
  [["DYNASTY", "DYNASTY-30", "30ml", 35000], ["DYNASTY", "DYNASTY-50", "50ml", 52000]]);

check("the template itself is never a thing to sell",
  both.rows.some((r) => r.externalId === "DYNASTY"), false);

// An ERPNext item with neither variant_of nor has_variants is a simple item.
// Dropping it would silently lose most of a typical catalogue.
const simple = feed({
  items: [{ item_code: "CANDLE-1", item_name: "Amber Candle", item_group: "Perfume Oils" }],
  prices: [price("CANDLE-1", 14000)],
});
check("a simple item is its own parent with one variation",
  simple.rows.map((r) => [r.parentId, r.externalId, r.option1]), [["CANDLE-1", "CANDLE-1", "One size"]]);

check("a disabled item is left out",
  feed({ items: [{ ...V30, disabled: 1 }], prices: [price("DYNASTY-30", 1)] }).rows.length, 0);

// The ingest refuses a row with no price, and rightly — but it should be a
// named skip in the log, not a mystery.
const unpriced = feed({ items: [TEMPLATE, V30], prices: [] });
check("an item with no price in that list is skipped, by name",
  [unpriced.rows.length, unpriced.skipped[0].item], [0, "DYNASTY-30"]);

// Several prices for one item in one list means somebody has dated them.
check("the latest dated price wins",
  feed({
    items: [{ item_code: "X", item_name: "X" }],
    prices: [price("X", 1000, { valid_from: "2026-01-01" }), price("X", 1400, { valid_from: "2026-06-01" })],
  }).rows[0].priceNgn, 1400);

// A variation must have a label or the ingest drops it. ERPNext does not
// always fill in attributes, so there are two fallbacks and neither is empty.
check("no attributes falls back to the part of the name the template doesn't explain",
  feed({ items: [TEMPLATE, { item_code: "DYNASTY-X", item_name: "Dynasty 100ml", variant_of: "DYNASTY" }], prices: [price("DYNASTY-X", 9)] })
    .rows[0].option1, "100ml");
// A variant whose name has nothing to do with its template's tells us nothing
// about what distinguishes it, so the label is the one string ERPNext
// guarantees is unique and non-empty: the item code.
check("...and with nothing to go on, the item code, never nothing",
  feed({ items: [TEMPLATE, { item_code: "DYNASTY-Z", item_name: "Unrelated", variant_of: "DYNASTY" }], prices: [price("DYNASTY-Z", 9)] })
    .rows[0].option1, "DYNASTY-Z");

check("a second and third attribute become the other option axes",
  (() => {
    const r = feed({
      items: [TEMPLATE, { item_code: "D-A", variant_of: "DYNASTY", item_name: "Dynasty", attributes: [{ attribute_value: "50ml" }, { attribute_value: "Gold" }] }],
      prices: [price("D-A", 9)],
    }).rows[0];
    return [r.option1, r.option2];
  })(), ["50ml", "Gold"]);

// ---- 2. Stock lands in the right city, or nowhere -------------------------
console.log("\nBins, through the warehouse map");

const stocked = feed({
  items: [TEMPLATE, V30], prices: [price("DYNASTY-30", 35000)],
  bins: [
    { item_code: "DYNASTY-30", warehouse: "Abuja Store - MR", actual_qty: 12 },
    { item_code: "DYNASTY-30", warehouse: "Lagos Store - MR", actual_qty: 4 },
  ],
});
check("each warehouse's count lands in its own shop", stocked.rows[0].stock, { abuja: 12, lagos: 4 });

check("two warehouses mapped to one shop are added, not overwritten",
  feed({
    items: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)],
    bins: [
      { item_code: "DYNASTY-30", warehouse: "Abuja Store - MR", actual_qty: 12 },
      { item_code: "DYNASTY-30", warehouse: "Abuja Overflow - MR", actual_qty: 5 },
    ],
  }).rows[0].stock, { abuja: 17 });

// A bottle promised to somebody else's open order is not a bottle we can sell.
check("stock already reserved is not stock we have",
  feed({
    items: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)],
    bins: [{ item_code: "DYNASTY-30", warehouse: "Abuja Store - MR", actual_qty: 12, reserved_qty: 5 }],
  }).rows[0].stock, { abuja: 7 });

check("...and a reservation bigger than the shelf is zero, not a negative",
  feed({
    items: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)],
    bins: [{ item_code: "DYNASTY-30", warehouse: "Abuja Store - MR", actual_qty: 2, reserved_qty: 9 }],
  }).rows[0].stock, { abuja: 0 });

// The point of the map: an unmapped warehouse is ignored, not defaulted.
check("stock in an unmapped warehouse is not counted anywhere",
  feed({
    items: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)],
    bins: [{ item_code: "DYNASTY-30", warehouse: "Somewhere Else - MR", actual_qty: 99 }],
  }).rows[0].stock, undefined);

// Sending `{}` is different from sending nothing: the ingest sets what it is
// given, absolutely, so an item with no Bin row must send no stock key at all
// rather than zeroing the shelf the shop is holding.
check("an item ERPNext has never stocked sends no stock at all, rather than zero",
  Object.prototype.hasOwnProperty.call(feed({ items: [TEMPLATE, V30], prices: [price("DYNASTY-30", 1)] }).rows[0], "stock"), false);

// ---- 3. The ERP owns price and stock; the shop owns its own copy ----------
console.log("\nWho owns which field");

const fresh = feed({ items: [TEMPLATE, V30, V50], prices: [price("DYNASTY-30", 1), price("DYNASTY-50", 2)] });
check("a product the shop has never seen arrives with its name and description",
  [fresh.rows[0].parentName, fresh.rows[0].description], ["Dynasty", "Oud and saffron."]);
check("...on the head of the group only, so the ingest reads it once",
  fresh.rows[1].parentName, undefined);
check("a mapped item group picks the category", fresh.rows[0].category, "perfume-oils");
check("an unmapped one falls to the default, and says so",
  (() => {
    const r = feed({ items: [{ ...TEMPLATE, item_group: "Something Else" }, V30], prices: [price("DYNASTY-30", 1)] });
    return [r.rows[0].category, r.skipped.some((x) => x.warning && /Something Else/.test(x.error))];
  })(), ["perfumes", true]);

// This is the one that stops the connector eating the shop's merchandising.
const knownFeed = feed({ items: [TEMPLATE, V30], prices: [price("DYNASTY-30", 35000)], known: new Set(["DYNASTY"]) });
check("a product the shop already has keeps its own name and copy",
  [knownFeed.rows[0].parentName, knownFeed.rows[0].description, knownFeed.rows[0].imageUrl],
  [undefined, undefined, undefined]);
check("...but its price still comes from ERPNext", knownFeed.rows[0].priceNgn, 35000);

// ---- 4. The guard --------------------------------------------------------
console.log("\nThe line that stops an expired key emptying the shop");

const shelf = { A: 40, B: 30, C: 30 }; // 100 units in the catalogue

check("an ordinary day passes", stockGuard({ before: shelf, after: { A: 38, B: 30 }, pct: 25 }).ok, true);
check("a rise passes", stockGuard({ before: shelf, after: { A: 80 }, pct: 25 }).ok, true);
check("nothing changing passes", stockGuard({ before: shelf, after: { A: 40, B: 30, C: 30 }, pct: 25 }).ok, true);

// The failure it exists for: the feed claims everything is gone.
const wipe = stockGuard({ before: shelf, after: { A: 0, B: 0, C: 0 }, pct: 25 });
check("a feed that zeroes the catalogue is refused", wipe.ok, false);
check("...and says how far it would have gone", [wipe.before, wipe.after, wipe.shareOfAll], [100, 0, 100]);

check("a drop past the line is refused", stockGuard({ before: shelf, after: { A: 10, B: 0 }, pct: 25 }).ok, false);
check("a drop under it is allowed", stockGuard({ before: shelf, after: { A: 30, B: 25 }, pct: 25 }).ok, true);

// A partial page must not read as "everything else is gone" — this is why the
// comparison is against the SKUs the feed actually spoke about.
check("a feed carrying three SKUs can't trip the guard by halving three bottles",
  stockGuard({ before: { A: 2, B: 2, C: 96 }, after: { A: 0, B: 0 }, pct: 25 }).ok, true);

// ...but the *share of the whole catalogue* is what is measured, so a feed
// covering the whole shop cannot sneak a wipe through as "only my rows".
check("a feed that covers the shop is measured against the shop",
  stockGuard({ before: { A: 50, B: 50 }, after: { A: 0, B: 0 }, pct: 25 }).ok, false);

check("an empty shop cannot be emptied further", stockGuard({ before: {}, after: {}, pct: 25 }).ok, true);
check("a guard of 0 refuses any drop at all", stockGuard({ before: shelf, after: { A: 39 }, pct: 0 }).ok, false);
check("a guard of 100 lets anything through", stockGuard({ before: shelf, after: { A: 0, B: 0, C: 0 }, pct: 100 }).ok, true);

console.log(failures ? `\n${failures} failing` : "\nAll good");
process.exit(failures ? 1 : 0);
