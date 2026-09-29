// The storefront's HTML, with each page's own head written in on the server.
//
// The storefront is a single-page app: every address is served the same
// index.html and the browser draws the page. That is fine for a shopper and
// fatal for a shared link — WhatsApp, iMessage, Facebook, X and most crawlers
// read the HTML exactly as sent, never run the JavaScript that fills the head
// in, and so previewed every product in the shop as the same generic title
// with no picture and no price.
//
// So the Worker answers every storefront address itself: it takes the built
// index.html from the asset store, works out which page the address is, loads
// only what that page needs, and writes its title, description, canonical
// address, Open Graph and Twitter tags and structured data into the head. The
// words come from src/lib/seo-head.js — the same code the browser uses to keep
// the head current afterwards — so the two can never disagree.
//
// An address that names nothing (a product that doesn't exist or was taken
// down, a page never published) is still served the shell, so the app can say
// so, but with a 404 status and noindex, rather than a 200 that search engines
// would file as a real, empty page.

import { pathToRoute } from "../src/storefront/router.js";
import { headFor, metaTags, jsonLdText } from "../src/lib/seo-head.js";
import { previewOf } from "../src/lib/blog.js";
import { getSettings } from "./util.js";

// A file the asset store serves as itself, not a page of the shop.
const ASSET_EXT = /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|txt|xml|json|webmanifest|woff2?|ttf|otf|mp4|webm|pdf)$/i;

/** Should this path be answered with the storefront shell? */
export function isShellPath(pathname) {
  if (pathname.startsWith("/api/") || pathname === "/api") return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/images/") || pathname.startsWith("/assets/")) return false;
  return !ASSET_EXT.test(pathname);
}

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function loadCategories(db) {
  const rows = (await db.prepare("SELECT id, label, descr, parent_id, image_url FROM categories WHERE live=1 ORDER BY sort, id").all()).results;
  return rows.map((r) => ({ id: r.id, label: r.label, desc: r.descr || "", parentId: r.parent_id || null, imageUrl: r.image_url || null }));
}

// One product, in the shape the storefront's catalogue gives it — only the
// fields a head reads. Loaded on its own rather than through the whole
// catalogue: this runs on every product link anyone opens.
async function loadProduct(db, id) {
  const p = await db.prepare("SELECT * FROM products WHERE id=?").bind(id).first();
  if (!p) return null;
  const variants = (await db.prepare("SELECT * FROM variants WHERE product_id=? AND active=1 ORDER BY sort, id").bind(id).all()).results;
  const images = (await db.prepare("SELECT id, url, variant_id FROM product_images WHERE product_id=? ORDER BY sort, id").bind(id).all()).results;
  const stock = variants.length
    ? (await db.prepare(`SELECT variant_id, location_id, qty FROM stock WHERE variant_id IN (${variants.map(() => "?").join(",")})`).bind(...variants.map((v) => v.id)).all()).results
    : [];
  const stockOf = {};
  for (const s of stock) (stockOf[s.variant_id] ||= {})[s.location_id] = s.qty;
  return {
    id: p.id, name: p.name, cat: p.cat, brand: p.brand || "", gender: p.gender, notes: p.notes, desc: p.descr,
    imageUrl: p.image_url, live: !!p.live,
    images: images.map((im) => ({ url: im.url })),
    variants: variants.map((v) => {
      const own = images.find((im) => im.variant_id === v.id);
      return {
        id: v.id, sku: v.sku, size: v.size, ngn: v.price_ngn,
        stock: stockOf[v.id] || {},
        imageUrl: v.image_url || (own && own.url) || p.image_url || null,
      };
    }),
  };
}

/**
 * The head for an address, and the status to serve it with.
 * Exported so it can be tested without a Worker runtime.
 */
