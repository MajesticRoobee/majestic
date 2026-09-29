// The shop grid's rules — what is on it, in what order, under what heading —
// shared by the desktop grid and the phone's listing so the two can never
// disagree about what "Deals in Body Mists" contains.
import { useEffect, useRef } from "react";
import { catFamily, catPath } from "../lib/categories.js";
import { record } from "./track.js";

// A search is recorded once it has settled, not on every keystroke — otherwise
// "vanilla" arrives as v, va, van, vani… and the list of terms nobody found is
// mostly prefixes of terms somebody did.
function useSearchRecord(term, found) {
  const foundRef = useRef(found);
  foundRef.current = found;
  useEffect(() => {
    const q = String(term || "").trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      record(foundRef.current ? "search" : "search_no_results", { q, value: foundRef.current });
    }, 900);
    return () => clearTimeout(t);
  }, [term]);
}

// The shop grid, and every page in the header that leads to it.
//
// "New arrivals", "Best sellers", "Deals" and "Gift sets" are this same grid
// with one filter already applied — which products are in each is the server's
// answer (worker/merch.js), so the browser never has to decide what counts as
// new or what has sold well. Category, sub-category, brand, collection and
// search all compose, so "gift sets in body mists" is one address.
export const SEGMENT_COPY = {
  "new-arrivals": { title: "New arrivals" },
  "best-sellers": { title: "Best sellers" },
  deals: { title: "Deals" },
  "gift-sets": { title: "Gift sets" },
};

// The shop page with nothing narrowed down.
export const SHOP_TITLE = "Shop";

// The phone's price bands, in naira: under the first, between, over the second.
export const PRICE_BANDS = [30000, 50000];

