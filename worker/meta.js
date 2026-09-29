// Meta's Conversions API: the server's own word that a purchase happened.
//
// The pixel in the browser reports a purchase too, but it can be blocked, and
// it never runs for a buyer who pays on Paystack's page and closes the tab.
// This sends the same Purchase from the server, under the same event id (the
// order number), so Meta counts the sale once and can still tie it to the ad
// that brought the buyer in.
//
// Only for a buyer who accepted marketing cookies, only once per order, and
// only when both the pixel id (Admin → Settings → Analytics) and the access
// token (the META_CAPI_TOKEN secret) are set. Their email and phone travel
// hashed, as Meta requires; their IP and browser, which Meta uses to match the
// click, are cleared from the order once the event has gone.

import { sha256hex, getSettings } from "./util.js";

export const GRAPH = "https://graph.facebook.com/v21.0";

/** Digits with the country code, the form Meta hashes a phone number in. */
export function metaPhone(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("0")) return `234${d.slice(1)}`;
  return d;
}

/** The event Meta receives for one order. Pure apart from the hashing. */
export async function purchaseEvent(order, items = [], { siteUrl = "", now = Date.now() } = {}) {
  const hash = async (v) => (v ? sha256hex(v) : null);
  const em = await hash(String(order.email || "").trim().toLowerCase());
  const ph = await hash(metaPhone(order.phone));
  const ct = await hash(String(order.city || "").trim().toLowerCase().replace(/[^a-z]/g, ""));
  const user = {
    ...(em ? { em: [em] } : {}),
    ...(ph ? { ph: [ph] } : {}),
    ...(ct ? { ct: [ct] } : {}),
    country: [await sha256hex("ng")],
    ...(order.src_fbc ? { fbc: order.src_fbc } : {}),
    ...(order.src_fbp ? { fbp: order.src_fbp } : {}),
    ...(order.capi_ip ? { client_ip_address: order.capi_ip } : {}),
    ...(order.capi_ua ? { client_user_agent: order.capi_ua } : {}),
  };
  const placed = Date.parse(String(order.placed_at || "").replace(" ", "T") + "Z");
  return {
    event_name: "Purchase",
    event_time: Math.floor((Number.isFinite(placed) ? placed : now) / 1000),
    // The browser's pixel sends the same id, which is what makes the two one.
    event_id: order.no,
    action_source: "website",
    ...(siteUrl ? { event_source_url: `${siteUrl.replace(/\/$/, "")}/confirm` } : {}),
    user_data: user,
    custom_data: {
      currency: "NGN",
      value: Number(order.total) || 0,
      order_id: order.no,
      content_type: "product",
      content_ids: items.map((i) => i.sku || i.product_id).filter(Boolean),
      num_items: items.reduce((n, i) => n + (i.qty || 0), 0),
    },
  };
}

/** Post events to Meta. Returns { ok, status, body }. */
export async function postEvents(pixelId, token, events, { testCode = "" } = {}) {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: events, ...(testCode ? { test_event_code: testCode } : {}) }),
    signal: AbortSignal.timeout(5000),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 400) };
}

/**
 * Tell Meta about one order, if everything allows it. Never throws: a sale is
 * never held up by an ad platform.
 */
export async function sendMetaPurchase(env, orderNo) {
  try {
    const db = env.DB;
    const settings = await getSettings(db);
    const pixel = String(settings.metaPixelId || "").trim();
    const token = env.META_CAPI_TOKEN;
    if (!pixel || !token) return { skipped: "not set up" };
    const order = await db.prepare("SELECT * FROM orders WHERE no=?").bind(orderNo).first();
    if (!order) return { skipped: "no such order" };
    if (!order.ad_consent) return { skipped: "no consent" };
    if (order.meta_sent_at) return { skipped: "already sent" };
    const items = (await db.prepare("SELECT sku, product_id, qty FROM order_items WHERE order_no=?").bind(orderNo).all()).results;
    const event = await purchaseEvent(order, items, { siteUrl: settings.siteUrl || env.SITE_URL || "" });
    const r = await postEvents(pixel, token, [event]);
    await db.prepare(
      `UPDATE orders SET meta_sent_at = CASE WHEN ? THEN datetime('now') ELSE meta_sent_at END,
                         meta_result = ?, capi_ip = CASE WHEN ? THEN NULL ELSE capi_ip END,
                         capi_ua = CASE WHEN ? THEN NULL ELSE capi_ua END
        WHERE no = ?`
    ).bind(r.ok ? 1 : 0, r.ok ? "sent" : `error ${r.status}: ${r.body.slice(0, 160)}`, r.ok ? 1 : 0, r.ok ? 1 : 0, orderNo).run();
    return r;
  } catch (e) {
    console.error("meta capi failed for " + orderNo, e);
    try {
      await env.DB.prepare("UPDATE orders SET meta_result=? WHERE no=?").bind(`error: ${String(e.message || e).slice(0, 160)}`, orderNo).run();
    } catch { /* the sale stands either way */ }
    return { ok: false, error: String(e.message || e) };
  }
}
