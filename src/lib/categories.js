// The category tree — the store's one and only category system.
//
// Categories are two levels: the categories the store sells by (Perfumes,
// Perfume Oils, Body Mists, Feminine Care, Home Fragrance, Wellness Products,
// Deodorants, Gift Sets), some with sub-categories under them (Perfume Oils →
// Designer Oils, Custom Oils). A product is always filed on exactly one of
// them, category or sub-category.
//
// These are pure functions over the flat list the server sends, so the header
// menu, the shop grid and the admin all read the same shape of tree rather than
// each deciding for itself what a category contains.

/** The flat list as categories, each carrying its sub-categories in sort order. */
export function catTree(categories = []) {
  const kids = new Map();
  for (const c of categories) {
    if (!c.parentId) continue;
    if (!kids.has(c.parentId)) kids.set(c.parentId, []);
    kids.get(c.parentId).push(c);
  }
  // A sub-category whose parent is missing or hidden would otherwise vanish
  // from the menu while its products stayed in the shop, so it is promoted
  // rather than dropped.
  const known = new Set(categories.map((c) => c.id));
  return categories
    .filter((c) => !c.parentId || !known.has(c.parentId))
    .map((c) => ({ ...c, children: kids.get(c.id) || [] }));
}

/**
 * Every category id a category covers: itself and everything under it.
 *
 * This is what makes "Perfume Oils" mean every designer and custom oil rather
 * than the nothing filed directly on the parent.
 */
export function catFamily(categories = [], id) {
  if (!id || id === "all") return null;   // null = no category filter at all
  const out = new Set([id]);
  // Two levels today, but a loop costs nothing and survives a third.
  let added = true;
  while (added) {
    added = false;
    for (const c of categories) {
      if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); added = true; }
    }
  }
  return out;
}

/** Is this product in that category? "all" (or nothing) matches everything. */
export function inCategory(categories, catId, productCat) {
  const fam = catFamily(categories, catId);
  return !fam || fam.has(productCat);
}

/** How many of these products are in that category, sub-categories included. */
export function countIn(categories, products, catId) {
  const fam = catFamily(categories, catId);
  return fam ? products.filter((p) => fam.has(p.cat)).length : products.length;
}

/** ["Perfume Oils", "Designer Oils"] — the path to a category, for a heading. */
export function catPath(categories = [], id) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out = [];
  let cur = byId.get(id);
  // A cycle would hang the page; two levels is the shape, so cap the walk.
  for (let i = 0; cur && i < 8; i++) {
    out.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return out;
}
