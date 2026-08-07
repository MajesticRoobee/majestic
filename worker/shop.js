// Public storefront API.
import { Hono } from "hono";
import { getSettings, loadProducts, normalizeContact, fmtNaira, displayTime, displayDate } from "./util.js";
import { emitEvent } from "./events.js";

export const shop = new Hono();

const LOCATION_ORDER = ["abuja", "lagos", "ibadan"];

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
  const locations = (await db.prepare("SELECT * FROM locations ORDER BY sort").all()).results.map((l) => ({
    id: l.id, city: l.city, store: l.store, address: l.address, shipNGN: l.ship_ngn, shipUSD: l.ship_usd, eta: l.eta, phone: l.phone,
  }));
  const categories = (await db.prepare("SELECT id, label FROM categories ORDER BY sort").all()).results;
  const products = await loadProducts(db, { liveOnly: true });
  const popup = await db
    .prepare("SELECT title, message, cta FROM campaigns WHERE kind='Popup' AND status='Live' ORDER BY created_at DESC LIMIT 1")
    .first();
  return c.json({ settings, locations, categories, products, popup });
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

function pickFulfilment(items, city) {
  // items: [{ variant: {stock}, qty }]
  const fits = (loc) => items.every((it) => (it.variant.stock[loc] || 0) >= it.qty);
  if (fits(city)) return { loc: city, allInCity: true };
  const alt = LOCATION_ORDER.filter((l) => l !== city).find(fits);
  return { loc: alt || city, allInCity: false };
}

shop.post("/orders", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { customer = {}, city, fulfill, pay, promo: promoCode, items } = body;

  if (!customer.name || !String(customer.name).trim() || !customer.phone || !String(customer.phone).trim())
    return c.json({ error: "Your name and phone help us find you — both are required." }, 400);
  if (fulfill === "delivery" && (!customer.address || !String(customer.address).trim()))
    return c.json({ error: "Add a delivery address, or switch to click & collect." }, 400);
  if (!Array.isArray(items) || !items.length) return c.json({ error: "Your cart is empty." }, 400);
  if (!LOCATION_ORDER.includes(city)) return c.json({ error: "Pick a city first." }, 400);

  const settings = await getSettings(db);
  const products = await loadProducts(db, { liveOnly: true });
  const lines = [];
  for (const it of items) {
    const hit = findVariant(products, it);
    const qty = Math.max(1, Math.min(50, Math.round(it.qty || 1)));
    if (!hit) return c.json({ error: "An item in your cart is no longer available." }, 400);
    const { product: p, variant: v } = hit;
    lines.push({ product: p, variant: v, qty, cat: p.cat, lineTotal: v.ngn * qty });
  }

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

  const { loc, allInCity } = pickFulfilment(lines, city);
  const locations = (await db.prepare("SELECT * FROM locations ORDER BY sort").all()).results;
  const cityLoc = locations.find((l) => l.id === city);
  const fromLoc = locations.find((l) => l.id === loc);

  let shipping = 0;
  if (fulfill !== "collect") {
    shipping = allInCity ? cityLoc.ship_ngn : (settings.crossCityShipNGN ?? 4500);
    if (city === "abuja" && allInCity && subtotal >= (settings.freeShipAbujaOver ?? 100000)) shipping = 0;
    if (freeShipPromo) shipping = 0;
  }
  const total = subtotal - discount + shipping;

  const no = await nextOrderNo(db);
  const payLabels = { paystack: "Paystack", transfer: "Bank transfer", whatsapp: "WhatsApp" };
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
  for (const l of lines) {
    statements.push(
      db.prepare("INSERT INTO order_items (order_no, product_id, variant_id, sku, name, size, qty, unit_ngn) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(no, l.product.id, l.variant.id, l.variant.sku || null, l.product.name, l.variant.size, l.qty, l.variant.ngn)
    );
    // Reserve stock at the fulfilling store (never below zero).
    statements.push(
      db.prepare("UPDATE stock SET qty = MAX(0, qty - ?) WHERE variant_id=? AND location_id=?").bind(l.qty, l.variant.id, loc)
    );
  }
  const routeDetail = allInCity
    ? `All items in stock at ${fromLoc.store}, ${fromLoc.city}`
    : `Routed to ${fromLoc.store}, ${fromLoc.city} — nearest store holding your full order`;
  const payDetail = { paystack: "Awaiting Paystack confirmation", transfer: "We hold your order 2 hours while you transfer", whatsapp: "A concierge completes your order in chat" }[pay] || "";
  const t = displayTime(now);
  const events = [
    ["Order placed", `${payLabels[pay] || "Paystack"} — ${fmtNaira(total)}. ${payDetail}`, t, 1, 0, 1],
    [allInCity ? `Routed to ${fromLoc.store}, ${fromLoc.city}` : "Routing to the nearest stocked store", routeDetail, t, 1, 1, 2],
    ["Packed & perfumed", "Hand-wrapped with a note", null, 0, 0, 3],
    [
      fulfill === "collect" ? "Ready for pickup" : "In transit",
      fulfill === "collect"
        ? `Ready in about 3 hours — we'll text ${customer.phone.trim()}`
        : allInCity ? `Estimated ${cityLoc.eta}` : `Estimated ${settings.crossCityEta || "3–5 days"}`,
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

  const order = {
    no,
    totalLabel: fmtNaira(total),
    total,
    pay: payLabels[pay] || "Paystack",
    method,
    route: allInCity
      ? (fulfill === "collect"
          ? `Ready for collection at ${fromLoc.store}, ${fromLoc.address}.`
          : `Shipping in one parcel from ${fromLoc.store}, ${fromLoc.city} to ${customer.address}.`)
      : `Routed to ${fromLoc.store}, ${fromLoc.city} — the nearest store holding your full order — shipping to ${fulfill === "collect" ? cityLoc.store : customer.address}.`,
    eta: fulfill === "collect"
      ? `Ready in about 3 hours — we'll text ${customer.phone.trim()}.`
      : allInCity ? `Estimated ${cityLoc.eta}.` : `Estimated ${settings.crossCityEta || "3–5 days"}.`,
  };

  // Paystack hand-off when configured; otherwise the order stays pending
  // and is confirmed manually (bank transfer / WhatsApp flows).
  if (pay === "paystack" && c.env.PAYSTACK_SECRET_KEY) {
    const origin = new URL(c.req.url).origin;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        email: (customer.email || "").trim() || "guest@majesticroobee.com",
        amount: total * 100,
        reference: no.replace("-", "_") + "_" + Date.now(),
        callback_url: `${origin}/?psorder=${encodeURIComponent(no)}`,
        metadata: { order_no: no, custom_fields: [] },
      }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.status && data.data && data.data.authorization_url) {
      await db.prepare("UPDATE orders SET pay_ref=? WHERE no=?").bind(data.data.reference, no).run();
      return c.json({ order, paystackUrl: data.data.authorization_url });
    }
  }
  return c.json({ order });
});

