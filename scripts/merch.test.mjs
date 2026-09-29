// The merchandising shelves, exercised directly.
//
// Four things the header now promises a shopper, each of which is a *reading*
// of data rather than a list someone maintains — so each gets the assertion
// that keeps the reading honest:
//
//   · "new arrivals" must age out on its own, and a pin must override that
//   · "best sellers" must be counted, not guessed, and must never be empty
//   · a deal must stop on the day after it ends, without anyone switching it off
//   · a daily deal must price the catalogue, not just the card it appears on
//   · a parent category must mean everything underneath it, or a shelf lies
//   · a pasted post link must reduce to an embed, however it was copied
import { computeSegments, dealIsLive, daysBefore, parseEmbed, embedUrlFor, firstName, pickDailyDeal, resolveDailyDeal, applyDailyDealPricing } from "../worker/merch.js";
import { watToMs } from "../worker/util.js";
import { catTree, catFamily, countIn, catPath } from "../src/lib/categories.js";
import { pathToRoute, routeToPath } from "../src/storefront/router.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

const TODAY = "2026-08-27";
const product = (id, extra = {}) => ({ id, cat: "extrait", createdAt: "2026-01-01 10:00:00", pinNew: false, pinBest: false, variants: [{ ngn: 1000, compareAtNgn: null }], ...extra });
const categories = [
  { id: "extrait", grp: "fragrance" },
  { id: "gift-set", grp: "gift" },
];

// ---- 1. New arrivals -----------------------------------------------------
console.log("\nNew arrivals");

const catalogue = [
  product("old-one"),
  product("fresh", { createdAt: "2026-08-20 09:00:00" }),
  product("older-fresh", { createdAt: "2026-08-01 09:00:00" }),
  product("pinned", { pinNew: true }),
  product("a-set", { cat: "gift-set" }),
];
const seg = computeSegments({ products: catalogue, categories, today: TODAY, newArrivalDays: 45 });

check("a product listed inside the window is new, newest first",
  seg["new-arrivals"].slice(0, 3), ["pinned", "fresh", "older-fresh"]);
check("...and one listed before it isn't — it only appears as padding, last",
  seg["new-arrivals"].indexOf("old-one") > seg["new-arrivals"].indexOf("older-fresh"), true);
check("a shorter window ages the same product out of the shelf proper",
  computeSegments({ products: catalogue, categories, today: TODAY, newArrivalDays: 10, minShelf: 0 })["new-arrivals"], ["pinned", "fresh"]);
check("...and a shelf left too thin is topped up from the catalogue rather than shown nearly empty",
  computeSegments({ products: catalogue, categories, today: TODAY, newArrivalDays: 10 })["new-arrivals"].length, 4);
check("...but a pin keeps it on the shelf whatever the arithmetic says",
  computeSegments({ products: catalogue, categories, today: TODAY, newArrivalDays: 1 })["new-arrivals"][0], "pinned");

// ---- 2. Best sellers -----------------------------------------------------
console.log("\nBest sellers");

const sold = computeSegments({
  products: catalogue,
  categories,
  today: TODAY,
  sales: [{ productId: "old-one", units: 12 }, { productId: "fresh", units: 40 }, { productId: "ghost", units: 99 }],
});
check("the shelf is ordered by units actually sold",
  sold["best-sellers"].slice(0, 2), ["fresh", "old-one"]);
check("a sale of something no longer in the catalogue can't put it back on the shelf",
  sold["best-sellers"].includes("ghost"), false);
check("with no sales at all the shelf still fills, in the house's own order",
  seg["best-sellers"], ["old-one", "fresh", "older-fresh", "pinned"]);
check("a pin outranks the counting",
  computeSegments({ products: catalogue.map((p) => (p.id === "a-set" ? { ...p, pinBest: true } : p)), categories, today: TODAY, sales: [{ productId: "fresh", units: 40 }] })["best-sellers"][0],
  "a-set");

// ---- 3. Gift sets and deals ---------------------------------------------
console.log("\nGift sets & deals");

check("gift sets are the categories grouped as gift, and nothing else",
  seg["gift-sets"], ["a-set"]);
