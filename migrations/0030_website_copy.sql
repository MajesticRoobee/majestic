-- The home page, in the words of the website copy brief.
--
-- The client's brief ("MAJESTIC ROOBEE Website Copy & SEO Brief") sets out the
-- home page section by section: the hero, Find your fragrance, feminine care,
-- best sellers, the founder's story, the fragrance personality, a featured
-- product, home fragrance, rewards, reviews, the newsletter and Instagram.
-- 0028 had switched several of those sections off and shortened the words on
-- the rest; this puts the brief's copy back and switches them on again, in the
-- brief's order.
--
-- Each change is guarded on the row still holding either the words 0028 left
-- or the words 0019 seeded, so a section somebody has since rewritten in
-- Admin → Home page is left as they have it. The wording in the code (buttons,
-- the rewards steps, the newsletter box, the footer) ships with the build.

-- ---- Sections --------------------------------------------------------------

-- Find your fragrance: the five categories the brief names, in its order.
UPDATE home_blocks
   SET live = 1, eyebrow = '', title = 'Find your fragrance',
       sub = 'Whatever you''re in the mood for, there''s a fragrance for it.',
       ref_id = 'perfumes,perfume-oils,mist,home,care', sort = 200, updated_at = datetime('now')
 WHERE id = 'categories' AND title = 'Find Your Fragrance';

UPDATE home_blocks
   SET eyebrow = '', title = 'The products your intimate area needs',
       lines = 'Looking for a safe product for your intimate area?
Shop our plant-based and non-toxic intimate care.',
       sort = 300, updated_at = datetime('now')
 WHERE id = 'band-care' AND title IN ('Feminine care', 'The products your intimate area needs');

UPDATE home_blocks
   SET eyebrow = '', title = 'The fragrance everyone is talking about',
       sub = 'Not sure where to start? Start with the fragrances our customers keep coming back for.',
       cta_label = 'Shop best sellers', sort = 400, updated_at = datetime('now')
 WHERE id = 'shelf-best' AND title IN ('Best sellers', 'The fragrance everyone is talking about');

-- The deals shelf only draws while a deal is running; it follows best sellers.
UPDATE home_blocks SET sort = 500, updated_at = datetime('now')
 WHERE id = 'shelf-deals' AND sort = 600;

-- The founder's story, whole: the section opens on its first paragraph and
-- the rest opens in place.
UPDATE home_blocks
   SET live = 1, eyebrow = '', title = '', cta_label = 'Read the full story', sort = 600, updated_at = datetime('now')
 WHERE id = 'story' AND title = '' AND cta_label = 'Read our story';

UPDATE home_blocks
   SET live = 1,
       lines = 'Are you soft and feminine? Warm and sensual? Fresh and effortless? Bold and commanding fragrances?
There''s a fragrance for every version of you.',
       cta_label = 'Find your signature scent', sort = 700, updated_at = datetime('now')
 WHERE id = 'cta-personality' AND title = 'What''s your fragrance personality?';

UPDATE home_blocks
   SET eyebrow = '', title = 'Your home deserves a signature scent too',
       lines = 'Explore our collection of home fragrances created to make your space feel warmer, fresher and more inviting.',
       cta_label = 'Shop home fragrance', sort = 900, updated_at = datetime('now')
 WHERE id = 'band-home' AND title IN ('Home fragrance', 'Your home deserves a signature scent too');

UPDATE home_blocks
   SET live = 1, eyebrow = '', title = 'The more you shop, the more you earn',
       sub = 'Every qualifying purchase earns you points that you can redeem for rewards on future orders.',
       cta_label = 'Shop to earn your points now', sort = 1000, updated_at = datetime('now')
 WHERE id = 'rewards' AND title = 'The more you shop, the more you earn';

-- The newsletter has no heading in the brief: its line leads, and the box and
-- button say "Enter your email address" and "Join the list".
UPDATE home_blocks
   SET title = '',
       sub = 'Be the first to know about new scents, restocks, special offers and everything happening at Majestic Roobee.',
       sort = 1300, updated_at = datetime('now')
 WHERE id = 'newsletter' AND title IN ('Newsletter', 'Join the list');

UPDATE home_blocks
   SET live = 1, eyebrow = '', title = 'Follow the fragrance',
       sub = 'Come behind the scenes, discover new fragrances and see what''s happening at Majestic Roobee.',
       cta_label = 'Follow us on Instagram', sort = 1400, updated_at = datetime('now')
 WHERE id = 'instagram' AND title = 'Follow the fragrance';

-- ---- The featured product ----------------------------------------------------
--
-- A banner with one hand-picked product beside the copy — the brief's
-- example, 2Sexy2Resist. Any product can take its place from Admin → Home page
-- (Chosen by hand), with its own heading and line. Only added where that
-- product exists, and never twice.
INSERT INTO home_blocks (id, kind, layout, source, ref_id, count, eyebrow, title, sub, lines, cta_label, cta_target, dark, sort, live)
SELECT 'featured', 'band', 'product-band', 'manual', '', 1, '', '2Sexy2Resist', '',
       'A sensual blend of benzoin, sandalwood, oud and vanilla created for the woman who knows the effect she has.',
       'Shop now', '/product/2sexy2resist', 1, 800, 1
 WHERE EXISTS (SELECT 1 FROM products WHERE id = '2sexy2resist')
   AND NOT EXISTS (SELECT 1 FROM home_blocks WHERE id = 'featured');

INSERT OR IGNORE INTO home_block_products (block_id, product_id, sort)
SELECT 'featured', '2sexy2resist', 0
 WHERE EXISTS (SELECT 1 FROM home_blocks WHERE id = 'featured')
   AND EXISTS (SELECT 1 FROM products WHERE id = '2sexy2resist');

-- ---- Settings ----------------------------------------------------------------

UPDATE settings SET value = json_set(value, '$.heroSub',
  'Discover beautifully crafted non-toxic perfumes, perfume oils, body mists and home fragrances made for men and women who want to smell as good as they feel.')
 WHERE key = 'site' AND json_extract(value, '$.heroSub') IN (
  'Non-toxic perfumes, perfume oils, body mists and home fragrance.',
  'Discover beautifully crafted non-toxic perfumes, perfume oils, body mists and home fragrances made for men and women who want to smell as good as they feel.');

UPDATE settings SET value = json_set(value, '$.reviewsHeadline', 'Don''t just take our word for it')
 WHERE key = 'site' AND json_extract(value, '$.reviewsHeadline') IN ('Reviews', 'Don''t Just Take Our Word For It');

-- The footer's short brand description.
UPDATE settings SET value = json_set(value, '$.footerTagline',
  'Luxury, safe and intentional products created for men and women who love to smell good.')
 WHERE key = 'site' AND json_extract(value, '$.footerTagline') IN (
  'Perfumes, body mists, feminine care and home fragrance.',
  'Luxury, safe and intentional products created for men and women who love to smell good.');

-- The home page's search description, from the brief — and never the store
-- cities: the brief's own words describe the brand, not its addresses.
UPDATE settings SET value = json_set(value, '$.metaDescription',
  'Discover luxurious perfumes, fragrance oils, body mists, feminine care, wellness products and home fragrances from Majestic Roobee. Find your signature scent and shop online in Nigeria.')
 WHERE key = 'site' AND (json_extract(value, '$.metaDescription') IS NULL
   OR json_extract(value, '$.metaDescription') = ''
   OR json_extract(value, '$.metaDescription') LIKE '%Abuja%'
   OR json_extract(value, '$.metaDescription') LIKE '%Lagos%'
   OR json_extract(value, '$.metaDescription') LIKE '%Ibadan%');
