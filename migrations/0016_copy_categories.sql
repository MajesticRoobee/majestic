-- The categories the client's website copy names, and the copy that goes with
-- them.
--
-- The copy sheet lists the categories a shopper picks from as: Perfumes, Perfume
-- Oils, Body Mists, Feminine Care, Home Fragrance and Wellness Products. The
-- tree 0015 built says something slightly different — "Perfumes" was a parent
-- over Extrait Perfumes, Designer Oils and Custom Oils, and Feminine Care hung
-- under a "Bodycare" category the store never uses in writing. So:
--
--   * Perfumes becomes the category itself and takes the extraits.
--   * Perfume Oils becomes a category of its own over the designer and custom oils.
--   * Feminine Care comes up to the top level and Bodycare retires.
--   * Wellness Products appears over the health drinks and massage oils.
--
-- Deodorants and Gift Sets are not in the copy sheet but are real categories with
-- real stock, so they keep their places at the end of the list.

-- 1. Perfumes is the category itself, not a parent. The extraits move onto it and the
--    now-empty child goes; `perfumes` is where the admin's "new product"
--    default already points after this migration.
UPDATE products   SET cat       = 'perfumes' WHERE cat       = 'extrait';
UPDATE categories SET parent_id = NULL       WHERE parent_id = 'extrait';
DELETE FROM categories WHERE id = 'extrait';

-- 2. Perfume Oils — the designer and custom oils, which the copy separates
--    from perfumes rather than filing under them.
INSERT INTO categories (id, label, descr, sort, live, grp) VALUES
  ('perfume-oils', 'Perfume Oils',
   'Concentrated fragrance oils, applied straight to skin or clothes.',
   2, 1, 'fragrance');
UPDATE categories SET parent_id = 'perfume-oils' WHERE id IN ('designer', 'custom-oil');

-- 3. Wellness Products — the health drinks and the massage oils, which the
--    copy groups together and which had no category of their own. The massage
--    oils are re-parented here before Bodycare goes, so nothing is ever left
--    pointing at a category that has been deleted.
INSERT INTO categories (id, label, descr, sort, live, grp) VALUES
  ('wellness', 'Wellness Products',
   'Health drinks and massage oils, made with you in mind.',
   6, 1, 'care');
UPDATE categories SET parent_id = 'wellness' WHERE id IN ('health', 'massage');

-- 4. Feminine Care stands on its own, so Bodycare has nothing left to hold.
UPDATE products   SET cat       = 'care' WHERE cat       = 'bodycare';
UPDATE categories SET parent_id = NULL   WHERE parent_id = 'bodycare';
DELETE FROM categories WHERE id = 'bodycare';

-- 5. Labels and descriptions, in the client's words. The old ones described
--    the categories in house style ("the house''s own trails"); these say what
--    is on them.
UPDATE categories SET label = 'Home Fragrance' WHERE id = 'home';

UPDATE categories SET descr = 'Non-toxic perfumes for men and women, made to last.'                    WHERE id = 'perfumes';
UPDATE categories SET descr = 'Designer-inspired perfume oils, blended in-house.'                      WHERE id = 'designer';
UPDATE categories SET descr = 'Perfume oils blended to your brief.'                                    WHERE id = 'custom-oil';
UPDATE categories SET descr = 'Light, refreshing mists for every day.'                                 WHERE id = 'mist';
UPDATE categories SET descr = 'Plant-based, non-toxic care for your intimate area.'                    WHERE id = 'care';
UPDATE categories SET descr = 'Candles, diffusers and room sprays for your space.'                     WHERE id = 'home';
UPDATE categories SET descr = 'Health drinks made to support you from the inside.'                     WHERE id = 'health';
UPDATE categories SET descr = 'Massage oils for skin.'                                                 WHERE id = 'massage';
UPDATE categories SET descr = 'Deodorants that keep you fresh all day.'                                WHERE id = 'deo';
UPDATE categories SET descr = 'Fragrance, mist and custom-oil sets, boxed and ready to give.'          WHERE id = 'gifts';

-- 6. Top-level order, as the copy lists it; children sort within their parent.
UPDATE categories SET sort = 1 WHERE id = 'perfumes';
UPDATE categories SET sort = 2 WHERE id = 'perfume-oils';
UPDATE categories SET sort = 3 WHERE id = 'mist';
UPDATE categories SET sort = 4 WHERE id = 'care';
UPDATE categories SET sort = 5 WHERE id = 'home';
UPDATE categories SET sort = 6 WHERE id = 'wellness';
UPDATE categories SET sort = 7 WHERE id = 'deo';
UPDATE categories SET sort = 8 WHERE id = 'gifts';

UPDATE categories SET sort = 1 WHERE id = 'designer';
UPDATE categories SET sort = 2 WHERE id = 'custom-oil';
UPDATE categories SET sort = 1 WHERE id = 'health';
UPDATE categories SET sort = 2 WHERE id = 'massage';

-- 7. The storefront copy the client wrote, in the settings the admin edits.
--    Only the lines this project seeded are replaced: anything the store has
--    since written itself is left alone.
UPDATE settings SET value = json_set(value,
  '$.announcement',   'SHOP YOUR SIGNATURE FRAGRANCE · EARN REWARD POINTS AS YOU SHOP · FREE GIFTS ON EVERY FIRST ORDER',
  '$.heroHeadline',   'ELEVATE YOUR SMELL GAME',
  '$.heroSub',        'Discover beautifully crafted non-toxic perfumes, perfume oils, body mists and home fragrances made for men and women who want to smell as good as they feel.',
  '$.footerTagline',  'Luxury, safe and intentional products created for men and women who love to smell good.',
  '$.metaDescription','Discover luxurious perfumes, fragrance oils, body mists, feminine care, wellness products and home fragrances from Majestic Roobee. Find your signature scent and shop online in Nigeria.',
  '$.reviewsHeadline','Don''t Just Take Our Word For It'
) WHERE key = 'site';

-- 8. The WhatsApp number the copy sheet gives for customer service. Only
--    written where the number is still the one the demo data seeded, so a
--    number the store has since set itself is never overwritten.
UPDATE settings SET value = json_set(value, '$.contactPhone', '0809 202 0525')
WHERE key = 'site' AND json_extract(value, '$.contactPhone') = '+234 906 227 7470';
