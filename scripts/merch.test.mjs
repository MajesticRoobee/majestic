// The merchandising shelves, exercised directly.
//
// Four things the header now promises a shopper, each of which is a *reading*
// of data rather than a list someone maintains — so each gets the assertion
// that keeps the reading honest:
//
//   · "new arrivals" must age out on its own, and a pin must override that
//   · "best sellers" must be counted, not guessed, and must never be empty
//   · a deal must stop on the day after it ends, without anyone switching it off
//   · a pasted post link must reduce to an embed, however it was copied
import { computeSegments, dealIsLive, daysBefore, parseEmbed, embedUrlFor, firstName } from "../worker/merch.js";
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
  parseEmbed("https://www.instagram.com/p/C1a-b2C3d/"), { kind: "instagram", ref: "C1a-b2C3d", embedUrl: "https://www.instagram.com/p/C1a-b2C3d/embed" });
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
check("a journal entry has its own address",
  [routeToPath("post", { postSlug: "how-to-layer" }), pathToRoute("/blog/how-to-layer", "")], ["/blog/how-to-layer", { page: "post", postSlug: "how-to-layer" }]);

console.log(failures ? `\n${failures} check(s) failed\n` : "\nAll merchandising checks passed\n");
process.exit(failures ? 1 : 0);