check("an empty gift shelf is left empty rather than padded with full-price staples",
  computeSegments({ products: [product("x")], categories, today: TODAY })["gift-sets"], []);
check("a markdown puts a product on the deals shelf without any deal existing",
  computeSegments({ products: [product("x", { variants: [{ ngn: 800, compareAtNgn: 1000 }] })], categories, today: TODAY }).deals, ["x"]);
check("a curated deal's products are on it too",
  computeSegments({ products: catalogue, categories, today: TODAY, dealProductIds: ["fresh"] }).deals, ["fresh"]);

const deal = (extra) => ({ status: "Active", ...extra });
check("a deal with no dates runs",
  dealIsLive(deal({}), TODAY), true);
check("a deal is live on the day it ends",
  dealIsLive(deal({ ends_at: TODAY }), TODAY), true);
check("...and stops by itself the day after, with nobody switching it off",
  dealIsLive(deal({ ends_at: "2026-08-26" }), TODAY), false);
check("a deal hasn't started before its start date",
  dealIsLive(deal({ starts_at: "2026-09-01" }), TODAY), false);
check("ending it by hand beats an open window",
  dealIsLive({ status: "Ended" }, TODAY), false);
check("the look-back window counts backwards in whole days",
  daysBefore(30, TODAY), "2026-07-28");

// ---- 4. Embeds and purchase proof ---------------------------------------
console.log("\nEmbeds & purchase proof");

check("an Instagram post link reduces to its shortcode",
  parseEmbed("https://www.instagram.com/p/C1a-b2C3d/"), { kind: "instagram", ref: "C1a-b2C3d", embedUrl: "https://www.instagram.com/p/C1a-b2C3d/embed/captioned" });
check("a reel copied with tracking parameters still resolves",
  parseEmbed("https://www.instagram.com/reel/C1a-b2C3d/?igsh=MzRlODBiNWFlZA==").ref, "C1a-b2C3d");
check("a TikTok video link resolves to its id",
  parseEmbed("https://www.tiktok.com/@majestic/video/7312345678901234567").ref, "7312345678901234567");
check("a YouTube short resolves the same way as a watch link",
  parseEmbed("https://youtu.be/dQw4w9WgXcQ").embedUrl, embedUrlFor("youtube", "dQw4w9WgXcQ"));
check("a direct video file is played rather than framed",
  parseEmbed("https://cdn.example.com/clip.mp4").kind, "video");
check("something that isn't a post falls back to a written quote, not a broken frame",
  parseEmbed("https://example.com/not-a-post"), { kind: "quote", ref: "", embedUrl: "" });

check("only the first name is ever published",
  firstName("Dorothy Okeke Nwosu"), "Dorothy");
check("...normalised, so a shouted checkout doesn't shout on the storefront",
  firstName("DOROTHY"), "Dorothy");
check("an initial isn't a name — nothing is shown rather than a letter",
  firstName("D."), "");

// ---- 5. Every shelf has a real, linkable address -------------------------
console.log("\nShelf routing");

for (const [path, segment] of [["/deals", "deals"], ["/new-arrivals", "new-arrivals"], ["/best-sellers", "best-sellers"], ["/gift-sets", "gift-sets"]]) {
  check(`${path} is the ${segment} shelf, and round-trips back to itself`,
    [pathToRoute(path, ""), routeToPath("shop", { fSeg: segment })], [{ page: "shop", fSeg: segment }, path]);
}
check("a category inside a shelf survives the round trip",
  routeToPath("shop", { fSeg: "deals", fCat: "mist" }), "/deals?category=mist");
check("...and is read back off the URL",
  pathToRoute("/deals", "?category=mist"), { page: "shop", fSeg: "deals", fCat: "mist" });
check("a brand has its own address",
  [routeToPath("shop", { fBrand: "ysl" }), pathToRoute("/brand/ysl", "")], ["/brand/ysl", { page: "shop", fBrand: "ysl", fCat: "all" }]);
check("the retired brands index lands on the full grid",
  pathToRoute("/brands", ""), { page: "shop", fCat: "all" });
check("a blog entry has its own address",
  [routeToPath("post", { postSlug: "how-to-layer" }), pathToRoute("/blog/how-to-layer", "")], ["/blog/how-to-layer", { page: "post", postSlug: "how-to-layer" }]);
