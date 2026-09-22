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
import { resolveMedia, readMedia } from "./media.js";

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
    "Disallow: /checkout",
    "Disallow: /confirm",
    "Disallow: /api/",
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
    "/locations", "/reviews", "/blog", "/about", "/faq", "/track", "/contact",
  ];
  let catUrls = [];
  try {
    const rows = (await c.env.DB.prepare("SELECT id FROM categories WHERE live = 1 ORDER BY sort, id").all()).results;
    catUrls = rows.map((r) => `/shop?category=${encodeURIComponent(r.id)}`);
  } catch {}
  let productUrls = [];
  try {
    // One entry per variation on products that have a choice, since each
    // variation has its own canonical URL, price and availability.
    const rows = (await c.env.DB.prepare(
      `SELECT p.id AS pid, v.sku AS sku, COUNT(*) OVER (PARTITION BY p.id) AS n
         FROM products p JOIN variants v ON v.product_id = p.id
        WHERE p.live = 1 AND v.active = 1
        ORDER BY p.rowid, v.sort, v.id`
    ).all()).results;
    productUrls = rows.map((r) => (r.n > 1 && r.sku ? `/product/${r.pid}?variant=${encodeURIComponent(r.sku)}` : `/product/${r.pid}`));
    productUrls = [...new Set(productUrls)];
  } catch {}
  let pageUrls = [];
  try {
    const rows = (await c.env.DB.prepare("SELECT slug FROM content_pages WHERE live=1 ORDER BY sort, slug").all()).results;
    pageUrls = rows.map((r) => `/${r.slug}`);
  } catch {}
  let postUrls = [];
  try {
    const rows = (await c.env.DB.prepare("SELECT slug FROM blog_posts WHERE status='published' ORDER BY COALESCE(published_at, created_at) DESC").all()).results;
    postUrls = rows.map((r) => `/blog/${r.slug}`);
  } catch {}
  const urls = staticUrls.concat(catUrls, pageUrls, productUrls, postUrls);
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${origin}${u}</loc><changefreq>${u === "/" ? "daily" : "weekly"}</changefreq></url>`).join("\n") +
    `\n</urlset>\n`;
  return c.text(xml, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" });
});

app.onError((err, c) => {
  console.error(err);
  if (c.req.path.startsWith("/api/")) return c.json({ error: "Something went wrong. We've been notified." }, 500);
  return c.text("Internal error", 500);
});

// Unknown API paths → JSON 404; everything else → the static SPA shell.
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
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
