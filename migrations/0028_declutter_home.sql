-- A quieter home page, and plainer words on it.
--
-- The home page ran fourteen sections. Several said the same thing twice — a
-- second product row of the same bottles as Best sellers ("Ready at your store
-- today"), a grid of categories directly under the category menu that already
-- stands open beside the hero — and several were explanation rather than
-- shopping: a four-step "how rewards work", a fragrance-personality quiz with
-- no quiz behind it, the founder's full opening paragraph, an Instagram plug
-- the footer icon already makes.
--
-- Those sections are switched off, not deleted: each one is a toggle away in
-- Admin → Home page. Every change below is guarded on the row still holding
-- the words this project seeded, so a section the shop has since rewritten or
-- switched back on is left exactly as the shop has it.

-- 1. Off.
UPDATE home_blocks SET live = 0, updated_at = datetime('now')
 WHERE id = 'shelf-in-city'   AND title = 'Ready at your store today';
UPDATE home_blocks SET live = 0, updated_at = datetime('now')
 WHERE id = 'cta-personality' AND title = 'What''s your fragrance personality?';
UPDATE home_blocks SET live = 0, updated_at = datetime('now')
 WHERE id = 'rewards'         AND title = 'The more you shop, the more you earn';
UPDATE home_blocks SET live = 0, updated_at = datetime('now')
 WHERE id = 'instagram'       AND title = 'Follow the fragrance';
UPDATE home_blocks SET live = 0, updated_at = datetime('now')
 WHERE id = 'categories'      AND title = 'Find Your Fragrance';
UPDATE home_blocks SET live = 0, updated_at = datetime('now')
 WHERE id = 'story'           AND eyebrow = 'Our story' AND title = '';

-- 2. Plainer words on what stays.
UPDATE home_blocks SET eyebrow = '', updated_at = datetime('now')
 WHERE id = 'tile-deals' AND eyebrow = 'On sale now';
UPDATE home_blocks SET eyebrow = '', updated_at = datetime('now')
 WHERE id = 'tile-new'   AND eyebrow = 'Just in';
UPDATE home_blocks SET eyebrow = '', updated_at = datetime('now')
 WHERE id = 'tile-sets'  AND eyebrow = 'Ready to give';

UPDATE home_blocks
   SET eyebrow = '', title = 'Feminine care', lines = 'Plant-based and non-toxic.', updated_at = datetime('now')
 WHERE id = 'band-care' AND title = 'The products your intimate area needs';

UPDATE home_blocks
   SET eyebrow = '', title = 'Best sellers', sub = '', cta_label = 'See all', updated_at = datetime('now')
 WHERE id = 'shelf-best' AND title = 'The fragrance everyone is talking about';

UPDATE home_blocks SET eyebrow = '', cta_label = 'See all', updated_at = datetime('now')
 WHERE id = 'shelf-deals' AND eyebrow = 'On sale now' AND cta_label = 'See all deals';

UPDATE home_blocks
   SET eyebrow = '', title = 'Home fragrance', lines = 'Candles, diffusers and room sprays.', updated_at = datetime('now')
 WHERE id = 'band-home' AND title = 'Your home deserves a signature scent too';

UPDATE home_blocks SET eyebrow = '', cta_label = 'See all', updated_at = datetime('now')
 WHERE id = 'reviews' AND eyebrow = 'Reviews' AND cta_label = 'Read all reviews';

UPDATE home_blocks SET eyebrow = '', cta_label = 'See all', updated_at = datetime('now')
 WHERE id = 'blog' AND cta_label = 'Read the blog';

UPDATE home_blocks SET title = 'Newsletter', sub = 'New arrivals, restocks and offers.', updated_at = datetime('now')
 WHERE id = 'newsletter' AND title = 'Join the list';

-- 3. The hero and the reviews heading, in the settings the admin edits — again
--    only where they still read as seeded.
UPDATE settings SET value = json_set(value, '$.heroSub',
  'Non-toxic perfumes, perfume oils, body mists and home fragrance.')
 WHERE key = 'site' AND json_extract(value, '$.heroSub') =
  'Discover beautifully crafted non-toxic perfumes, perfume oils, body mists and home fragrances made for men and women who want to smell as good as they feel.';

UPDATE settings SET value = json_set(value, '$.reviewsHeadline', 'Reviews')
 WHERE key = 'site' AND json_extract(value, '$.reviewsHeadline') = 'Don''t Just Take Our Word For It';

UPDATE settings SET value = json_set(value, '$.footerTagline',
  'Perfumes, body mists, feminine care and home fragrance.')
 WHERE key = 'site' AND json_extract(value, '$.footerTagline') =
  'Luxury, safe and intentional products created for men and women who love to smell good.';

-- 4. Category lines, where they still read as seeded: what is on the shelf,
--    nothing more.
UPDATE categories SET descr = 'Non-toxic perfumes for men and women.' WHERE id = 'perfumes' AND descr = 'Non-toxic perfumes for men and women, made to last.';
UPDATE categories SET descr = 'Designer-inspired perfume oils.'       WHERE id = 'designer' AND descr = 'Designer-inspired perfume oils, blended in-house.';
UPDATE categories SET descr = 'Plant-based, non-toxic feminine care.' WHERE id = 'care'     AND descr = 'Plant-based, non-toxic care for your intimate area.';
UPDATE categories SET descr = 'Candles, diffusers and room sprays.'   WHERE id = 'home'     AND descr = 'Candles, diffusers and room sprays for your space.';
UPDATE categories SET descr = 'Health drinks.'                        WHERE id = 'health'   AND descr = 'Health drinks made to support you from the inside.';
UPDATE categories SET descr = 'Deodorants.'                           WHERE id = 'deo'      AND descr = 'Deodorants that keep you fresh all day.';
UPDATE categories SET descr = 'Fragrance, mist and custom-oil sets.'  WHERE id = 'gifts'    AND descr = 'Fragrance, mist and custom-oil sets, boxed and ready to give.';
UPDATE categories SET descr = 'Health drinks and massage oils.'       WHERE id = 'wellness' AND descr = 'Health drinks and massage oils, made with you in mind.';