check("the phone's category index has its own address, and round-trips",
  [routeToPath("categories"), pathToRoute("/shop/categories", "")], ["/shop/categories", { page: "categories" }]);
check("...without swallowing the shop grid's own filters",
  pathToRoute("/shop", "?category=mist"), { page: "shop", fCat: "mist" });
check("the cart is a page — a phone has no drawer",
  [routeToPath("cart"), pathToRoute("/cart", "")], ["/cart", { page: "cart" }]);

// ---- 6. The daily deal ---------------------------------------------------
//
// Two things make this feature honest rather than decorative, and both are
// asserted here: the window has to be read in the house's own clock (a deal set
// to end at midnight WAT must not end at 1am), and the price on the card has to
// be the price on the catalogue — otherwise the countdown promises a saving the
// checkout never gives.
console.log("\nDaily deals");

const NOW = watToMs("2026-09-04T12:00");    // midday in Abuja
const dd = (extra = {}) => ({
  id: 1, product_id: "flames", variant_id: 11, headline: "Daily Deal",
  price_ngn: null, compare_at_ngn: null,
  starts_at: "2026-09-04T09:00", ends_at: "2026-09-04T18:00", status: "Scheduled", ...extra,
});
const shop = [
  { id: "flames", name: "Flames", live: true, imageUrl: null, variants: [{ id: 11, sku: "FL-30", size: "30ml", ngn: 30000, compareAtNgn: null, active: true, imageUrl: null }] },
  { id: "pulze", name: "Pulze", live: true, imageUrl: null, variants: [{ id: 21, sku: "PZ-30", size: "30ml", ngn: 24000, compareAtNgn: 30000, active: true, imageUrl: null }] },
];

check("a deal is running inside its window", !!pickDailyDeal([dd()], NOW), true);
check("...and not before it starts", pickDailyDeal([dd({ starts_at: "2026-09-04T14:00" })], NOW), null);
check("...nor after it ends", pickDailyDeal([dd({ ends_at: "2026-09-04T11:00" })], NOW), null);
check("...nor while it is paused", pickDailyDeal([dd({ status: "Paused" })], NOW), null);
check("the window is read in WAT, not UTC — midnight here is not midnight there",
  !!pickDailyDeal([dd({ starts_at: "2026-09-04T00:00", ends_at: "2026-09-05T00:00" })], watToMs("2026-09-04T23:30")), true);
check("...and that same deal is over a minute after midnight",
  pickDailyDeal([dd({ starts_at: "2026-09-04T00:00", ends_at: "2026-09-05T00:00" })], watToMs("2026-09-05T00:01")), null);
check("of two overlapping deals, the one ending soonest is the one on show",
  (pickDailyDeal([dd({ id: 1, ends_at: "2026-09-04T23:00" }), dd({ id: 2, ends_at: "2026-09-04T15:00" })], NOW) || {}).id, 2);

const scheduled = resolveDailyDeal({ products: shop, row: dd({ price_ngn: 21000, compare_at_ngn: 30000 }), now: NOW });
check("a scheduled deal names its piece, its price and its saving",
  [scheduled.productId, scheduled.priceNgn, scheduled.compareAtNgn, scheduled.off], ["flames", 21000, 30000, 30]);
check("...and counts down to the end of its own window",
  scheduled.endsAtMs, watToMs("2026-09-04T18:00"));

check("the price on the card is the price on the catalogue",
  applyDailyDealPricing(shop, scheduled).find((p) => p.id === "flames").variants[0],
  { id: 11, sku: "FL-30", size: "30ml", ngn: 21000, compareAtNgn: 30000, active: true, imageUrl: null });
check("...and no other piece is touched",
  applyDailyDealPricing(shop, scheduled).find((p) => p.id === "pulze").variants[0].ngn, 24000);

check("the was-price is the house's to set, above the shelf price too",
  resolveDailyDeal({ products: shop, row: dd({ price_ngn: 21000, compare_at_ngn: 45000 }), now: NOW }).off, 53);
