-- The scheduled ERPRev pull, switched on.
--
-- ERPRev's *Signing requests* page arrived, and the connector now signs every
-- call exactly as it specifies (worker/erp-adapters.js → signRequest). The pull
-- was left off while the signing was unknown; with it known, the house asked
-- for inventory to follow the ERP automatically. The cron calls it every 15
-- minutes and it runs every `erpSyncEveryMins` (60 by default).
--
-- What it does when it runs, so switching it on is safe to do blind:
--   · it only writes price and stock, and only onto sizes the shop already
--     sells that it can recognise exactly (worker/erp.js → matchToShop)
--   · ERP items the shop doesn't sell are left out (`erpImportNew` off)
--   · a pull that would cut the stock it manages by more than the guard is
--     refused and logged, with nothing written
--   · every run is a line in Admin → Integrations → Recent pulls
--
-- The negotiator's saved signing shape (`erpSigning`) has no meaning now that
-- the contract is fixed in code, so it goes.
UPDATE settings
   SET value = json_remove(json_patch(value, json_object('erpOn', '1', 'erpImportNew', '0')), '$.erpSigning')
 WHERE key = 'site';
