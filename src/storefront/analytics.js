// Consent-gated marketing & analytics tags. All IDs are managed by the store
// owner in Admin → Settings; nothing loads until the shopper grants consent.
//
// Providers: GA4, Google Ads, Meta Pixel, TikTok Pixel, Microsoft Clarity.
// A single track() fans a canonical ecommerce event out to whichever are configured.

let started = false;
let cfg = {};

const CONSENT_KEY = "mr-consent"; // "granted" | "denied" | null

export function getConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}
export function setConsent(v) {
  try { localStorage.setItem(CONSENT_KEY, v); } catch {}
}

// Is there anything to ask consent for?
export function hasTags(settings = {}) {
  return !!(settings.ga4Id || settings.googleAdsId || settings.metaPixelId || settings.tiktokPixelId || settings.clarityId);
}

function injectScript(src, attrs = {}) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
  return s;
}

function initGtag(ids) {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${ids[0]}`);
  }
  for (const id of ids) window.gtag("config", id, { anonymize_ip: true });
}

function initMeta(id) {
  if (window.fbq) return;
  const n = (window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
  if (!window._fbq) window._fbq = n;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  injectScript("https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function initTikTok(id) {
  if (window.ttq) return;
  const w = window, t = "ttq";
  w.TiktokAnalyticsObject = t;
  const ttq = (w[t] = w[t] || []);
  ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
  ttq.setAndDefer = function (obj, m) { obj[m] = function () { obj.push([m].concat(Array.prototype.slice.call(arguments, 0))); }; };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.load = function (id2) {
    const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {}; ttq._i[id2] = []; ttq._i[id2]._u = url;
    ttq._t = ttq._t || {}; ttq._t[id2] = +new Date();
    ttq._o = ttq._o || {}; ttq._o[id2] = {};
    injectScript(url + "?sdkid=" + id2 + "&lib=" + t);
  };
  ttq.load(id);
  ttq.page();
}

function initClarity(id) {
  if (window.clarity) return;
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", id);
}

// Call once consent is granted.
export function startAnalytics(settings = {}) {
  if (started || getConsent() !== "granted") return;
  cfg = settings;
  const gtagIds = [settings.ga4Id, settings.googleAdsId].filter(Boolean);
  if (gtagIds.length) initGtag(gtagIds);
  if (settings.metaPixelId) initMeta(settings.metaPixelId);
  if (settings.tiktokPixelId) initTikTok(settings.tiktokPixelId);
  if (settings.clarityId) initClarity(settings.clarityId);
  started = true;
}

// Canonical events: "page_view" | "view_item" | "add_to_cart" | "begin_checkout" | "purchase"
export function track(event, params = {}) {
  if (!started) return;
  const { value, currency = "NGN", items = [], id, name } = params;
  const gItems = items.map((it) => ({ item_id: it.id, item_name: it.name, price: it.price, quantity: it.qty || 1 }));

  if (window.gtag) {
    if (event === "page_view") window.gtag("event", "page_view", { page_location: location.href, page_title: document.title });
    else window.gtag("event", event, { currency, value, items: gItems });
    if (event === "purchase" && cfg.googleAdsId && cfg.googleAdsPurchaseLabel) {
      window.gtag("event", "conversion", { send_to: `${cfg.googleAdsId}/${cfg.googleAdsPurchaseLabel}`, value, currency, transaction_id: id || "" });
    }
  }
  if (window.fbq) {
    const map = { page_view: ["PageView"], view_item: ["ViewContent"], add_to_cart: ["AddToCart"], begin_checkout: ["InitiateCheckout"], purchase: ["Purchase"] };
    for (const e of map[event] || []) {
      const data = { value, currency, content_name: name, content_ids: id && event !== "purchase" ? [id] : gItems.map((i) => i.item_id) };
      // A purchase carries the order number as its event id: the server sends
      // the same Purchase to the Conversions API under the same id
      // (worker/meta.js), and Meta counts the two as one sale.
      if (event === "purchase" && id) window.fbq("track", e, { ...data, order_id: id }, { eventID: id });
      else window.fbq("track", e, data);
    }
  }
  if (window.ttq) {
    const map = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "CompletePayment" };
    if (event === "page_view") window.ttq.page();
    else if (map[event]) window.ttq.track(map[event], { value, currency, content_id: id, content_name: name });
  }
}
