// The home page as data, exercised directly.
//
// The house asked to choose what shows under "Best sellers" and "Ready at your
// store". Curation is the easy half; the hard half is that a curated shelf goes
// stale in a way a computed one cannot — the moment a hand-picked piece sells
// out, or is taken off the shop floor, the shelf is lying. So:
//
//   · a hand-picked list is honoured in the house's own order
//   · ...but never shows something that cannot be bought
//   · ...and a shelf left short is topped up rather than shown half-empty
//   · a band is *not* topped up, because padding a category window with
//     something from another category makes the copy beside it untrue
//   · a parent category means everything underneath it
//   · switching a block off, or reordering the page, is data and not a deploy
import { resolveBlock, resolveHomeBlocks, familyOf, linesOf, PRODUCT_KINDS, CLAIM_SEGMENTS } from "../worker/home.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

const categories = [
  { id: "perfumes", parentId: null },
  { id: "designer", parentId: "perfumes" },
  { id: "custom-oil", parentId: "designer" },
  { id: "care", parentId: null },
  { id: "home", parentId: null },
];
const CATS = {
  "p-extrait": "perfumes", "p-designer": "designer", "p-custom": "custom-oil",
  "c-wash": "care", "c-wipes": "care",
  "h-candle": "home", "h-diffuser": "home", "h-spray": "home",
};
const order = Object.keys(CATS);
const ctx = {
  order,
  categories,
  catOf: (id) => CATS[id],
  segments: { "best-sellers": ["h-candle", "c-wash", "p-extrait"], deals: [] },
  collections: { "starter-set": ["c-wipes", "h-spray"] },
  sellable: new Set(order),
};
const block = (extra) => ({ kind: "shelf", source: "segment", refId: "best-sellers", count: 4, productIds: [], ...extra });

// ---- 1. A category means its whole family ---------------------------------
console.log("\nCategory families");

check("a leaf category is its own family",
  [...familyOf(categories, "care")], ["care"]);
check("a parent carries its children — and their children",
  [...familyOf(categories, "perfumes")].sort(), ["custom-oil", "designer", "perfumes"]);
check("a category the store does not have resolves to nothing, not everything",
  familyOf(categories, "nonsense"), null);
check("...and neither does an empty id",
  familyOf(categories, ""), null);
check("a band on a parent shows everything beneath it",
  resolveBlock(block({ kind: "band", source: "category", refId: "perfumes", count: 3 }), ctx),
  ["p-extrait", "p-designer", "p-custom"]);

// ---- 2. Curation --------------------------------------------------------
console.log("\nHand-picked shelves");

check("a hand-picked shelf runs in the order the house put them in",
  resolveBlock(block({ source: "manual", productIds: ["h-spray", "c-wash", "p-extrait"], count: 3 }), ctx),
  ["h-spray", "c-wash", "p-extrait"]);
check("...and stops at the count even when more are picked",
  resolveBlock(block({ source: "manual", productIds: ["h-spray", "c-wash", "p-extrait"], count: 2 }), ctx),
  ["h-spray", "c-wash"]);
check("the same product picked twice appears once",
  resolveBlock(block({ source: "manual", productIds: ["c-wash", "c-wash", "h-spray"], count: 3 }), ctx),
  ["c-wash", "h-spray"]);

// The load-bearing one: a curated shelf must not promise what the shop cannot
// sell. A piece taken off the floor, or left with no sizes, drops out silently.
const thinned = { ...ctx, sellable: new Set(["h-spray", "p-extrait", "p-designer", "h-candle"]) };
check("a hand-picked piece that can no longer be bought is dropped",
  resolveBlock(block({ source: "manual", productIds: ["c-wash", "h-spray"], count: 2 }), thinned),
  ["h-spray"]);
check("...and a product that was deleted outright is dropped too",
  resolveBlock(block({ source: "manual", productIds: ["gone-entirely", "h-spray"], count: 2 }), ctx),
  ["h-spray"]);

// ---- 3. Topping up --------------------------------------------------------
console.log("\nWhen a shelf comes up short");

check("a shelf short of its count is padded in catalogue order",
  resolveHomeBlocks([block({ id: "s", source: "manual", productIds: ["h-spray"], count: 3 })], ctx)[0].productIds,
  ["h-spray", "p-extrait", "p-designer"]);
check("...never repeating what is already on it",
  resolveHomeBlocks([block({ id: "s", source: "manual", productIds: ["p-designer"], count: 3 })], ctx)[0].productIds,
  ["p-designer", "p-extrait", "p-custom"]);
