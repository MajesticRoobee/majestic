-- Storefront expansion: a merchandising header, a blog, curated deals,
-- embedded testimonials, brands, and live purchase proof.
--
-- The shape of the shop changes here. Until now the storefront had one way in
-- (the shop grid) and one axis to narrow it by (category). The house wants the
-- header a fragrance shopper expects — categories with sub-shelves under them,
-- new arrivals, hot deals, best sellers, brands and stores — plus editorial
-- (a blog) and social proof (Instagram embeds, and a note when someone buys).
--
-- Almost none of that is new *data*: "new arrivals" is the catalogue sorted by
-- age, "best sellers" is the order book counted, "deals" is a markdown with a
-- window on it. So this migration adds the few columns those readings need and
-- the three tables that hold genuinely new content, and leaves every existing
-- row answering exactly as it did.

-- ---- 1. Products: a brand, and manual override of the automatic shelves ----
--
-- Brand is the shopper's other way in — "show me everything by X" — and for a
-- house that blends designer-inspired oils it is the label on the bottle, not
-- the category. Empty on every existing product, which reads as "the house's
-- own", and the brands page simply doesn't list an empty brand.
ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT '';

-- New arrivals and best sellers are computed (see worker/merch.js). These two
-- are the manual thumb on the scale: a pin puts a product on that shelf
-- whatever the arithmetic says — for a launch with no sales yet, or a piece the
-- house wants read as new after its listing date has aged.
ALTER TABLE products ADD COLUMN pin_new INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN pin_best INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_products_brand ON products(brand);

-- ---- 2. Categories become the house's own, editable, with sub-shelves ------
--
-- The category list was seeded and then fixed — the admin could file a product
-- under one but never add, rename, describe or retire one. These columns make
-- the row self-describing so the storefront's mega-menu can be built from the
-- table alone.
--
-- `grp` groups categories the way a promo scope does ('fragrance' | 'gift' |
-- 'care'), and is what "Gift sets" reads to know which categories are sets.
-- `subcats` is the JSON list of default sub-shelves offered under this category
-- — every category opens with all three, and the admin can drop any of them.
ALTER TABLE categories ADD COLUMN descr TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN live INTEGER NOT NULL DEFAULT 1;
ALTER TABLE categories ADD COLUMN image_url TEXT;
ALTER TABLE categories ADD COLUMN grp TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN subcats TEXT NOT NULL DEFAULT '["new-arrivals","best-sellers","gift-sets"]';

-- The groupings the promo scopes already assume, written down once.
UPDATE categories SET grp = 'fragrance' WHERE id IN ('extrait', 'designer', 'custom-oil', 'mist');
UPDATE categories SET grp = 'gift'      WHERE id IN ('fragrance-set', 'mist-set', 'custom-oil-set', 'gift-set');
UPDATE categories SET grp = 'care'      WHERE id IN ('care', 'deo');

-- ---- 3. Deals — a markdown the house runs for a period --------------------
--
-- Distinct from a promo code: a promo is something the shopper types, a deal is
-- something they *see*. A deal names products, carries a badge and a window,
-- and the Deals tab shows whatever is inside its window right now. Nothing
-- needs ending by hand.
CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  descr TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT 'Hot deal',
  starts_at TEXT,                   -- YYYY-MM-DD, inclusive; NULL = already on
  ends_at TEXT,                     -- YYYY-MM-DD, inclusive; NULL = until ended
  status TEXT NOT NULL DEFAULT 'Active',   -- Active | Ended
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE deal_products (
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (deal_id, product_id)
);
CREATE INDEX idx_deal_products ON deal_products(deal_id, sort);

-- ---- 4. The blog ----------------------------------------------------------
--
-- Slug is the URL and the identity, so an edit to the title never breaks a
-- shared link unless the house deliberately changes the slug. `body` is plain
-- text with blank lines between paragraphs; the storefront renders paragraphs,
-- headings (a line starting '## ') and images (a line that is only a URL).
CREATE TABLE blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  author TEXT NOT NULL DEFAULT 'Majestic Roobee',
  tags TEXT NOT NULL DEFAULT '',    -- comma-separated
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | published
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_blog_status ON blog_posts(status, published_at);

-- ---- 5. Reviews & testimonials, as embeds ---------------------------------
--
-- The house's proof lives on Instagram and TikTok, so a testimonial here is
-- usually a *reference* to a post rather than text we hold: kind 'instagram' |
-- 'tiktok' | 'youtube' | 'video' | 'quote'. `ref` is the parsed post id for the
-- embeddable kinds (worker/merch.js does the parsing) and the embed is built
-- from it, so a pasted URL with tracking parameters on it still renders.
CREATE TABLE testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'quote',
  url TEXT NOT NULL DEFAULT '',
  ref TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  handle TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5,
  city TEXT NOT NULL DEFAULT '',
  product_id TEXT,
  thumb_url TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  live INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_testimonials_live ON testimonials(live, sort);

-- ---- 6. Stores: what a customer needs to walk into one --------------------
--
-- The stores page shows an address a shopper can act on. Opening hours and a
-- map link are the two things it was missing.
ALTER TABLE locations ADD COLUMN hours TEXT NOT NULL DEFAULT '';
ALTER TABLE locations ADD COLUMN maps_url TEXT NOT NULL DEFAULT '';
