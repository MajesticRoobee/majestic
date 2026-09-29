// F4 — the behavioural stream, and what can be read off it.
//
// Three jobs live here:
//
//   1. `ingest` — take a batch of events from one visitor's browser and write
//      them down, keeping the session row's counters current so a segment is an
//      indexed read rather than a scan.
//   2. `rollup` — fold yesterday into `insight_daily` on the cron, and prune
//      raw events past the window the house set. Kept separate because the
//      admin must never scan the raw log to draw a chart.
//   3. `segments` — the saved questions the client actually asked: who filled a
//      cart and left, who looked and never added, who keeps coming back and has
//      never bought.
//
// The discipline, stated once: **no personal detail enters this stream.** Ids,
// types, paths and amounts. A name or an email in a payload is dropped at the
// door rather than stored and filtered later, because the second kind of
// promise is the kind that quietly stops being true.

import { getSettings } from "./util.js";

// Everything the browser is allowed to say happened. An unknown type is
// dropped: the stream is only useful if its vocabulary is fixed.
export const EVENT_TYPES = new Set([
  "page_view", "view_item", "view_category", "search", "search_no_results",
  "add_to_cart", "remove_from_cart", "begin_checkout", "checkout_step",
  "purchase", "wishlist_add", "waitlist_join", "nudge_shown", "nudge_clicked",
]);

// How much one browser may send at once, and how much one session may ever
// record. A visit that claims ten thousand events is a bug or a bot.
export const MAX_BATCH = 40;
export const MAX_SESSION_EVENTS = 600;

export const DEFAULT_RETAIN_DAYS = 90;
export const DEFAULT_ABANDON_MINS = 45;

export function insightsConfig(settings = {}) {
  const int = (v, d, lo, hi) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
  };
  return {
    on: settings.insightsOn !== false,
    retainDays: int(settings.insightsRetainDays, DEFAULT_RETAIN_DAYS, 7, 3650),
    abandonMins: int(settings.abandonAfterMins, DEFAULT_ABANDON_MINS, 5, 10080),
  };
}

// ---- What never leaves the browser ----------------------------------------

// A referrer is kept as a host. The full URL of the page someone came from can
// carry a search they typed, a session token, or their own name — none of
// which this store has any business writing down.
export function referrerHost(ref) {
  const s = String(ref || "").trim();
  if (!s) return "";
  try {
    const h = new URL(s).hostname.replace(/^www\./, "");
    return h.slice(0, 80);
  } catch { return ""; }
}

// A path with its query dropped, so "?email=..." on a shared link cannot ride
// in as an entry path.
export function safePath(p) {
  const s = String(p || "/").split("?")[0].split("#")[0].trim();
  return (s.startsWith("/") ? s : "/" + s).slice(0, 200);
}

// Bots are flagged at write time rather than filtered at read time, so the
// rollups are clean and the raw log is still honest about what arrived.
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pagespeed|curl|wget|python-requests|node-fetch|axios|monitor|preview|facebookexternalhit|whatsapp|telegram|embedly|semrush|ahrefs|dataprovider|screaming/i;
export function looksLikeBot(ua = "", { cfVerifiedBot = false } = {}) {
  if (cfVerifiedBot) return true;
  const s = String(ua || "");
  if (!s.trim()) return true; // a browser always sends one
  return BOT_RE.test(s);
}

export function deviceOf(ua = "") {
  const s = String(ua || "");
  if (/iPad|Tablet/i.test(s)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(s)) return "phone";
  return "desktop";
}

/**
 * Reduce one raw batch from a browser to the events that may be written.
 *
 * Everything about this is deliberately mean: an unknown type is dropped, a
 * batch longer than MAX_BATCH is cut, and only the handful of fields the stream
 * has a use for survive. Whatever else the page sent — and a page can send
 * anything — never reaches the database.
 */