// The one that matters most. "On sale now" over four full-price bottles is not
// a thin shelf, it is a false one — and the old home page only showed the strip
// when something was actually marked down, which the rewrite must not lose.
check("a deals row with nothing marked down stays empty rather than being padded",
  resolveHomeBlocks([block({ id: "d", refId: "deals", count: 4 })], ctx)[0].productIds, []);
check("...and so does a gift-set row, which would otherwise offer single bottles as sets",
  resolveHomeBlocks([block({ id: "g", refId: "gift-sets", count: 4 })], ctx)[0].productIds, []);
check("...but a deals row with two real markdowns shows the two, not two plus filler",
  resolveHomeBlocks([block({ id: "d", refId: "deals", count: 4 })],
    { ...ctx, segments: { ...ctx.segments, deals: ["c-wash", "h-spray"] } })[0].productIds, ["c-wash", "h-spray"]);
check("best sellers IS padded — it is a selection, not a claim about a price",
  resolveHomeBlocks([block({ id: "b", refId: "best-sellers", count: 5 })], ctx)[0].productIds.length, 5);
check("the two claim shelves are named, so adding a third is a deliberate act",
  [...CLAIM_SEGMENTS].sort(), ["deals", "gift-sets"]);
check("'ready at your store' is never padded — it must not name what is not there",
  resolveHomeBlocks([block({ id: "c", source: "in-city", count: 4 })],
    { ...ctx, order: ["c-wash"], sellable: new Set(["c-wash"]) })[0].productIds, ["c-wash"]);

check("a band is NOT padded — a category window must not show another category",
  resolveHomeBlocks([block({ id: "b", kind: "band", source: "category", refId: "care", count: 4 })], ctx)[0].productIds,
  ["c-wash", "c-wipes"]);
check("an empty category leaves the band empty rather than borrowing",
  resolveHomeBlocks([block({ id: "b", kind: "band", source: "category", refId: "designer", count: 3 })],
    { ...ctx, order: ["c-wash"], sellable: new Set(["c-wash"]) })[0].productIds, []);

// ---- 4. The other sources -------------------------------------------------
console.log("\nSources");

check("a segment reads the shelf the server computed",
  resolveBlock(block({ refId: "best-sellers", count: 2 }), ctx), ["h-candle", "c-wash"]);
check("a collection reads the curated grouping",
  resolveBlock(block({ source: "collection", refId: "starter-set", count: 4 }), ctx), ["c-wipes", "h-spray"]);
check("an unknown segment is empty, not everything",
  resolveBlock(block({ refId: "no-such-shelf", count: 3 }), ctx), []);
// "Ready at your store" is narrowed again in the browser, which is the only
// place that knows which city the shopper picked — so the server has to hand
// over more candidates than the shelf will finally show.
check("in-city sends candidates rather than exactly the count",
  resolveBlock(block({ source: "in-city", count: 4 }), ctx).length, order.length);
check("source 'none' — a plain call-to-action band — asks for nothing",
  resolveBlock(block({ kind: "band", source: "none", count: 4 }), ctx), []);

// ---- 5. Blocks that are not product rows ----------------------------------
console.log("\nThe rest of the page");

check("only bands and shelves resolve products",
  [...PRODUCT_KINDS].sort(), ["band", "shelf"]);
for (const kind of ["story", "rewards", "reviews", "blog", "newsletter", "instagram", "perks", "categories", "tile"]) {
  if (resolveBlock(block({ kind, count: 4 }), ctx).length) { failures++; console.log(`✗ ${kind} should not resolve products`); }
}
console.log("✓ a story, a tile or a newsletter block asks the catalogue for nothing");
check("a count of zero means the block shows no products at all",
  resolveBlock(block({ count: 0 }), ctx), []);
check("the page comes back in the order it was given, block for block",
  resolveHomeBlocks([block({ id: "a" }), { ...block({ id: "b" }), kind: "story" }], ctx).map((b) => b.id), ["a", "b"]);

// ---- 6. The copy ----------------------------------------------------------
console.log("\nCopy");

check("each line the admin typed is its own line",
  linesOf("First line\nSecond line"), ["First line", "Second line"]);
check("blank lines and stray spacing are dropped rather than rendered as gaps",
  linesOf("  One  \n\n\n  Two  \n"), ["One", "Two"]);
check("nothing typed is no lines, not one empty one",
  [linesOf(""), linesOf(null)], [[], []]);

console.log(failures ? `\n${failures} check(s) failed\n` : "\nAll home-page checks passed\n");
process.exit(failures ? 1 : 0);
