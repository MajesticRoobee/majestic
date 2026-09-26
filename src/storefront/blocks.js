// Drawing a home block's products and links — shared by the desktop home page
// and the phone's, so a block means the same thing at every width.
import { pathToRoute } from "./router.js";

// A heading may say {city}, so "In Abuja now" follows the shopper when they
// switch store instead of naming the house's default forever.
export const fill = (text, vars) => String(text || "").replace(/\{city\}/g, vars.city || "");

// A block's products, as cards, in the order the server resolved them.
export function cardsFor(block, ctx) {
  return (block.productIds || [])
    .map((id) => ctx.listings.find((e) => e.product.id === id))
    .filter(Boolean)
    .map(ctx.card)
    .filter(Boolean);
}

// "Ready at your store today" is the one shelf the server cannot finish: only
// the browser knows which city the shopper picked. So the server sends
// candidates in catalogue order and the narrowing happens here.
export function shelfCards(block, ctx) {
  const cards = cardsFor(block, ctx);
  if (block.source !== "in-city") return cards.slice(0, block.count || cards.length);
  const here = (block.productIds || [])
    .map((id) => ctx.products.find((p) => p.id === id))
    .filter((p) => p && p.variants && p.variants.length && ctx.availInfo(p).inCity)
    .slice(0, block.count || 4)
    .map(ctx.card)
    .filter(Boolean);
  return here;
}

// A block's button or "see all" link. The target is a storefront path, so the
// house types /deals or /shop?category=home and it routes properly rather than
// reloading the whole app.
export function blockNav(ctx, target) {
  const path = String(target || "").trim();
  if (!path) return null;
  return (e) => {
    if (e) e.preventDefault();
    if (/^https?:\/\//i.test(path)) { window.open(path, "_blank", "noopener"); return; }
    const r = pathToRoute(path.split("?")[0], path.includes("?") ? "?" + path.split("?").slice(1).join("?") : "");
    const { page, ...extra } = r;
    // Coming from a shelf link, the filters that are *not* named must be
    // cleared, or "/deals" would land still narrowed to whatever the shopper
    // was last looking at.
    ctx.nav(page, page === "shop" ? { fCat: "all", fCol: null, fSeg: null, fBrand: "", ...extra } : extra);
  };
}
