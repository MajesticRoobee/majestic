-- The blog reads as a blog.
--
-- "Journal" appeared in exactly one place a shopper can see: the kicker on the
-- home page's blog block, seeded in 0019. The house calls it the blog, so it
-- says Blog. Only the rows still carrying the seeded word are touched —
-- anyone who has already written their own kicker keeps it.
UPDATE home_blocks SET eyebrow = 'Blog', updated_at = datetime('now')
 WHERE kind = 'blog' AND eyebrow = 'Journal';

-- "From the blog" was a fallback in the storefront rather than a row, so it is
-- gone in code: the heading is `blogHeadline` now and defaults to "Blog". A
-- house that had typed "From the blog" into the setting itself keeps it until
-- they change it — clearing it here would be editing their own copy.

-- Nothing is done to `blog_posts.excerpt`, deliberately.
--
-- The runaway previews are handled by clamping on the way out (see
-- `previewOf` in src/lib/blog.js), so every card is already short. Truncating
-- what is *stored* would be a one-way trim of the only copy of that text —
-- on a post whose writer put the whole article in the preview box and left the
-- story empty, this migration would be the thing that deleted it. The editor
-- says so instead, and offers to move the text down into the story.
