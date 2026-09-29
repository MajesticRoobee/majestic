-- Where each order came from, and whether Meta has been told about it.
--
-- The storefront notes how a shopper arrived — an ad's click id (fbclid,
-- gclid, ttclid), the link's utm_ tags, or the site that referred them — and
-- sends it with the order. The shop reads it back as "Meta ads", "Google ads",
-- "Instagram", "Direct" and so on (worker/attribution.js), in the order list
-- and in Insights → Sales by source.
--
-- The meta_* columns are the Conversions API's: the server tells Meta about a
-- purchase once, under the order number, so the browser's pixel event and the
-- server's are counted as one. It only happens for a shopper who accepted
-- marketing cookies (ad_consent); their address and browser, needed for Meta
-- to match the sale to an ad, are held only until the event is sent.

ALTER TABLE orders ADD COLUMN src_source   TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN src_medium   TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN src_campaign TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN src_click    TEXT NOT NULL DEFAULT '';   -- fbclid | gclid | ttclid | ''
ALTER TABLE orders ADD COLUMN src_click_id TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN src_referrer TEXT NOT NULL DEFAULT '';   -- host only
ALTER TABLE orders ADD COLUMN src_landing  TEXT NOT NULL DEFAULT '';   -- path only
ALTER TABLE orders ADD COLUMN src_fbc      TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN src_fbp      TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN ad_consent   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN capi_ip      TEXT;
ALTER TABLE orders ADD COLUMN capi_ua      TEXT;
ALTER TABLE orders ADD COLUMN meta_sent_at TEXT;
ALTER TABLE orders ADD COLUMN meta_result  TEXT;
