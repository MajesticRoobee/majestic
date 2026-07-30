// Post-deploy safety net: load the live storefront + admin in a real browser
// and fail if the SPA renders nothing or throws — catches white-screen
// regressions that the HTML/API smoke test can't (it never executes JS).
import { chromium } from "playwright";

const base = process.env.SITE_URL || "https://majestic-roobee.victorugwu4real.workers.dev";

// Pull a product page from whatever is actually live rather than naming one.
// The demo catalogue gets cleared at go-live, and a hardcoded slug would quietly
// start testing a 404 instead of a real product page.
const store = await fetch(base + "/api/store").then((r) => r.json()).catch(() => ({}));
const sample = (store.products || [])[0];

const targets = [
  { path: "/", needsRoot: true },
  { path: "/shop", needsRoot: true },
  ...(sample ? [{ path: "/product/" + sample.id, needsRoot: true }] : []),
  { path: "/admin/", needsRoot: true },
];
if (!sample) console.log("• catalogue is empty — skipping the product-page check");

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
// Product photos live in D1 and are served from /images/<id>. A blob that comes
// back mangled still yields a 200, so check the browser can actually decode one.
const imgPage = await browser.newPage();
try {
  const withPhoto = (store.products || []).find((p) => (p.imageUrl || "").startsWith("/images/"));
  if (!withPhoto) {
    console.log("• no uploaded product photos yet — skipping image decode check");
  } else {
    await imgPage.goto(base + "/product/" + withPhoto.id, { waitUntil: "domcontentloaded", timeout: 30000 });
    await imgPage.waitForTimeout(3000);
    const w = await imgPage.evaluate((src) => {
      const el = [...document.images].find((i) => i.src.includes(src));
      return el ? el.naturalWidth : -1;
    }, withPhoto.imageUrl);
    if (w > 0) console.log(`✓ ${withPhoto.imageUrl} decoded (${w}px wide)`);
    else { failed = true; console.error(`✗ ${withPhoto.imageUrl} — image did not decode (naturalWidth ${w})`); }
  }
} catch (e) {
  failed = true;
  console.error(`✗ image decode check — ${e.message}`);
}
await imgPage.close();

await browser.close();
if (failed) { console.error("Render check FAILED"); process.exit(1); }
console.log("Render check passed.");
