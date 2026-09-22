// The Perfume Studio's booking page, exercised directly.
//
// The client asked for two things and they pull against each other: a customer
// should be able to book a consultation *on the website*, and the calendar
// should be Calendly. Embedding somebody else's page is the one place a
// storefront usually gives up its Content-Security-Policy and loads a
// third-party script. This one doesn't — it frames Calendly's own page, the
// way the testimonial embeds frame Instagram's — so the only thing that has to
// be right is the URL, and that is what this file is about.
//
// The second half is the same arrangement the About page uses: an empty box is
// not an instruction to publish a blank page.
import { readFileSync } from "node:fs";
import { calendlyEmbedUrl, isCalendlyUrl, consultationContent, blocks, CONSULT_DEFAULTS } from "../src/lib/consultation.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

// ---- 1. The link the house pastes ----------------------------------------
console.log("\nThe calendar's address");

const embed = (u) => calendlyEmbedUrl(u, "majesticroobee.com");
const params = (u) => Object.fromEntries(new URL(u).searchParams);

check("a plain Calendly link is framed",
  params(embed("https://calendly.com/majestic-roobee/consultation")),
  { embed_domain: "majesticroobee.com", embed_type: "Inline", hide_gdpr_banner: "1" });

check("...and keeps its path", new URL(embed("https://calendly.com/majestic-roobee/consultation")).pathname,
  "/majestic-roobee/consultation");

check("a link pasted without the scheme still works",
  new URL(embed("calendly.com/majestic-roobee/60min")).origin, "https://calendly.com");

check("whatever the house put on the link survives — a prefill, a UTM",
  params(embed("https://calendly.com/mr/consultation?name=Ada&utm_source=flyer")).name, "Ada");

check("embed parameters already on the link are set, not doubled",
  embed("https://calendly.com/mr/x?embed_type=PopupText").split("embed_type=").length - 1, 1);
check("...and it is the inline calendar that wins",
  params(embed("https://calendly.com/mr/x?embed_type=PopupText")).embed_type, "Inline");

// The CSP names calendly.com and nothing else, so anything else would frame a
// blank rectangle. Refusing it here is what lets the admin say so instead.
check("a link to anywhere else is refused", embed("https://evil.example.com/book"), "");
check("...including a lookalike host", embed("https://calendly.com.evil.example.com/book"), "");
check("a Calendly subdomain is fine", embed("https://eu.calendly.com/mr/x") !== "", true);
check("http is refused", embed("http://calendly.com/mr/x"), "");
check("nonsense is refused rather than thrown", [embed("not a url"), embed(""), embed(null)], ["", "", ""]);
check("isCalendlyUrl agrees with the embed", [isCalendlyUrl("https://calendly.com/a/b"), isCalendlyUrl("https://x.com")], [true, false]);

// ---- 2. The page, before anybody edits it --------------------------------
console.log("\nThe words the store shipped with");

const shipped = consultationContent({ consultOn: "1" });
check("the heading is the shipped one", shipped.headline, CONSULT_DEFAULTS.headline);
check("...and the line above it", shipped.eyebrow, CONSULT_DEFAULTS.eyebrow);
check("...and the button", shipped.ctaLabel, CONSULT_DEFAULTS.ctaLabel);
check("what a consultation is runs to several blocks", shipped.blocks.length > 3, true);
check("at least one of them is a heading", shipped.blocks.some((b) => b.startsWith("## ")), true);
check("nothing about it depends on being handed a settings object",
  consultationContent().headline, CONSULT_DEFAULTS.headline);

console.log("\nThe house's own words win");
const mine = consultationContent({
  consultOn: "1", consultHeadline: "Sit with a perfumer", consultCtaLabel: "Book an hour",
  consultBody: "One line.\n\n## Two\n\nThree.", consultImage: "/images/studio",
});
check("the heading", mine.headline, "Sit with a perfumer");
check("the button", mine.ctaLabel, "Book an hour");
check("the body", mine.blocks, ["One line.", "## Two", "Three."]);
check("the photograph", mine.imageUrl, "/images/studio");
check("a box left blank falls back rather than publishing nothing", mine.eyebrow, CONSULT_DEFAULTS.eyebrow);
check("a box holding only spaces is a blank box",
  consultationContent({ consultOn: "1", consultHeadline: "   " }).headline, CONSULT_DEFAULTS.headline);

