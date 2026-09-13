// Where the low-stock line sits, and who hears about it when a shelf crosses it.
//
// "Low stock" was one number, shared by every piece in the shop, shown only as a
// count on the dashboard. Three things are wrong with that. A 3ml sample and a
// ₦180,000 extrait do not run low at the same figure. A store turning ten a day
// and a store turning one a week do not either. And a number on a screen is not
// an alert — nobody is looking at it at six in the evening.
//
// So: a line per variation where the house wants one, a mode that reads the line
// off how fast the thing actually sells, and a sweep on the cron that emits an
// event when a shelf *crosses* the line rather than every fifteen minutes for as
// long as it sits below it.
//
// The arithmetic here is pure and exported on its own, because the interesting
// part is the arithmetic — see scripts/inventory.test.mjs.

import { emitEvent } from "./events.js";
import { daysBefore } from "./merch.js";
import { getSettings } from "./util.js";

export const DEFAULT_THRESHOLD = 5;
export const DEFAULT_COVER_DAYS = 14;
export const DEFAULT_VELOCITY_DAYS = 30;

/** The house's settings, read defensively — any of them may be absent or junk. */
export function lowStockConfig(settings = {}) {
  const int = (v, fallback, min, max) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  return {
    flat: int(settings.lowStockThreshold, DEFAULT_THRESHOLD, 0, 10000),
    mode: settings.lowStockMode === "cover" ? "cover" : "flat",
    coverDays: int(settings.lowStockCoverDays, DEFAULT_COVER_DAYS, 1, 365),
    velocityDays: int(settings.lowStockVelocityDays, DEFAULT_VELOCITY_DAYS, 7, 365),
    alerts: settings.lowStockAlerts !== false,
    onStorefront: settings.lowStockOnStorefront !== false,
  };
}

/**
 * The line for one variation at one store.
 *
 * An override on the variation wins outright — it is the house saying "this
 * one is different", and no computed figure should argue with that.
 *
 * In `cover` mode the line is how many units cover `coverDays` at the rate this
 * store has been selling them, and the flat figure is the **floor**. That
 * matters: without the floor, a piece that has never sold has a velocity of
 * zero, a line of zero, and would go from healthy to sold out with no warning
 * in between — which is precisely the case the house most wants to be told
 * about. With the floor, a fast mover gets a higher line than five and a slow
 * one still gets five.
 */
