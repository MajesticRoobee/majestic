import { Hono } from "hono";
import { shop } from "./shop.js";
import { admin } from "./admin.js";
import { account } from "./customers.js";
import { v1, handleMcp } from "./integrations.js";
import { runScheduled } from "./events.js";

const app = new Hono();

app.route("/api", shop);
app.route("/api/admin", admin);
app.route("/api/account", account);
app.route("/api/v1", v1);
app.post("/api/mcp", (c) => handleMcp(c));

// Product imagery. Content-addressed by id, so it can cache forever at the edge.
app.get("/images/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT mime, bytes FROM media WHERE id=?").bind(c.req.param("id")).first();
  if (!row) return c.text("Not found", 404);
  // D1 returns a BLOB as a plain number array — Response() would stringify that,
  // so it has to be wrapped back into bytes before it goes out.
  const bytes = row.bytes instanceof ArrayBuffer ? row.bytes : new Uint8Array(row.bytes);
  return new Response(bytes, {
    headers: {
      "content-type": row.mime,
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
  const staticUrls = ["/", "/shop", "/about", "/track", "/contact"];
  let productUrls = [];
  try {
    const rows = (await c.env.DB.prepare("SELECT id FROM products WHERE live=1 ORDER BY rowid").all()).results;
    productUrls = rows.map((r) => `/product/${r.id}`);
  } catch {}
  const urls = staticUrls.concat(productUrls);
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${origin}${u}</loc><changefreq>${u === "/" ? "daily" : "weekly"}</changefreq></url>`).join("\n") +
    `\n</urlset>\n`;
  return c.text(xml, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" });
});

app.onError((err, c) => {
  console.error(err);
  if (c.req.path.startsWith("/api/")) return c.json({ error: "Something went wrong — the house has been notified." }, 500);
  return c.text("Internal error", 500);
});

// Unknown API paths → JSON 404; everything else → the static SPA shell.
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: (req, env, ctx) => app.fetch(req, env, ctx),
  // Cron: drain the automation outbox and enqueue time-based automations.
  scheduled: (event, env, ctx) => ctx.waitUntil(runScheduled(env)),
};