export function useShopList(ctx, { mobile = false } = {}) {
  const { listings, categories, collections, cityName, segments } = ctx;
  const searching = !!ctx.search.trim();
  const collection = collections.find((c) => c.id === ctx.fCol) || null;
  const seg = ctx.fSeg && segments[ctx.fSeg] ? ctx.fSeg : null;
  const segIds = seg ? segments[seg] : null;
  const segRank = segIds ? new Map(segIds.map((id, i) => [id, i])) : null;
  const segCopy = seg ? SEGMENT_COPY[seg] : null;
  const brand = ctx.fBrand ? ctx.brands.find((b) => b.id === ctx.fBrand) : null;
  const brandName = brand ? brand.name : ctx.fBrand;
  const activeCat = categories.find((c) => c.id === ctx.fCat) || null;
  // A category is itself and everything under it: "Perfume Oils" is the
  // designer oils and the custom oils, not the nothing filed on the parent.
  const catIds = catFamily(categories, ctx.fCat);
  // ["Perfume Oils", "Designer Oils"] when a sub-category is open, so the page
  // says where the shopper is.
  const trail = activeCat ? catPath(categories, activeCat.id) : [];
  // The deals running right now, so the Deals page names them rather than
  // showing a wall of discounted products with no reason attached.
  const runningDeals = seg === "deals" ? ctx.deals.filter((d) => d.productIds.length) : [];
  // The line under the title: only what the house wrote for a collection or a
  // category. The shop's own pages need no caption.
  const subLine = segCopy || brand || searching
    ? ""
    : collection && collection.desc
      ? collection.desc
      : activeCat && activeCat.desc
        ? activeCat.desc
        : "";
  // The grid iterates listing entries, not products: one entry per card. A
  // product with a picker is one entry carrying all its variations; a
  // split-listed product contributes one entry per variation.
  //
  // "In stock here" therefore means any variation the card can show is in
  // the city — which is the whole product for a picker card, and exactly one
  // variation for a split card.
  const inStockHere = (e) => e.variants.some((v) => (v.stock[ctx.city] || 0) > 0);
  const scopedOut = listings.filter((e) => !inStockHere(e)).length;
  // What is in stock nearby is the default. A search always reaches every
  // store — someone looking for a specific scent wants to know it exists in
  // Lagos, not to be told it doesn't exist.
  let list = listings.filter((e) => {
    const p = e.product;
    if (catIds && !catIds.has(p.cat)) return false;
    if (segIds && !segIds.includes(p.id)) return false;
    if (brandName && (p.brand || "").toLowerCase() !== String(brandName).toLowerCase()) return false;
    if (collection && !collection.productIds.includes(p.id)) return false;
    if (ctx.search) {
      // Sizes, SKUs and the brand are searchable too, now that they are real
      // identities on the product rather than words in its description.
      const hay = (p.name + " " + p.brand + " " + p.notes + " " + e.variants.map((v) => `${v.size} ${v.sku || ""}`).join(" ")).toLowerCase();
      if (!hay.includes(ctx.search.toLowerCase())) return false;
    }
    if (!searching && ctx.fScope === "city" && !inStockHere(e)) return false;
    return true;
  });
  // Sorting reads the cheapest variation on the card, so a card never sorts by
  // a price the shopper can't actually see on it.
  const priceOf = (e) => Math.min(...e.variants.map((v) => v.ngn));
  // "Newest" and "Best selling" reuse the rankings the New arrivals and Best
  // sellers pages are built from, so the shop sorts by what the server knows
  // actually sold rather than by anything the browser guesses at.
  const rankBy = (key) => {
    const ids = segments[key] || [];
    const rank = new Map(ids.map((id, i) => [id, i]));
    const at = (e) => (rank.has(e.product.id) ? rank.get(e.product.id) : ids.length);
    return (a, b) => at(a) - at(b);
  };
  // What people searched for, and — the useful half — what they searched for
  // and the shop had nothing to show. That second list is a buying brief and an
  // SEO brief at once, written by customers.
  // The phone's filter sheet narrows further — by price, and by who it is for
  // or its scent family where the catalogue actually has more than one of
  // those. Only applied where there is a sheet to see and undo it in.
  if (mobile) {
    const mf = ctx.mf || {};
    const lo = (e) => Math.min(...e.variants.map((v) => v.ngn));
    if (mf.price === "under") list = list.filter((e) => lo(e) < PRICE_BANDS[0]);
    if (mf.price === "mid") list = list.filter((e) => lo(e) >= PRICE_BANDS[0] && lo(e) <= PRICE_BANDS[1]);
    if (mf.price === "over") list = list.filter((e) => lo(e) > PRICE_BANDS[1]);
    if (mf.gender && mf.gender !== "all") list = list.filter((e) => e.product.gender === mf.gender);
    if (mf.fam && mf.fam !== "all") list = list.filter((e) => e.product.family === mf.fam);
  }
  useSearchRecord(ctx.search, list.length);
  if (ctx.fSort === "new") list = list.slice().sort(rankBy("new-arrivals"));
  else if (ctx.fSort === "best") list = list.slice().sort(rankBy("best-sellers"));
  else if (ctx.fSort === "low") list = list.slice().sort((a, b) => priceOf(a) - priceOf(b));
  else if (ctx.fSort === "high") list = list.slice().sort((a, b) => priceOf(b) - priceOf(a));
  else if (ctx.fSort === "name") list = list.slice().sort((a, b) => a.product.name.localeCompare(b.product.name));
  // On new arrivals, deals or best sellers, "featured" means the order that
  // page is already in — newest first, best-selling first — rather than city
  // stock, which would shuffle the ranking the page exists to show.
  else if (segRank) list = list.slice().sort((a, b) => segRank.get(a.product.id) - segRank.get(b.product.id));
  else list = list.slice().sort((a, b) => (inStockHere(b) ? 1 : 0) - (inStockHere(a) ? 1 : 0));
  const filtersDirty = ctx.fCat !== "all" || !!ctx.search || !!collection || !!seg || !!brand || ctx.fScope !== "city";
  return {
    listings, categories, collections, cityName, segments, searching, collection, seg, segIds, segRank, segCopy, brand, brandName, activeCat, catIds, trail, runningDeals, subLine, inStockHere, scopedOut, list, filtersDirty,
  };
}