export function thresholdFor({ override = null, unitsSold = 0, cfg } = {}) {
  const { flat, mode, coverDays, velocityDays } = cfg;
  if (override !== null && override !== undefined && override !== "") {
    const n = parseInt(override, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  if (mode !== "cover") return flat;
  const perDay = Math.max(0, Number(unitsSold) || 0) / velocityDays;
  return Math.max(flat, Math.ceil(perDay * coverDays));
}

export function stateFor(qty, threshold) {
  if (qty <= 0) return "out";
  return qty <= threshold ? "low" : "ok";
}

// Only a step downhill is news. "ok → low", "ok → out" and "low → out" are worth
// a message; coming back up is worth recording and nothing more, so the next dip
// is heard again.
const RANK = { ok: 0, low: 1, out: 2 };
export function worsened(before, after) {
  return RANK[after] > RANK[(before in RANK ? before : "ok")];
}

/**
 * Every (variation × store) pair, with the line that applies to it and the state
 * it is in.
 *
 * @param rows     [{ variantId, productId, productName, size, sku, locationId, qty, lowStockAt }]
 * @param sold     Map "variantId:locationId" -> units over the velocity window
 */
export function computeStockStates(rows = [], sold = new Map(), cfg) {
  return rows.map((r) => {
    const threshold = thresholdFor({
      override: r.lowStockAt,
      unitsSold: sold.get(`${r.variantId}:${r.locationId}`) || 0,
      cfg,
    });
    return { ...r, threshold, state: stateFor(r.qty, threshold) };
  });
}

// ---- The database side ----------------------------------------------------

/** Units sold per (variation × store) over the window. A sale is a paid,
 *  uncancelled order — the same rule the best-seller count uses, so the two
 *  screens can never disagree about what counts as having sold. */
async function unitsByVariantStore(db, days) {
  const rows = (await db.prepare(
    `SELECT i.variant_id AS vid, COALESCE(i.location_id, o.fulfilled_from) AS loc, SUM(i.qty) AS units
       FROM order_items i JOIN orders o ON o.no = i.order_no
      WHERE i.variant_id IS NOT NULL
        AND o.status <> 'Cancelled'
        AND (o.pay_status = 'paid' OR o.pay <> 'Paystack')
        AND date(o.placed_at) >= ?
      GROUP BY i.variant_id, loc`
  ).bind(daysBefore(days)).all()).results;
  const by = new Map();
  for (const r of rows) if (r.loc) by.set(`${r.vid}:${r.loc}`, r.units);
  return by;
}

/** Every live variation's stock, one row per store, with its override. */
export async function stockRows(db) {
  return (await db.prepare(
    `SELECT v.id AS variantId, v.product_id AS productId, v.size AS size, v.sku AS sku,
            v.low_stock_at AS lowStockAt, p.name AS productName,
            s.location_id AS locationId, s.qty AS qty
       FROM stock s
       JOIN variants v ON v.id = s.variant_id
       JOIN products p ON p.id = v.product_id
       JOIN locations l ON l.id = s.location_id
      WHERE v.active = 1 AND p.live = 1 AND l.active = 1
      ORDER BY p.rowid, v.sort, v.id, s.location_id`
  ).all()).results;
}

/**
 * The sweep. Runs on the cron the Worker already has.
 *
 * Kept off the checkout path deliberately: an order that empties a shelf is
 * already doing four writes under a shopper who is waiting, and a fifth to work
 * out whether to send an email is not worth the millisecond. Fifteen minutes
 * late is early enough to reorder stock.
 */
export async function sweepStock(env, { settings = null, emit = true } = {}) {
  const db = env.DB;
  const cfg = lowStockConfig(settings || (await getSettings(db)));
  const rows = await stockRows(db);
  const sold = cfg.mode === "cover" ? await unitsByVariantStore(db, cfg.velocityDays) : new Map();
  const states = computeStockStates(rows, sold, cfg);

  const prior = new Map(
    (await db.prepare("SELECT variant_id, location_id, state FROM stock_alerts").all()).results
      .map((r) => [`${r.variant_id}:${r.location_id}`, r.state])
  );

  const changed = [];
  const writes = [];
  for (const s of states) {
    const key = `${s.variantId}:${s.locationId}`;
    const before = prior.get(key) || "ok";
    if (before === s.state) continue;
    writes.push(
      db.prepare(
        `INSERT INTO stock_alerts (variant_id, location_id, state, qty, threshold, changed_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(variant_id, location_id) DO UPDATE SET
           state=excluded.state, qty=excluded.qty, threshold=excluded.threshold, changed_at=excluded.changed_at`
      ).bind(s.variantId, s.locationId, s.state, s.qty, s.threshold)
    );
    if (worsened(before, s.state)) changed.push({ ...s, before });
  }
  // D1 caps a batch; the sweep touches every shelf in the shop on its first run.
  for (let i = 0; i < writes.length; i += 50) await db.batch(writes.slice(i, i + 50));

  if (emit && cfg.alerts) {
    for (const s of changed) {
      await emitEvent(env, s.state === "out" ? "inventory_out" : "inventory_low", {
        entity: s.sku || String(s.variantId),
        payload: {
          productId: s.productId, productName: s.productName, size: s.size, sku: s.sku,
          city: s.locationId, qty: s.qty, threshold: s.threshold,
        },
      });
    }
  }
  return { scanned: states.length, changed: changed.length, alerted: emit && cfg.alerts ? changed.length : 0 };
}

/**
 * The low-stock line for every live variation, per store, in the shape the
 * catalogue already uses for stock — `{ abuja: 6, lagos: 4 }`.
 *
 * The storefront needs this to say "only 2 left in Abuja" using the *same* line
 * the house set, rather than a second hardcoded number that drifts from it.
 */
export async function lowStockLines(db, settings) {
  const cfg = lowStockConfig(settings);
  const rows = await stockRows(db);
  const sold = cfg.mode === "cover" ? await unitsByVariantStore(db, cfg.velocityDays) : new Map();
  const by = {};
  for (const s of computeStockStates(rows, sold, cfg)) {
    (by[s.variantId] ||= {})[s.locationId] = s.threshold;
  }
  return by;
}

/** What the admin's inventory screen and the dashboard both count as thin. */
export async function stockHealth(db, settings, scope = null) {
  const cfg = lowStockConfig(settings);
  const rows = (await stockRows(db)).filter((r) => !scope || r.locationId === scope);
  const sold = cfg.mode === "cover" ? await unitsByVariantStore(db, cfg.velocityDays) : new Map();
  const states = computeStockStates(rows, sold, cfg);
  return {
    cfg,
    states,
    low: states.filter((s) => s.state === "low"),
    out: states.filter((s) => s.state === "out"),
  };
}
