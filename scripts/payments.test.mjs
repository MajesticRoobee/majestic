// Settlement rules, exercised directly.
//
// These are the assertions that protect money: a charge only settles the order
// it was raised for, at the amount and in the currency this server asked for;
// an order settles exactly once however many callbacks arrive; and an unpaid
// order eventually gives its stock back — unless it turns out to have been paid
// for after all.
import {
  markPaid, handleWebhook, verifySignature, releaseExpiredOrders, toKobo, _internals,
} from "../worker/payments.js";

const { chargeSettles, sameDigest } = _internals;

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`}`);
};

// ---- A D1 stand-in ------------------------------------------------------
//
// Enough of the interface for these paths: statements are recorded so a test
// can assert what was written, SELECTs are answered from a small table map, and
// UPDATEs report how many rows they changed so idempotency can be observed.

function fakeDb({ orders = [], items = [], updates = {} } = {}) {
  const log = [];
  const table = (sql) => (sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i) || [])[1];
  const mk = (sql) => ({
    _args: [],
    bind(...args) { this._args = args; return this; },
    async run() {
      log.push({ sql, args: this._args });
      const t = table(sql);
      // `updates` lets a test say "this UPDATE matched a row" (1) or "someone
      // beat you to it" (0) — the conditional-update idempotency guard.
      const changes = /^\s*UPDATE/i.test(sql) ? (updates[t] !== undefined ? updates[t] : 1) : 1;
      return { meta: { changes, last_row_id: log.length } };
    },
    async first() {
      log.push({ sql, args: this._args });
      if (/FROM orders/i.test(sql)) {
        const [key] = this._args;
        return orders.find((o) => o.no === key || o.pay_ref === key) || null;
      }
      return null;
    },
    async all() {
      log.push({ sql, args: this._args });
      if (/FROM order_items/i.test(sql)) return { results: items };
      if (/FROM orders/i.test(sql)) return { results: orders };
      return { results: [] };
    },
  });
  return {
    log,
    prepare: (sql) => mk(sql),
    batch: async (statements) => { for (const s of statements) await s.run(); return []; },
  };
}

const ORDER = {
  no: "MR-10001", customer: "Ada", email: "ada@example.com", phone: "08030000000",
  total: 42500, pay_amount: 4250000, pay_status: "pending", status: "Processing",
  pay_ref: "MR_10001_abc", stock_released: 0,
};

const wrote = (db, re) => db.log.filter((l) => re.test(l.sql)).length;

// ---- 1. What settles an order, and what doesn't -------------------------

check("exact amount in naira settles", chargeSettles(ORDER, { status: "success", currency: "NGN", amount: 4250000 }).ok, true);
check("a short payment does not settle", chargeSettles(ORDER, { status: "success", currency: "NGN", amount: 100 }).ok, false);
check("an overpayment does not settle either", chargeSettles(ORDER, { status: "success", currency: "NGN", amount: 9999999 }).ok, false);
check("a foreign currency does not settle", chargeSettles(ORDER, { status: "success", currency: "USD", amount: 4250000 }).ok, false);
check("a failed charge does not settle", chargeSettles(ORDER, { status: "failed", currency: "NGN", amount: 4250000 }).ok, false);
check("nothing at all does not settle", chargeSettles(ORDER, null).ok, false);
// An order written before pay_amount existed falls back to its naira total.
check("legacy order without pay_amount falls back to total", chargeSettles({ ...ORDER, pay_amount: null }, { status: "success", currency: "NGN", amount: 4250000 }).ok, true);
check("naira converts to kobo", toKobo(42500), 4250000);

// ---- 2. Digest comparison ----------------------------------------------

check("identical digests match", sameDigest("abc123", "abc123"), true);
check("differing digests don't", sameDigest("abc123", "abc124"), false);
check("a shorter digest doesn't", sameDigest("abc123", "abc12"), false);
check("a missing signature doesn't", sameDigest("abc123", undefined), false);

// ---- 3. A webhook is only believed when it is signed and correct --------

const SECRET = "sk_test_majestic";
const body = JSON.stringify({
  event: "charge.success",
  data: { reference: ORDER.pay_ref, status: "success", currency: "NGN", amount: 4250000, channel: "card" },
});
const sign = async (raw) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const goodSig = await sign(body);

check("a valid signature verifies", await verifySignature(SECRET, body, goodSig), true);
check("a tampered body doesn't", await verifySignature(SECRET, body + " ", goodSig), false);

