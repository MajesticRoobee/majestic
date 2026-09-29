import { Hono } from "hono";
import { shop } from "./shop.js";
import { admin } from "./admin.js";
import { account } from "./customers.js";
import { v1, handleMcp } from "./integrations.js";
import { runScheduled } from "./events.js";
import { releaseExpiredOrders } from "./payments.js";
import { sweepStock } from "./inventory.js";
import { rollup } from "./insights.js";
import { rebuildAffinity } from "./affinity.js";
import { isConsultOn } from "../src/lib/consultation.js";
import { resolveMedia, readMedia } from "./media.js";
import { getSettings } from "./util.js";
import { runErpPull } from "./erp.js";
import { isShellPath, serveShell } from "./seo.js";

const app = new Hono();

app.route("/api", shop);
app.route("/api/admin", admin);
app.route("/api/account", account);
app.route("/api/v1", v1);
app.post("/api/mcp", (c) => handleMcp(c));

// Which build is answering.
//
// A deploy uploads the assets and the Worker script separately, and a new
// version does not reach every edge the instant `wrangler deploy` returns. That
// window is real — it is how a new storefront bundle came to be served against
// an older API payload, and how a post-deploy smoke test came to assert against
// the *previous* build and pass. CI now polls this until it sees the commit it
// just pushed, so "deployed" means "actually serving".
//
// BUILD_SHA is injected at deploy time (`wrangler deploy --var BUILD_SHA:…`);
// locally it is simply absent.
app.get("/api/health", (c) => c.json({ ok: true, version: c.env.BUILD_SHA || "dev" }));

