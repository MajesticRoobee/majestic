// Where an order came from, and what Meta is told about it.
//
// An order carries the note the storefront kept of how its buyer arrived; the
// admin reads it as a channel ("Meta ads", "Instagram", "Direct"), and the
// Conversions API reports the purchase to Meta under the order number. Both
// halves are pure enough to pin here.
import { cleanAttribution, channelOf } from "../worker/attribution.js";
import { purchaseEvent, metaPhone } from "../worker/meta.js";
import { createHash } from "node:crypto";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};
const sha = (s) => createHash("sha256").update(s).digest("hex");

console.log("\nNaming the channel");
check("a Meta ad click is Meta ads, whatever the tags say", channelOf({ click: "fbclid", source: "ig" }), "Meta ads");
check("tagged paid social from Instagram is Meta ads", channelOf({ source: "instagram", medium: "paid_social" }), "Meta ads");
check("a Google ad click is Google ads", channelOf({ click: "gclid" }), "Google ads");
check("a TikTok ad click is TikTok ads", channelOf({ click: "ttclid" }), "TikTok ads");
check("an unpaid tagged link is named by its source", channelOf({ source: "newsletter", medium: "email" }), "Newsletter");
check("Instagram's link shim is Instagram", channelOf({ referrer: "l.instagram.com" }), "Instagram");
check("Facebook's is Facebook", channelOf({ referrer: "lm.facebook.com" }), "Facebook");
check("a Google results page is Google search", channelOf({ referrer: "www.google.com.ng" }), "Google search");
check("nothing at all is Direct", channelOf({}), "Direct");
check("the order row's own column names read the same", channelOf({ src_click: "fbclid" }), "Meta ads");

console.log("\nCleaning what the browser sends");
const clean = cleanAttribution({ source: "  Instagram ", click: "evil", clickId: "x", referrer: "https://l.instagram.com/?u=abc", landing: "/product/x?utm_source=ig", fbc: "fb.1.123.abc", fbp: "nonsense" });
check("sources are lower-cased and trimmed", clean.source, "instagram");
check("an unknown click kind is dropped, with its id", [clean.click, clean.clickId], ["", ""]);
check("a referrer is kept as its host alone", clean.referrer, "l.instagram.com");
check("a landing page keeps its path, not its query", clean.landing, "/product/x");
check("Meta ids are kept only in Meta's own format", [clean.fbc, clean.fbp], ["fb.1.123.abc", ""]);
check("control characters never reach the database", cleanAttribution({ campaign: "a\u0000b\u001fc" }).campaign, "abc");
check("nothing sent is nothing stored", cleanAttribution(undefined).source, "");

console.log("\nThe Conversions API event");
check("a Nigerian number takes the country code", [metaPhone("0809 202 0525"), metaPhone("+234 809 202 0525")], ["2348092020525", "2348092020525"]);
const ev = await purchaseEvent(
  { no: "MR-10042", total: 45000, email: " Ada@Example.com ", phone: "0809 202 0525", city: "Abuja", placed_at: "2026-09-29 17:00:00", src_fbc: "fb.1.1.abc", capi_ip: "1.2.3.4", capi_ua: "UA" },
  [{ sku: "VR-30", qty: 2 }, { product_id: "osk", qty: 1 }],
  { siteUrl: "https://majesticroobee.shop/" },
);
check("the event id is the order number, the same one the pixel sends", [ev.event_name, ev.event_id], ["Purchase", "MR-10042"]);
check("email and phone travel hashed, normalised first", [ev.user_data.em[0], ev.user_data.ph[0]], [sha("ada@example.com"), sha("2348092020525")]);
check("the click id and the browser go with it", [ev.user_data.fbc, ev.user_data.client_ip_address, ev.user_data.client_user_agent], ["fb.1.1.abc", "1.2.3.4", "UA"]);
check("the value is the order's, in naira", [ev.custom_data.value, ev.custom_data.currency, ev.custom_data.num_items], [45000, "NGN", 3]);
check("it is timed to when the order was placed", ev.event_time, Math.floor(Date.parse("2026-09-29T17:00:00Z") / 1000));
check("no raw email or phone anywhere in it", /ada@|0809/.test(JSON.stringify(ev)), false);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
