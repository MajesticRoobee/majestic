// The behavioural stream, exercised directly.
//
// This is the one part of the platform that records what people do rather than
// what they bought, so the assertions that matter are the ones about restraint:
//
//   · only the vocabulary we defined is ever written down
//   · nothing that could identify a person survives the door — not in a
//     referrer, not in an entry path, not in a search box
//   · a bot is flagged on the way in, so the rollups are clean and the raw log
//     is still honest
//   · a page cannot write to the database without limit
//   · and the counters a segment reads must actually follow the visit
import {
  sanitiseBatch, tallyBatch, referrerHost, safePath, looksLikeBot, deviceOf,
  insightsConfig, EVENT_TYPES, MAX_BATCH, DEFAULT_RETAIN_DAYS, SEGMENTS,
} from "../worker/insights.js";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

// ---- 1. Nothing personal gets in ------------------------------------------
console.log("\nWhat never gets written down");

check("a referrer is reduced to its host — the rest can carry a search someone typed",
  referrerHost("https://www.google.com/search?q=how+do+i+stop+my+perfume+fading&hl=en"), "google.com");
check("...and a referrer we cannot parse is nothing, not a raw string",
  referrerHost("not a url"), "");
check("...and our own pages are not a source",
  referrerHost(""), "");
check("a path drops its query, so a shared link with an address on it cannot ride in",
  safePath("/confirm?email=someone@example.com&no=MR-1024"), "/confirm");
check("...and its fragment",
  safePath("/shop#section"), "/shop");
check("a path is always a path",
  safePath("shop"), "/shop");

// The search box is the only free text in the stream, and it is the whole
// point of "what did people look for and not find" — so it is allowed, and
// then held to the same rule as everything else.
check("a search term is kept, because that list is the point",
  sanitiseBatch([{ type: "search_no_results", q: "vanilla musk" }])[0].meta.q, "vanilla musk");
check("...but an email typed into the search box is dropped rather than stored",
  sanitiseBatch([{ type: "search", q: "peace@example.com" }])[0].meta, {});
check("...and so is a phone number",
  sanitiseBatch([{ type: "search", q: "call me on 0803 123 4567" }])[0].meta, {});
check("a search term is cut long before it can hold a paragraph",
  sanitiseBatch([{ type: "search", q: "x".repeat(400) }])[0].meta.q.length, 60);

// ---- 2. The vocabulary is fixed -------------------------------------------
console.log("\nThe vocabulary");

check("an event type nobody defined is dropped, not stored as 'other'",
  sanitiseBatch([{ type: "made_up_thing" }, { type: "page_view" }]).map((e) => e.type), ["page_view"]);
check("a field the page invented never reaches the database",
  Object.keys(sanitiseBatch([{ type: "page_view", email: "a@b.com", isAdmin: true }])[0].meta), []);
check("...and neither does anything outside the shape",
  Object.keys(sanitiseBatch([{ type: "page_view" }])[0]).sort(), ["meta", "productId", "type", "value", "variantId"]);
check("the types are the ones the storefront actually sends",
  ["page_view", "view_item", "add_to_cart", "begin_checkout", "purchase", "search_no_results"].every((t) => EVENT_TYPES.has(t)), true);
check("a batch longer than the cap is cut rather than accepted",
  sanitiseBatch(Array.from({ length: 500 }, () => ({ type: "page_view" }))).length, MAX_BATCH);
check("junk instead of a list is no events, not a crash",
  [sanitiseBatch(null).length, sanitiseBatch("nope").length, sanitiseBatch(undefined).length], [0, 0, 0]);
check("a value is clamped, so one page cannot claim a billion-naira order",
  sanitiseBatch([{ type: "purchase", value: 1e15 }])[0].value, 100000000);
check("...and a negative one is floored at zero",
  sanitiseBatch([{ type: "purchase", value: -5000 }])[0].value, 0);

// ---- 3. Bots -------------------------------------------------------------
console.log("\nBots");

check("a crawler is flagged",
  looksLikeBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
check("...and a headless browser",
  looksLikeBot("Mozilla/5.0 HeadlessChrome/120.0.0.0"), true);
check("...and the link previewers that open every URL anyone shares",
  [looksLikeBot("WhatsApp/2.23"), looksLikeBot("facebookexternalhit/1.1")], [true, true]);
check("a request with no user agent at all is not a browser",
  looksLikeBot(""), true);
check("Cloudflare's own verdict is taken when it has one",
  looksLikeBot("Mozilla/5.0 (iPhone)", { cfVerifiedBot: true }), true);
check("a real phone is not a bot",
  looksLikeBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"), false);
check("a phone, a tablet and a desktop are told apart",
  ["Mozilla/5.0 (iPhone)", "Mozilla/5.0 (iPad)", "Mozilla/5.0 (Macintosh)"].map(deviceOf), ["phone", "tablet", "desktop"]);

// ---- 4. What a visit adds up to -------------------------------------------
console.log("\nThe counters a segment reads");

const visit = sanitiseBatch([
  { type: "page_view" },
  { type: "view_item", productId: "a", value: 5000 },
  { type: "view_item", productId: "b", value: 7000 },
  { type: "add_to_cart", productId: "a", value: 5000 },
  { type: "begin_checkout", value: 5000 },
]);
check("a visit that browsed, added and reached checkout counts all three",
  tallyBatch(visit), { views: 2, carts: 1, checkouts: 1, orders: 0, revenue: 0, cartValue: 5000 });
check("a purchase carries its revenue",
  tallyBatch(sanitiseBatch([{ type: "purchase", value: 42000 }])),
  { views: 0, carts: 0, checkouts: 0, orders: 1, revenue: 42000, cartValue: null });
// The one that stops the shop chasing people who changed their mind properly.
check("a cart emptied on purpose leaves nothing behind to chase",
  tallyBatch(sanitiseBatch([{ type: "add_to_cart", value: 5000 }, { type: "remove_from_cart", value: 0 }])).cartValue, 0);
check("a batch that changes nothing leaves the counters alone",
  tallyBatch(sanitiseBatch([{ type: "page_view" }])).cartValue, null);

// ---- 5. Settings and segments ---------------------------------------------
console.log("\nSettings and segments");

check("an empty settings blob measures, keeps ninety days, and chases after 45 minutes",
  insightsConfig({}), { on: true, retainDays: DEFAULT_RETAIN_DAYS, abandonMins: 45 });
check("the house can switch the whole stream off",
  insightsConfig({ insightsOn: false }).on, false);
check("a retention window shorter than a week is refused — the rollup runs daily",
  insightsConfig({ insightsRetainDays: 1 }).retainDays, 7);
check("...and junk in the box does not become a window of NaN days",
  insightsConfig({ insightsRetainDays: "soon" }).retainDays, DEFAULT_RETAIN_DAYS);

check("the segments the client asked for are all there",
  SEGMENTS.map((s) => s.id).sort(),
  ["bounced", "browsed-no-cart", "buyers", "cart-abandoned", "checkout-abandoned", "high-intent", "repeat-no-order"]);
check("every segment says what it is for, so nobody has to read the SQL",
  SEGMENTS.every((s) => s.name && s.why && s.where), true);
// The ask, verbatim: "shopper who entered the website and click but didn't add
// anything to cart".
check("'looked, never added' is exactly that: products opened, nothing basketed",
  SEGMENTS.find((s) => s.id === "browsed-no-cart").where, "s.views >= 2 AND s.carts = 0");

console.log(failures ? `\n${failures} check(s) failed\n` : "\nAll behavioural-stream checks passed\n");
process.exit(failures ? 1 : 0);
