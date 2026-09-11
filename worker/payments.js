// Paystack settlement.
//
// The rule this file exists to enforce: **an order is paid when, and only when,
// the gateway confirms a successful charge for the amount this server asked for,
// in the currency it asked for.** Nothing a browser sends can settle an order,
// and nothing settles one twice.
//
// Money is handled in kobo (Paystack's smallest unit) from the moment it leaves
// `orders.total` until it comes back, so there is no rounding step in the middle
// where a naira figure and a kobo figure can drift apart.
import { emitEvent } from "./events.js";
import { issueEarnedReward } from "./rewards.js";
import { getSettings } from "./util.js";

const API = "https://api.paystack.co";

// Local testing can point the gateway at `scripts/paystack-stub.mjs`. This is
// read from the Worker's own environment — never from a request — and is unset
// everywhere except a developer's `.dev.vars`.
const apiBase = (env) => env.PAYSTACK_API_BASE || API;

// How long an unpaid card order holds its stock. Long enough to find a card and
// finish a 3-D Secure challenge, short enough that a walked-away checkout does
// not keep a bottle off the shelf all day.
export const HOLD_MINUTES = 45;

export const CURRENCY = "NGN";

export function paystackEnabled(env) {
  return !!env.PAYSTACK_SECRET_KEY;
}

export function toKobo(ngn) {
  return Math.round(Number(ngn) * 100);
}

// One reference per attempt. The order number is carried inside it so a payment
// can be traced from the Paystack dashboard back to an order by eye, and the
// suffix keeps a retry from colliding with an abandoned first attempt.
function newReference(no) {
  return `${no.replace(/-/g, "_")}_${Date.now().toString(36)}`;
}

