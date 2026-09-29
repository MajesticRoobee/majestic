// Per-page SEO in the browser: keeps the document head in step as a shopper
// moves around the shop. What each page says is decided in src/lib/seo-head.js,
// which the Worker also uses to write the same head into the HTML it serves —
// so a shared link's preview and the live page never disagree.

import { headFor as headForAt, metaTags, META_KEYS, jsonLdText } from "../lib/seo-head.js";

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function setHead(head, settings = {}) {
  if (head.title) document.title = head.title;
  const tags = metaTags(head, settings);
  const set = new Set(tags.map(([, key]) => key));
  for (const [attr, key, content] of tags) upsertMeta(attr, key, content);
  // A tag the last page carried and this one doesn't — a product's price, an
  // article's date — goes, rather than lingering on the next page.
  for (const key of META_KEYS) {
    if (set.has(key)) continue;
    const el = document.head.querySelector(`meta[name="${key}"], meta[property="${key}"]`);
    if (el) el.remove();
  }
  upsertLink("canonical", head.canonical);
  setJsonLd(head.jsonLd);
}

export function setJsonLd(data) {
  const id = "mr-jsonld";
  let el = document.getElementById(id);
  if (!data) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = jsonLdText(data);
}

// Google Search Console — "HTML tag" verification, driven from admin settings.
export function setGscVerification(token) {
  upsertMeta("name", "google-site-verification", token || "");
}

/** The head for a page, on this site's own origin. */
export function headFor(args) {
  return headForAt({ origin: window.location.origin, ...args });
}
