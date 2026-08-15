// Public storefront API.
import { Hono } from "hono";
import { getSettings, loadProducts, normalizeContact, fmtNaira, displayTime, displayDate, activeLocations } from "./util.js";
import { planFulfilment } from "./fulfilment.js";
import { emitEvent } from "./events.js";
import { paystackEnabled, initializePayment, verifyPayment, handleWebhook, resumePayment } from "./payments.js";

export const shop = new Hono();

// Category groups a promo scope applies to.
// Home fragrance, massage oils and the health drink sit outside these groups, so
// a promo aimed at them is written Storewide.
const SCOPE_CATS = {
  Storewide: null,
  Fragrances: ["extrait", "designer", "custom-oil", "mist"],
  "Gift packages": ["fragrance-set", "mist-set", "custom-oil-set", "gift-set"],
  "Feminine care": ["care", "deo"],
};

function promoIsActive(promo) {
  return promo && promo.status === "Active";
}

// Resolve a cart line to its variation.
//
// Lines address a variation by `variantId` (or `sku`) — a stable identity that
// survives an admin renaming a size. `size` is still accepted as a fallback so
// carts written to localStorage by an older build, which keyed on the size
// text, keep working through the upgrade.
function findVariant(products, it) {
  if (it.variantId || it.sku) {
    for (const p of products) {
      const v = p.variants.find((x) => (it.variantId && x.id === it.variantId) || (it.sku && x.sku === it.sku));
      if (v) return { product: p, variant: v };
    }
  }
  const p = products.find((x) => x.id === it.productId);
  if (!p) return null;
  const v = it.size ? p.variants.find((x) => x.size === it.size) : null;
  return v ? { product: p, variant: v } : null;
}

function computeDiscount(promo, items) {
  // items: [{ cat, lineTotal }]
  const cats = SCOPE_CATS[promo.scope] ?? null;
  const eligible = items.filter((i) => !cats || cats.includes(i.cat)).reduce((n, i) => n + i.lineTotal, 0);
  if (promo.kind === "pct") return Math.round((eligible * promo.value) / 100);
  if (promo.kind === "amt") return Math.min(promo.value, eligible);
  return 0; // "ship" handled on the shipping line
}

// Bootstrap payload: settings + catalogue + stores.
shop.get("/store", async (c) => {
  const db = c.env.DB;
  const settings = await getSettings(db);
  const locations = (await activeLocations(db)).map((l) => ({
    id: l.id, city: l.city, store: l.store, address: l.address, shipNGN: l.ship_ngn, shipUSD: l.ship_usd, eta: l.eta, phone: l.phone,
  }));
  const categories = (await db.prepare("SELECT id, label FROM categories ORDER BY sort").all()).results;
  const products = await loadProducts(db, { liveOnly: true });
  const colRows = (await db.prepare("SELECT * FROM collections WHERE live=1 ORDER BY sort, created_at").all()).results;
  const colItems = (await db.prepare("SELECT * FROM collection_products ORDER BY sort").all()).results;
  const collections = colRows.map((x) => ({
    id: x.id, title: x.title, desc: x.descr,
    productIds: colItems.filter((i) => i.collection_id === x.id).map((i) => i.product_id),
  }));
  const popup = await db
    .prepare("SELECT title, message, cta FROM campaigns WHERE kind='Popup' AND status='Live' ORDER BY created_at DESC LIMIT 1")
    .first();
  return c.json({ settings, locations, categories, collections, products, popup });
});

shop.post("/leads", async (c) => {
  const { email, source } = await c.req.json();
  if (!email || !String(email).includes("@")) return c.json({ error: "A valid email is required." }, 400);
  await c.env.DB
    .prepare("INSERT INTO leads (email, source) VALUES (?, ?) ON CONFLICT(email) DO NOTHING")
    .bind(String(email).trim().toLowerCase(), source || "popup")
    .run();
  return c.json({ ok: true, code: "FIRSTTRAIL" });
});

