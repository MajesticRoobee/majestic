-- Sprint 3.2 — the home page becomes data.
--
-- See docs/SPRINT-3-PLAN.md §4.
--
-- Two asks turned out to be the same ask. "Let us choose which products show
-- under Best sellers and Ready at your store" and "make the home fragrance
-- banner look like the feminine care one, and let us change those pictures"
-- are both the same sentence: *the home page is written into a file*. Every
-- heading, every band, the order they run in and which three tiles sit under
-- the hero were all JSX, so each of them was a deploy.
--
-- They are rows now. Seeded to exactly what is on the screen today — nothing
-- changes visually until somebody changes it — and then editable from
-- Admin → Home page.

CREATE TABLE home_blocks (
  id         TEXT PRIMARY KEY,
  -- What kind of thing this is, which decides how it is drawn:
  --   tile       a promo tile under the hero (image, kicker, title, a target)
  --   band       copy on one side; products or nothing on the other
  --   shelf      a heading and a row of product cards
  -- ...and the blocks whose body is structural rather than editable, which
  -- carry only their heading, their order and their on/off switch:
  --   perks · categories · story · rewards · reviews · blog · newsletter · instagram
  kind       TEXT NOT NULL,
  -- 'product-band' shows the bottles beside the copy (feminine care);
  -- 'cta-band' is the plain heading-and-button. Only read for kind='band'.
  layout     TEXT NOT NULL DEFAULT 'product-band',
  -- Where a band or a shelf gets its products:
  --   segment     ref_id is one of the computed shelves (best-sellers, deals…)
  --   category    ref_id is a category; its whole family counts
  --   collection  ref_id is a curated collection
  --   in-city     whatever is on the shelf in the shopper's own city
  --   manual      the list in home_block_products, in that order
  source     TEXT NOT NULL DEFAULT 'segment',
  ref_id     TEXT NOT NULL DEFAULT '',
  count      INTEGER NOT NULL DEFAULT 4,
  eyebrow    TEXT NOT NULL DEFAULT '',
  title      TEXT NOT NULL DEFAULT '',
  sub        TEXT NOT NULL DEFAULT '',
  -- A band runs one or more short lines under its heading. One per line.
  lines      TEXT NOT NULL DEFAULT '',
  cta_label  TEXT NOT NULL DEFAULT '',
  -- Where the button and the "see all" link go: a storefront path.
  cta_target TEXT NOT NULL DEFAULT '',
  image_url  TEXT,
  -- A band on the deep purple wash reads as a feature; on the card it reads as
  -- a note. Only meaningful for kind='band'.
  dark       INTEGER NOT NULL DEFAULT 1,
  sort       INTEGER NOT NULL DEFAULT 0,
  live       INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_home_blocks_sort ON home_blocks(sort, id);

-- A hand-picked shelf, in the house's own order.
CREATE TABLE home_block_products (
  block_id   TEXT NOT NULL REFERENCES home_blocks(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (block_id, product_id)
);
CREATE INDEX idx_home_block_products ON home_block_products(block_id, sort);

-- ---- The home page as it stands today -------------------------------------
--
-- Sorts leave room between them so a block can be dropped in without
-- renumbering the rest.

-- The three tiles under the hero. Their pictures were three fixed settings
-- keys (promoTileDeals / promoTileNew / promoTileSets) and the tiles
-- themselves could not be renamed, reordered, switched off or added to. The
-- images are carried across below so nothing goes blank on deploy.
INSERT INTO home_blocks (id, kind, source, ref_id, eyebrow, title, cta_target, sort) VALUES
  ('tile-deals', 'tile', 'segment', 'deals',        'On sale now',   'Deals',        '/deals', 10),
  ('tile-new',   'tile', 'segment', 'new-arrivals', 'Just in',       'New Arrivals', '/new-arrivals', 20),
  ('tile-sets',  'tile', 'segment', 'gift-sets',    'Ready to give', 'Gift Sets',    '/gift-sets', 30);

UPDATE home_blocks SET image_url = (SELECT json_extract(value, '$.promoTileDeals') FROM settings WHERE key='site') WHERE id='tile-deals';
UPDATE home_blocks SET image_url = (SELECT json_extract(value, '$.promoTileNew')   FROM settings WHERE key='site') WHERE id='tile-new';
UPDATE home_blocks SET image_url = (SELECT json_extract(value, '$.promoTileSets')  FROM settings WHERE key='site') WHERE id='tile-sets';

-- The flow of the page, in the order it runs.
INSERT INTO home_blocks (id, kind, source, ref_id, count, layout, dark, eyebrow, title, sub, lines, cta_label, cta_target, sort) VALUES
  ('perks', 'perks', 'segment', '', 0, 'product-band', 1, '', '', '', '', '', '', 100),

  ('categories', 'categories', 'segment', '', 0, 'product-band', 1,
   'Shop by category', 'Find Your Fragrance',
   'Whatever you''re in the mood for, there''s a fragrance for it.', '', '', '', 200),

  ('band-care', 'band', 'category', 'care', 3, 'product-band', 1,
   'Feminine care', 'The products your intimate area needs', '',
   'Looking for a safe product for your intimate area?
Shop our plant-based and non-toxic intimate care.',
   'Shop feminine care', '/shop?category=care', 300),

  ('shelf-best', 'shelf', 'segment', 'best-sellers', 4, 'product-band', 1,
   'Best sellers', 'The fragrance everyone is talking about',
   'Not sure where to start? Start with the fragrances our customers keep coming back for.',
   '', 'Shop best sellers', '/best-sellers', 400),

  -- {city} is filled in with wherever the shopper is shopping, so this heading
  -- stays true when they switch store.
  ('shelf-in-city', 'shelf', 'in-city', '', 4, 'product-band', 1,
   'In {city} now', 'Ready at your store today', '',
   '', 'View all products', '/shop', 500),

  -- The title is left empty on purpose: a single running deal names itself, and
  -- "Hot deals" is what is used when there is more than one, or none.
  ('shelf-deals', 'shelf', 'segment', 'deals', 4, 'product-band', 1,
   'On sale now', '', '', '', 'See all deals', '/deals', 600),

  ('cta-personality', 'band', 'none', '', 0, 'cta-band', 1,
   '', 'What''s your fragrance personality?', '',
   'Are you soft and feminine? Warm and sensual? Fresh and effortless? Bold and commanding?
There''s a fragrance for every version of you.',
   'Find your signature scent', '/shop?category=perfumes', 700),

  -- Home fragrance, sold the way feminine care is sold rather than as a bare
  -- heading and a button.
  ('band-home', 'band', 'category', 'home', 3, 'product-band', 1,
   'Home fragrance', 'Your home deserves a signature scent too', '',
   'Explore our collection of home fragrances created to make your space feel warmer, fresher and more inviting.',
   'Shop home fragrance', '/shop?category=home', 800),

  ('story', 'story', 'segment', '', 0, 'product-band', 1,
   'Our story', '', '', '', 'Read our story', '/about', 900),

  ('rewards', 'rewards', 'segment', '', 0, 'product-band', 1,
   'Rewards', 'The more you shop, the more you earn',
   'Every qualifying purchase earns you a reward code you can spend on your next order.',
   '', 'Shop to earn your points', '/shop', 1000),

  ('reviews', 'reviews', 'segment', '', 0, 'product-band', 1,
   'Reviews', '', '', '', 'Read all reviews', '/reviews', 1100),

  ('blog', 'blog', 'segment', '', 3, 'product-band', 1,
   'Journal', '', '', '', 'Read the blog', '/blog', 1200),

  ('newsletter', 'newsletter', 'segment', '', 0, 'product-band', 1,
   '', 'Join the list',
   'Be the first to know about new scents, restocks, special offers and everything happening at Majestic Roobee.',
   '', '', '', 1300),

  ('instagram', 'instagram', 'segment', '', 0, 'product-band', 1,
   'Instagram', 'Follow the fragrance',
   'Come behind the scenes, discover new fragrances and see what''s happening at Majestic Roobee.',
   '', 'Follow us on Instagram', '', 1400);
