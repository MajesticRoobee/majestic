// "Other people also opened…" — built from the shop's own shoppers.
//
// The product page has had a "You may also like" rail since the beginning, and
// it is filed by category: it recommends whatever happens to sit near the piece
// on a shelf. That is a guess dressed as a recommendation.
//
// This is the same question answered with evidence: which pieces do people open
// in the *same visit* as this one. It costs nothing extra to collect, because
// F4 is already writing those visits down.
//
// Rebuilt whole on the cron rather than nudged per event. It is a few thousand
// rows, it only has to be right once a day, and a rebuild cannot drift the way
// an incrementally-maintained counter can.

// A visit that opened thirty products is somebody browsing the whole shop, and
// pairing all of them would say everything goes with everything. Sessions wider
// than this are left out of the graph entirely.
export const MAX_BASKET = 12;
// Below this a "pairing" is one person, once — noise wearing a recommendation's
// clothes.
export const MIN_SCORE = 2;
export const KEEP_PER_PRODUCT = 8;

/**
 * The co-view graph, as an unordered pair count.
 *
 * @param sessions [[productId, …], …] — the distinct products each visit opened
 * @returns Map "a|b" -> times the two were opened in one visit
 */
export function pairCounts(sessions = [], { maxBasket = MAX_BASKET } = {}) {
  const counts = new Map();
  for (const raw of sessions) {
    const ids = [...new Set(raw)].sort();
    if (ids.length < 2 || ids.length > maxBasket) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = `${ids[i]}|${ids[j]}`;
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * The pair counts as directed rows, thresholded and trimmed.
 *
 * Both directions are stored. It doubles the rows and removes every doubt at
 * read time about which way round a pair was written.
 */
export function affinityRows(counts, { minScore = MIN_SCORE, keep = KEEP_PER_PRODUCT } = {}) {
  const by = new Map();
  const add = (id, other, score) => {
    if (!by.has(id)) by.set(id, []);
    by.get(id).push({ other, score });
  };
  for (const [k, score] of counts) {
    if (score < minScore) continue;
    const [a, b] = k.split("|");
    add(a, b, score);
    add(b, a, score);
  }
  const rows = [];
  for (const [id, list] of by) {
    list.sort((x, y) => y.score - x.score || x.other.localeCompare(y.other));
    for (const r of list.slice(0, keep)) rows.push({ productId: id, otherId: r.other, score: r.score });
  }
  return rows;
}

/** Rebuild the whole graph from the window of visits still in the raw log. */
export async function rebuildAffinity(env, { days = 60 } = {}) {
  const db = env.DB;
  const rows = (await db.prepare(
    `SELECT e.session_id AS sid, e.product_id AS pid
       FROM session_events e JOIN sessions s ON s.id = e.session_id
      WHERE s.is_bot = 0 AND e.product_id IS NOT NULL
        AND e.type IN ('view_item','add_to_cart')
        AND e.at >= datetime('now', ?)
      ORDER BY e.session_id`
  ).bind(`-${Math.max(7, Math.min(365, days))} days`).all()).results;

  const bySession = new Map();
  for (const r of rows) {
    if (!bySession.has(r.sid)) bySession.set(r.sid, []);
    bySession.get(r.sid).push(r.pid);
  }
  const out = affinityRows(pairCounts([...bySession.values()]));

  // Only products still on the shop floor: a rail that recommends something
  // withdrawn is worse than a shorter rail.
  const live = new Set((await db.prepare("SELECT id FROM products WHERE live = 1").all()).results.map((p) => p.id));
  const keep = out.filter((r) => live.has(r.productId) && live.has(r.otherId));

  await db.prepare("DELETE FROM product_affinity").run();
  for (let i = 0; i < keep.length; i += 50) {
    await db.batch(keep.slice(i, i + 50).map((r) =>
      db.prepare("INSERT INTO product_affinity (product_id, other_id, score) VALUES (?, ?, ?)")
        .bind(r.productId, r.otherId, r.score)));
  }
  return { sessions: bySession.size, pairs: keep.length };
}

/** The whole graph, small enough to ship with the catalogue. */
export async function loadAffinity(db) {
  const rows = (await db.prepare(
    "SELECT product_id, other_id FROM product_affinity ORDER BY product_id, score DESC"
  ).all()).results;
  const by = {};
  for (const r of rows) (by[r.product_id] ||= []).push(r.other_id);
  return by;
}
