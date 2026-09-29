-- The ERP link is the scheduled API pull alone.
--
-- 0025 added a second, inbound transport: ERPRev posting stock and price
-- changes to /api/erp/webhook. ERPRev only offers outgoing webhooks on its
-- Ultimate plan, which the house is not on, so no delivery from ERPRev ever
-- arrived — the only rows ever logged were the deploy's own forged test post,
-- refused. The route and its code are gone (worker/erp-webhook.js), and with
-- them the two tables only it used:
--
--   erp_webhook_events  the delivery log
--   erp_stock_marks     per-shelf timestamps that stopped an older delivery
--                       from undoing a newer one — the pull sets counts
--                       absolutely each run and never read these.
--
-- The pull's own tables (erp_warehouses, erp_item_groups, catalog_syncs) and
-- every product and size already linked to the ERP are untouched.

DROP INDEX IF EXISTS idx_erp_webhook_events_at;
DROP TABLE IF EXISTS erp_webhook_events;
DROP TABLE IF EXISTS erp_stock_marks;
