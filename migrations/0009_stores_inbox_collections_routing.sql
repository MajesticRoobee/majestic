-- Stores as data, an archivable inbox, collections, and split-shipment orders.
--
-- Four small additions and one real one. The real one is order_shipments: an
-- order used to ship from exactly one store (orders.fulfilled_from), which is
-- only true while every item can be found in one place. A growing catalogue
-- across three stores makes that the exception, so an order now carries one row
-- per parcel. fulfilled_from stays and holds the *primary* parcel's store, so
-- every existing order, the dashboard scoping and the partner API keep working.

-- 1. Inbox archive. Conversations are archived, never deleted — the thread is
--    the customer record.
ALTER TABLE inquiries ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;

-- 2. Stores can be retired. A store that has ever fulfilled an order cannot be
--    deleted without orphaning that history, so it is deactivated instead:
--    hidden from the storefront and from routing, still readable on old orders.
ALTER TABLE locations ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

-- 3. Collections — curated sets that sit above the catalogue in the shop.
--    Separate from `categories` on purpose: a category is where a product
--    lives (one each), a collection is an editorial grouping (many, overlapping).
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  descr TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  live INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE collection_products (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);
CREATE INDEX idx_collection_products ON collection_products(collection_id, sort);

-- 4. One row per parcel. `ship_ngn` is what that parcel cost the buyer, so the
--    order's shipping line is always the sum of its shipments.
CREATE TABLE order_shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL REFERENCES orders(no) ON DELETE CASCADE,
  location_id TEXT NOT NULL,
  ship_ngn INTEGER NOT NULL DEFAULT 0,
  eta TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_order_shipments ON order_shipments(order_no);

-- Which store each line ships from. NULL on historical orders, which all
-- shipped whole from orders.fulfilled_from.
ALTER TABLE order_items ADD COLUMN location_id TEXT;