// ---- 3. The switch, and the page with no calendar yet --------------------
console.log("\nOpen, closed, and not connected yet");

check("the studio ships closed", consultationContent({}).on, false);
check("a string 1 from the settings blob opens it", consultationContent({ consultOn: "1" }).on, true);
check("...and 0 does not", consultationContent({ consultOn: "0" }).on, false);

// This is the ordinary order of events: somebody switches consultations on
// before the Calendly account exists. The page must not be a blank frame.
const noCalendar = consultationContent({ consultOn: "1" });
check("open with no link yet is open, without a calendar", [noCalendar.on, noCalendar.hasCalendar], [true, false]);
check("a bad link reads as no calendar rather than a broken one",
  consultationContent({ consultOn: "1", consultCalendlyUrl: "https://evil.example.com" }).hasCalendar, false);
check("a good link gives the page a calendar",
  consultationContent({ consultOn: "1", consultCalendlyUrl: "https://calendly.com/mr/x" }).hasCalendar, true);

check("blank text is no blocks, not one empty one", blocks("  \n\n  "), []);

// ---- 4. The screen, the server and the policy agree ----------------------
console.log("\nThe pieces line up");

// A setting nobody allowed through PUT /api/admin/settings is a box that
// silently forgets what was typed into it.
const adminSrc = readFileSync(new URL("../worker/admin.js", import.meta.url), "utf8");
const KEYS = ["consultOn", "consultCalendlyUrl", "consultEyebrow", "consultHeadline", "consultIntro",
  "consultBody", "consultCtaLabel", "consultImage", "consultSeoTitle", "consultSeoDesc"];
check("the server accepts every key the studio panel saves",
  KEYS.filter((k) => !adminSrc.includes(`"${k}"`)), []);

const settingsSrc = readFileSync(new URL("../src/admin/pages-growth.jsx", import.meta.url), "utf8");
const panel = settingsSrc.match(/consult: \[([^\]]*)\]/);
check("...and the panel saves every key the page reads",
  KEYS.filter((k) => !(panel && panel[1].includes(`"${k}"`))), []);

// Framing Calendly is only possible if the policy says so — and the policy is
// a static file nothing else would fail on.
const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
// The policy itself, not the comment above it explaining the policy.
const csp = (headers.split(/\r?\n/).find((l) => l.trim().startsWith("Content-Security-Policy:")) || "");
const frameSrc = (csp.match(/frame-src ([^;]*);/) || [])[1] || "";
check("the policy lets the calendar frame", frameSrc.includes("https://calendly.com"), true);
check("...and nothing was dropped from it on the way",
  ["checkout.paystack.com", "www.instagram.com", "www.tiktok.com", "www.youtube.com"].filter((h) => !frameSrc.includes(h)), []);
check("no Calendly script is allowed, because none is loaded",
  /script-src[^;]*calendly/.test(csp), false);

// The band's tab, and the two places it must *not* appear. A tab that lands
// on "bookings aren't open at the moment" is worse than no tab.
const chromeSrc = readFileSync(new URL("../src/storefront/chrome.jsx", import.meta.url), "utf8");
check("the header band carries a consultation tab", /label: "Book a consultation", page: "consultation"/.test(chromeSrc), true);
check("...which is conditional, not unconditional", /page: "consultation".*when:/.test(chromeSrc), true);
check("...and the band filters on that condition", /!t\.when \|\| t\.when\(ctx\)/.test(chromeSrc), true);
check("...as does the phone drawer, which lists the same tabs",
  (chromeSrc.match(/!t\.when \|\| t\.when\(ctx\)/g) || []).length >= 2, true);

// /consultation has to be a route, not an information page: the storefront's
// catch-all turns any unknown single segment into "no such page".
const routerSrc = readFileSync(new URL("../src/storefront/router.js", import.meta.url), "utf8");
check("the storefront routes /consultation", routerSrc.includes('"consultation"'), true);
check("...and a content page cannot claim the address", adminSrc.includes('"consultation", "brand"'), true);

console.log(failures ? `\n${failures} failing` : "\nAll good");
process.exit(failures ? 1 : 0);
