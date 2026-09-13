// The home page, as data.
//
// Every band, shelf, heading and tile on the home page used to be written into
// pages.jsx: the order they ran in, the words on them, which three tiles sat
// under the hero, and — the thing the house actually asked for — which products
// a shelf showed. All of it was a deploy.
//
// A block names *where* its products come from rather than naming the products,
// except when the house has picked them by hand. The resolving happens here so
// the storefront is handed a finished list and the admin, the storefront and
// the tests all agree on one set of rules.
//
// The rule worth stating out loud, because it is the one that makes a curated
// shelf safe: **a hand-picked list is a preference, not a promise.** It is
// still filtered by what is actually buyable, and still topped up from the
// house's own catalogue order when it comes up short. "Ready at your store
// today" naming something the store has not got is worse than no shelf at all.

/**
 * A category and everything filed under it.
 *
 * The storefront has `catFamily` in src/lib for the same job, but the Worker
 * keeps its own company: six lines here is cheaper than a dependency from
 * worker/ into the browser bundle, and a shelf must mean the same thing on both
 * sides — a parent shows everything beneath it.
 */
export function familyOf(categories = [], id) {
  if (!id) return null;
  const known = new Set(categories.map((c) => c.id));
  if (!known.has(id)) return null;
  const fam = new Set([id]);
  // Two levels today, but walked rather than assumed, so a deeper tree later
  // does not silently empty a band.
  for (let depth = 0; depth < 4; depth++) {
    for (const c of categories) {
      const parent = c.parentId || c.parent_id;
      if (parent && fam.has(parent)) fam.add(c.id);
    }
  }
  return fam;
}

/** The kinds that show products, and therefore have a source worth resolving. */
export const PRODUCT_KINDS = new Set(["band", "shelf"]);

/** Where a block's products can come from. */
export const SOURCES = ["segment", "category", "collection", "in-city", "manual", "none"];

/**
 * Shelves that are a *claim* rather than a *selection*, and so must never be
 * padded out to length.
 *
 * "Best sellers" is a selection: showing four when three have really sold is a
 * shelf that is slightly generous about its ordering. "On sale now" is a claim
 * — padding it means putting full-price bottles under a heading that says they
 * are marked down, which is not a thin shelf, it is a false one. Same for gift
 * sets, which would otherwise offer single bottles as sets, and for "ready at
 * your store", which would name things the shopper cannot walk in and collect.
 *
 * worker/merch.js draws this line for the same two segments, and for the same
 * reason; it is drawn again here because a block can point at a segment the
 * home page never used to show.
 */
export const CLAIM_SEGMENTS = new Set(["deals", "gift-sets"]);

/**
 * Resolve one block to an ordered list of product ids.
 *
 * @param block     { kind, source, refId, count, productIds }
 * @param ctx.order        every live product id, in the house's catalogue order
 * @param ctx.segments     { 'best-sellers': [id…], … } from worker/merch.js
 * @param ctx.categories   the flat category list, for resolving a family
 * @param ctx.catOf        (productId) => its category id
 * @param ctx.collections  { collectionId: [id…] }
 * @param ctx.sellable     Set of ids that can actually be bought at all
 * @param topUp            pad a short shelf from the catalogue (off for bands,
 *                         which are a category's own window and must not show
 *                         something from another shelf)
 */
export function resolveBlock(block, ctx, { topUp = false } = {}) {
  const { order = [], segments = {}, collections = {}, sellable = null } = ctx;
  const count = Math.max(0, parseInt(block.count, 10) || 0);
  if (!PRODUCT_KINDS.has(block.kind) || !count) return [];

  const known = new Set(order);
  const buyable = (id) => known.has(id) && (!sellable || sellable.has(id));

  let ids;
  switch (block.source) {
    case "manual":
      ids = (block.productIds || []).slice();
      break;
    case "segment":
      ids = (segments[block.refId] || []).slice();
      break;
    case "collection":
      ids = (collections[block.refId] || []).slice();
      break;
    case "category": {
      const fam = familyOf(ctx.categories, block.refId);
      ids = fam ? order.filter((id) => fam.has(ctx.catOf(id))) : [];
      break;
    }
    // Resolved in the browser, which is the only place that knows which city
    // the shopper is standing in. The server sends the candidates in catalogue
    // order and the storefront keeps the ones on the shelf there.
    case "in-city":
      ids = order.slice();
      break;
    default:
      return [];
  }

  const out = [];
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id) || !buyable(id)) continue;
    seen.add(id);
    out.push(id);
    // in-city is narrowed again in the browser, so it needs candidates in hand
    // rather than exactly `count` of them.
    if (out.length >= count && block.source !== "in-city") break;
  }
  if (topUp && out.length < count) {
    for (const id of order) {
      if (out.length >= count) break;
      if (seen.has(id) || !buyable(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** A block's lines, as the admin typed them — one per line, blanks dropped. */
export const linesOf = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

const blockOut = (r, productIds) => ({
  id: r.id, kind: r.kind, layout: r.layout, source: r.source, refId: r.ref_id,
  count: r.count, eyebrow: r.eyebrow, title: r.title, sub: r.sub,
  lines: linesOf(r.lines), ctaLabel: r.cta_label, ctaTarget: r.cta_target,
  imageUrl: r.image_url || null, dark: !!r.dark, sort: r.sort, live: !!r.live,
  productIds,
});

/** Every block the admin owns, resolved or not. `live` filters for the shop. */
export async function loadHomeBlocks(db, { liveOnly = false } = {}) {
  const rows = (await db.prepare(
    `SELECT * FROM home_blocks ${liveOnly ? "WHERE live=1" : ""} ORDER BY sort, id`
  ).all()).results;
  const picks = (await db.prepare("SELECT * FROM home_block_products ORDER BY sort").all()).results;
  return rows.map((r) => blockOut(r, picks.filter((p) => p.block_id === r.id).map((p) => p.product_id)));
}

/**
 * The home page the storefront is handed: every live block, each already
 * carrying the products it shows.
 */
export function resolveHomeBlocks(blocks, ctx) {
  return blocks.map((b) => {
    if (!PRODUCT_KINDS.has(b.kind)) return { ...b, productIds: [] };
    // A shelf is a row of the shop and looks wrong half-empty, so it is topped
    // up — unless what it says about its products is a claim (above), or it is
    // a band, which is a window onto one category and would be made untrue by
    // padding it with something from another.
    const topUp = b.kind === "shelf"
      && b.source !== "in-city"
      && !(b.source === "segment" && CLAIM_SEGMENTS.has(b.refId));
    return { ...b, productIds: resolveBlock(b, ctx, { topUp }) };
  });
}
