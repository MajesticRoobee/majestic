// Merchandising: the shelves the header promises, and the embeds under them.
//
// "New arrivals", "Best sellers", "Gift sets" and "Deals" are not four new
// tables — they are four readings of the catalogue and the order book, which is
// why they live here as pure functions the tests can exercise without a
// database. shop.js supplies the rows; everything below is arithmetic.

import { todayInWAT } from "./util.js";

export const SEGMENTS = ["new-arrivals", "best-sellers", "gift-sets", "deals"];

export const SEGMENT_LABELS = {
  "new-arrivals": "New arrivals",
  "best-sellers": "Best sellers",
  "gift-sets": "Gift sets",
  deals: "Deals",
};

// How long a product reads as "new", and how few products a shelf may show
// before it is topped up from the catalogue. A shelf the header links to must
// never be empty — an empty tab reads as a broken shop, not as an honest one.
export const NEW_ARRIVAL_DAYS = 45;
export const MIN_SHELF = 4;

/**
 * Is this deal running right now?
 *
 * Same two rules as a promo code: the house's switch (`status`) and the window
 * (`starts_at` / `ends_at`, both inclusive, either may be NULL for unbounded).
 * Either can stop a deal; neither alone can revive it.
 */
export function dealIsLive(deal, today = todayInWAT()) {
  if (!deal || deal.status !== "Active") return false;
  if (deal.starts_at && today < deal.starts_at) return false;
  if (deal.ends_at && today > deal.ends_at) return false;
  return true;
}

// "2026-08-27 09:14:02" / ISO → "2026-08-27". Anything unparseable is treated
// as ancient rather than as new, so a bad timestamp can't fake a launch.
function dayOf(value) {
  const s = String(value || "");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// today minus n days, as YYYY-MM-DD.
export function daysBefore(days, today = todayInWAT()) {
  const t = Date.parse(today + "T00:00:00Z");
  if (Number.isNaN(t)) return today;
  return new Date(t - days * 86400000).toISOString().slice(0, 10);
}

/**
 * The four shelves, each as an ordered list of product ids.
 *
 * @param products  storefront catalogue (loadProducts), already live-only, in
 *                  the house's own shelf order
 * @param sales     [{ productId, units }] over the best-seller window
 * @param categories[{ id, grp }] — 'gift' is what makes a category a set
 * @param dealProductIds ids named by the deals that are running right now
 */
export function computeSegments({
  products = [],
  sales = [],
  categories = [],
  dealProductIds = [],
  today = todayInWAT(),
  newArrivalDays = NEW_ARRIVAL_DAYS,
  minShelf = MIN_SHELF,
} = {}) {
  const order = products.map((p) => p.id);
  const rank = new Map(order.map((id, i) => [id, i]));
  const known = new Set(order);
  // A shelf is topped up in the house's own catalogue order — the sequence the
  // admin arranged — never with random padding.
  const topUp = (ids) => {
    const out = ids.slice();
    const have = new Set(out);
    for (const id of order) {
      if (out.length >= minShelf) break;
      if (!have.has(id)) { out.push(id); have.add(id); }
    }
    return out;
  };

  const cutoff = daysBefore(newArrivalDays, today);
  const newArrivals = products
    .filter((p) => p.pinNew || dayOf(p.createdAt) >= cutoff)
    .sort((a, b) => (b.pinNew ? 1 : 0) - (a.pinNew ? 1 : 0) || dayOf(b.createdAt).localeCompare(dayOf(a.createdAt)) || rank.get(a.id) - rank.get(b.id))
    .map((p) => p.id);

  const units = new Map();
  for (const s of sales) if (known.has(s.productId)) units.set(s.productId, (units.get(s.productId) || 0) + (s.units || 0));
  const bestSellers = products
    .filter((p) => p.pinBest || units.get(p.id))
    .sort((a, b) => (b.pinBest ? 1 : 0) - (a.pinBest ? 1 : 0) || (units.get(b.id) || 0) - (units.get(a.id) || 0) || rank.get(a.id) - rank.get(b.id))
    .map((p) => p.id);

  const giftCats = new Set(categories.filter((c) => c.grp === "gift").map((c) => c.id));
  const giftSets = products.filter((p) => giftCats.has(p.cat)).map((p) => p.id);

  // A deal is either curated (named by a running deal) or intrinsic (a variation
  // priced below its own compare-at). Both are a markdown a shopper can see.
  const curated = new Set(dealProductIds.filter((id) => known.has(id)));
  const marked = products.filter((p) => (p.variants || []).some((v) => v.compareAtNgn && v.compareAtNgn > v.ngn)).map((p) => p.id);
  const deals = [...new Set([...curated, ...marked])].sort((a, b) => rank.get(a) - rank.get(b));

  return {
    "new-arrivals": topUp(newArrivals),
    "best-sellers": topUp(bestSellers),
    // These two are what they are: an empty gift shelf means the house sells no
    // sets, and an empty deal shelf means nothing is marked down today. Padding
    // either with full-price staples would be a lie.
    "gift-sets": giftSets,
    deals,
  };
}

// ---- Embeds ---------------------------------------------------------------
//
// A testimonial is usually a post that already exists on Instagram or TikTok.
// The admin pastes the URL they copied — with whatever tracking parameters came
// with it — and this reduces it to the post's id, which is what the storefront
// builds an <iframe> from. Nothing here loads a third-party script: each
// platform's own /embed URL renders inside an iframe on its own.

const EMBED_PATTERNS = [
  { kind: "instagram", re: /instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i },
  { kind: "tiktok", re: /tiktok\.com\/(?:@[^/]+\/video|v|embed)\/(\d+)/i },
  { kind: "youtube", re: /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i },
];

/**
 * What kind of embed is this URL, and what is the post's id?
 *
 * Returns { kind, ref, embedUrl }. An address we don't recognise that points at
 * a video file is played directly; anything else falls back to 'quote', so a
 * mistyped link becomes a plain testimonial card rather than a broken frame.
 */
export function parseEmbed(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!url) return { kind: "quote", ref: "", embedUrl: "" };
  for (const { kind, re } of EMBED_PATTERNS) {
    const m = url.match(re);
    if (m) return { kind, ref: m[1], embedUrl: embedUrlFor(kind, m[1]) };
  }
  if (/^https?:\/\/\S+\.(mp4|webm|mov)(\?\S*)?$/i.test(url)) return { kind: "video", ref: url, embedUrl: url };
  return { kind: "quote", ref: "", embedUrl: "" };
}

export function embedUrlFor(kind, ref) {
  if (!ref) return "";
  if (kind === "instagram") return `https://www.instagram.com/p/${encodeURIComponent(ref)}/embed`;
  if (kind === "tiktok") return `https://www.tiktok.com/embed/v2/${encodeURIComponent(ref)}`;
  if (kind === "youtube") return `https://www.youtube.com/embed/${encodeURIComponent(ref)}`;
  if (kind === "video") return ref;
  return "";
}

// ---- Purchase proof -------------------------------------------------------
//
// "Dorothy from Cross River bought Osk 30ml" is a real order, shown to the next
// shopper. Two rules make that safe to publish: only the first name ever leaves
// the server, and nothing is said about an order until it is paid for — an
// abandoned card attempt is not a purchase.

/** The first name alone, capitalised. "" for anything that isn't a name. */
export function firstName(full) {
  const w = String(full || "").trim().split(/\s+/)[0] || "";
  const letters = w.replace(/[^A-Za-z'’-]/g, "");
  if (letters.length < 2) return "";
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}