export function sanitiseBatch(events = []) {
  const out = [];
  for (const e of Array.isArray(events) ? events.slice(0, MAX_BATCH) : []) {
    if (!e || !EVENT_TYPES.has(e.type)) continue;
    const meta = {};
    // A search term is the one free-text field here, and it is the whole point
    // of "what did people look for and not find". Trimmed hard, and never
    // anything that looks like a way of reaching a person.
    if (typeof e.q === "string" && e.q.trim()) {
      const q = e.q.trim().slice(0, 60);
      if (!/@|\+?\d[\d\s-]{7,}/.test(q)) meta.q = q;
    }
    if (typeof e.path === "string") meta.path = safePath(e.path);
    if (typeof e.cat === "string" && e.cat.trim()) meta.cat = e.cat.trim().slice(0, 60);
    if (typeof e.step === "string" && e.step.trim()) meta.step = e.step.trim().slice(0, 40);
    out.push({
      type: e.type,
      productId: typeof e.productId === "string" ? e.productId.slice(0, 120) : null,
      variantId: Number.isFinite(parseInt(e.variantId, 10)) ? parseInt(e.variantId, 10) : null,
      value: Math.max(0, Math.min(100000000, Math.round(Number(e.value) || 0))),
      meta,
    });
  }
  return out;
}

/** What a batch does to the session's running counters. */
export function tallyBatch(events = []) {
  const t = { views: 0, carts: 0, checkouts: 0, orders: 0, revenue: 0, cartValue: null };
  for (const e of events) {
    if (e.type === "view_item") t.views++;
    else if (e.type === "add_to_cart") { t.carts++; t.cartValue = e.value || t.cartValue; }
    else if (e.type === "begin_checkout") { t.checkouts++; t.cartValue = e.value || t.cartValue; }
    else if (e.type === "purchase") { t.orders++; t.revenue += e.value || 0; }
    // A cart emptied back to nothing is not an abandoned cart.
    else if (e.type === "remove_from_cart") t.cartValue = e.value || 0;
  }
  return t;
}

// ---- Ingest ---------------------------------------------------------------

const uuidish = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(s);

/**
 * Write one batch. Returns { ok, wrote } — never throws at the caller, because
 * a measurement failure must never be visible to a shopper.
 */
