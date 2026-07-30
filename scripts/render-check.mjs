// Post-deploy safety net: load the live storefront + admin in a real browser
// and fail if the SPA renders nothing or throws — catches white-screen
// regressions that the HTML/API smoke test can't (it never executes JS).
import { chromium } from "playwright";

const base = process.env.SITE_URL || "https://majestic-roobee.victorugwu4real.workers.dev";
const targets = [
  { path: "/", needsRoot: true },
  { path: "/shop", needsRoot: true },
  { path: "/product/hypnotic-poison", needsRoot: true },
  { path: "/admin/", needsRoot: true },
];

const browser = await chromium.launch();
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
await browser.close();
if (failed) { console.error("Render check FAILED"); process.exit(1); }
console.log("Render check passed.");