{
  const db = fakeDb({ orders: [ORDER] });
  const r = await handleWebhook({ DB: db, PAYSTACK_SECRET_KEY: SECRET }, body, "deadbeef");
  check("an unsigned webhook is rejected", r.status, 401);
  check("...and writes nothing", wrote(db, /UPDATE orders/), 0);
}

{
  const db = fakeDb({ orders: [ORDER] });
  const r = await handleWebhook({ DB: db, PAYSTACK_SECRET_KEY: SECRET }, body, goodSig);
  check("a signed, matching webhook settles the order", r.status, 200);
  check("...and marks it paid", wrote(db, /UPDATE orders SET pay_status='paid'/), 1);
}

{
  // The dangerous one: a correctly signed webhook claiming a trivial amount.
  const cheap = JSON.stringify({
    event: "charge.success",
    data: { reference: ORDER.pay_ref, status: "success", currency: "NGN", amount: 100, channel: "card" },
  });
  const db = fakeDb({ orders: [ORDER] });
  const r = await handleWebhook({ DB: db, PAYSTACK_SECRET_KEY: await sign(cheap).then(() => SECRET) }, cheap, await sign(cheap));
  check("a signed webhook for ₦1 does not settle a ₦42,500 order", wrote(db, /UPDATE orders SET pay_status='paid'/), 0);
  check("...and the mismatch is recorded", wrote(db, /INSERT INTO payments/), 1);
  check("...and the webhook is still acknowledged", r.status, 200);
}

{
  const db = fakeDb({ orders: [] });
  const r = await handleWebhook({ DB: db, PAYSTACK_SECRET_KEY: SECRET }, body, goodSig);
  check("a webhook for an unknown order is acknowledged, not actioned", [r.status, wrote(db, /UPDATE orders SET pay_status='paid'/)], [200, 0]);
}

// ---- 4. An order settles exactly once ----------------------------------

{
  // The redirect leg and the webhook race by design. The loser's UPDATE matches
  // no rows, and it must stop there — a second order_paid event means the
  // customer gets the post-purchase mail twice.
  const db = fakeDb({ orders: [ORDER], updates: { orders: 0 } });
  const settled = await markPaid({ DB: db }, ORDER, { reference: ORDER.pay_ref, amount: 4250000, currency: "NGN", channel: "card" }, "webhook");
  check("the second confirmation to arrive settles nothing", settled, false);
  check("...and emits no order_paid event", wrote(db, /INSERT INTO events/), 0);
  check("...but is still written to the payment log", wrote(db, /INSERT INTO payments/), 1);
}

{
  const db = fakeDb({ orders: [ORDER], updates: { orders: 1 } });
  const settled = await markPaid({ DB: db }, ORDER, { reference: ORDER.pay_ref, amount: 4250000, currency: "NGN", channel: "card" }, "verify");
  check("the first confirmation settles the order", settled, true);
  check("...and emits exactly one order_paid event", wrote(db, /INSERT INTO events/), 1);
}

// ---- 5. Unpaid orders give their stock back ----------------------------

{
  // No gateway configured, so nothing can be rescued: the order lapses.
  const lapsed = { ...ORDER, pay_expires_at: "2020-01-01 00:00:00" };
  const db = fakeDb({ orders: [lapsed], items: [{ variant_id: 7, qty: 2, location_id: "abuja" }] });
  const r = await releaseExpiredOrders({ DB: db });
  check("a lapsed order is expired", r, { expired: 1, rescued: 0 });
  check("...and its stock is added back", wrote(db, /UPDATE stock SET qty = qty \+ \?/), 1);
  check("...and it is marked cancelled", wrote(db, /status='Cancelled'/), 1);
}

{
  // Paid in the last second before the hold ran out — the sweep must notice
  // rather than cancelling an order the customer has already been charged for.
  const lapsed = { ...ORDER, pay_expires_at: "2020-01-01 00:00:00" };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: true, data: { status: "success", currency: "NGN", amount: 4250000, channel: "card" },
  }), { headers: { "content-type": "application/json" } });
  const db = fakeDb({ orders: [lapsed], updates: { orders: 1 } });
  const r = await releaseExpiredOrders({ DB: db, PAYSTACK_SECRET_KEY: SECRET });
  globalThis.fetch = realFetch;
  check("an order paid at the last second is rescued, not cancelled", r, { expired: 0, rescued: 1 });
  check("...and its stock is not released", wrote(db, /UPDATE stock SET qty = qty \+ \?/), 0);
}

console.log(failures ? `\n${failures} payment case(s) failed.` : "\nAll payment cases pass.");
process.exit(failures ? 1 : 0);
