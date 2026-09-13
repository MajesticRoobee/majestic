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