shop.post("/promos/validate", async (c) => {
  const { code, items } = await c.req.json();
  const db = c.env.DB;
  const promo = await db.prepare("SELECT * FROM promos WHERE code=?").bind(String(code || "").trim().toUpperCase()).first();
  if (!promoIsActive(promo)) return c.json({ valid: false });
  const products = await loadProducts(db);
  const lines = (items || []).map((it) => {
    const hit = findVariant(products, it);
    return hit ? { cat: hit.product.cat, lineTotal: hit.variant.ngn * (it.qty || 1) } : null;
  }).filter(Boolean);
  const discount = computeDiscount(promo, lines);
  return c.json({ valid: true, code: promo.code, kind: promo.kind, value: promo.value, scope: promo.scope, desc: promo.descr, discount, freeShip: promo.kind === "ship" });
});

// Track abandoned checkouts. Upserts by phone/email.
shop.post("/checkouts/activity", async (c) => {
  const { name, phone, email, city, value, stage } = await c.req.json();
  const key = normalizeContact(email || phone);
  if (!key) return c.json({ ok: false });
  await c.env.DB
    .prepare(
      `INSERT INTO abandoned_checkouts (contact_key, name, phone, email, city, value_ngn, stage, converted, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
       ON CONFLICT(contact_key) DO UPDATE SET name=excluded.name, phone=excluded.phone, email=excluded.email,
         city=excluded.city, value_ngn=excluded.value_ngn, stage=excluded.stage, converted=0, updated_at=datetime('now')`
    )
    .bind(key, name || "", phone || "", email || "", city || "", Math.round(value || 0), stage || "Cart")
    .run();
  return c.json({ ok: true });
});