export async function ingest(env, body, { ua = "", country = "", cfVerifiedBot = false, settings = null } = {}) {
  const db = env.DB;
  const cfg = insightsConfig(settings || (await getSettings(db)));
  if (!cfg.on) return { ok: true, wrote: 0, off: true };

  const sessionId = body && body.sid;
  const visitorId = body && body.vid;
  if (!uuidish(sessionId) || !uuidish(visitorId)) return { ok: false, wrote: 0 };

  const events = sanitiseBatch(body.events);
  if (!events.length) return { ok: true, wrote: 0 };

  const bot = looksLikeBot(ua, { cfVerifiedBot });
  const existing = await db.prepare("SELECT id, events_written FROM (SELECT id, (SELECT COUNT(*) FROM session_events WHERE session_id = s.id) AS events_written FROM sessions s WHERE s.id = ?)").bind(sessionId).first();

  if (!existing) {
    await db.prepare(
      `INSERT INTO sessions (id, visitor_id, entry_path, referrer, utm_source, utm_medium, utm_campaign, device, country, city_pref, is_bot)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`
    ).bind(
      sessionId, visitorId, safePath(body.path), referrerHost(body.ref),
      String(body.utmSource || "").trim().slice(0, 60),
      String(body.utmMedium || "").trim().slice(0, 60),
      String(body.utmCampaign || "").trim().slice(0, 60),
      deviceOf(ua), String(country || "").slice(0, 2),
      String(body.city || "").trim().slice(0, 40),
      bot ? 1 : 0
    ).run();
  } else if (existing.events_written >= MAX_SESSION_EVENTS) {
    // The session has said enough. Its counters stay current; the log stops.
    await db.prepare("UPDATE sessions SET last_seen = datetime('now') WHERE id = ?").bind(sessionId).run();
    return { ok: true, wrote: 0, capped: true };
  }

  const room = existing ? Math.max(0, MAX_SESSION_EVENTS - existing.events_written) : MAX_SESSION_EVENTS;
  const writing = events.slice(0, room);
  const t = tallyBatch(events);

  const stmts = writing.map((e) =>
    db.prepare("INSERT INTO session_events (session_id, type, product_id, variant_id, value_ngn, meta) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(sessionId, e.type, e.productId, e.variantId, e.value, JSON.stringify(e.meta))
  );
  stmts.push(
    db.prepare(
      `UPDATE sessions SET last_seen = datetime('now'), views = views + ?, carts = carts + ?,
         checkouts = checkouts + ?, orders = orders + ?, revenue = revenue + ?,
         cart_value = CASE WHEN ? IS NULL THEN cart_value ELSE ? END,
         city_pref = CASE WHEN ? = '' THEN city_pref ELSE ? END
       WHERE id = ?`
    ).bind(
      t.views, t.carts, t.checkouts, t.orders, t.revenue,
      t.cartValue, t.cartValue,
      String(body.city || "").trim().slice(0, 40), String(body.city || "").trim().slice(0, 40),
      sessionId
    )
  );
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
  return { ok: true, wrote: writing.length };
}

/**
 * Attach every session this visitor has ever had to the customer they turned
 * out to be.
 *
 * This is the line between "someone looked at this four times" and "*this
 * customer* looked at this four times", and it is what makes the whole stream
 * worth keeping. Called the moment somebody signs in, registers, or orders.
 */
export async function stitchVisitor(env, visitorId, customerId) {
  if (!uuidish(visitorId) || !customerId) return { stitched: 0 };
  const r = await env.DB.prepare("UPDATE sessions SET customer_id = ? WHERE visitor_id = ? AND customer_id IS NULL")
    .bind(customerId, visitorId).run();
  return { stitched: (r.meta && r.meta.changes) || 0 };
}

// ---- Rollup and retention -------------------------------------------------

const dayBefore = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/**
 * Fold whole days into `insight_daily`, then prune raw events past the window.
 *
 * Only days that are *over* are folded — a partial day would be written and
 * then have to be corrected, and a chart that changes under the reader is worse
 * than one that starts a day behind.
 */
export async function rollup(env, { today = new Date().toISOString().slice(0, 10), settings = null } = {}) {
  const db = env.DB;
  const cfg = insightsConfig(settings || (await getSettings(db)));
  const state = JSON.parse((await db.prepare("SELECT value FROM settings WHERE key='insights'").first() || { value: "{}" }).value || "{}");
  // Never re-walk more than a month on a cold start; the rest is already gone
  // from the raw log anyway.
  const from = state.rolledTo || dayBefore(31);
  const days = [];
  for (let d = 1; d <= 31; d++) {
    const day = dayBefore(d);
    if (day >= today) continue;
    if (day <= from) break;
    days.push(day);
  }
  days.reverse();

  for (const day of days) {
    const rows = [];
    const put = (metric, dim, value) => { if (value) rows.push({ metric, dim, value }); };

    const s = await db.prepare(
      `SELECT COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS visitors,
              SUM(views) AS views, SUM(carts) AS carts, SUM(checkouts) AS checkouts,
              SUM(orders) AS orders, SUM(revenue) AS revenue,
              SUM(CASE WHEN views > 0 THEN 1 ELSE 0 END) AS browsed,
              SUM(CASE WHEN carts > 0 THEN 1 ELSE 0 END) AS carted,
              SUM(CASE WHEN orders > 0 THEN 1 ELSE 0 END) AS bought
         FROM sessions WHERE is_bot = 0 AND date(started_at) = ?`
    ).bind(day).first();
    if (s) {
      put("sessions", "", s.sessions); put("visitors", "", s.visitors);
      put("views", "", s.views); put("carts", "", s.carts);
      put("checkouts", "", s.checkouts); put("orders", "", s.orders);
      put("revenue", "", s.revenue);
      put("browsed", "", s.browsed); put("carted", "", s.carted); put("bought", "", s.bought);
    }

    const bySource = (await db.prepare(
      `SELECT CASE WHEN utm_source <> '' THEN utm_source WHEN referrer <> '' THEN referrer ELSE 'direct' END AS dim,
              COUNT(*) AS n
         FROM sessions WHERE is_bot = 0 AND date(started_at) = ? GROUP BY dim ORDER BY n DESC LIMIT 40`
    ).bind(day).all()).results;
    for (const r of bySource) put("source", r.dim, r.n);

    const byDevice = (await db.prepare(
      "SELECT device AS dim, COUNT(*) AS n FROM sessions WHERE is_bot = 0 AND date(started_at) = ? GROUP BY device"
    ).bind(day).all()).results;
    for (const r of byDevice) put("device", r.dim, r.n);

    // Per-product interest, which is what turns "this gets looked at and never
    // bought" into something the house can see.
    const byProduct = (await db.prepare(
      `SELECT e.product_id AS dim, e.type AS type, COUNT(*) AS n
         FROM session_events e JOIN sessions s ON s.id = e.session_id
        WHERE s.is_bot = 0 AND date(e.at) = ? AND e.product_id IS NOT NULL
          AND e.type IN ('view_item','add_to_cart')
        GROUP BY e.product_id, e.type`
    ).bind(day).all()).results;
    for (const r of byProduct) put(r.type === "view_item" ? "product_view" : "product_cart", r.dim, r.n);

    // What people looked for and did not find: an SEO brief and a buying list,
    // written by customers.
    const misses = (await db.prepare(
      `SELECT json_extract(e.meta, '$.q') AS dim, COUNT(*) AS n
         FROM session_events e JOIN sessions s ON s.id = e.session_id
        WHERE s.is_bot = 0 AND date(e.at) = ? AND e.type = 'search_no_results'
          AND json_extract(e.meta, '$.q') IS NOT NULL
        GROUP BY dim ORDER BY n DESC LIMIT 60`
    ).bind(day).all()).results;
    for (const r of misses) put("search_miss", r.dim, r.n);

    if (rows.length) {
      const stmts = rows.map((r) =>
        db.prepare("INSERT INTO insight_daily (day, metric, dim, value) VALUES (?, ?, ?, ?) ON CONFLICT(day, metric, dim) DO UPDATE SET value = excluded.value")
          .bind(day, r.metric, r.dim, r.value));
      for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
    }
  }

  if (days.length) {
    await db.prepare("INSERT INTO settings (key, value) VALUES ('insights', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(JSON.stringify({ ...state, rolledTo: days[days.length - 1] })).run();
  }

  // Prune. Rollups are kept for good; the raw log is not — a session that
  // carries an order is spared, because that one is a record of a sale.
  const cutoff = dayBefore(cfg.retainDays);
  await db.prepare(
    `DELETE FROM session_events WHERE session_id IN (
       SELECT id FROM sessions WHERE date(last_seen) < ? AND orders = 0 LIMIT 2000)`
  ).bind(cutoff).run();
  const pruned = await db.prepare(
    "DELETE FROM sessions WHERE date(last_seen) < ? AND orders = 0 AND id NOT IN (SELECT DISTINCT session_id FROM session_events)"
  ).bind(cutoff).run();

  return { folded: days.length, pruned: (pruned.meta && pruned.meta.changes) || 0 };
}

// ---- Segments -------------------------------------------------------------
//
// The saved questions. Each one is the client's ask written as SQL over the
// session row rather than the event log — which is why the counters are kept on
// the row: a segment has to be cheap enough to draw eight of them on one screen.
//
// `sql` is a WHERE clause against `sessions s`. `since` and `abandon` are bound
// in that order wherever the clause names them.

export const SEGMENTS = [
  {
    id: "cart-abandoned",
    name: "Filled a cart and left",
    why: "Carts with something still in them, gone quiet. The cheapest sale in the shop to win back.",
    where: "s.carts > 0 AND s.orders = 0 AND s.last_seen <= datetime('now', ?abandon)",
    action: "Send the recovery link",
  },
  {
    id: "checkout-abandoned",
    name: "Reached checkout and stopped",
    why: "They started paying and did not finish. Worth knowing which step lost them.",
    where: "s.checkouts > 0 AND s.orders = 0 AND s.last_seen <= datetime('now', ?abandon)",
    action: "Send the recovery link",
  },
  {
    id: "browsed-no-cart",
    name: "Looked, never added",
    why: "Two or more products opened and nothing put in a basket. The ask, exactly: who came in, clicked, and left empty-handed.",
    where: "s.views >= 2 AND s.carts = 0",
    action: "Worth asking what the product pages are not saying",
  },
  {
    id: "bounced",
    name: "Came in and went straight out",
    why: "Not one product opened. Either the wrong traffic, or the front page is not doing its job.",
    where: "s.views = 0 AND s.carts = 0",
    action: "Check where they came from",
  },
  {
    id: "repeat-no-order",
    name: "Keeps coming back, never bought",
    why: "Three visits or more and no order. This is who the first-order offer is actually for.",
    where: `s.visitor_id IN (
      SELECT visitor_id FROM sessions WHERE is_bot = 0 GROUP BY visitor_id
       HAVING COUNT(*) >= 3 AND SUM(orders) = 0)`,
    action: "Target the first-order offer here instead of at everyone",
  },
  {
    id: "high-intent",
    name: "Same piece, again and again",
    why: "One product opened three times or more across visits, and still not bought. Somebody already decided and is waiting for a reason.",
    where: `s.orders = 0 AND s.id IN (
      SELECT session_id FROM session_events WHERE type = 'view_item' AND product_id IS NOT NULL
       GROUP BY session_id, product_id HAVING COUNT(*) >= 3)`,
    action: "A price drop, a restock note, or a reward code",
  },
  {
    id: "buyers",
    name: "Bought",
    why: "For the funnel's last step, and to measure everything else against.",
    where: "s.orders > 0",
    action: "",
  },
];

/** Count every segment in one pass over the window. */
export async function segmentCounts(env, { days = 30, settings = null } = {}) {
  const db = env.DB;
  const cfg = insightsConfig(settings || (await getSettings(db)));
  const since = `-${Math.max(1, Math.min(365, days))} days`;
  const abandon = `-${cfg.abandonMins} minutes`;
  const out = [];
  for (const seg of SEGMENTS) {
    const where = seg.where.replace(/\?abandon/g, "?");
    const binds = [since];
    for (let i = 0; i < (seg.where.match(/\?abandon/g) || []).length; i++) binds.push(abandon);
    const row = await db.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(s.cart_value), 0) AS value
         FROM sessions s
        WHERE s.is_bot = 0 AND s.started_at >= datetime('now', ?) AND (${where})`
    ).bind(...binds).first();
    out.push({ id: seg.id, name: seg.name, why: seg.why, action: seg.action, count: row.n, value: row.value });
  }
  return out;
}

// ---- What the admin reads -------------------------------------------------
//
// Everything historical comes off `insight_daily`; only "right now" and a
// drill-down into one segment touch the raw log. That split is the whole reason
// the rollup exists, and it is worth keeping even while the numbers are small.

const rangeDays = (d) => Math.max(1, Math.min(365, parseInt(d, 10) || 30));

async function foldedTotals(db, days) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const prevSince = new Date(Date.now() - days * 2 * 86400000).toISOString().slice(0, 10);
  const read = async (from, to) => {
    const rows = (await db.prepare(
      "SELECT metric, SUM(value) AS v FROM insight_daily WHERE dim = '' AND day >= ? AND day < ? GROUP BY metric"
    ).bind(from, to).all()).results;
    return Object.fromEntries(rows.map((r) => [r.metric, r.v]));
  };
  return { now: await read(since, "9999"), prev: await read(prevSince, since) };
}

/**
 * Today so far, straight off the session rows.
 *
 * The rollup only folds days that are *over* — a chart that changes under the
 * reader is worse than one that starts a day behind — so today is read live and
 * added on. It is one indexed query, not a scan of the event log.
 */
async function todaySoFar(db) {
  const r = await db.prepare(
    `SELECT COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS visitors,
            COALESCE(SUM(views),0) AS views, COALESCE(SUM(carts),0) AS carts,
            COALESCE(SUM(checkouts),0) AS checkouts, COALESCE(SUM(orders),0) AS orders,
            COALESCE(SUM(revenue),0) AS revenue,
            SUM(CASE WHEN views > 0 THEN 1 ELSE 0 END) AS browsed,
            SUM(CASE WHEN carts > 0 THEN 1 ELSE 0 END) AS carted,
            SUM(CASE WHEN orders > 0 THEN 1 ELSE 0 END) AS bought
       FROM sessions WHERE is_bot = 0 AND date(started_at) = date('now')`
  ).first();
  return r || {};
}

/**
 * The funnel, and what it costs at each step.
 *
 * Sessions rather than events at every stage, because "how many people got this
 * far" is the question — four views by one shopper is one person who browsed,
 * not four.
 */
export async function overview(env, { days = 30 } = {}) {
  const db = env.DB;
  const d = rangeDays(days);
  const { now, prev } = await foldedTotals(db, d);
  const today = await todaySoFar(db);
  const add = (k) => (now[k] || 0) + (today[k] || 0);

  const visitors = add("visitors");
  const funnel = [
    { step: "Came in", n: visitors, of: visitors },
    { step: "Opened a product", n: add("browsed"), of: visitors },
    { step: "Added to a cart", n: add("carted"), of: visitors },
    { step: "Reached checkout", n: (now.checkouts || 0) + (today.checkouts || 0), of: visitors },
    { step: "Bought", n: add("bought"), of: visitors },
  ].map((s) => ({ ...s, pct: s.of ? Math.round((s.n / s.of) * 1000) / 10 : 0 }));

  const orders = add("orders");
  const revenue = add("revenue");
  const prevVisitors = prev.visitors || 0;
  const prevOrders = prev.orders || 0;

  // The daily line, from the rollup plus today.
  const rows = (await db.prepare(
    "SELECT day, metric, value FROM insight_daily WHERE dim = '' AND metric IN ('visitors','orders','revenue') AND day >= ? ORDER BY day"
  ).bind(new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)).all()).results;
  const byDay = {};
  for (const r of rows) (byDay[r.day] ||= {})[r.metric] = r.value;
  const todayKey = new Date().toISOString().slice(0, 10);
  byDay[todayKey] = { visitors: today.visitors || 0, orders: today.orders || 0, revenue: today.revenue || 0 };
  const series = [];
  for (let i = d - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const v = byDay[day] || {};
    series.push({ day, visitors: v.visitors || 0, orders: v.orders || 0, revenue: v.revenue || 0 });
  }

  const dimRows = async (metric, limit = 12) => (await db.prepare(
    "SELECT dim, SUM(value) AS v FROM insight_daily WHERE metric = ? AND dim <> '' AND day >= ? GROUP BY dim ORDER BY v DESC LIMIT ?"
  ).bind(metric, new Date(Date.now() - d * 86400000).toISOString().slice(0, 10), limit).all()).results;

  // Looked at a lot and put in a basket rarely: a price, a photograph or a
  // description problem, and nothing in the admin could name those products
  // before this.
  const views = await dimRows("product_view", 200);
  const carts = Object.fromEntries((await dimRows("product_cart", 200)).map((r) => [r.dim, r.v]));
  const names = Object.fromEntries((await db.prepare("SELECT id, name FROM products").all()).results.map((p) => [p.id, p.name]));
  const interest = views
    .filter((r) => r.v >= 3)
    .map((r) => ({ id: r.dim, name: names[r.dim] || r.dim, views: r.v, carts: carts[r.dim] || 0, rate: Math.round(((carts[r.dim] || 0) / r.v) * 1000) / 10 }))
    .sort((a, b) => a.rate - b.rate || b.views - a.views);

  return {
    days: d,
    kpis: {
      visitors, prevVisitors,
      sessions: add("sessions"),
      orders, prevOrders,
      revenue,
      conversion: visitors ? Math.round((add("bought") / visitors) * 1000) / 10 : 0,
      perVisitor: visitors ? Math.round(revenue / visitors) : 0,
      aov: orders ? Math.round(revenue / orders) : 0,
    },
    funnel,
    series,
    sources: await dimRows("source"),
    devices: await dimRows("device", 5),
    searchMisses: await dimRows("search_miss", 20),
    coldest: interest.slice(0, 12),
    hottest: interest.slice().sort((a, b) => b.views - a.views).slice(0, 12),
  };
}

/** Everything sold out, ranked by how many people went looking for it. */
export async function soldOutDemand(env, { days = 30 } = {}) {
  const db = env.DB;
  const since = new Date(Date.now() - rangeDays(days) * 86400000).toISOString().slice(0, 10);
  const rows = (await db.prepare(
    `SELECT v.id AS variantId, p.id AS productId, p.name AS name, v.size AS size, v.price_ngn AS price,
            COALESCE((SELECT SUM(d.value) FROM insight_daily d WHERE d.metric='product_view' AND d.dim = p.id AND d.day >= ?), 0) AS views,
            (SELECT COUNT(*) FROM stock_waitlist w WHERE w.product_id = p.id AND w.notified = 0) AS waiting
       FROM variants v JOIN products p ON p.id = v.product_id
      WHERE v.active = 1 AND p.live = 1
        AND NOT EXISTS (SELECT 1 FROM stock s WHERE s.variant_id = v.id AND s.qty > 0)
      ORDER BY waiting DESC, views DESC LIMIT 25`
  ).bind(since).all()).results;
  // What the shelf being empty is costing, near enough to be worth ordering on.
  return rows.map((r) => ({ ...r, missed: (r.waiting || 0) * r.price }));
}

/** One segment, as a readable list the house can act on. */
export async function segmentRows(env, id, { days = 30, limit = 60, settings = null } = {}) {
  const db = env.DB;
  const seg = SEGMENTS.find((s) => s.id === id);
  if (!seg) return null;
  const cfg = insightsConfig(settings || (await getSettings(db)));
  const where = seg.where.replace(/\?abandon/g, "?");
  const binds = [`-${rangeDays(days)} days`];
  for (let i = 0; i < (seg.where.match(/\?abandon/g) || []).length; i++) binds.push(`-${cfg.abandonMins} minutes`);
  const rows = (await db.prepare(
    `SELECT s.id, s.visitor_id, s.customer_id, s.started_at, s.last_seen, s.device, s.country,
            s.city_pref, s.referrer, s.utm_source, s.views, s.carts, s.cart_value, s.recovered,
            c.email AS email, c.name AS name, c.phone AS phone
       FROM sessions s LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.is_bot = 0 AND s.started_at >= datetime('now', ?) AND (${where})
      ORDER BY s.last_seen DESC LIMIT ?`
  ).bind(...binds, Math.max(1, Math.min(200, limit))).all()).results;

  // What each one was looking at, so the list is a list of *people and pieces*
  // rather than a list of opaque ids.
  const ids = rows.map((r) => r.id);
  const looked = ids.length
    ? (await db.prepare(
        `SELECT e.session_id, p.name AS name, COUNT(*) AS n
           FROM session_events e JOIN products p ON p.id = e.product_id
          WHERE e.session_id IN (${ids.map(() => "?").join(",")}) AND e.type IN ('view_item','add_to_cart')
          GROUP BY e.session_id, p.id ORDER BY n DESC`
      ).bind(...ids).all()).results
    : [];
  return {
    segment: { id: seg.id, name: seg.name, why: seg.why, action: seg.action },
    rows: rows.map((r) => ({
      id: r.id, customerId: r.customer_id, name: r.name || "", email: r.email || "", phone: r.phone || "",
      started: r.started_at, lastSeen: r.last_seen, device: r.device, country: r.country,
      city: r.city_pref, source: r.utm_source || r.referrer || "direct",
      views: r.views, carts: r.carts, cartValue: r.cart_value, recovered: !!r.recovered,
      looked: looked.filter((l) => l.session_id === r.id).slice(0, 4).map((l) => l.name),
    })),
  };
}

/**
 * The people behind the numbers, with a way to reach each of them.
 *
 * Four lists the house can act on today: checkouts left unfinished (they typed
 * a phone number or an email and stopped), people waiting on a restock,
 * newsletter and pop-up sign-ups, and recent buyers for a thank-you or a
 * review. Contact details are the shop's own records, read only by a signed-in
 * admin; a manager tied to one store sees that store's city only.
 */
export async function followUps(env, { days = 30, scope = null, limit = 100 } = {}) {
  const db = env.DB;
  const since = `-${rangeDays(days)} days`;
  const cap = Math.max(1, Math.min(500, limit));
  const city = scope && scope !== "all" ? scope : null;
  const byCity = (col) => (city ? ` AND ${col} = ?` : "");
  const bind = (...xs) => (city ? [...xs, city] : xs);

  const checkouts = (await db.prepare(
    `SELECT name, phone, email, city, value_ngn AS value, stage, reminded, updated_at AS at
       FROM abandoned_checkouts
      WHERE converted = 0 AND updated_at >= datetime('now', ?)${byCity("city")}
      ORDER BY updated_at DESC LIMIT ?`
  ).bind(...bind(since), cap).all()).results;

  const waiting = (await db.prepare(
    `SELECT w.contact, w.size, w.city, w.created_at AS at, p.name AS product
       FROM stock_waitlist w LEFT JOIN products p ON p.id = w.product_id
      WHERE w.notified = 0 AND w.created_at >= datetime('now', ?)${byCity("w.city")}
      ORDER BY w.created_at DESC LIMIT ?`
  ).bind(...bind(since), cap).all()).results;

  // Sign-ups carry no city, so a store-bound manager doesn't see them.
  const signups = city ? [] : (await db.prepare(
    `SELECT l.email, l.source, l.created_at AS at, c.name AS name, c.phone AS phone
       FROM leads l LEFT JOIN customers c ON lower(c.email) = lower(l.email)
      WHERE l.created_at >= datetime('now', ?)
      ORDER BY l.created_at DESC LIMIT ?`
  ).bind(since, cap).all()).results;

  const buyers = (await db.prepare(
    `SELECT o.no, o.customer AS name, o.phone, o.email, o.city, o.total AS value, o.pay_status, o.placed_at AS at
       FROM orders o
      WHERE o.status <> 'Cancelled' AND o.placed_at >= datetime('now', ?)${byCity("o.city")}
      ORDER BY o.placed_at DESC LIMIT ?`
  ).bind(...bind(since), cap).all()).results;

  const isEmail = (s) => String(s || "").includes("@");
  return {
    checkouts: checkouts.map((r) => ({ name: r.name, phone: r.phone, email: r.email, city: r.city, value: r.value, note: r.stage + (r.reminded ? " · reminder sent" : ""), at: r.at })),
    waiting: waiting.map((r) => ({
      name: "", phone: isEmail(r.contact) ? "" : r.contact, email: isEmail(r.contact) ? r.contact : "",
      city: r.city || "", value: 0, note: `${r.product || "A product"}${r.size ? ` ${r.size}` : ""}`, at: r.at,
    })),
    signups: signups.map((r) => ({ name: r.name || "", phone: r.phone || "", email: r.email, city: "", value: 0, note: r.source, at: r.at })),
    buyers: buyers.map((r) => ({ name: r.name, phone: r.phone, email: r.email, city: r.city, value: r.value, note: `Order ${r.no}${r.pay_status === "paid" ? " · paid" : ""}`, at: r.at })),
  };
}
