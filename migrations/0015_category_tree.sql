-- One category system, two levels deep.
--
-- The shop had thirteen flat categories and, separately, a "sub-shelf" idea
-- bolted onto each of them (`subcats`) that was really the merchandising
-- shelves — new arrivals, best sellers, gift sets — wearing a category's
-- clothes. Shoppers therefore met two different category pickers: a rail in the
-- header and a row of pills on the shop page, disagreeing about what a category
-- even was.
--
-- The house's actual shelves are seven, and most of the old thirteen are
-- sub-categories of them. So categories get a parent, the seven become the
-- top level, and `subcats` goes: the shelves it stood for are already top-level
-- links in the header, and nothing else should compete with this tree.

ALTER TABLE categories ADD COLUMN parent_id TEXT REFERENCES categories(id);

-- The parents that did not exist as categories before. Body Mists, Deodorants,
-- Home Fragrances and Health Drinks are already categories holding products, so
-- they simply become top level where they stand.
INSERT INTO categories (id, label, descr, sort, live, grp) VALUES
  ('perfumes', 'Perfumes',
   'Extraits, designer oils and custom blends — the house''s own trails.',
   1, 1, 'fragrance'),
  ('bodycare', 'Bodycare',
   'Feminine care and massage oils, made for skin.',
   4, 1, 'care'),
  ('gifts', 'Gift Sets',
   'Boxed and ready — fragrance, mist and custom-oil sets.',
   6, 1, 'gift');

-- Children keep their ids, so every product's `cat`, every promo scope and
-- every shared /shop?category=… link still resolves. Only their parent is new.
UPDATE categories SET parent_id = 'perfumes' WHERE id IN ('extrait', 'designer', 'custom-oil');
UPDATE categories SET parent_id = 'bodycare' WHERE id IN ('care', 'massage');
UPDATE categories SET parent_id = 'gifts'    WHERE id IN ('fragrance-set', 'mist-set', 'custom-oil-set', 'gift-set');

-- 'Gift Sets' inside 'Gift Sets' reads as a mistake. The old generic bucket is
-- the catch-all beside the three named ones, so it is named for that.
UPDATE categories SET label = 'Other Sets' WHERE id = 'gift-set';

-- The house writes it plural.
UPDATE categories SET label = 'Home Fragrances' WHERE id = 'home';

-- Top-level order, as the house lists it. Children sort within their parent.
UPDATE categories SET sort = 1 WHERE id = 'perfumes';
UPDATE categories SET sort = 2 WHERE id = 'mist';
UPDATE categories SET sort = 3 WHERE id = 'deo';
UPDATE categories SET sort = 4 WHERE id = 'bodycare';
UPDATE categories SET sort = 5 WHERE id = 'home';
UPDATE categories SET sort = 6 WHERE id = 'gifts';
UPDATE categories SET sort = 7 WHERE id = 'health';

UPDATE categories SET sort = 1 WHERE id = 'extrait';
UPDATE categories SET sort = 2 WHERE id = 'designer';
UPDATE categories SET sort = 3 WHERE id = 'custom-oil';
UPDATE categories SET sort = 1 WHERE id = 'care';
UPDATE categories SET sort = 2 WHERE id = 'massage';
UPDATE categories SET sort = 1 WHERE id = 'fragrance-set';
UPDATE categories SET sort = 2 WHERE id = 'mist-set';
UPDATE categories SET sort = 3 WHERE id = 'custom-oil-set';
UPDATE categories SET sort = 4 WHERE id = 'gift-set';

-- A parent is a shelf, and its own group has to match what hangs under it or a
-- promo scoped to "Gift packages" would miss the parent.
UPDATE categories SET grp = 'fragrance' WHERE id IN ('mist', 'home');
UPDATE categories SET grp = 'care'      WHERE id = 'deo';

-- Reading the tree is the storefront's commonest query after the catalogue.
CREATE INDEX idx_categories_parent ON categories(parent_id, sort);

-- `subcats` is gone: nothing reads it any more, and leaving a dead column in
-- place is how a second category system grows back.
ALTER TABLE categories DROP COLUMN subcats;
