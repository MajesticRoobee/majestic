// Path-based routing for the storefront so every page (and every product) has a
// real, crawlable URL. The Worker serves the SPA shell for all these paths.

const STATIC = ["home", "shop", "about", "faq", "track", "contact", "checkout", "confirm", "account", "wishlist", "locations", "reviews", "consultation"];

// The header's merchandising tabs are the shop grid with one filter already
// applied, so they share its implementation — but each gets its own short URL,
// because "/deals" is what a shopper expects to be able to link to and what the
// house wants to put on a flyer. `segment` round-trips through both directions.
const SEGMENT_PATHS = {
  "new-arrivals": "/new-arrivals",
  "best-sellers": "/best-sellers",
  deals: "/deals",
  "gift-sets": "/gift-sets",
};
const PATH_SEGMENTS = Object.fromEntries(Object.entries(SEGMENT_PATHS).map(([seg, path]) => [path.slice(1), seg]));

// Categories the copy rewrite retired, and the shelf that now holds their
// products. A link someone already shared — a flyer, a bookmark, a search
// result — lands on the right shelf rather than on an empty grid.
const CAT_ALIASES = { extrait: "perfumes", bodycare: "care" };
const catParam = (params) => {
  const id = params.get("category");
  return id ? CAT_ALIASES[id] || id : null;
};

export function pathToRoute(pathname = window.location.pathname, search = window.location.search) {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const params = new URLSearchParams(search);
  if (parts.length === 0) return { page: "home" };
  // A variation is addressable by its SKU, so a shopper can link straight to
  // "the 50ml" and land on it already selected.
  if (parts[0] === "product" && parts[1]) {
    const sku = params.get("variant");
    return { page: "product", productId: decodeURIComponent(parts[1]), ...(sku ? { prSku: sku } : {}) };
  }
  if (parts[0] === "blog") {
    return parts[1] ? { page: "post", postSlug: decodeURIComponent(parts[1]) } : { page: "blog" };
  }
  // The brands index is retired. A link to it that is still out there — a
  // flyer, a bookmark, a search result — lands on the full grid rather than
  // being dropped on the home page.
  if (parts[0] === "brands") return { page: "shop", fCat: "all" };
  if (parts[0] === "brand" && parts[1]) return { page: "shop", fBrand: decodeURIComponent(parts[1]), fCat: "all" };
  if (PATH_SEGMENTS[parts[0]]) {
    const fCat = catParam(params);
    return { page: "shop", fSeg: PATH_SEGMENTS[parts[0]], ...(fCat ? { fCat } : {}) };
  }
  if (parts[0] === "shop") {
    const fCat = catParam(params);
    const fCol = params.get("collection");
    const fSeg = params.get("segment");
    const fBrand = params.get("brand");
    return {
      page: "shop",
      ...(fCat ? { fCat } : {}),
      ...(fCol ? { fCol } : {}),
      ...(fSeg && SEGMENT_PATHS[fSeg] ? { fSeg } : {}),
      ...(fBrand ? { fBrand } : {}),
    };
  }
  if (STATIC.includes(parts[0])) return { page: parts[0] };
  // Anything else with a single segment is an information page — privacy,
  // terms, returns, or whatever else the house has written. The server owns
  // that list, and this runs before any of it has loaded, so the page is
  // fetched by name and a slug nobody has written becomes a plain "no such
  // page" rather than a silent bounce to the home page.
  if (parts.length === 1) return { page: "info", pageSlug: decodeURIComponent(parts[0]) };
  return { page: "home" };
}

export function routeToPath(page, extra = {}) {
  if (page === "home") return "/";
  if (page === "product" && extra.productId) {
    const base = `/product/${encodeURIComponent(extra.productId)}`;
    return extra.prSku ? `${base}?variant=${encodeURIComponent(extra.prSku)}` : base;
  }
  if (page === "post" && extra.postSlug) return `/blog/${encodeURIComponent(extra.postSlug)}`;
  if (page === "info") return extra.pageSlug ? `/${encodeURIComponent(extra.pageSlug)}` : "/";
  if (page === "post") return "/blog";
  if (page === "shop") {
    // A segment owns the path; a category alongside it rides as a query, so
    // "new arrivals in body mists" is still one linkable address.
    if (extra.fSeg && SEGMENT_PATHS[extra.fSeg]) {
      const base = SEGMENT_PATHS[extra.fSeg];
      return extra.fCat && extra.fCat !== "all" ? `${base}?category=${encodeURIComponent(extra.fCat)}` : base;
    }
    if (extra.fBrand) return `/brand/${encodeURIComponent(extra.fBrand)}`;
    if (extra.fCol) return `/shop?collection=${encodeURIComponent(extra.fCol)}`;
    if (extra.fCat && extra.fCat !== "all") return `/shop?category=${encodeURIComponent(extra.fCat)}`;
    return "/shop";
  }
  return `/${page}`;
}

export { SEGMENT_PATHS };
