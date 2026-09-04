// The category tree — the store's one and only category system.
//
// Categories are two levels: seven shelves the house sells by (Perfumes, Body
// Mists, Deodorants, Bodycare, Home Fragrances, Gift Sets, Health Drinks), some
// with children under them (Perfumes → Extrait, Designer Oils, Custom Oils).
// A product is always filed on exactly one of them, parent or child.
//
// These are pure functions over the flat list the server sends, so the header
// rail, the shop grid and the admin all read the same shape of tree rather than
// each deciding for itself what a category contains.

/** The flat list as parents, each carrying its children in sort order. */
export function catTree(categories = []) {
  const kids = new Map();
  for (const c of categories) {
    if (!c.parentId) continue;
    if (!kids.has(c.parentId)) kids.set(c.parentId, []);
    kids.get(c.parentId).push(c);
  }
  // A child whose parent is missing or hidden would otherwise vanish from the
  // menu while its products stayed in the shop, so it is promoted rather than
  // dropped.
  const known = new Set(categories.map((c) => c.id));
  return categories
    .filter((c) => !c.parentId || !known.has(c.parentId))
    .map((c) => ({ ...c, children: kids.get(c.id) || [] }));
}

/**
 * Every category id a shelf covers: itself and everything under it.
 *
 * This is what makes "Perfumes" mean the 110 pieces across Extrait, Designer
 * Oils and Custom Oils rather than the nothing filed directly on the parent.
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

/** Is this product on that shelf? "all" (or nothing) matches everything. */
export function inCategory(categories, catId, productCat) {
  const fam = catFamily(categories, catId);
  return !fam || fam.has(productCat);
}

/** How many of these products sit on that shelf, children included. */
export function countIn(categories, products, catId) {
  const fam = catFamily(categories, catId);
  return fam ? products.filter((p) => fam.has(p.cat)).length : products.length;
}

/** ["Perfumes", "Extrait Perfumes"] — the trail to a category, for a heading. */
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
