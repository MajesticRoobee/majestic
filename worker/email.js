// Email, through Resend.
//
// Every email the shop sends goes through `sendEmail`: the automations in the
// outbox (order paid, status updates, back in stock, abandoned cart, welcome,
// the low-stock digest) and the strictly transactional ones that cannot wait
// for the cron (password reset). Before this there were two copies of the same
// fetch, each sending plain text only and each reporting a failure as a bare
// "Resend 403" — which is what an unverified sending domain looks like, and
// nobody could have told that from the log.
//
// What it needs, all of it Worker secrets (never the database):
//
//   RESEND_API_KEY   re_… — resend.com → API Keys. "Sending access" is all it
//                    needs; restrict it to the shop's domain.
//   RESEND_FROM      "Majestic Roobee <hello@majesticroobee.shop>" — the address
//                    must be on a domain verified in Resend → Domains, or every
//                    send is refused.
//   RESEND_REPLY_TO  optional — where a customer's reply lands, if not the
//                    From address (e.g. the customer-service inbox).
//
// With no key, nothing is sent and nothing is lost: the message is recorded as
// `queued` with its full text, readable in Admin → Integrations.

import { getSettings } from "./util.js";

const DEFAULT_FROM = "Majestic Roobee <hello@majesticroobee.shop>";

/** What the admin screen shows, without ever handing back the key itself. */
export function emailConfig(env) {
  const key = String(env.RESEND_API_KEY || "");
  const from = String(env.RESEND_FROM || DEFAULT_FROM);
  const domain = (/@([^>\s]+)>?\s*$/.exec(from) || [])[1] || "";
  return {
    connected: key.startsWith("re_"),
    // A key that is set but isn't shaped like one is worth saying so about —
    // a pasted "Bearer re_…" or a stray quote is a 401 on every send.
    keyLooksWrong: !!key && !key.startsWith("re_"),
    from,
    fromIsDefault: !env.RESEND_FROM,
    domain,
    replyTo: String(env.RESEND_REPLY_TO || ""),
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])/g;
const linkify = (s) => esc(s).replace(URL_RE, (u) => `<a href="${u}" style="color:#6b3f8f;text-decoration:underline">${u}</a>`);

/**
 * The shop's letterhead around a plain-text message.
 *
 * The automations are written as plain text in the admin — blank lines between
 * paragraphs — and stay that way; this only dresses them. A paragraph that is
 * a label followed by a single link ("Pick up where you left off: https://…")
 * becomes a button, because that link is the whole point of the email.
 *
 * Table layout and inline styles only: that is what renders the same in
 * Gmail, Outlook and Apple Mail.
 */
