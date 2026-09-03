-- Daily deals: the countdown card on the homepage, and the storefront layout
-- the redesign lands on.
--
-- A *deal* (0013) is a shelf: several products, a badge, a window measured in
-- whole days. A *daily deal* is a single piece, spotlit for a few hours, with a
-- clock running down beside it. It is one product, one variation, one price and
-- one deadline — so it gets its own small table rather than another shape
-- bolted onto `deals`.
--
-- The price named here is the price everywhere: worker/shop.js overlays it on
-- the catalogue before anything reads it, so the grid, the product page, the
-- cart and the Paystack charge cannot disagree with the countdown card.

CREATE TABLE daily_deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Which variation is on offer. NULL means the product's first active one,
  -- which is what a single-size piece wants and never has to be chosen.
  variant_id INTEGER REFERENCES variants(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT 'Daily Deal',
  -- The offer price, and the price struck through beside it. Either may be
  -- NULL: the variation's own price / compare-at is then what shows, which is
  -- how you spotlight a markdown that already exists without restating it.
  price_ngn INTEGER,
  compare_at_ngn INTEGER,
  -- 'YYYY-MM-DDTHH:MM' in WAT — the house's own clock, same as every other
  -- window in this schema. ends_at is what the countdown counts down to.
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled',   -- Scheduled | Paused
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The storefront asks one question of this table — "what is running right
-- now?" — on every page load, so the window is the index.
CREATE INDEX idx_daily_deals_window ON daily_deals(status, starts_at, ends_at);

-- ---- The redesigned homepage ---------------------------------------------
--
-- The client's redesign puts a banner hero between the category rail and the
-- daily-deal card, so it becomes the layout the store opens on. Only a store
-- still sitting on the old default is moved; a house that deliberately chose
-- the full-bleed or product-led hero keeps it.
UPDATE settings
   SET value = json_set(
         value,
         '$.heroDirection', 'storefront grid',
         '$.dailyDealOn',   json('true'),
         '$.dailyDealAuto', json('true')
       )
 WHERE key = 'site'
   AND COALESCE(json_extract(value, '$.heroDirection'), 'editorial split') = 'editorial split';

-- Stores on another hero still get the daily-deal switches, defaulted on.
UPDATE settings
   SET value = json_set(value, '$.dailyDealOn', json('true'), '$.dailyDealAuto', json('true'))
 WHERE key = 'site'
   AND json_extract(value, '$.dailyDealOn') IS NULL;
