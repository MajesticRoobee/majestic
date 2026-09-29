// Where this shopper came from, kept until they buy.
//
// An ad click arrives with its click id on the address (fbclid from Meta,
// gclid from Google, ttclid from TikTok) and a tagged link with utm_ tags; a
// shopper from another site arrives with a referrer. The first page of a visit
// is the only one that knows, and the order is often placed days later, so the
// last such arrival is written down here and sent with the order. A visit with
// nothing to say (typing the address, a bookmark) doesn't overwrite a real
// source: "Direct" is only what is left when there was never anything else.
//
// First-party and stored in this browser only, like the shop's own visit
// counting (track.js) — and switched off by the same opt-out.

const KEY = "mr-src";
const KEEP_MS = 30 * 86400000;
const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

const readCookie = (name) => safe(() => (document.cookie.split("; ").find((c) => c.startsWith(`${name}=`)) || "").split("=").slice(1).join("="), "");

/** Look at how this page was reached, and keep it if it says anything. */
export function captureAttribution({ optedOut = false } = {}) {
  if (optedOut) return;
  const q = safe(() => new URLSearchParams(window.location.search), new URLSearchParams());
  const click = ["fbclid", "gclid", "ttclid"].find((k) => q.get(k)) || "";
  const ref = safe(() => (document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : ""), "");
  const tagged = q.get("utm_source") || q.get("utm_medium") || q.get("utm_campaign");
  if (!click && !tagged && !ref) return;
  const now = Date.now();
  const note = {
    source: q.get("utm_source") || "",
    medium: q.get("utm_medium") || "",
    campaign: q.get("utm_campaign") || "",
    click,
    clickId: click ? q.get(click) : "",
    referrer: ref ? safe(() => new URL(ref).hostname, "") : "",
    landing: safe(() => window.location.pathname, "/"),
    // Meta's own format for a click, the same one its pixel writes to _fbc.
    fbc: click === "fbclid" ? `fb.1.${now}.${q.get("fbclid")}` : "",
    at: now,
  };
  safe(() => localStorage.setItem(KEY, JSON.stringify(note)));
}

/** What goes with the order: the kept note, plus Meta's browser ids. */
export function attributionForOrder() {
  const raw = safe(() => JSON.parse(localStorage.getItem(KEY) || "null"), null);
  const note = raw && Date.now() - (raw.at || 0) < KEEP_MS ? raw : {};
  return {
    source: note.source || "", medium: note.medium || "", campaign: note.campaign || "",
    click: note.click || "", clickId: note.clickId || "",
    referrer: note.referrer || "", landing: note.landing || "",
    // The pixel's cookies win when it has set them; otherwise our own note.
    fbc: readCookie("_fbc") || note.fbc || "",
    fbp: readCookie("_fbp"),
  };
}
