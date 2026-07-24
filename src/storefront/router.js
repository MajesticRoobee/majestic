// Path-based routing for the storefront so every page (and every product) has a
// real, crawlable URL. The Worker serves the SPA shell for all these paths.

const STATIC = ["home", "shop", "about", "track", "contact", "checkout", "confirm"];

export function pathToRoute(pathname = window.location.pathname, search = window.location.search) {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const params = new URLSearchParams(search);
  if (parts.length === 0) return { page: "home" };
  if (parts[0] === "product" && parts[1]) return { page: "product", productId: decodeURIComponent(parts[1]) };
  if (parts[0] === "shop") {
    const fCat = params.get("category");
    return { page: "shop", ...(fCat ? { fCat } : {}) };
  }
  if (STATIC.includes(parts[0])) return { page: parts[0] };
  return { page: "home" };
}

export function routeToPath(page, extra = {}) {
  if (page === "home") return "/";
  if (page === "product" && extra.productId) return `/product/${encodeURIComponent(extra.productId)}`;
  if (page === "shop" && extra.fCat && extra.fCat !== "all") return `/shop?category=${encodeURIComponent(extra.fCat)}`;
  if (page === "shop") return "/shop";
  return `/${page}`;
}