async function markPaid(env, no) {
  const db = env.DB;
  await db.prepare("UPDATE orders SET pay_status='paid' WHERE no=?").bind(no).run();
  await db
    .prepare("UPDATE order_events SET detail = detail || ' — payment confirmed' WHERE order_no=? AND sort=1")
    .bind(no)
    .run();
  const o = await db.prepare("SELECT customer, email, phone, total FROM orders WHERE no=?").bind(no).first();
  if (o) await emitEvent(env, "order_paid", { entity: no, payload: { orderNo: no, name: o.customer, email: o.email, phone: o.phone, contact: o.email || o.phone, total: o.total } });
}

// Paystack redirects back here (client calls this to confirm).
shop.get("/paystack/verify", async (c) => {
  const no = c.req.query("order");
  const db = c.env.DB;
  const order = no && (await db.prepare("SELECT * FROM orders WHERE no=?").bind(no).first());
  if (!order) return c.json({ error: "Order not found." }, 404);
  if (order.pay_status === "paid") return c.json({ ok: true, paid: true });
  if (!c.env.PAYSTACK_SECRET_KEY || !order.pay_ref) return c.json({ ok: true, paid: false });
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(order.pay_ref)}`, {
    headers: { authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}` },
  });
  const data = await res.json().catch(() => null);
  const paid = !!(data && data.status && data.data && data.data.status === "success");
  if (paid) await markPaid(c.env, no);
  return c.json({ ok: true, paid });
});

// Paystack server-to-server webhook.
shop.post("/paystack/webhook", async (c) => {
  const secret = c.env.PAYSTACK_SECRET_KEY;
  if (!secret) return c.text("not configured", 400);
  const raw = await c.req.text();
  const sig = c.req.header("x-paystack-signature") || "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== sig) return c.text("invalid signature", 401);
  const event = JSON.parse(raw);
  if (event.event === "charge.success") {
    const no = event.data?.metadata?.order_no;
    if (no) await markPaid(c.env, no);
  }
  return c.text("ok");
});

// Guest order tracking: order number + the phone or email used.
shop.get("/orders/track", async (c) => {
  const no = String(c.req.query("no") || "").trim().toUpperCase();
  const contact = normalizeContact(c.req.query("contact"));
  const db = c.env.DB;
  const order = no && (await db.prepare("SELECT * FROM orders WHERE no=?").bind(no).first());
  if (!order) return c.json({ error: "We couldn't find that order. Check the number, or chat with us below." }, 404);
  if (contact && contact !== normalizeContact(order.phone) && contact !== normalizeContact(order.email))
    return c.json({ error: "That contact doesn't match this order — use the phone or email you ordered with." }, 403);
  const events = (await db.prepare("SELECT * FROM order_events WHERE order_no=? ORDER BY sort").bind(no).all()).results;
  const from = await db.prepare("SELECT * FROM locations WHERE id=?").bind(order.fulfilled_from).first();
  return c.json({
    no: order.no,
    status: order.pay_status === "pending" && order.status === "Processing" ? "Awaiting payment" : order.status,
    placed: displayDate(new Date(order.placed_at.replace(" ", "T") + "Z")),
    total: order.total,
    from: from ? `${from.store}, ${from.city}` : order.fulfilled_from,
    steps: events.map((e) => ({ step: e.step, detail: e.detail, time: e.at || "", done: !!e.done, current: !!e.current })),
  });
});
