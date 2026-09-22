-- Sprint 3.9 — the ERPNext link.
--
-- See docs/SPRINT-3-PLAN.md §7. The ingest half has existed since 0010:
-- `POST /api/v1/catalog/sync` takes a flat SKU feed, groups it by the parent
-- code into variable products, upserts on the ERP's own identifiers so a retry
-- is free, and sets stock absolutely because the ERP is the system of record
-- for counts. What was missing was the *pull* — something that calls ERPNext
-- rather than waiting to be called — and the two tables below, which are the
-- parts that decide whether a pull is safe to run unattended.

-- Which ERPNext warehouse is which of our stores.
--
-- This is the single most consequential mapping in the connector and it cannot
-- be guessed: ERPNext warehouses are named things like "Stores - MR" and
-- "Abuja Branch - MR", and our stores are `abuja`, `lagos`, `ibadan`. Getting
-- it wrong doesn't error — it quietly puts Lagos's stock on Abuja's shelf and
-- the shop starts promising bottles that are in another city.
--
-- So warehouses are *discovered* (the connector lists them from ERPNext) and
-- then assigned by hand in the admin. A warehouse with no store against it is
-- ignored rather than defaulted: counting stock nobody has mapped into the
-- default store is exactly the failure this table exists to prevent.
CREATE TABLE erp_warehouses (
  -- The warehouse's ERPNext name, which is its primary key there too.
  warehouse   TEXT PRIMARY KEY,
  -- Our store id, or NULL for "seen in ERPNext, not mapped, not counted".
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  -- What ERPNext last told us about it, for the admin to show.
  is_group    INTEGER NOT NULL DEFAULT 0,
  disabled    INTEGER NOT NULL DEFAULT 0,
  seen_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_erp_warehouses_location ON erp_warehouses(location_id);

-- Which ERPNext item group is which of our categories.
--
-- Softer than the warehouse map — an unmapped group means the product lands in
-- whatever category the sync's default is and somebody re-files it in the
-- admin, which is an inconvenience rather than a wrong promise. Discovered the
-- same way.
CREATE TABLE erp_item_groups (
  item_group  TEXT PRIMARY KEY,
  cat         TEXT REFERENCES categories(id) ON DELETE SET NULL,
  seen_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The sync log grows a direction and a duration, so "the 15-minute pull has
-- been failing since Tuesday" is a thing somebody can see rather than infer.
ALTER TABLE catalog_syncs ADD COLUMN direction TEXT NOT NULL DEFAULT 'push';
ALTER TABLE catalog_syncs ADD COLUMN ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE catalog_syncs ADD COLUMN ok INTEGER NOT NULL DEFAULT 1;
ALTER TABLE catalog_syncs ADD COLUMN note TEXT NOT NULL DEFAULT '';

-- Defaults, so the admin screen opens with sensible numbers in it rather than
-- empty boxes. Everything here is configuration; the API key and secret are
-- Worker secrets and are deliberately not in the database.
--
--   erpOn              the scheduled pull runs (off until it has been tested)
--   erpBaseUrl         https://majesticroobee.erpnext.com — no trailing path
--   erpPriceList       which ERPNext Price List is the web price
--   erpPublish         do items new to us go live, or land as drafts
--   erpDefaultCat      where an unmapped item group files a new product
--   erpEmptyGuardPct   refuse a pull that would cut catalogue stock by more
--                      than this share. An expired key returning [] must not
--                      empty the shop; this is the line that stops it.
--   erpSyncEveryMins   how often the cron actually calls out
--   erpLastSync        the high-water mark for the incremental read
UPDATE settings
   SET value = json_patch(value, json_object(
         'erpOn', '0',
         'erpBaseUrl', '',
         'erpPriceList', 'Standard Selling',
         'erpPublish', '0',
         'erpDefaultCat', 'perfumes',
         'erpEmptyGuardPct', 25,
         'erpSyncEveryMins', 60,
         'erpLastSync', ''
       ))
 WHERE key = 'site';
