-- Variations become products in their own right.
--
-- Until now a variant was a price row: (product_id, size, price_ngn), identified
-- everywhere by the *string pair* (productId, size). That made a variation
-- impossible to give its own photo, impossible to address from an ERP, and
-- fragile — renaming a size orphaned every cart and order line holding it.
--
-- This migration gives each variation the attributes of a product (SKU, own
-- imagery, own ERP identity, own sort order, own active flag) while keeping it
-- attached to a parent product, so the storefront can still present one listing
-- with a picker. `size` is retained as the variant's *display label* and is kept
-- in sync with the option columns, so existing carts, order history and the
-- UNIQUE(product_id, size) constraint all keep working.

-- ---- Products: option naming, listing style, ERP identity ----

-- What the options on this product are called, as a JSON array. Almost always
-- ["Size"]; a product with a second axis reads ["Size","Cap"].
ALTER TABLE products ADD COLUMN option_names TEXT NOT NULL DEFAULT '["Size"]';

-- Opt-in: list every variation as its own card in the shop grid rather than one
-- card with a picker. Off by default — for gift sets and distinct scents where a
-- picker would hide what the shopper is actually choosing between.
ALTER TABLE products ADD COLUMN split_listing INTEGER NOT NULL DEFAULT 0;

-- The ERP's parent/style code, and which system it came from. Sync upserts on
-- (external_source, external_id) so re-running an import is always idempotent.
ALTER TABLE products ADD COLUMN external_id TEXT;
ALTER TABLE products ADD COLUMN external_source TEXT;
CREATE UNIQUE INDEX idx_products_external ON products(external_source, external_id)
  WHERE external_id IS NOT NULL;

-- ---- Variants: SKU-level identity ----

ALTER TABLE variants ADD COLUMN sku TEXT;
ALTER TABLE variants ADD COLUMN external_id TEXT;
ALTER TABLE variants ADD COLUMN external_source TEXT;
ALTER TABLE variants ADD COLUMN image_url TEXT;
ALTER TABLE variants ADD COLUMN option1 TEXT;
ALTER TABLE variants ADD COLUMN option2 TEXT;
ALTER TABLE variants ADD COLUMN option3 TEXT;
ALTER TABLE variants ADD COLUMN compare_at_ngn INTEGER;   -- was-price, for markdowns
ALTER TABLE variants ADD COLUMN sort INTEGER NOT NULL DEFAULT 0;
ALTER TABLE variants ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- Backfill: today's single free-text `size` is the first option.
UPDATE variants SET option1 = size WHERE option1 IS NULL;

-- Backfill SKUs. Derived from the product slug and the size label, so they are
-- human-readable in the admin and in the ERP; UNIQUE(product_id, size) upstream
-- guarantees these do not collide.
UPDATE variants
   SET sku = product_id || '-' || lower(replace(replace(size, ' ', ''), '/', '-'))
 WHERE sku IS NULL;

-- Preserve today's ordering (insertion order) as the explicit sort.
UPDATE variants SET sort = id WHERE sort = 0;

CREATE UNIQUE INDEX idx_variants_sku ON variants(sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_variants_external ON variants(external_source, external_id)
  WHERE external_id IS NOT NULL;

-- ---- Imagery: a gallery per product, each shot optionally tied to a variant ----

CREATE TABLE product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- NULL = a shared shot shown for every variation; set = shown when that
  -- variation is selected.
  variant_id INTEGER REFERENCES variants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_product_images_product ON product_images(product_id, sort);
CREATE INDEX idx_product_images_variant ON product_images(variant_id);

-- Seed the gallery from the single photo products carry today.
INSERT INTO product_images (product_id, variant_id, url, alt, sort)
SELECT id, NULL, image_url, name, 0 FROM products
 WHERE image_url IS NOT NULL AND image_url <> '';

-- ---- Traceability: tie order lines and waitlist entries to the variant ----

ALTER TABLE order_items ADD COLUMN variant_id INTEGER;
ALTER TABLE order_items ADD COLUMN sku TEXT;
ALTER TABLE stock_waitlist ADD COLUMN variant_id INTEGER;

UPDATE order_items
   SET variant_id = (SELECT v.id FROM variants v WHERE v.product_id = order_items.product_id AND v.size = order_items.size),
       sku        = (SELECT v.sku FROM variants v WHERE v.product_id = order_items.product_id AND v.size = order_items.size)
 WHERE variant_id IS NULL;

UPDATE stock_waitlist
   SET variant_id = (SELECT v.id FROM variants v WHERE v.product_id = stock_waitlist.product_id AND v.size = stock_waitlist.size)
 WHERE variant_id IS NULL AND size IS NOT NULL;

-- ---- ERP catalogue sync audit ----

CREATE TABLE catalog_syncs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  products_created INTEGER NOT NULL DEFAULT 0,
  variants_created INTEGER NOT NULL DEFAULT 0,
  variants_updated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  errors TEXT NOT NULL DEFAULT '[]',
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_catalog_syncs_at ON catalog_syncs(at);
