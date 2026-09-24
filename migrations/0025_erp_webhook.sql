-- The ERP link — the push half (worker/erp-webhook.js).
--
-- ERPRev calls `POST /api/erp/webhook` on every stock move and price change,
-- and the shop applies it within seconds. The scheduled pull stays on as the
-- reconciler; this is what makes the shelf agree *now*.

-- Every delivery, whether it was trusted and what it changed — the shop's half
-- of ERPRev's own delivery log, so "is the ERP actually talking to us" is a
-- list somebody can read. `delivery_id` makes a retried delivery a no-op.
CREATE TABLE erp_webhook_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id  TEXT UNIQUE,
  event        TEXT NOT NULL DEFAULT '',
  ok           INTEGER NOT NULL DEFAULT 0,
  auth         TEXT NOT NULL DEFAULT '',   -- which proof it carried
  applied      INTEGER NOT NULL DEFAULT 0, -- rows it changed
  note         TEXT NOT NULL DEFAULT '',
  received_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_erp_webhook_events_at ON erp_webhook_events(received_at);

-- When each SKU's count at each shop was last set by an ERP event. Webhooks
-- arrive out of order and get retried; without this a late retry of an old
-- event would put back a count the ERP had already moved past.
CREATE TABLE erp_stock_marks (
  variant_id   INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  location_id  TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  at_ms        INTEGER NOT NULL,
  PRIMARY KEY (variant_id, location_id)
);

-- Where ERP stock goes when there is no other shop it could belong to: a row
-- naming no location, or an ERP that has only ever shown one. The house asked
-- for ERPRev's stock to feed Abuja. Two or more ERP locations still have to be
-- mapped by hand — see `effectiveWarehouseMap` in worker/erp.js.
UPDATE settings
   SET value = json_patch(value, json_object('erpDefaultShop', 'abuja'))
 WHERE key = 'site' AND json_extract(value, '$.erpDefaultShop') IS NULL;
