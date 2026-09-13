// Public storefront API.
import { Hono } from "hono";
import { getSettings, loadProducts, normalizeContact, fmtNaira, displayTime, displayDate, activeLocations, promoIsLive, promoRefusal, todayInWAT, scopeCats } from "./util.js";
import { computeSegments, dealIsLive, daysBefore, embedUrlFor, firstName, NEW_ARRIVAL_DAYS, pickDailyDeal, resolveDailyDeal, applyDailyDealPricing } from "./merch.js";
import { lowStockLines } from "./inventory.js";
import { loadHomeBlocks, resolveHomeBlocks } from "./home.js";
import { ingest, stitchVisitor } from "./insights.js";
import { loadAffinity } from "./affinity.js";
import { planFulfilment } from "./fulfilment.js";
import { emitEvent } from "./events.js";
import { paystackEnabled, initializePayment, verifyPayment, handleWebhook, resumePayment } from "./payments.js";
import { getReward, rewardRefusal, computeRewardDiscount, claimReward, releaseReward, freeItemName } from "./rewards.js";

export const shop = new Hono();

// A promo is live when the house hasn't ended it *and* today falls inside its
// window. The window is the part that used to be decoration: the dates were
// free display text nothing read, so an expired code kept discounting.
const promoIsActive = (promo) => promoIsLive(promo);

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
  const cats = scopeCats(promo.scope);
  const eligible = items.filter((i) => !cats || cats.includes(i.cat)).reduce((n, i) => n + i.lineTotal, 0);
  if (promo.kind === "pct") return Math.round((eligible * promo.value) / 100);
  if (promo.kind === "amt") return Math.min(promo.value, eligible);
  return 0; // "ship" handled on the shipping line
}

// The catalogue as the storefront sees it — which is the catalogue with today's
// daily deal already priced in.
//
// Every public path that quotes money goes through here rather than through
// loadProducts, because the offer has to be the same number on the countdown
// card, in the grid, in the cart and on the Paystack charge. The admin keeps
// reading the raw table: what it edits is the usual price, not today's.
async function storeCatalogue(db, { liveOnly = true, settings = null, now = Date.now() } = {}) {
  const cfg = settings || (await getSettings(db));
  const products = await loadProducts(db, { liveOnly });
  if (cfg.dailyDealOn === false) return { products, dailyDeal: null };
  const rows = (await db.prepare("SELECT * FROM daily_deals ORDER BY starts_at").all()).results;
  const dailyDeal = resolveDailyDeal({
    // Resolved against what is published, even when the caller asked for the
    // whole table: an unpublished piece must not become today's offer.
    products: products.filter((p) => p.live !== false),
    row: pickDailyDeal(rows, now),
    auto: cfg.dailyDealAuto !== false,
    headline: cfg.dailyDealHeadline || "Daily Deal",
    now,
  });
  return { products: applyDailyDealPricing(products, dailyDeal), dailyDeal };
}

