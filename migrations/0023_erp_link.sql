-- Sprint 3.9 — the ERP link.
--
-- See docs/SPRINT-3-PLAN.md §7. The ingest half has existed since 0010:
-- `POST /api/v1/catalog/sync` takes a flat SKU feed, groups it by the parent
-- code into variable products, upserts on the ERP's own identifiers so a retry
-- is free, and sets stock absolutely because the ERP is the system of record
-- for counts. What was missing was the *pull* — something that calls the ERP
-- rather than waiting to be called — and the two tables below, which are the
-- parts that decide whether a pull is safe to run unattended.
--
-- Nothing here is specific to any one ERP. The house runs **ERPRevolution
-- (ERPrev)**; an earlier plan had guessed ERPNext from the abbreviation and
-- been wrong, which is why the vendor is a setting read by an adapter rather
-- than anything baked into a schema. Changing it must never be a migration.

-- Which of the ERP's stock locations is which of our shops.
--
-- This is the single most consequential mapping in the connector and it cannot
-- be guessed: an ERP names its locations things like "Abuja Branch - Main"
-- and our shops are `abuja`, `lagos`, `ibadan`. Getting it wrong doesn't
-- error — it quietly puts one city's stock on another city's shelf and the
-- shop starts promising bottles that are somewhere else.
--
-- So locations are *discovered* (the connector lists them from the ERP, or
-- collects the names it sees on stock rows) and then assigned by hand in the
-- admin. One with no shop against it is ignored rather than defaulted:
-- counting unmapped stock into the default shop is exactly the failure this
-- table exists to prevent.
--
-- Named `erp_warehouses` because that is what the concept is called almost
-- everywhere, whatever a given ERP's screens say.
CREATE TABLE erp_warehouses (
  -- The location's name as the ERP gives it, which is how stock rows refer
  -- to it. Character for character — hence discovery rather than typing.
  -- **Whatever a stock row says**, which is not always a name. ERPRev's
  -- `/warehouses` gives `{id, name}` and its stock rows carry `warehouse_id`,
  -- so on that ERP this column holds the id. A map keyed on the readable name
  -- would be a map nothing ever matches, and every shop would come back empty
  -- with no error anywhere to explain it.
  warehouse   TEXT PRIMARY KEY,
  -- What a person should see next to it in the admin.
  label       TEXT NOT NULL DEFAULT '',
  -- Our shop id, or NULL for "seen in the ERP, not mapped, not counted".
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  is_group    INTEGER NOT NULL DEFAULT 0,
  disabled    INTEGER NOT NULL DEFAULT 0,
  seen_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_erp_warehouses_location ON erp_warehouses(location_id);

-- Which of the ERP's product categories is which of ours.
--
-- Softer than the location map — an unmapped category means the product lands
-- in the sync's default and somebody re-files it in the admin, which is an
-- inconvenience rather than a wrong promise. Discovered the same way, and
-- from the products themselves where the ERP has no category endpoint.
CREATE TABLE erp_item_groups (
  item_group  TEXT PRIMARY KEY,
  cat         TEXT REFERENCES categories(id) ON DELETE SET NULL,
  seen_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The sync log grows a direction and a duration, so "the hourly pull has been
-- failing since Tuesday" is a thing somebody can see rather than infer.
ALTER TABLE catalog_syncs ADD COLUMN direction TEXT NOT NULL DEFAULT 'push';
ALTER TABLE catalog_syncs ADD COLUMN ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE catalog_syncs ADD COLUMN ok INTEGER NOT NULL DEFAULT 1;
ALTER TABLE catalog_syncs ADD COLUMN note TEXT NOT NULL DEFAULT '';

-- Defaults, so the admin screen opens with sensible values rather than empty
-- boxes. Everything here is configuration; the API key and secret are Worker
-- secrets and are deliberately not in the database.
--
--   erpVendor          which adapter: erprev · erpnext · custom
--   erpOn              the scheduled pull runs (off until it has been tested)
--   erpBaseUrl         the ERP's API root, no trailing path
--   erpAuthStyle       how the credentials go on the wire — see erp-adapters.js
--   erpPageStyle       how the ERP pages a list endpoint
--   erpPaths           JSON: the list endpoint for each resource. Empty means
--                      "the adapter's default"; an empty `prices` means the
--                      price rides the product row, which is the usual shape
--   erpFields          JSON: per-field overrides, for an ERP whose spelling
--                      isn't one the reader already tries
--   erpEnvelopeKey     where the array sits in the response, if not obvious
--   erpCursorKey       where the next page's cursor sits, for a cursor API
--   erpPingPath        an endpoint that answers without credentials, so
--                      "can't reach it" and "won't accept this key" are two
--                      different answers rather than one 401
--   erpPageSize        rows per request (ERPRev caps a list at 200)
--   erpSigning         JSON: the canonical string and the four header names
--                      for a request-signed API. Configuration, because the
--                      exact byte order has to match the vendor's and a
--                      mismatch is a 401 on every call
--   erpPriceList       for an ERP that keeps several price lists
--   erpPublish         do items new to us go live, or land as drafts
--   erpDefaultCat      where an unmapped category files a new product
--   erpEmptyGuardPct   refuse a pull that would cut catalogue stock by more
--                      than this share. An expired key returning [] must not
--                      empty the shop; this is the line that stops it
--   erpSyncEveryMins   how often the cron actually calls out
--   erpLastSync        written by the connector, not by a person
UPDATE settings
   SET value = json_patch(value, json_object(
         'erpVendor', 'erprev',
         'erpOn', '0',
         'erpBaseUrl', '',
         'erpAuthStyle', '',
         'erpPageStyle', '',
         'erpPaths', '',
         'erpFields', '',
         'erpEnvelopeKey', '',
         'erpCursorKey', '',
         'erpPingPath', '',
         'erpPageSize', '',
         'erpSigning', '',
         'erpPriceList', '',
         'erpPublish', '0',
         'erpDefaultCat', 'perfumes',
         'erpEmptyGuardPct', 25,
         'erpSyncEveryMins', 60,
         'erpLastSync', ''
       ))
 WHERE key = 'site';