shop.post("/inquiries", async (c) => {
  const { name, contact, channel, subject, city, message } = await c.req.json();
  if (!message || !String(message).trim()) return c.json({ error: "A message is required." }, 400);
  const db = c.env.DB;
  const guestKey = crypto.randomUUID();
  const r = await db
    .prepare("INSERT INTO inquiries (name, contact, channel, subject, city, guest_key) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(name || "Guest", contact || "", channel || "Live chat", subject || String(message).slice(0, 60), city || "", guestKey)
    .run();
  await db
    .prepare("INSERT INTO inquiry_messages (inquiry_id, from_us, text) VALUES (?, 0, ?)")
    .bind(r.meta.last_row_id, String(message).trim())
    .run();
  return c.json({ ok: true, id: r.meta.last_row_id, key: guestKey });
});

// Follow-up messages from the same guest session (live chat thread).
shop.post("/inquiries/:id/messages", async (c) => {
  const { key, message } = await c.req.json();
  if (!message || !String(message).trim()) return c.json({ error: "A message is required." }, 400);
  const db = c.env.DB;
  const inq = await db.prepare("SELECT id, guest_key FROM inquiries WHERE id=?").bind(parseInt(c.req.param("id"), 10)).first();
  if (!inq || !inq.guest_key || inq.guest_key !== key) return c.json({ error: "Not found." }, 404);
  await db.prepare("INSERT INTO inquiry_messages (inquiry_id, from_us, text) VALUES (?, 0, ?)").bind(inq.id, String(message).trim()).run();
  await db.prepare("UPDATE inquiries SET status='Open' WHERE id=? AND status='Resolved'").bind(inq.id).run();
  return c.json({ ok: true });
});

// Back-in-stock waitlist — "Notify me" on sold-out products.
shop.post("/waitlist", async (c) => {
  const { productId, variantId, sku, size, contact, city } = await c.req.json();
  if (!productId || !contact || !String(contact).trim()) return c.json({ error: "Product and a contact are required." }, 400);
  // Resolve to the exact variation so the back-in-stock alert fires for the
  // size the shopper actually wanted, not just any size of the product.
  const hit = findVariant(await loadProducts(c.env.DB), { productId, variantId, sku, size });
  await c.env.DB.prepare("INSERT INTO stock_waitlist (product_id, variant_id, size, contact, city) VALUES (?, ?, ?, ?, ?)")
    .bind(productId, hit ? hit.variant.id : null, hit ? hit.variant.size : size || null, String(contact).trim(), city || null).run();
  await emitEvent(c.env, "waitlist_joined", { entity: productId, payload: { productId, contact: String(contact).trim() }, ctx: c.executionCtx });
  return c.json({ ok: true });
});

async function nextOrderNo(db) {
  const row = await db.prepare("SELECT no FROM orders ORDER BY CAST(substr(no, 4) AS INTEGER) DESC LIMIT 1").first();
  const n = row ? parseInt(row.no.slice(3), 10) + 1 : 10001;
  return "MR-" + n;
}

// Resolve cart items against the live catalogue. Returns { lines } or { error }.
async function resolveLines(db, items) {
  const products = await loadProducts(db, { liveOnly: true });
  const lines = [];
  for (const it of items) {
    const hit = findVariant(products, it);
    const qty = Math.max(1, Math.min(50, Math.round(it.qty || 1)));
    if (!hit) return { error: "An item in your cart is no longer available." };
    const { product: p, variant: v } = hit;
    lines.push({ product: p, variant: v, qty, cat: p.cat, lineTotal: v.ngn * qty });
  }
  return { lines };
}

// What the shopper is shown before they commit: which store (or stores) their
// order ships from, and what each parcel costs. The checkout page calls this
// whenever the cart, the city or the fulfilment choice changes.
shop.post("/fulfilment/quote", async (c) => {
  const db = c.env.DB;
  const { city, fulfill, items } = await c.req.json();
  const locations = await activeLocations(db);
  if (!locations.some((l) => l.id === city)) return c.json({ error: "Pick a city first." }, 400);
  if (!Array.isArray(items) || !items.length) return c.json({ error: "Your cart is empty." }, 400);
  const { lines, error } = await resolveLines(db, items);
  if (error) return c.json({ error }, 400);
  const settings = await getSettings(db);
  const plan = planFulfilment({ lines, locations, city, settings, fulfil: fulfill === "collect" ? "collect" : "delivery" });
  return c.json({ plan: publicPlan(plan) });
});

// What the shopper is shown: when each delivery arrives, what it costs, and
// what is in it. Which store it leaves from is the shop's concern, not theirs,
// so the store and city names stop here.
function publicPlan(plan) {
  return {
    mode: plan.mode,
    needsConfirmation: plan.needsConfirmation,
    shipTotal: plan.shipTotal,
    collectBlocked: !!plan.collectBlocked,
    unavailable: plan.unavailable,
    deliveries: plan.shipments.map((s) => ({
      eta: s.eta,
      ship: s.ship,
      items: s.items.map((i) => ({ name: i.name, size: i.size, qty: i.qty })),
    })),
  };
}

const PAY_METHODS = { paystack: "Paystack", transfer: "Bank transfer", whatsapp: "WhatsApp" };

// Everything the shopper types is checked here rather than in the browser, so a
// request that skips the form still can't write a half-formed order.
function validateOrder({ customer, city, fulfill, pay, items, locations }) {
  if (!customer.name || !String(customer.name).trim()) return "Enter your name.";
  if (!customer.phone || !String(customer.phone).trim()) return "Enter your phone number.";
  if (fulfill === "delivery" && (!customer.address || !String(customer.address).trim())) return "Enter a delivery address.";
  if (!Array.isArray(items) || !items.length) return "Your cart is empty.";
  if (!locations.some((l) => l.id === city)) return "Choose a city.";
  if (!PAY_METHODS[pay]) return "Choose how you'd like to pay.";
  // Paystack keys a transaction to an email address — it is where the receipt
  // goes and how a charge is reconciled, so a card order can't proceed without
  // one. The other methods are settled by a human and only need the phone.
  const email = String(customer.email || "").trim();
  if (pay === "paystack" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address for your receipt.";
  return null;
}

shop.post("/orders", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { customer = {}, city, fulfill, pay, promo: promoCode, items, acceptSplit } = body;

  const locations = await activeLocations(db);
  const invalid = validateOrder({ customer, city, fulfill, pay, items, locations });
  if (invalid) return c.json({ error: invalid }, 400);
  if (pay === "paystack" && !paystackEnabled(c.env))
    return c.json({ error: "Card payment is unavailable right now — choose bank transfer or WhatsApp." }, 400);

  const settings = await getSettings(db);
  const resolved = await resolveLines(db, items);
  if (resolved.error) return c.json({ error: resolved.error }, 400);
  const lines = resolved.lines;

  const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);

  let promo = null;
  let discount = 0;
  let freeShipPromo = false;
  if (promoCode && String(promoCode).trim()) {
    promo = await db.prepare("SELECT * FROM promos WHERE code=?").bind(String(promoCode).trim().toUpperCase()).first();
    if (!promoIsActive(promo)) return c.json({ error: "That promo code isn't active." }, 400);
    discount = computeDiscount(promo, lines);
    freeShipPromo = promo.kind === "ship";
  }

  // The plan is recomputed here rather than trusted from the client, so the
  // parcels and the delivery total are always the server's own.
  const plan = planFulfilment({ lines, locations, city, settings, fulfil: fulfill === "collect" ? "collect" : "delivery" });
  if (plan.mode === "unavailable") {
    const what = plan.unavailable.map((u) => `${u.name} (${u.size})`).join(", ");
    return c.json({
      error: plan.collectBlocked
        ? `Not available to collect: ${what}. Switch to delivery.`
        : `Out of stock: ${what}. Remove it to continue.`,
      plan: publicPlan(plan),
    }, 400);
  }
  // Several deliveries cost more than one, so the buyer sees the arrangement
  // before the order is written.
  if (plan.needsConfirmation && !acceptSplit) {
    return c.json({
      error: `Your order arrives in ${plan.shipments.length} deliveries — confirm to continue.`,
      plan: publicPlan(plan),
      needsConfirmation: true,
    }, 409);
  }

  const loc = plan.primary;
  const allInCity = plan.mode === "single" && plan.shipments[0].locationId === city;
  const cityLoc = locations.find((l) => l.id === city);
  const fromLoc = locations.find((l) => l.id === loc) || cityLoc;

  let shipping = fulfill === "collect" ? 0 : plan.shipTotal;
  if (freeShipPromo) shipping = 0;
  const total = subtotal - discount + shipping;
  // Which store each line comes from, for the order_items rows and stock.
  // Keyed on the variation's id: two sizes of one fragrance can ship from
  // different stores, and the size label is not an identity.
  const lineLocation = new Map();
  for (const s of plan.shipments) for (const i of s.items) lineLocation.set(i.variantId, s.locationId);

  const no = await nextOrderNo(db);
  const payLabels = PAY_METHODS;
  const method = fulfill === "collect" ? "Click & collect" : "Delivery";
  const now = new Date();

  const statements = [
    db.prepare(
      `INSERT INTO orders (no, customer, phone, email, city, address, fulfilled_from, method, pay, pay_status, status,
        promo_code, subtotal, discount, shipping, total, all_in_city, placed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'Processing', ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      no, customer.name.trim(), customer.phone.trim(), (customer.email || "").trim(), city,
      (customer.address || "").trim(), loc, method, payLabels[pay] || "Paystack",
      promo ? promo.code : null, subtotal, discount, shipping, total, allInCity ? 1 : 0
    ),
  ];
  for (const s of plan.shipments) {
    statements.push(
      db.prepare("INSERT INTO order_shipments (order_no, location_id, ship_ngn, eta, sort) VALUES (?, ?, ?, ?, ?)")
        .bind(no, s.locationId, fulfill === "collect" ? 0 : s.ship, s.eta, plan.shipments.indexOf(s))
    );
  }
  for (const l of lines) {
    const from = lineLocation.get(l.variant.id) || loc;
    statements.push(
      db.prepare("INSERT INTO order_items (order_no, product_id, variant_id, sku, name, size, qty, unit_ngn, location_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(no, l.product.id, l.variant.id, l.variant.sku || null, l.product.name, l.variant.size, l.qty, l.variant.ngn, from)
    );
    // Reserve stock at the store that parcel ships from (never below zero).
    statements.push(
      db.prepare("UPDATE stock SET qty = MAX(0, qty - ?) WHERE variant_id=? AND location_id=?").bind(l.qty, l.variant.id, from)
    );
  }
  // The timeline a shopper reads. Each line says what has happened to their
  // order — not how the system decided it. Which store was chosen and why is
  // the shop's business; the delivery date is theirs.
  const t = displayTime(now);
  const events = [
    ["Order placed", `${payLabels[pay]} — ${fmtNaira(total)}`, t, 1, 0, 1],
    ["Confirmed", plan.shipments.length > 1 ? `Arriving in ${plan.shipments.length} deliveries` : "", t, 1, 1, 2],
    ["Packed", "", null, 0, 0, 3],
    [
      fulfill === "collect" ? "Ready to collect" : "On its way",
      fulfill === "collect" ? "Ready in about 3 hours — we'll text you" : plan.shipments.map((s) => s.eta).join(" · "),
      null, 0, 0, 4,
    ],
  ];
  for (const e of events) {
    statements.push(db.prepare("INSERT INTO order_events (order_no, step, detail, at, done, current, sort) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(no, ...e));
  }
  if (promo) {
    statements.push(db.prepare("UPDATE promos SET redemptions = redemptions + 1 WHERE code=?").bind(promo.code));
  }
  const contactKey = normalizeContact(customer.email || customer.phone);
  if (contactKey) {
    statements.push(db.prepare("UPDATE abandoned_checkouts SET converted=1, updated_at=datetime('now') WHERE contact_key=?").bind(contactKey));
  }
  await db.batch(statements);

  await emitEvent(c.env, "order_placed", {
    entity: no,
    payload: { orderNo: no, name: customer.name.trim(), email: (customer.email || "").trim(), phone: customer.phone.trim(), contact: (customer.email || "").trim() || customer.phone.trim(), total, city },
    ctx: c.executionCtx,
  });

  // What the confirmation screen shows. Where it is coming from is left out on
  // purpose — the shopper needs the date and the address, not the warehouse.
  const order = {
    no,
    totalLabel: fmtNaira(total),
    total,
    pay: payLabels[pay],
    payKey: pay,
    method,
    deliverTo: fulfill === "collect" ? `${fromLoc.store}, ${fromLoc.address}` : (customer.address || "").trim(),
    eta: fulfill === "collect"
      ? "Ready in about 3 hours"
      : [...new Set(plan.shipments.map((s) => s.eta))].join(" · "),
    parcels: plan.shipments.length,
  };

  if (pay !== "paystack") return c.json({ order });

  // Card orders hand off to Paystack. If that hand-off fails there is nothing
  // for the shopper to pay against, so the order is stood down and its stock
  // goes straight back on the shelf rather than being held by a dead order.
  const init = await initializePayment(c.env, {
    no, total, email: (customer.email || "").trim(), customer: customer.name.trim(), phone: customer.phone.trim(),
  }, new URL(c.req.url).origin);
  if (init.error) {
    await db.batch([
      db.prepare("UPDATE orders SET pay_status='failed', status='Cancelled', stock_released=1 WHERE no=?").bind(no),
      ...lines.map((l) =>
        db.prepare("UPDATE stock SET qty = qty + ? WHERE variant_id=? AND location_id=?")
          .bind(l.qty, l.variant.id, lineLocation.get(l.variant.id) || loc)
      ),
    ]);
    return c.json({ error: init.error }, 502);
  }
  return c.json({ order, paystackUrl: init.url });
});

// Pay for an order that was placed but never settled — the card was declined,
// the tab was closed, or bank transfer turned out to be inconvenient. Proved
// the same way as order tracking: the number plus the contact used to order.
shop.post("/orders/:no/pay", async (c) => {
  const { contact } = await c.req.json().catch(() => ({}));
  const no = String(c.req.param("no") || "").trim().toUpperCase();
  const order = no && (await c.env.DB.prepare("SELECT * FROM orders WHERE no=?").bind(no).first());
  if (!order) return c.json({ error: "We couldn't find that order." }, 404);
  const key = normalizeContact(contact);
  if (!key || (key !== normalizeContact(order.phone) && key !== normalizeContact(order.email)))
    return c.json({ error: "Use the phone or email you ordered with." }, 403);
  const r = await resumePayment(c.env, order, new URL(c.req.url).origin);
  if (r.error) return c.json({ error: r.error }, 400);
  return c.json({ paystackUrl: r.url });
});

// The redirect leg. The shopper is back from Paystack; the browser only tells
// us *which* order to ask about, and the gateway is asked directly whether it
// was actually paid for.
shop.get("/paystack/verify", async (c) => {
  const r = await verifyPayment(c.env, String(c.req.query("order") || "").trim().toUpperCase());
  if (r.error) return c.json({ error: r.error }, r.status || 400);
  return c.json({ ok: true, paid: r.paid });
});

// The server-to-server leg — signed, and the one that arrives even when the
// shopper closes the tab on their bank's 3-D Secure page.
shop.post("/paystack/webhook", async (c) => {
  const raw = await c.req.text();
  const r = await handleWebhook(c.env, raw, c.req.header("x-paystack-signature"));
  return c.text(r.text, r.status);
});

// Guest order tracking: order number + the phone or email used.
shop.get("/orders/track", async (c) => {
  const no = String(c.req.query("no") || "").trim().toUpperCase();
  const contact = normalizeContact(c.req.query("contact"));
  const db = c.env.DB;
  const order = no && (await db.prepare("SELECT * FROM orders WHERE no=?").bind(no).first());
  if (!order) return c.json({ error: "We couldn't find that order — check the number." }, 404);
  if (contact && contact !== normalizeContact(order.phone) && contact !== normalizeContact(order.email))
    return c.json({ error: "Use the phone or email you ordered with." }, 403);
  const events = (await db.prepare("SELECT * FROM order_events WHERE order_no=? ORDER BY sort").bind(no).all()).results;
  // Orders placed before split shipments existed have no shipment rows — they
  // all shipped whole from fulfilled_from.
  const parcels = (await db.prepare(
    `SELECT s.location_id, s.ship_ngn, s.eta FROM order_shipments s WHERE s.order_no=? ORDER BY s.sort, s.id`
  ).bind(no).all()).results;
  const unpaid = order.pay_status === "pending" || order.pay_status === "failed";
  return c.json({
    no: order.no,
    status: unpaid && order.status === "Processing" ? "Awaiting payment" : order.status,
    placed: displayDate(new Date(order.placed_at.replace(" ", "T") + "Z")),
    total: order.total,
    // Whether this order can still be paid for online, so the tracking page can
    // offer the button instead of leaving the shopper stranded.
    payable: unpaid && order.status !== "Cancelled",
    eta: [...new Set(parcels.map((p) => p.eta).filter(Boolean))].join(" · "),
    parcels: parcels.length,
    steps: events.map((e) => ({ step: e.step, detail: e.detail, time: e.at || "", done: !!e.done, current: !!e.current })),
  });
});