// Bootstrap payload: settings + catalogue + stores.
shop.get("/store", async (c) => {
  const db = c.env.DB;
  const settings = await getSettings(db);
  const locations = (await activeLocations(db)).map((l) => ({
    id: l.id, city: l.city, store: l.store, address: l.address, shipNGN: l.ship_ngn, shipUSD: l.ship_usd, eta: l.eta, phone: l.phone,
    // What someone needs to actually walk in — shown on the Locations page.
    hours: l.hours || "", mapsUrl: l.maps_url || "",
  }));
  const catRows = (await db.prepare("SELECT * FROM categories WHERE live=1 ORDER BY sort, id").all()).results;
  // Flat on the wire, a tree in the browser: `parentId` is all the storefront
  // needs to build the header rail, and sending it flat keeps one category its
  // own row rather than duplicated inside a parent.
  const categories = catRows.map((x) => ({
    id: x.id, label: x.label, desc: x.descr || "", grp: x.grp || "", imageUrl: x.image_url || null,
    parentId: x.parent_id || null,
  }));
  const { products, dailyDeal } = await storeCatalogue(db, { settings });
  // "Only 2 left in Abuja" reads off the *same* line the house set in Settings
  // — per store, because the stock is per store, and honouring any override on
  // the variation. Switched off, the lines are simply not published: there is no
  // reason for the shop's reorder points to leave the building.
  if (settings.lowStockOnStorefront !== false) {
    const lines = await lowStockLines(db, settings);
    for (const p of products) for (const v of p.variants) if (lines[v.id]) v.lowAt = lines[v.id];
  }
  const colRows = (await db.prepare("SELECT * FROM collections WHERE live=1 ORDER BY sort, created_at").all()).results;
  const colItems = (await db.prepare("SELECT * FROM collection_products ORDER BY sort").all()).results;
  const collections = colRows.map((x) => ({
    id: x.id, title: x.title, desc: x.descr,
    productIds: colItems.filter((i) => i.collection_id === x.id).map((i) => i.product_id),
  }));
  const popup = await db
    .prepare("SELECT title, message, cta FROM campaigns WHERE kind='Popup' AND status='Live' ORDER BY created_at DESC LIMIT 1")
    .first();
  // Which ways to pay the checkout may actually offer. Card depends on a
  // Paystack key being present, and the storefront must know that up front —
  // offering a method the server will refuse is a dead end at the last step.
  const pay = {
    paystack: paystackEnabled(c.env),
    transfer: true,
    whatsapp: !!settings.contactPhone,
  };

  // ---- The merchandising shelves the header links to ----
  const today = todayInWAT();
  const dealRows = (await db.prepare("SELECT * FROM deals ORDER BY sort, created_at").all()).results.filter((d) => dealIsLive(d, today));
  const dealItems = (await db.prepare("SELECT * FROM deal_products ORDER BY sort").all()).results;
  const liveIds = new Set(products.map((p) => p.id));
  const deals = dealRows.map((d) => ({
    id: d.id, title: d.title, desc: d.descr, badge: d.badge, endsAt: d.ends_at || "",
    productIds: dealItems.filter((i) => i.deal_id === d.id).map((i) => i.product_id).filter((id) => liveIds.has(id)),
  }));
  const segments = computeSegments({
    products,
    sales: await bestSellerUnits(db, settings),
    categories,
    dealProductIds: deals.flatMap((d) => d.productIds),
    today,
    newArrivalDays: settings.newArrivalDays || NEW_ARRIVAL_DAYS,
  });
  const brands = brandsOf(products);
  const testimonials = publicTestimonials(
    (await db.prepare("SELECT * FROM testimonials WHERE live=1 ORDER BY sort, id").all()).results
  );
  // Three most recent posts, for the strip on the home page. The blog page
  // fetches its own, paged list.
  const blog = (await db.prepare(
    "SELECT slug, title, excerpt, cover_url, author, tags, published_at FROM blog_posts WHERE status='published' ORDER BY COALESCE(published_at, created_at) DESC LIMIT 3"
  ).all()).results.map(blogCard);

  // The home page, as the house arranged it. Each block arrives carrying the
  // products it shows, resolved here so the browser is handed a finished list
  // rather than re-deriving the house's merchandising rules for itself.
  const catById = new Map(products.map((p) => [p.id, p.cat]));
  const homeBlocks = resolveHomeBlocks(await loadHomeBlocks(db, { liveOnly: true }), {
    order: products.map((p) => p.id),
    segments,
    collections: Object.fromEntries(collections.map((c) => [c.id, c.productIds])),
    categories,
    catOf: (id) => catById.get(id),
    // A product with nothing to sell is not a candidate for any shelf.
    sellable: new Set(products.filter((p) => (p.variants || []).length).map((p) => p.id)),
  });

  // "Other people also opened…" — the shop's own shoppers, not a guess from the
  // category tree. Small enough to ride with the catalogue; empty until the
  // graph has been built and while there is too little traffic to mean anything.
  const alsoViewed = settings.alsoViewedOn === false ? {} : await loadAffinity(db);

  // The information pages that are published, so the footer links to what
  // actually exists rather than to a list kept in the markup. Titles only —
  // the body is fetched when someone opens one.
  const pages = (await db.prepare(
    "SELECT slug, title FROM content_pages WHERE live=1 AND in_footer=1 ORDER BY sort, slug"
  ).all()).results.map((r) => ({ slug: r.slug, title: r.title }));

  return c.json({ settings, locations, categories, collections, products, popup, pay, deals, dailyDeal, segments, brands, testimonials, blog, pages, homeBlocks, alsoViewed });
});

