-- Give production's erp_warehouses the `label` column the code has used since
-- 22 Sep.
--
-- Migration 0023 was edited after it had already run in production: the first
-- version (cc48909) created erp_warehouses without `label`, a later commit the
-- same day (e846edb) added it *to 0023 itself*. D1 applies a migration once, by
-- file name, so production never saw the edit — while every fresh database
-- (local, CI) did. The result was a schema difference nobody could see from the
-- repo: in production every write that names a location — "Fetch locations",
-- the pull recording what it saw, a webhook meeting a new warehouse — failed
-- with "no such column: label". A comparison of production's schema with a
-- freshly migrated one found this to be the only difference.
--
-- `ALTER TABLE … ADD COLUMN label` would fix production and break every fresh
-- database ("duplicate column"), so the table is rebuilt instead, which is
-- correct in both. The copy names only the columns both versions have; a label
-- lost on a fresh database is refilled by the next pull.
--
-- The rule this leaves behind: a migration that has shipped is never edited.
-- A change is a new file.
CREATE TABLE erp_warehouses_v2 (
  warehouse   TEXT PRIMARY KEY,
  label       TEXT NOT NULL DEFAULT '',
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  is_group    INTEGER NOT NULL DEFAULT 0,
  disabled    INTEGER NOT NULL DEFAULT 0,
  seen_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO erp_warehouses_v2 (warehouse, location_id, is_group, disabled, seen_at)
  SELECT warehouse, location_id, is_group, disabled, seen_at FROM erp_warehouses;
DROP TABLE erp_warehouses;
ALTER TABLE erp_warehouses_v2 RENAME TO erp_warehouses;
CREATE INDEX idx_erp_warehouses_location ON erp_warehouses(location_id);