export function renderEmail({ subject, text, brand = {} }) {
  const name = brand.name || "Majestic Roobee";
  const site = String(brand.siteUrl || "").replace(/\/$/, "");
  // An uploaded light logo if there is one (it may be a relative /images/…
  // address, which an inbox can't resolve on its own), else the one the build
  // ships with. No site address at all means no way to point at an image, so
  // the name is set in type instead.
  const own = String(brand.logoUrl || "");
  const logo = /^https?:\/\//.test(own) ? own : site ? `${site}${own.startsWith("/") ? own : "/logo-light.png"}` : "";
  const paras = String(text || "").replace(/\r\n?/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const body = paras.map((p) => {
    const cta = /^(.{2,60}?):\s*(https?:\/\/\S+)$/.exec(p);
    if (cta) {
      return `<tr><td style="padding:8px 0 18px"><a href="${esc(cta[2])}" style="display:inline-block;background:#d6b26a;color:#241430;font-weight:700;font-size:15px;text-decoration:none;padding:13px 24px;border-radius:6px">${esc(cta[1])}</a></td></tr>`;
    }
    return `<tr><td style="padding:0 0 16px;font-size:15px;line-height:1.65;color:#3a2a44">${linkify(p).replace(/\n/g, "<br>")}</td></tr>`;
  }).join("");
  const footer = [brand.phone, brand.email].filter(Boolean).map(esc).join(" · ");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#faf6f1;font-family:Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(paras[0] || subject).slice(0, 140)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f1"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #eadfd3">
<tr><td style="background:#2d1a3b;padding:22px 28px;text-align:center">${logo
    ? `<img src="${esc(logo)}" alt="${esc(name)}" height="40" style="height:40px;border:0;display:inline-block">`
    : `<span style="font-family:Georgia,serif;font-size:22px;color:#faf6f1;letter-spacing:.5px">${esc(name)}</span>`}</td></tr>
<tr><td style="padding:30px 28px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:0 0 18px;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:#241430">${esc(subject)}</td></tr>
${body}
</table></td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #f0e8df;font-size:12px;line-height:1.6;color:#8a7a92;text-align:center">
${site ? `<a href="${esc(site)}" style="color:#6b3f8f;text-decoration:none;font-weight:600">${esc(site.replace(/^https?:\/\//, ""))}</a><br>` : ""}${footer}
</td></tr></table></td></tr></table></body></html>`;
  return { html, text: String(text || "") };
}

/** Resend's own words for a refusal, which name the actual problem. */
async function refusal(res) {
  let msg = "";
  try { const j = await res.json(); msg = j.message || j.error || j.name || ""; } catch { /* not JSON */ }
  const hint = res.status === 401 ? " — the API key is wrong or revoked."
    : res.status === 403 && /domain/i.test(msg) ? " — verify the domain in Resend → Domains, or change RESEND_FROM."
    : res.status === 422 ? " — check the From address and the recipient."
    : res.status === 429 ? " — rate limited; it will be retried." : "";
  return `Resend ${res.status}: ${msg || res.statusText || "refused"}${hint}`.slice(0, 240);
}

/**
 * Send one email. Returns `{ sent, detail, id }` and never throws.
 *
 * `idempotencyKey` makes a retry safe: Resend sends a given key once, so the
 * cron re-running an outbox row that timed out after Resend accepted it does
 * not put two copies in a customer's inbox.
 */
export async function sendEmail(env, { to, subject, text, idempotencyKey = "", tags = [], replyTo = "" }) {
  const cfg = emailConfig(env);
  const recipient = String(to || "").trim();
  if (!cfg.connected) return { sent: false, detail: cfg.keyLooksWrong ? "RESEND_API_KEY doesn't look like a Resend key (re_…)" : "no email provider configured" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return { sent: false, detail: "no email address to send to" };
  let brand = {};
  try {
    const s = await getSettings(env.DB);
    brand = { name: s.siteName, siteUrl: s.siteUrl || env.SITE_URL, logoUrl: s.logoLightUrl, phone: s.contactPhone, email: s.contactEmail };
  } catch { /* the letterhead falls back to the name alone */ }
  const { html } = renderEmail({ subject, text, brand });
  const headers = { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" };
  if (idempotencyKey) headers["idempotency-key"] = String(idempotencyKey).slice(0, 256);
  const payload = {
    from: cfg.from, to: [recipient], subject, text, html,
    ...(replyTo || cfg.replyTo ? { reply_to: replyTo || cfg.replyTo } : {}),
    ...(tags.length ? { tags: tags.map((t) => ({ name: "kind", value: String(t).replace(/[^\w-]/g, "_").slice(0, 256) })) } : {}),
  };
  try {
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers, body: JSON.stringify(payload) });
    if (!res.ok) return { sent: false, detail: await refusal(res), retry: res.status === 429 || res.status >= 500 };
    const j = await res.json().catch(() => ({}));
    return { sent: true, detail: "via Resend", id: j.id || "" };
  } catch (e) {
    return { sent: false, detail: `Couldn't reach Resend: ${String(e.message || e).slice(0, 80)}`, retry: true };
  }
}