// Units sold per product over the best-seller window. Only orders that were
// actually paid for count — a cancelled order or an abandoned card attempt is
// not a sale, and must not be able to push a product onto the shelf.
async function bestSellerUnits(db, settings) {
  const days = Math.max(7, Math.min(365, parseInt(settings.bestSellerDays, 10) || 90));
  const since = daysBefore(days);
  const rows = (await db.prepare(
    `SELECT i.product_id AS pid, SUM(i.qty) AS units
       FROM order_items i JOIN orders o ON o.no = i.order_no
      WHERE o.status <> 'Cancelled'
        AND (o.pay_status = 'paid' OR o.pay <> 'Paystack')
        AND date(o.placed_at) >= ?
      GROUP BY i.product_id`
  ).bind(since).all()).results;
  return rows.map((r) => ({ productId: r.pid, units: r.units }));
}

// Brands are the labels on the bottles the house actually carries — derived
// from the catalogue rather than kept in a second list that could drift out of
// step with it.
function brandsOf(products) {
  const by = new Map();
  for (const p of products) {
    const name = (p.brand || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const hit = by.get(key) || { id: key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name, count: 0, imageUrl: null };
    hit.count += 1;
    hit.imageUrl = hit.imageUrl || p.imageUrl || null;
    by.set(key, hit);
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// The embed URL is built server-side from the stored post id, so the browser
// never has to parse a pasted link and a malformed one simply has no frame.
function publicTestimonials(rows) {
  return rows.map((t) => ({
    id: t.id, kind: t.kind, embedUrl: embedUrlFor(t.kind, t.ref), url: t.url,
    author: t.author, handle: t.handle, quote: t.quote, rating: t.rating, city: t.city,
    productId: t.product_id || null, thumbUrl: t.thumb_url || null,
  }));
}

function blogCard(r) {
  return {
    slug: r.slug, title: r.title, excerpt: r.excerpt, coverUrl: r.cover_url || null,
    author: r.author, tags: (r.tags || "").split(",").map((s) => s.trim()).filter(Boolean),
    publishedAt: r.published_at || "",
    published: r.published_at ? displayDate(new Date(String(r.published_at).replace(" ", "T") + "Z")) : "",
  };
}

// ---- The blog -------------------------------------------------------------

shop.get("/blog", async (c) => {
  const db = c.env.DB;
  const tag = String(c.req.query("tag") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(50, parseInt(c.req.query("limit"), 10) || 24));
  const rows = (await db.prepare(
    "SELECT slug, title, excerpt, cover_url, author, tags, published_at FROM blog_posts WHERE status='published' ORDER BY COALESCE(published_at, created_at) DESC LIMIT ?"
  ).bind(limit).all()).results.map(blogCard);
  const tags = [...new Set(rows.flatMap((r) => r.tags))].sort();
  return c.json({ posts: tag ? rows.filter((r) => r.tags.some((t) => t.toLowerCase() === tag)) : rows, tags });
});

shop.get("/blog/:slug", async (c) => {
  const db = c.env.DB;
  const row = await db.prepare("SELECT * FROM blog_posts WHERE slug=? AND status='published'").bind(c.req.param("slug")).first();
  if (!row) return c.json({ error: "That story isn't here." }, 404);
  const more = (await db.prepare(
    "SELECT slug, title, excerpt, cover_url, author, tags, published_at FROM blog_posts WHERE status='published' AND slug<>? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 3"
  ).bind(row.slug).all()).results.map(blogCard);
  return c.json({ post: { ...blogCard(row), body: row.body }, more });
});

// One information page. Unpublished reads as missing, so a draft is never
// reachable by guessing its address.
shop.get("/pages/:slug", async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM content_pages WHERE slug=? AND live=1").bind(c.req.param("slug")).first();
  if (!row) return c.json({ error: "No such page." }, 404);
  return c.json({
    page: {
      slug: row.slug, title: row.title, eyebrow: row.eyebrow || "", body: row.body || "",
      seoTitle: row.seo_title || "", seoDesc: row.seo_desc || "",
      updatedAt: row.updated_at,
    },
  });
});

// ---- Purchase proof -------------------------------------------------------
//
// What the little "someone just bought this" note is built from: real, paid
// orders, reduced to a first name, a city and what was bought. No surname, no
// contact detail and no order number ever leaves this endpoint — it is a public
// route, so what it returns is what anyone can read.
shop.get("/social-proof", async (c) => {
  const db = c.env.DB;
  const settings = await getSettings(db);
  if (settings.purchasePopups === false) return c.json({ enabled: false, purchases: [] });
  const days = Math.max(1, Math.min(90, parseInt(settings.purchasePopupDays, 10) || 30));
  const rows = (await db.prepare(
    `SELECT o.customer, o.city, o.placed_at, i.name AS item, i.size
       FROM orders o JOIN order_items i ON i.order_no = o.no
      WHERE o.status <> 'Cancelled'
        AND (o.pay_status = 'paid' OR o.pay <> 'Paystack')
        AND date(o.placed_at) >= ?
      ORDER BY o.placed_at DESC
      LIMIT 40`
  ).bind(daysBefore(days)).all()).results;
  const seen = new Set();
  const purchases = [];
  for (const r of rows) {
    const name = firstName(r.customer);
    if (!name) continue;
    // One line per order per product — the same buyer's second bottle of the
    // same thing is not a second event worth showing.
    const key = `${name}|${r.item}|${r.size}|${String(r.placed_at).slice(0, 10)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    purchases.push({
      name,
      city: (r.city || "").charAt(0).toUpperCase() + (r.city || "").slice(1),
      item: r.size ? `${r.item} ${r.size}` : r.item,
      when: displayDate(new Date(String(r.placed_at).replace(" ", "T") + "Z")),
    });
    if (purchases.length >= 12) break;
  }
  return c.json({
    enabled: true,
    intervalMs: Math.max(4000, Math.min(120000, parseInt(settings.purchasePopupIntervalMs, 10) || 14000)),
    purchases,
  });
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

// One code box on the checkout page, two tables behind it.
//
// Sale codes are read first and reward codes second, which is also the order
// `mintCode` protects: a reward can never be issued with a code the promos
// table already holds, so nothing minted here is unreachable.
//
// `contact` is optional — the shopper may not have typed their email yet — and
// a reward bound to someone else is only *hard* refused when the order is
// actually placed. Sending it when it's known means the refusal arrives while
// there is still something to do about it.
shop.post("/promos/validate", async (c) => {
  const { code, items, contact = "" } = await c.req.json();
  const db = c.env.DB;
  const clean = String(code || "").trim().toUpperCase();

  // Deal pricing first: a percentage code discounts what the shopper is
  // actually being charged today, not yesterday's shelf price.
  const { products } = await storeCatalogue(db, { liveOnly: false });
  const lines = (items || []).map((it) => {
    const hit = findVariant(products, it);
    return hit
      ? { cat: hit.product.cat, unit: hit.variant.ngn, variantId: hit.variant.id, lineTotal: hit.variant.ngn * (it.qty || 1) }
      : null;
  }).filter(Boolean);
  const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);

  const promo = await db.prepare("SELECT * FROM promos WHERE code=?").bind(clean).first();
  if (promo) {
    // Tell the shopper *why*: "that code has expired" sends them looking for a
    // current one, where a bare "invalid" reads as the checkout being broken.
    if (!promoIsActive(promo)) return c.json({ valid: false, reason: promoRefusal(promo) });
    const discount = computeDiscount(promo, lines);
    return c.json({ valid: true, type: "promo", code: promo.code, kind: promo.kind, value: promo.value, scope: promo.scope, desc: promo.descr, discount, freeShip: promo.kind === "ship" });
  }

  const reward = await getReward(db, clean);
  if (reward) {
    const refusal = rewardRefusal(reward, { contact, subtotal });
    if (refusal) return c.json({ valid: false, reason: refusal });
    const { discount, freeShip, reason } = computeRewardDiscount(reward, lines);
    if (reason) return c.json({ valid: false, reason });
    return c.json({
      valid: true, type: "reward", code: reward.code, kind: reward.kind, value: reward.value,
      scope: reward.scope, desc: reward.descr, minSpend: reward.min_spend,
      freeVariantId: reward.free_variant_id, freeItem: await freeItemName(db, reward.free_variant_id),
      expiresAt: reward.expires_at || "", discount, freeShip,
    });
  }

  return c.json({ valid: false, reason: "That code isn't recognised." });
});

// The behavioural stream (F4). One batch of events from one visit.
//
// Deliberately the least interesting endpoint in the Worker: it answers 204 to
// everything, because it is called by `sendBeacon` on a page that is already
// closing and nothing may ever be shown to a shopper on account of it. A
// refusal is silent and the visit carries on.
//
// What bounds it is a ceiling on what can be *stored*, not on how often it may
// be called: forty events to a request, six hundred to a session, and a session
// id that has to look like one. Past that a request costs one UPDATE and
// writes nothing, however many arrive. The login throttle is deliberately not
// reused here — that is a security table counting failures, and pouring ordinary
// traffic through it would both pollute it and throttle real shoppers. The outer
// layer for this endpoint is a Cloudflare rate-limiting rule (BUILD-MAP §6).
shop.post("/track", async (c) => {
  try {
    await ingest(c.env, await c.req.json(), {
      ua: c.req.header("user-agent") || "",
      country: c.req.header("cf-ipcountry") || "",
      cfVerifiedBot: !!(c.req.raw.cf && c.req.raw.cf.verifiedBotCategory),
    });
  } catch { /* measurement never surfaces to a shopper */ }
  return c.body(null, 204);
});

// Track abandoned checkouts. Upserts by phone/email.
//
// It now keeps *what was in the cart*, and a token that puts it back. The
// automation has been enqueuing "you left something" since Phase 1 and could
// only ever drop the shopper on the home page to find it again; most do not.
// The token is random, names one row, and carries nothing — the row is already
// keyed on a contact the shopper typed into our own checkout.
shop.post("/checkouts/activity", async (c) => {
  const { name, phone, email, city, value, stage, items } = await c.req.json();
  const key = normalizeContact(email || phone);
  if (!key) return c.json({ ok: false });
  const db = c.env.DB;
  const lines = JSON.stringify(
    (Array.isArray(items) ? items : []).slice(0, 30).map((i) => ({
      variantId: parseInt(i.variantId, 10) || null,
      qty: Math.max(1, Math.min(50, parseInt(i.qty, 10) || 1)),
    })).filter((i) => i.variantId)
  );
  const existing = await db.prepare("SELECT token FROM abandoned_checkouts WHERE contact_key=?").bind(key).first();
  const token = (existing && existing.token) || crypto.randomUUID().replace(/-/g, "");
  await db
    .prepare(
      `INSERT INTO abandoned_checkouts (contact_key, name, phone, email, city, value_ngn, stage, converted, updated_at, token, items)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), ?, ?)
       ON CONFLICT(contact_key) DO UPDATE SET name=excluded.name, phone=excluded.phone, email=excluded.email,
         city=excluded.city, value_ngn=excluded.value_ngn, stage=excluded.stage, converted=0,
         updated_at=datetime('now'), token=COALESCE(abandoned_checkouts.token, excluded.token), items=excluded.items`
    )
    .bind(key, name || "", phone || "", email || "", city || "", Math.round(value || 0), stage || "Cart", token, lines)
    .run();
  return c.json({ ok: true });
});

// One tap back into the cart someone left.
//
// The link answers with the lines only — never the name, the address or the
// contact it is keyed on. A recovery link that leaked a customer's details to
// whoever it was forwarded to would be a worse bargain than the sale it wins.
shop.get("/cart/recover", async (c) => {
  const token = String(c.req.query("t") || "").trim();
  if (!/^[a-f0-9]{16,64}$/i.test(token)) return c.json({ items: [] });
  const db = c.env.DB;
  const row = await db.prepare("SELECT * FROM abandoned_checkouts WHERE token=? AND converted=0").bind(token).first();
  if (!row) return c.json({ items: [] });
  let lines = [];
  try { lines = JSON.parse(row.items || "[]"); } catch { lines = []; }
  if (!lines.length) return c.json({ items: [] });

  // Only what can still actually be bought — the shopper is being sent back to
  // a cart, and a cart that prices something withdrawn is a dead end at the
  // last step rather than at the first.
  const ids = lines.map((l) => l.variantId);
  const live = (await db.prepare(
    `SELECT v.id, v.product_id, v.sku, v.size FROM variants v JOIN products p ON p.id = v.product_id
      WHERE v.active = 1 AND p.live = 1 AND v.id IN (${ids.map(() => "?").join(",")})`
  ).bind(...ids).all()).results;
  const byId = new Map(live.map((v) => [v.id, v]));
  const items = lines
    .filter((l) => byId.has(l.variantId))
    .map((l) => {
      const v = byId.get(l.variantId);
      return { id: v.product_id, variantId: v.id, sku: v.sku, size: v.size, qty: l.qty };
    });
  await db.prepare("UPDATE abandoned_checkouts SET recovered_at=datetime('now') WHERE token=?").bind(token).run();
  return c.json({ items, city: row.city || "" });
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
  const { products } = await storeCatalogue(db);
  const lines = [];
  for (const it of items) {
    const hit = findVariant(products, it);
    const qty = Math.max(1, Math.min(50, Math.round(it.qty || 1)));
    if (!hit) return { error: "An item in your cart is no longer available." };
    const { product: p, variant: v } = hit;
    // `unit` and `variantId` are here for the reward engine: a "one product
    // free" reward takes off one unit's price, not a whole line.
    lines.push({ product: p, variant: v, qty, cat: p.cat, unit: v.ngn, variantId: v.id, lineTotal: v.ngn * qty });
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

  // The one code box, resolved the same way the validate endpoint resolves it:
  // a public sale code first, a personal reward second. The discount is the
  // server's own arithmetic over the server's own lines — the browser's
  // preview of it is never read.
  let promo = null;
  let reward = null;
  let discount = 0;
  let freeShipPromo = false;
  const contactForReward = (customer.email || "").trim() || (customer.phone || "").trim();
  if (promoCode && String(promoCode).trim()) {
    const clean = String(promoCode).trim().toUpperCase();
    promo = await db.prepare("SELECT * FROM promos WHERE code=?").bind(clean).first();
    if (promo) {
      if (!promoIsActive(promo)) return c.json({ error: promoRefusal(promo) }, 400);
      discount = computeDiscount(promo, lines);
      freeShipPromo = promo.kind === "ship";
    } else {
      reward = await getReward(db, clean);
      // A reward is bound to the contact it was issued to, and here — unlike at
      // validate time — that contact is known, so the check is the real one.
      const refusal = rewardRefusal(reward, { contact: contactForReward, subtotal });
      if (refusal) return c.json({ error: refusal }, 400);
      const worth = computeRewardDiscount(reward, lines);
      if (worth.reason) return c.json({ error: worth.reason }, 400);
      discount = worth.discount;
      freeShipPromo = worth.freeShip;
    }
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

  // Spend the reward *before* the order is written. The claim is a conditional
  // UPDATE, so when two checkouts race on one code the database picks the
  // winner and the loser is refused — rather than both being given a discount
  // and the second UPDATE quietly changing nothing.
  if (reward && !(await claimReward(db, reward.code, no))) {
    return c.json({ error: "That reward has already been used." }, 400);
  }

  const payLabels = PAY_METHODS;
  const method = fulfill === "collect" ? "Click & collect" : "Delivery";
  const now = new Date();

  const statements = [
    db.prepare(
      `INSERT INTO orders (no, customer, phone, email, city, address, fulfilled_from, method, pay, pay_status, status,
        promo_code, reward_code, subtotal, discount, shipping, total, all_in_city, placed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'Processing', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      no, customer.name.trim(), customer.phone.trim(), (customer.email || "").trim(), city,
      (customer.address || "").trim(), loc, method, payLabels[pay] || "Paystack",
      promo ? promo.code : null, reward ? reward.code : null,
      subtotal, discount, shipping, total, allInCity ? 1 : 0
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
  try {
    await db.batch(statements);
  } catch (e) {
    // The code is already spent but the order it was spent on does not exist.
    // Put it back — scoped to this order number, so a code another checkout
    // has legitimately taken in the meantime is never resurrected.
    if (reward) await releaseReward(db, reward.code, no);
    throw e;
  }

  // An order is an identification too: a guest who has never signed in still
  // just told the shop who they are. Their earlier visits are attached to that
  // record, which is what makes "how many times did they look before they
  // bought" answerable at all.
  const guestEmail = (customer.email || "").trim().toLowerCase();
  if (guestEmail) {
    const cust = await db.prepare("SELECT id FROM customers WHERE email=?").bind(guestEmail).first();
    if (cust) await stitchVisitor(c.env, c.req.header("x-mr-visitor"), cust.id);
  }

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
  // A reward this order earned. It exists only once the order is paid for, so
  // the tracking page is where a bank-transfer customer finds theirs — the
  // confirmation screen came and went before the money landed.
  const earned = await db
    .prepare("SELECT code, descr, expires_at FROM reward_codes WHERE earned_order_no=? AND status='Active'")
    .bind(no)
    .first();
  return c.json({
    no: order.no,
    reward: earned ? { code: earned.code, desc: earned.descr, expiresAt: earned.expires_at || "" } : null,
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
