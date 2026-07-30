-- Tag the rows that migration 0002 seeded, so "clear the demo data" can remove
-- the samples without touching anything the shop has created since. The seed ran
-- before the store served anyone, so for the auto-increment tables every seeded
-- row sits below the first real one.
ALTER TABLE products            ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders              ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inquiries           ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE abandoned_checkouts ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE promos              ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns           ADD COLUMN seeded INTEGER NOT NULL DEFAULT 0;

UPDATE products SET seeded = 1 WHERE id IN ('amouage-decision', 'pdm-valaya', 'flames', 'ani-nishane', 'bare-secret', 'hypnotic-poison', 'pulze', 'addictive-ambergris', 'imagination-lv', 'pacific-chill', 'reef-33', 'addicted-to-you', 'night-fire', 'hello-freshpits', 'armpitox', 'opulent-peach', 'opulent-combo');
UPDATE orders   SET seeded = 1 WHERE no IN ('MR-10234', 'MR-10233', 'MR-10232', 'MR-10231', 'MR-10230', 'MR-10229', 'MR-10228', 'MR-10227', 'MR-10226', 'MR-10225', 'MR-10224', 'MR-10223', 'MR-10222', 'MR-10221', 'MR-10220', 'MR-10219');
UPDATE promos   SET seeded = 1 WHERE code IN ('QUEEN10', 'FIRSTTRAIL', 'OPULENT25', 'EIDROYALE');
UPDATE inquiries           SET seeded = 1 WHERE id <= 5;
UPDATE abandoned_checkouts SET seeded = 1 WHERE id <= 4;
UPDATE campaigns           SET seeded = 1 WHERE id <= 4;
