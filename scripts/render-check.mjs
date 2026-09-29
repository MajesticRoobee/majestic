// Post-deploy safety net: load the live storefront + admin in a real browser
// and fail if the SPA renders nothing or throws — catches white-screen
// regressions that the HTML/API smoke test can't (it never executes JS).
import { chromium } from "playwright";

// The deploy passes the address it just deployed to. Run bare, it checks a
// local `wrangler dev` — never a guessed production address.
const base = process.env.SITE_URL || "http://127.0.0.1:8787";

// Pull a product page from whatever is actually live rather than naming one.
// The demo catalogue gets cleared at go-live, and a hardcoded slug would quietly
// start testing a 404 instead of a real product page.
const store = await fetch(base + "/api/store").then((r) => r.json()).catch(() => ({}));
const sample = (store.products || [])[0];
// Same reasoning as the product page below: pull a published post from whatever
// is actually live rather than naming a slug that could be renamed or deleted.
const post = (await fetch(base + "/api/blog").then((r) => r.json()).catch(() => ({})).then((d) => (d.posts || [])[0])) || null;
// The information pages the house has published — privacy, terms, returns and
// whatever else it has written. Read from the store rather than listed here,
// for the same reason as the product and the post: this file must not quietly
// start testing a 404 because someone renamed a page.
const infoPages = (store.pages || []).map((p) => p.slug);

// Every page the header links to. Each of these is a distinct route through the
// SPA, and a white screen on any of them is a white screen a shopper reaches
// from the top of the site — so the gate has to open all of them, not just the
// three the store started with.
const targets = [
  { path: "/", needsRoot: true },
  { path: "/shop", needsRoot: true },
  { path: "/new-arrivals", needsRoot: true },
  { path: "/deals", needsRoot: true },
  { path: "/best-sellers", needsRoot: true },
  { path: "/gift-sets", needsRoot: true },
  { path: "/locations", needsRoot: true },
  { path: "/wishlist", needsRoot: true },
  { path: "/reviews", needsRoot: true },
  { path: "/blog", needsRoot: true },
  { path: "/about", needsRoot: true },
  { path: "/faq", needsRoot: true },
  { path: "/contact", needsRoot: true },
  // Switched on by default now, and linked from the header on every page.
  { path: "/consultation", needsRoot: true },
  ...infoPages.map((slug) => ({ path: "/" + slug, needsRoot: true })),
  ...(post ? [{ path: "/blog/" + post.slug, needsRoot: true }] : []),
  ...(sample ? [{ path: "/product/" + sample.id, needsRoot: true }] : []),
  { path: "/admin/", needsRoot: true },
];
if (!sample) console.log("• catalogue is empty — skipping the product-page check");
if (!post) console.log("• no published posts yet — skipping the blog-post check");
if (!infoPages.length) console.log("• no information pages published — skipping those");

// CHROME_PATH lets this run against a preinstalled browser (handy locally);
// CI leaves it unset so Playwright resolves its own download.
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
let failed = false;
for (const t of targets) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(base + t.path, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3500); // let the SPA mount (external fonts/pixels may never settle)
    const children = await page.evaluate(() => (document.getElementById("root")?.children.length) || 0);
    const fatal = errors.filter((e) => !/ERR_|Failed to load resource/.test(e));
    if (children < 1 || fatal.length) {
      failed = true;
      console.error(`✗ ${t.path} — root children: ${children}${fatal.length ? "; errors: " + fatal.join(" | ") : ""}`);
    } else {
      console.log(`✓ ${t.path} — rendered (${children} root nodes)`);
    }
  } catch (e) {
    failed = true;
    console.error(`✗ ${t.path} — ${e.message}`);
  }
  await page.close();
}
// Product photos are served from /images/<id> — bytes in R2, or in D1 for rows
// uploaded before the move. Three things can go wrong here and none of them is
// visible from a status code alone:
//
//   · the row exists but its bytes don't (a missing R2 object) — 404
//   · the bytes come back mangled — 200, an image content-type, and a picture
//     no browser can decode. This is the one v7 added the check for: D1 hands
//     a BLOB back as a number array, and `Response()` used to stringify it
//   · the responsive derivative is broken while the original is fine — which
//     is what a shopper actually downloads, since every <img> carries a srcset
//
// So the bytes are asserted over HTTP first and decoded second, and the two
// failures are told apart deliberately: **mangled bytes fail the deploy**,
// because that is the serving path breaking for every photo in the shop, while
// **missing bytes are reported and allowed through**, because that is one
// product's upload to redo and not something this build did. A check that
// treats them alike either blocks a release over a stale row or waves through
// a regression that breaks the whole catalogue.
const withPhoto = (store.products || []).filter((p) => (p.imageUrl || "").startsWith("/images/")).slice(0, 3);
if (!withPhoto.length) {
  console.log("• no uploaded product photos yet — skipping the image checks");
} else {
  const page = await browser.newPage();
  // Same origin as the images, so the decode below runs under the site's own
  // CSP rather than in a sandbox that would allow anything.
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });

  for (const product of withPhoto) {
    // The original, and the derivative a phone would pick. `?w=` resolves to
    // the narrowest copy that covers the request, falling back to the original
    // for anything uploaded before derivatives existed — so both must serve.
    for (const url of [product.imageUrl, `${product.imageUrl}?w=400`]) {
      const label = `${url} (${product.id})`;
      let res;
      try {
        res = await page.request.get(base + url, { timeout: 30000 });
      } catch (e) {
        failed = true;
        console.error(`✗ ${label} — request failed: ${e.message}`);
        continue;
      }
      const type = res.headers()["content-type"] || "";
      const body = await res.body();

      if (res.status() === 404 || !body.length) {
        // Data, not code: the product record points at bytes that aren't there.
        console.warn(`⚠ ${label} — HTTP ${res.status()}, ${body.length} bytes. The photo's bytes are missing; re-upload it in Admin → Products. Not failing the deploy: the serving path itself is exercised by the other photos.`);
        continue;
      }
      if (!res.ok() || !type.startsWith("image/")) {
        failed = true;
        console.error(`✗ ${label} — HTTP ${res.status()}, content-type "${type}"`);
        continue;
      }
      // 200 with an image content-type proves nothing about the bytes, so
      // decode them. `img.decode()` settles on load *and* decode, which is
      // what naturalWidth sampled at a fixed delay only guessed at — that
      // guess is why a slow edge could read as a broken image.
      const decoded = await page.evaluate(async (src) => {
        const img = new Image();
        img.src = src;
        const timeout = new Promise((r) => setTimeout(() => r(-1), 20000));
        const decode = img.decode().then(() => img.naturalWidth).catch(() => 0);
        return Promise.race([decode, timeout]);
      }, base + url);

      if (decoded > 0) {
        console.log(`✓ ${label} — ${body.length} bytes, decoded (${decoded}px wide)`);
      } else {
        failed = true;
        console.error(`✗ ${label} — HTTP 200 and ${body.length} bytes of "${type}", but the browser ${decoded === -1 ? "timed out decoding it" : "could not decode it"}. The bytes being served are not a valid image.`);
      }
    }
  }
  await page.close();
}

await browser.close();
if (failed) { console.error("Render check FAILED"); process.exit(1); }
console.log("Render check passed.");