check("left blank, the was-price is the regular price, so the saving still shows",
  [resolveDailyDeal({ products: shop, row: dd({ price_ngn: 21000 }), now: NOW }).compareAtNgn,
    resolveDailyDeal({ products: shop, row: dd({ price_ngn: 21000 }), now: NOW }).off], [30000, 30]);
check("a was-price that isn't above the asking price shows no saving",
  resolveDailyDeal({ products: shop, row: dd({ price_ngn: 30000, compare_at_ngn: 30000 }), now: NOW }).compareAtNgn, null);
check("a deal on a piece that has left the catalogue doesn't take the card down with it",
  resolveDailyDeal({ products: shop, row: dd({ product_id: "gone" }), auto: true, now: NOW }).productId, "pulze");
check("...and with the fallback off, there is simply no card",
  resolveDailyDeal({ products: shop, row: dd({ product_id: "gone" }), auto: false, now: NOW }), null);

const auto = resolveDailyDeal({ products: shop, row: null, auto: true, now: NOW });
check("with nothing scheduled, the deepest markdown stands in, until midnight",
  [auto.productId, auto.off, auto.scheduled, auto.endsAtMs], ["pulze", 20, false, watToMs("2026-09-05T00:00")]);
check("a floor with no markdowns and no schedule shows no card",
  resolveDailyDeal({ products: [shop[0]], row: null, auto: true, now: NOW }), null);

check("the deal's piece is on the Deals shelf, because its price is now below its was-price",
  computeSegments({ products: applyDailyDealPricing(shop, scheduled), categories, today: "2026-09-04" }).deals,
  ["flames", "pulze"]);

// ---- 7. The category tree ------------------------------------------------
//
// One category system, two levels. The thing worth asserting is that a parent
// is not an empty shelf: "Perfumes" holds no products of its own, and a shopper
// clicking it must still see all 110 extraits, designer oils and custom oils.
console.log("\nCategory tree");

const cats = [
  { id: "perfumes", label: "Perfumes", parentId: null },
  { id: "extrait", label: "Extrait Perfumes", parentId: "perfumes" },
  { id: "designer", label: "Designer Oils", parentId: "perfumes" },
  { id: "mist", label: "Body Mists", parentId: null },
  { id: "gifts", label: "Gift Sets", parentId: null },
  { id: "gift-set", label: "Other Sets", parentId: "gifts" },
];
const shop2 = [
  { id: "a", cat: "extrait" }, { id: "b", cat: "extrait" }, { id: "c", cat: "designer" },
  { id: "d", cat: "mist" }, { id: "e", cat: "gift-set" },
];

check("the tree is the shelves, each carrying its own children",
  catTree(cats).map((c) => [c.label, c.children.map((x) => x.label)]),
  [["Perfumes", ["Extrait Perfumes", "Designer Oils"]], ["Body Mists", []], ["Gift Sets", ["Other Sets"]]]);

check("a parent covers itself and everything under it",
  [...catFamily(cats, "perfumes")].sort(), ["designer", "extrait", "perfumes"]);
check("a leaf covers only itself", [...catFamily(cats, "mist")], ["mist"]);
check("\"all\" is no filter at all", catFamily(cats, "all"), null);

check("a parent shelf shows its children's products, though none are filed on it",
  countIn(cats, shop2, "perfumes"), 3);
check("...and a child shows only its own", countIn(cats, shop2, "extrait"), 2);
check("...and no category at all shows everything", countIn(cats, shop2, "all"), 5);

check("a sub-category knows the shelf it came from",
  catPath(cats, "extrait").map((c) => c.label), ["Perfumes", "Extrait Perfumes"]);
check("...and a top-level shelf is its own trail",
  catPath(cats, "mist").map((c) => c.label), ["Body Mists"]);

// A child whose parent is hidden must not fall off the menu while its products
// are still on the shop floor.
check("an orphaned child is promoted, not dropped",
  catTree([{ id: "x", label: "Orphan", parentId: "gone" }]).map((c) => c.label), ["Orphan"]);
// A malformed tree must not hang the page that walks it.
check("a cycle terminates rather than spinning",
  catPath([{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }], "a").length <= 8, true);

console.log(failures ? `\n${failures} check(s) failed\n` : "\nAll merchandising checks passed\n");
process.exit(failures ? 1 : 0);
