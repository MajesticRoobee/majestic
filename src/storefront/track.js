// First-party measurement.
//
// The shop's own visitors, on the shop's own domain, in the shop's own
// database. Not a pixel: this is the data the house can actually act on —
// joined to its customers, readable in its admin, and still there for the large
// share of real traffic on which a third-party tag never loads at all.
//
// Three promises, kept here rather than in a policy page nobody reads:
//
//   · **Nothing personal leaves the page.** Ids, types, paths and amounts. The
//     visitor id is a random string that means nothing outside this store.
//   · **Anyone can say no**, and no means no measurement at all — not "measure
//     anyway and mark the row". Do Not Track and Global Privacy Control are
//     honoured without being asked.
//   · **It never gets in the way.** Every call is wrapped; a measurement
//     failure must never be something a shopper can see.

const VISITOR_KEY = "mr-visitor";
const SESSION_KEY = "mr-session";
const OPTOUT_KEY = "mr-no-measure";
// A visit is over after half an hour of quiet, which is the convention every
// analytics tool uses and the one the house's own numbers will be compared to.
const SESSION_GAP_MS = 30 * 60 * 1000;
const FLUSH_MS = 5000;

let queue = [];
let timer = null;
let started = false;
let city = "";

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

const rid = () => {
  const b = new Uint8Array(16);
  (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
};

/** Has this visitor asked not to be measured — by our switch, or by their browser? */
export function optedOut() {
  if (safe(() => localStorage.getItem(OPTOUT_KEY), null) === "1") return true;
  // Both of these are a person telling every site the same thing. Honouring
  // them costs a line and is the difference between a claim and a practice.
  const n = safe(() => window.navigator, {}) || {};
  return n.globalPrivacyControl === true || n.doNotTrack === "1" || window.doNotTrack === "1";
}

export function setOptOut(on) {
  safe(() => (on ? localStorage.setItem(OPTOUT_KEY, "1") : localStorage.removeItem(OPTOUT_KEY)));
  if (on) { queue = []; started = false; }
}

/** The visitor's own id, minted once. Meaningless outside this store. */
export function visitorId() {
  let v = safe(() => localStorage.getItem(VISITOR_KEY), null);
  if (!v) { v = rid(); safe(() => localStorage.setItem(VISITOR_KEY, v)); }
  return v;
}

/** This visit. A new one after half an hour of quiet. */
function sessionId() {
  const now = Date.now();
  const raw = safe(() => sessionStorage.getItem(SESSION_KEY), null) || safe(() => localStorage.getItem(SESSION_KEY), null);
  let s = null;
  try { s = raw ? JSON.parse(raw) : null; } catch { s = null; }
  if (!s || !s.id || now - (s.at || 0) > SESSION_GAP_MS) s = { id: rid(), at: now, fresh: true };
  else s = { ...s, at: now, fresh: false };
  const json = JSON.stringify({ id: s.id, at: s.at });
  safe(() => sessionStorage.setItem(SESSION_KEY, json));
  safe(() => localStorage.setItem(SESSION_KEY, json));
  return s;
}

const utm = (k) => safe(() => new URLSearchParams(window.location.search).get(k) || "", "");

function send(beacon) {
  if (!queue.length) return;
  const events = queue;
  queue = [];
  const s = sessionId();
  const body = JSON.stringify({
    sid: s.id, vid: visitorId(), city,
    path: safe(() => window.location.pathname, "/"),
    // Only a referrer from somewhere else is worth sending — the server keeps
    // the host and drops the rest, and our own pages are noise.
    ref: safe(() => (document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : ""), ""),
    utmSource: utm("utm_source"), utmMedium: utm("utm_medium"), utmCampaign: utm("utm_campaign"),
    events,
  });
  const url = "/api/track";
  // On a page that is closing, `fetch` is cancelled with it and the last events
  // of a visit — the interesting ones — are exactly the ones lost. sendBeacon
  // is handed to the browser to deliver afterwards.
  if (beacon && safe(() => navigator.sendBeacon(url, new Blob([body], { type: "application/json" })), false)) return;
  safe(() => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {}));
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; send(false); }, FLUSH_MS);
}

/** Record one thing that happened. Silently does nothing when opted out. */
export function record(type, fields = {}) {
  if (!started || optedOut()) return;
  queue.push({ type, ...fields });
  if (queue.length >= 20) send(false);
  else schedule();
}

/** Which store the shopper is browsing, so a shelf can be read per city. */
export function setCity(id) { city = String(id || ""); }

/**
 * Begin measuring. Safe to call repeatedly; only the first one counts.
 *
 * Unlike the marketing tags, this does not wait on the cookie banner: it is the
 * shop measuring its own shop, it sets no third-party cookie and shares nothing
 * with anyone. The banner governs the tools that *do* — and anyone who would
 * rather not be counted at all has the switch above, which the privacy page
 * points at.
 */
export function startTracking({ on = true } = {}) {
  if (started || !on || optedOut()) return;
  started = true;
  window.addEventListener("pagehide", () => send(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") send(true); });
}

/** Everything still queued, now — used before a hard navigation. */
export function flushNow() { if (started) send(true); }
