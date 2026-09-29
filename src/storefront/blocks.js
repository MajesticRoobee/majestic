// Drawing a home block's products and links — shared by the desktop home page
// and the phone's, so a block means the same thing at every width.
import { pathToRoute } from "./router.js";

// The hero's see-through panel, on the phone and the desktop alike: the house
// purple at a strength that keeps cream type legible over a bright photograph,
// with no blur, so the picture behind it stays sharp and shows through.
export const HERO_PANEL = { background: "rgba(36, 20, 48, 0.72)", border: "1px solid rgba(250, 246, 241, 0.16)" };
export const HERO_TEXT_SHADOW = "0 1px 2px rgba(20, 10, 28, 0.55)";

// A heading may say {city}, so "In Abuja now" follows the shopper when they
// switch store instead of naming the house's default forever.
export const fill = (text, vars) => String(text || "").replace(/\{city\}/g, vars.city || "");

// The categories a "categories" block shows. Its ref_id may name them, comma
// separated, in the order the house wants them; empty means every top-level
// category, in the tree's own order. A name that no longer exists is skipped.
export function blockCategories(block, categories = []) {
  const top = categories.filter((c) => !c.parentId);
  const ids = String((block && block.refId) || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return top;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const picked = ids.map((id) => byId.get(id)).filter(Boolean);
  return picked.length ? picked : top;
}

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
