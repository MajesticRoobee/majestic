-- Sprint 3.3 — F4, the behavioural stream.
--
-- See docs/SPRINT-3-PLAN.md §1.
--
-- The store records what the *business* did — an order was placed, a status
-- changed, a cart with a name on it went cold. What nothing records is what a
-- *visitor* did. That is why the client's first ask cannot be answered today:
-- "who came in, clicked around and left without adding anything" has no data
-- behind it, and `abandoned_checkouts` only ever sees someone who has already
-- typed their name and contact into the checkout form.
--
-- Third-party pixels see some of it. That data lives in someone else's
-- dashboard, is blocked for a large share of real traffic, dies behind the
-- cookie banner, and can never be joined to a customer record or acted on by
-- the store. So this is first-party: the shop's own visitors, on the shop's own
-- domain, in the shop's own database, shared with nobody.

-- One visit. `visitor_id` is a random first-party id kept in the browser; it
-- means nothing outside this store and carries no personal detail.
CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,            -- uuid minted by the browser
  visitor_id   TEXT NOT NULL,
  -- Filled in the moment the visitor identifies themselves — signing in,
  -- registering, or placing an order. Every *earlier* session on the same
  -- visitor_id is stitched at the same time, which is what turns "someone
  -- looked at this four times" into "this customer looked at this four times".
  customer_id  INTEGER,
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen    TEXT NOT NULL DEFAULT (datetime('now')),
  entry_path   TEXT NOT NULL DEFAULT '',
  referrer     TEXT NOT NULL DEFAULT '',    -- host only; never the full URL
  utm_source   TEXT NOT NULL DEFAULT '',
  utm_medium   TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  device       TEXT NOT NULL DEFAULT '',    -- phone | tablet | desktop
  country      TEXT NOT NULL DEFAULT '',    -- from Cloudflare, never an IP
  city_pref    TEXT NOT NULL DEFAULT '',    -- the store the shopper is browsing
  is_bot       INTEGER NOT NULL DEFAULT 0,
  -- Kept on the row so a segment can be a single indexed read rather than a
  -- scan of the event log.
  views        INTEGER NOT NULL DEFAULT 0,  -- product views
  carts        INTEGER NOT NULL DEFAULT 0,  -- add-to-carts
  checkouts    INTEGER NOT NULL DEFAULT 0,
  orders       INTEGER NOT NULL DEFAULT 0,
  revenue      INTEGER NOT NULL DEFAULT 0,
  cart_value   INTEGER NOT NULL DEFAULT 0,  -- what was left behind, if anything
  recovered    INTEGER NOT NULL DEFAULT 0   -- a recovery message has been sent
);
CREATE INDEX idx_sessions_visitor ON sessions(visitor_id);
CREATE INDEX idx_sessions_customer ON sessions(customer_id);
CREATE INDEX idx_sessions_seen ON sessions(last_seen);
CREATE INDEX idx_sessions_bot ON sessions(is_bot, last_seen);

-- What happened, in order. No personal detail ever lands here: ids, types,
-- paths and amounts only.
CREATE TABLE session_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type       TEXT NOT NULL,
  product_id TEXT,
  variant_id INTEGER,
  value_ngn  INTEGER NOT NULL DEFAULT 0,
  meta       TEXT NOT NULL DEFAULT '{}',
  at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sev_session ON session_events(session_id, id);
CREATE INDEX idx_sev_type_at ON session_events(type, at);
CREATE INDEX idx_sev_product ON session_events(product_id, type);

-- The rollup the admin reads.
--
-- D1 is SQLite. A dashboard that scans raw events is fine at a thousand
-- sessions and unusable at a million, and by then the fix is a rewrite. So the
-- cron folds each day down to this, the raw log is pruned on a window the house
-- sets, and these rows are kept for good.
CREATE TABLE insight_daily (
  day    TEXT NOT NULL,
  metric TEXT NOT NULL,              -- visitors | sessions | views | carts | checkouts | orders | revenue | source | product_view | product_cart | search_miss
  dim    TEXT NOT NULL DEFAULT '',   -- the product, the source, the search term…
  value  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric, dim)
);
CREATE INDEX idx_insight_metric ON insight_daily(metric, day);

-- How far back a *raw* event is kept, whether the stream runs at all, and how
-- long a cart sits before it counts as abandoned. Rollups are never pruned.
UPDATE settings SET value = json_set(value,
  '$.insightsOn',        json('true'),
  '$.insightsRetainDays', 90,
  '$.abandonAfterMins',   45
) WHERE key = 'site' AND json_extract(value, '$.insightsOn') IS NULL;

-- A last-seen marker for the rollup, so a run only folds what it has not
-- already folded and re-running it is harmless.
INSERT INTO settings (key, value) VALUES ('insights', '{}')
  ON CONFLICT(key) DO NOTHING;