export async function resolveHead(env, url) {
  const db = env.DB;
  const origin = url.origin;
  const route = pathToRoute(url.pathname, url.search);
  const [settings, categories] = await Promise.all([getSettings(db), loadCategories(db)]);
  const base = { origin, settings, categories };
  const missing = (title) => ({
    status: 404,
    settings,
    head: { ...headFor({ ...base, page: "home" }), title: `${title} | ${settings.siteName || "Majestic Roobee"}`, noindex: true, jsonLd: null, canonical: `${origin}${url.pathname}` },
  });

  // Anything the router didn't recognise falls back to "home"; only "/" is home.
  if (route.page === "home" && url.pathname.replace(/\/+$/, "") !== "") return missing("Page not found");

  if (route.page === "product") {
    const product = await loadProduct(db, route.productId);
    if (!product || !product.live || !product.variants.length) return missing("Product not found");
    const variant = (route.prSku && product.variants.find((v) => v.sku === route.prSku)) || product.variants[0];
    return { status: 200, settings, head: headFor({ ...base, page: "product", product, variant, variantInUrl: !!route.prSku }) };
  }

  if (route.page === "post") {
    const row = await db.prepare("SELECT slug, title, excerpt, substr(body, 1, 600) AS body_head, cover_url, author, published_at FROM blog_posts WHERE slug=? AND status='published'").bind(route.postSlug).first();
    if (!row) return missing("Post not found");
    const post = {
      slug: row.slug, title: row.title, excerpt: previewOf(row.excerpt, row.body_head),
      coverUrl: row.cover_url || null, author: row.author || "", publishedAt: row.published_at || "",
    };
    return { status: 200, settings, head: headFor({ ...base, page: "post", post }) };
  }

  if (route.page === "info") {
    const row = await db.prepare("SELECT slug, title, seo_title, seo_desc FROM content_pages WHERE slug=? AND live=1").bind(route.pageSlug).first();
    if (!row) return missing("Page not found");
    const infoPage = { slug: row.slug, title: row.title, seoTitle: row.seo_title || "", seoDesc: row.seo_desc || "" };
    return { status: 200, settings, head: headFor({ ...base, page: "info", infoPage }) };
  }

  if (route.page === "shop") {
    let brand = "";
    if (route.fBrand) {
      const rows = (await db.prepare("SELECT DISTINCT brand FROM products WHERE live=1 AND brand IS NOT NULL AND brand<>''").all()).results;
      const hit = rows.find((r) => slugify(r.brand) === slugify(route.fBrand));
      brand = hit ? hit.brand : route.fBrand;
    }
    const category = route.fCat && route.fCat !== "all" ? route.fCat : "";
    const head = headFor({ ...base, page: "shop", segment: route.fSeg || null, category, brand });
    // A search result page is for the person searching, not for an index.
    if (route.q) head.noindex = true;
    return { status: 200, settings, head };
  }

  return { status: 200, settings, head: headFor({ ...base, page: route.page }) };
}

/** The tags written into <head>, as one HTML string. */
export function headHtml(head, settings) {
  const meta = metaTags(head, settings)
    .map(([attr, key, content]) => `<meta ${attr}="${esc(key)}" content="${esc(content)}">`)
    .join("");
  const canonical = head.canonical ? `<link rel="canonical" href="${esc(head.canonical)}">` : "";
  const ld = head.jsonLd ? `<script type="application/ld+json" id="mr-jsonld">${jsonLdText(head.jsonLd)}</script>` : "";
  return meta + canonical + ld;
}

/** Serve a storefront address: the built shell, with this page's head in it. */
export async function serveShell(c) {
  const url = new URL(c.req.url);
  // The shell itself — always "/", so the asset store hands back index.html
  // whatever address was asked for, and never a 304 with no body to rewrite.
  const shell = await c.env.ASSETS.fetch(new Request(new URL("/", url).toString()));
  if (!shell.ok || !(shell.headers.get("content-type") || "").includes("text/html")) return shell;

  let resolved;
  try {
    resolved = await resolveHead(c.env, url);
  } catch (e) {
    // A head that can't be built is no reason to withhold the page.
    console.error("seo head failed", e);
    return shell;
  }
  const { head, status, settings } = resolved;
  const rewritten = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(head.title || ""); } })
    // The shell's own generic description is replaced, not duplicated.
    .on('meta[name="description"]', { element(el) { el.remove(); } })
    .on("head", { element(el) { el.append(headHtml(head, settings), { html: true }); } })
    .transform(shell);

  const headers = new Headers(rewritten.headers);
  headers.delete("etag");
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  // The head carries live prices and stock, so the page is revalidated rather
  // than held; the hashed scripts it loads are cached for good regardless.
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  if (head.noindex) headers.set("x-robots-tag", "noindex, nofollow");
  return new Response(c.req.method === "HEAD" ? null : rewritten.body, { status, headers });
}
