// Which photographs a product page shows, and in what order.
//
// This lives on its own because two surfaces have to agree about it and they
// are written in different places. Every card in the shop draws one picture —
// the variation's *effective* photo, which `loadProducts` resolves as "the
// variation's own shot, else the first shot tagged to it, else the product's".
// The product page draws a gallery. When the two disagreed, a shopper clicked
// one bottle in the grid and landed on a page showing another: the house
// reported it as the shop "swapping the pictures round".
//
// So the rule is one line: **the gallery opens on the picture the card used.**
// Everything else follows it — the shots tagged to this variation, then the
// shots shared across the product — deduplicated by address, because leading
// with the card's photo must not show the same bottle twice.

/**
 * @param product  a product from the store payload (`images`, `imageUrl`)
 * @param variant  the selected variation (`id`, `imageUrl`)
 * @returns [{ url, alt }], the first being the one every card shows
 */
export function variantGallery(product, variant) {
  const p = product || {};
  const v = variant || {};
  const shots = Array.isArray(p.images) ? p.images : [];
  const own = shots.filter((im) => im && im.variantId === v.id);
  const shared = shots.filter((im) => im && !im.variantId);

  const out = [];
  const seen = new Set();
  const push = (url, alt) => {
    const u = typeof url === "string" ? url.trim() : "";
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, alt: alt || p.name || "" });
  };

  push(v.imageUrl || p.imageUrl, p.name);
  for (const im of own.concat(shared)) push(im.url, im.alt);
  return out;
}