// Product imagery. Content-addressed by id, so it can cache forever at the
// edge. `?w=` selects a narrower derivative for phones; each width caches
// separately because it is a distinct URL. See worker/media.js.
app.get("/images/:id", async (c) => {
  const row = await resolveMedia(c.env, c.req.param("id"), c.req.query("w"));
  if (!row) return c.text("Not found", 404);
  const bytes = await readMedia(c.env, row);
  if (!bytes) return c.text("Not found", 404);
  return new Response(bytes, {
    headers: {
      "content-type": row.mime,
      // Content-addressed: an id is minted per upload and its bytes never
      // change, so this can cache forever. Each width is a distinct URL
      // (`?w=`), which is what keeps a phone's copy out of a desktop's cache —
      // there is no content negotiation here, so nothing to Vary on.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
});

app.get("/robots.txt", (c) => {
  const origin = new URL(c.req.url).origin;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /confirm",
    "Disallow: /account",
    "Disallow: /wishlist",
    "Disallow: /track",
    "Disallow: /*?q=",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return c.text(body, 200, { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" });
});

app.get("/sitemap.xml", async (c) => {
  const origin = new URL(c.req.url).origin;
  // Every page the header and footer link to is a real, indexable page of its
  // own. Category pages are listed from the live tree below.
  const staticUrls = [
    "/", "/shop", "/new-arrivals", "/best-sellers", "/deals", "/gift-sets",
    "/locations", "/reviews", "/blog", "/about", "/faq", "/contact",
  ];
  // The Perfume Studio's booking page is only a page while the studio is
  // taking bookings — listing it otherwise would send search traffic to a
  // sentence saying no.
  try {
    const settings = await getSettings(c.env.DB);
    if (isConsultOn(settings)) staticUrls.push("/consultation");
  } catch {}
  let catUrls = [];
  try {
    const rows = (await c.env.DB.prepare("SELECT id FROM categories WHERE live = 1 ORDER BY sort, id").all()).results;
    catUrls = rows.map((r) => `/shop?category=${encodeURIComponent(r.id)}`);
  } catch {}
  let productUrls = [];
  try {
    // The product's own address, then one per variation on products that have
    // a choice, since each variation has its own canonical URL, price and
    // availability. Each carries its photograph, so the product also turns up
    // in image search.
    const rows = (await c.env.DB.prepare(
      `SELECT p.id AS pid, p.name AS name, p.image_url AS pimg, p.created_at AS created,
              v.sku AS sku, v.size AS size, v.image_url AS vimg,
              COUNT(*) OVER (PARTITION BY p.id) AS n
         FROM products p JOIN variants v ON v.product_id = p.id
        WHERE p.live = 1 AND v.active = 1
        ORDER BY p.rowid, v.sort, v.id`
    ).all()).results;
    const seen = new Set();
    for (const r of rows) {
      const pid = encodeURIComponent(r.pid);
      const lastmod = r.created ? String(r.created).slice(0, 10) : "";
      if (!seen.has(r.pid)) {
        seen.add(r.pid);
        productUrls.push({ loc: `/product/${pid}`, image: r.pimg || r.vimg, title: r.name, lastmod });
      }
      if (r.n > 1 && r.sku) {
        productUrls.push({ loc: `/product/${pid}?variant=${encodeURIComponent(r.sku)}`, image: r.vimg || r.pimg, title: `${r.name} ${r.size || ""}`.trim(), lastmod });
      }
    }
  } catch {}
  let pageUrls = [];
  try {
    const rows = (await c.env.DB.prepare("SELECT slug FROM content_pages WHERE live=1 ORDER BY sort, slug").all()).results;
    pageUrls = rows.map((r) => `/${r.slug}`);
  } catch {}
  let postUrls = [];
  try {
    const rows = (await c.env.DB.prepare("SELECT slug, cover_url, title, COALESCE(published_at, created_at) AS at FROM blog_posts WHERE status='published' ORDER BY COALESCE(published_at, created_at) DESC").all()).results;
    postUrls = rows.map((r) => ({ loc: `/blog/${encodeURIComponent(r.slug)}`, image: r.cover_url, title: r.title, lastmod: r.at ? String(r.at).slice(0, 10) : "" }));
  } catch {}
  const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const abs = (u) => (/^https?:\/\//i.test(u) ? u : `${origin}${u.startsWith("/") ? "" : "/"}${u}`);
  const entry = (u) => {
    const e = typeof u === "string" ? { loc: u } : u;
    return `  <url><loc>${x(origin + e.loc)}</loc>`
      + (e.lastmod ? `<lastmod>${x(e.lastmod)}</lastmod>` : "")
      + `<changefreq>${e.loc === "/" ? "daily" : "weekly"}</changefreq>`
      + (e.image ? `<image:image><image:loc>${x(abs(e.image))}</image:loc>${e.title ? `<image:title>${x(e.title)}</image:title>` : ""}</image:image>` : "")
      + `</url>`;
  };
  const urls = staticUrls.concat(catUrls, pageUrls, productUrls, postUrls);
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    urls.map(entry).join("\n") +
    `\n</urlset>\n`;
  return c.text(xml, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" });
});

app.onError((err, c) => {
  console.error(err);
  if (c.req.path.startsWith("/api/")) return c.json({ error: "Something went wrong. We've been notified." }, 500);
  return c.text("Internal error", 500);
});

// Unknown API paths → JSON 404. A storefront address → the SPA shell with that
// page's own head written in (worker/seo.js). Anything else → the asset store.
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
app.on(["GET", "HEAD"], "*", (c) => (isShellPath(new URL(c.req.url).pathname) ? serveShell(c) : c.env.ASSETS.fetch(c.req.raw)));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

// Cron. Lapsed card payments are released first — every minute an unpaid order
// sits there is a minute its stock can't be sold, and an order that has just
// been released should not then be chased as an abandoned cart.
async function cron(env) {
  try { await releaseExpiredOrders(env); } catch (e) { console.error("payment sweep failed", e); }
  // Stock next, and before the outbox drains: a shelf that crossed its low-stock
  // line in the last quarter hour should leave the building on this run, not the
  // next one.
  try { await sweepStock(env); } catch (e) { console.error("stock sweep failed", e); }
  try { await runScheduled(env); } catch (e) { console.error("automation run failed", e); }
  // The ERP link. It decides for itself whether this cadence is its turn — the
  // house sets how often it calls out, and this cron fires every 15 minutes
  // for everything else. Never throws: a pull that fails is a row in the sync
  // log, not a cron that stops sweeping stock.
  try { await runErpPull(env); } catch (e) { console.error("erp pull failed", e); }
  // Fold yesterday into the rollups the admin reads, and prune raw events past
  // the window. Last, because it is the only job here nobody is waiting on.
  try { await rollup(env); } catch (e) { console.error("insight rollup failed", e); }
  // "Other people also opened…". Rebuilt whole, and only once an hour — it only
  // has to be right daily, and a rebuild cannot drift the way a counter can.
  if (new Date().getUTCMinutes() < 15) {
    try { await rebuildAffinity(env); } catch (e) { console.error("affinity rebuild failed", e); }
  }
}

export default {
  fetch: (req, env, ctx) => app.fetch(req, env, ctx),
  scheduled: (event, env, ctx) => ctx.waitUntil(cron(env)),
};