async function logPayment(db, order_no, row) {
  await db
    .prepare(
      `INSERT INTO payments (order_no, reference, amount, currency, status, channel, source, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      order_no,
      row.reference || "",
      row.amount || 0,
      row.currency || CURRENCY,
      row.status,
      row.channel || null,
      row.source,
      String(row.detail || "").slice(0, 300)
    )
    .run();
}

async function paystack(env, path, init) {
  const res = await fetch(apiBase(env) + path, {
    ...init,
    headers: {
      authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "content-type": "application/json",
      ...(init && init.headers),
    },
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, body };
}

// ---- Stock reservation -------------------------------------------------
//
// Placing an order takes stock off the shelf; letting it lapse puts it back.
// Both directions live here so they can never disagree, and both are guarded by
// `orders.stock_released` so neither can be applied twice.

async function moveStock(db, no, direction) {
  const items = (await db.prepare("SELECT variant_id, qty, location_id FROM order_items WHERE order_no=?").bind(no).all()).results;
  const statements = items
    .filter((i) => i.variant_id && i.location_id)
    .map((i) =>
      direction === "release"
        ? db.prepare("UPDATE stock SET qty = qty + ? WHERE variant_id=? AND location_id=?").bind(i.qty, i.variant_id, i.location_id)
        : db.prepare("UPDATE stock SET qty = MAX(0, qty - ?) WHERE variant_id=? AND location_id=?").bind(i.qty, i.variant_id, i.location_id)
    );
  if (statements.length) await db.batch(statements);
}

// Give an order's reservation back. Returns true only if this call is the one
// that did it — the conditional UPDATE is the lock.
async function releaseStock(db, no) {
  const r = await db.prepare("UPDATE orders SET stock_released=1 WHERE no=? AND stock_released=0").bind(no).run();
  if (!r.meta.changes) return false;
  await moveStock(db, no, "release");
  return true;
}

// Take it back — for a payment that lands after the hold lapsed.
async function retakeStock(db, no) {
  const r = await db.prepare("UPDATE orders SET stock_released=0 WHERE no=? AND stock_released=1").bind(no).run();
  if (!r.meta.changes) return false;
  await moveStock(db, no, "reserve");
  return true;
}

// ---- Settlement --------------------------------------------------------

// Does what the gateway reported actually settle this order?
//
// Anyone who can reach the webhook can describe a charge; only a charge for the
// exact amount and currency this server initialized may mark an order paid.
function chargeSettles(order, data) {
  if (!data || data.status !== "success") return { ok: false, why: `gateway status ${data ? data.status : "unknown"}` };
  const currency = String(data.currency || "").toUpperCase();
  if (currency !== CURRENCY) return { ok: false, why: `wrong currency ${currency}` };
  const expected = order.pay_amount || toKobo(order.total);
  if (Number(data.amount) !== expected) return { ok: false, why: `amount ${data.amount} ≠ ${expected}` };
  return { ok: true };
}

// Mark an order paid — exactly once, whichever leg gets here first.
//
// The conditional UPDATE is the idempotency guard: the redirect leg and the
// webhook race by design, and only the one that actually changes a row goes on
// to touch the timeline or fire the post-purchase automation.
export async function markPaid(env, order, data, source) {
  const db = env.DB;
  const r = await db
    .prepare(
      `UPDATE orders SET pay_status='paid', paid_at=datetime('now'), pay_channel=?, pay_expires_at=NULL
        WHERE no=? AND pay_status<>'paid'`
    )
    .bind(data.channel || null, order.no)
    .run();
  await logPayment(db, order.no, {
    reference: data.reference, amount: data.amount, currency: data.currency,
    status: "success", channel: data.channel, source,
    detail: r.meta.changes ? "settled" : "duplicate confirmation ignored",
  });
  if (!r.meta.changes) return false; // someone else settled it first

  // The hold may already have lapsed and put the goods back on the shelf. The
  // money is real, so the reservation is taken again and the discrepancy is
  // written where the fulfilment team will see it.
  const retaken = await retakeStock(db, order.no);
  await db
    .prepare("UPDATE order_events SET detail = detail || ' — payment confirmed' WHERE order_no=? AND sort=1 AND detail NOT LIKE '%payment confirmed%'")
    .bind(order.no)
    .run();
  if (retaken) {
    await db
      .prepare("INSERT INTO order_events (order_no, step, detail, at, done, current, sort) VALUES (?, 'Payment arrived late', 'The hold had lapsed — stock re-reserved, please confirm availability.', NULL, 1, 0, 1)")
      .bind(order.no)
      .run();
  }
  // The purchase has earned its reward. Here rather than at checkout, because
  // an order that was placed and never paid for has earned nothing — and here
  // rather than in each payment path, because a card settlement and a bank
  // transfer a manager confirmed both arrive through this one door.
  //
  // A reward that cannot be minted must never cost the shop a settlement: the
  // money is already taken and the order is already paid, so this is logged and
  // stepped over rather than thrown.
  let earned = null;
  try {
    earned = await issueEarnedReward(db, await getSettings(db), order);
  } catch (e) {
    console.error("reward issue failed for " + order.no, e);
  }

  await emitEvent(env, "order_paid", {
    entity: order.no,
    payload: {
      orderNo: order.no, name: order.customer, email: order.email, phone: order.phone,
      contact: order.email || order.phone, total: order.total,
      // The post-purchase automation can put the code in the email it already
      // sends, so the customer is told about it without a second message.
      ...(earned ? { rewardCode: earned.code, rewardDesc: earned.descr, rewardExpires: earned.expiresAt || "" } : {}),
    },
  });
  return true;
}

// Settle an order a human has confirmed the money for — a bank transfer that
// landed, cash at the counter. It goes through the same door as a gateway
// confirmation so the timeline, the automation and the audit log all behave
// identically, but it records *who* said so, because unlike a Paystack callback
// this claim has no independent evidence behind it.
export async function markPaidManually(env, order, by) {
  return markPaid(
    env,
    order,
    { reference: order.pay_ref || `manual_${order.no}`, amount: order.pay_amount || toKobo(order.total), currency: CURRENCY, channel: "manual" },
    `manual:${by}`
  );
}

// ---- The three entry points --------------------------------------------

// Open a checkout session for an order. The amount is read from the order row,
// never from the caller.
export async function initializePayment(env, order, origin) {
  const db = env.DB;
  const amount = toKobo(order.total);
  const reference = newReference(order.no);
  const email = (order.email || "").trim();
  if (!email) return { error: "An email address is needed to pay by card." };

  const { ok, body } = await paystack(env, "/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      amount,
      currency: CURRENCY,
      reference,
      callback_url: `${origin}/?psorder=${encodeURIComponent(order.no)}`,
      metadata: {
        order_no: order.no,
        custom_fields: [
          { display_name: "Order", variable_name: "order_no", value: order.no },
        ],
      },
    }),
  });

  const url = ok && body && body.status && body.data ? body.data.authorization_url : null;
  if (!url) {
    const detail = (body && (body.message || body.error)) || "gateway did not return a checkout link";
    await logPayment(db, order.no, { reference, amount, status: "failed", source: "init", detail });
    return { error: "We couldn't reach the payment gateway. Your order hasn't been charged." };
  }

  await db
    .prepare("UPDATE orders SET pay_ref=?, pay_amount=?, pay_expires_at=datetime('now', ?) WHERE no=?")
    .bind(body.data.reference || reference, amount, `+${HOLD_MINUTES} minutes`, order.no)
    .run();
  await logPayment(db, order.no, { reference: body.data.reference || reference, amount, status: "initialized", source: "init", detail: "checkout opened" });
  return { url, reference: body.data.reference || reference };
}

// The redirect leg: the shopper is back from Paystack and we ask the gateway
// directly what happened, rather than believing the URL they arrived on.
export async function verifyPayment(env, no) {
  const db = env.DB;
  const order = await db.prepare("SELECT * FROM orders WHERE no=?").bind(no).first();
  if (!order) return { error: "Order not found.", status: 404 };
  if (order.pay_status === "paid") return { paid: true };
  if (!paystackEnabled(env) || !order.pay_ref) return { paid: false };

  const { body } = await paystack(env, `/transaction/verify/${encodeURIComponent(order.pay_ref)}`);
  const data = body && body.status ? body.data : null;
  const verdict = chargeSettles(order, data);
  if (!verdict.ok) {
    // A shopper who simply hasn't finished paying is the ordinary case and not
    // worth a log line; a charge that came back *wrong* very much is.
    if (data && data.status === "success") {
      await logPayment(db, no, {
        reference: order.pay_ref, amount: data.amount, currency: data.currency,
        status: "mismatch", channel: data.channel, source: "verify", detail: verdict.why,
      });
    }
    return { paid: false };
  }
  await markPaid(env, order, { ...data, reference: order.pay_ref }, "verify");
  return { paid: true };
}

// Timing-safe compare of two hex digests.
function sameDigest(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySignature(secret, raw, signature) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sameDigest(hex, String(signature || "").toLowerCase());
}

// The server-to-server leg. Authoritative, and the only one that arrives even
// when the shopper closes the tab on the bank's 3-D Secure page.
export async function handleWebhook(env, raw, signature) {
  if (!paystackEnabled(env)) return { status: 400, text: "not configured" };
  if (!(await verifySignature(env.PAYSTACK_SECRET_KEY, raw, signature))) return { status: 401, text: "invalid signature" };

  let event;
  try { event = JSON.parse(raw); } catch { return { status: 400, text: "bad payload" }; }
  if (event.event !== "charge.success") return { status: 200, text: "ignored" };

  const data = event.data || {};
  // Resolve the order from the reference we issued; the metadata is a fallback
  // for a charge created outside this flow.
  const db = env.DB;
  const order =
    (data.reference && (await db.prepare("SELECT * FROM orders WHERE pay_ref=?").bind(data.reference).first())) ||
    (data.metadata && data.metadata.order_no && (await db.prepare("SELECT * FROM orders WHERE no=?").bind(data.metadata.order_no).first()));
  if (!order) return { status: 200, text: "no matching order" };

  const verdict = chargeSettles(order, data);
  if (!verdict.ok) {
    await logPayment(db, order.no, {
      reference: data.reference, amount: data.amount, currency: data.currency,
      status: "mismatch", channel: data.channel, source: "webhook", detail: verdict.why,
    });
    return { status: 200, text: "not settled" };
  }
  await markPaid(env, order, data, "webhook");
  return { status: 200, text: "ok" };
}

// Re-open payment on an order that was placed but never paid for — the shopper
// closed the tab, the card was declined, or they picked bank transfer and
// changed their mind.
export async function resumePayment(env, order, origin) {
  if (order.pay_status === "paid") return { error: "This order is already paid." };
  if (!paystackEnabled(env)) return { error: "Card payment isn't available right now." };
  if (order.status === "Cancelled") return { error: "This order was cancelled — please place a new one." };
  const init = await initializePayment(env, order, origin);
  if (init.error) return init;
  await env.DB.prepare("UPDATE orders SET pay='Paystack' WHERE no=?").bind(order.no).run();
  return init;
}

// ---- The sweep ---------------------------------------------------------

// Cron: let unpaid card orders lapse and put their stock back.
//
// Each one is verified with the gateway first. A shopper can pay in the last
// second before the hold runs out, and a webhook can be delayed; expiring an
// order that has actually been paid for would be the worst bug in this file.
export async function releaseExpiredOrders(env) {
  const db = env.DB;
  const stale = (await db.prepare(
    `SELECT * FROM orders
      WHERE pay_status='pending' AND stock_released=0
        AND pay_expires_at IS NOT NULL AND pay_expires_at <= datetime('now')
      LIMIT 50`
  ).all()).results;

  let expired = 0;
  let rescued = 0;
  for (const order of stale) {
    if (paystackEnabled(env) && order.pay_ref) {
      const { body } = await paystack(env, `/transaction/verify/${encodeURIComponent(order.pay_ref)}`).catch(() => ({ body: null }));
      const data = body && body.status ? body.data : null;
      if (chargeSettles(order, data).ok) {
        await markPaid(env, order, { ...data, reference: order.pay_ref }, "sweep");
        rescued++;
        continue;
      }
    }
    await releaseStock(db, order.no);
    await db
      .prepare("UPDATE orders SET pay_status='expired', status='Cancelled' WHERE no=? AND pay_status='pending'")
      .bind(order.no)
      .run();
    await db
      .prepare("INSERT INTO order_events (order_no, step, detail, at, done, current, sort) VALUES (?, 'Payment not completed', 'The order was released and the items returned to stock.', NULL, 1, 1, 9)")
      .bind(order.no)
      .run();
    await logPayment(db, order.no, {
      reference: order.pay_ref || "", amount: order.pay_amount || 0,
      status: "expired", source: "sweep", detail: `unpaid after ${HOLD_MINUTES} minutes`,
    });
    expired++;
  }
  return { expired, rescued };
}

// Exported for the unit tests, which exercise the settlement rules directly.
export const _internals = { chargeSettles, sameDigest, newReference };
