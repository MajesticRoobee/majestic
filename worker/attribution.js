// Where an order came from.
//
// The storefront keeps a note of how a shopper arrived (src/storefront/
// attribution.js) and sends it with the order. This file is the server's half:
// it cleans what arrives — it is the browser's word, so every field is clipped
// and the click id's kind is one of three — and names the channel the house
// reads in the admin. Pure, so it is tested directly.

const CLICKS = ["fbclid", "gclid", "ttclid"];
// Printable text only: control characters are dropped rather than stored.
const clip = (v, n = 200) => [...String(v ?? "")].filter((ch) => ch.charCodeAt(0) >= 32).join("").trim().slice(0, n);
const host = (v) => clip(v, 120).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

/** The attribution block from an order request, made safe to store. */
export function cleanAttribution(a = {}) {
  const src = a && typeof a === "object" ? a : {};
  const click = CLICKS.includes(src.click) ? src.click : "";
  return {
    source: clip(src.source, 80).toLowerCase(),
    medium: clip(src.medium, 80).toLowerCase(),
    campaign: clip(src.campaign, 120),
    click,
    clickId: click ? clip(src.clickId, 500) : "",
    referrer: host(src.referrer),
    landing: clip(src.landing, 200).split("?")[0],
    fbc: /^fb\.\d\.\d+\./.test(String(src.fbc || "")) ? clip(src.fbc, 600) : "",
    fbp: /^fb\.\d\.\d+\./.test(String(src.fbp || "")) ? clip(src.fbp, 200) : "",
  };
}

const PAID = /^(cpc|ppc|paid|paid[_-]?social|paidsocial|ads?|cpm|display|social[_-]?paid)$/;
const META = /^(fb|facebook|ig|instagram|meta|facebook[_-]?ads|instagram[_-]?ads|meta[_-]?ads)$/;

/**
 * The channel an order is filed under: "Meta ads", "Google ads", "TikTok ads",
 * a named source ("Instagram", "Newsletter"), the referring site, or "Direct".
 * An ad's click id is the strongest evidence and wins; tags come next; the
 * referrer last.
 */
export function channelOf(o = {}) {
  const source = String(o.source || o.src_source || "").toLowerCase();
  const medium = String(o.medium || o.src_medium || "").toLowerCase();
  const click = String(o.click || o.src_click || "");
  const ref = String(o.referrer || o.src_referrer || "").toLowerCase();
  const paid = PAID.test(medium);
  if (click === "fbclid" || (META.test(source) && paid)) return "Meta ads";
  if (click === "gclid" || (source === "google" && paid)) return "Google ads";
  if (click === "ttclid" || (source === "tiktok" && paid)) return "TikTok ads";
  if (source) return source.charAt(0).toUpperCase() + source.slice(1);
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(ref)) return "Facebook";
  if (/(^|\.)instagram\.com$/.test(ref)) return "Instagram";
  if (/(^|\.)tiktok\.com$/.test(ref)) return "TikTok";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(ref)) return "WhatsApp";
  if (/(^|\.)(t\.co|x\.com|twitter\.com)$/.test(ref)) return "X";
  if (/(^|\.)google\.[a-z.]+$/.test(ref)) return "Google search";
  if (/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com)$/.test(ref)) return "Search";
  if (ref) return ref;
  return "Direct";
}
