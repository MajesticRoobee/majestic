-- Sprint 3.5 — smart shopping: what the stream is actually for.
--
-- See docs/SPRINT-3-PLAN.md §2. Measuring is only half an answer; this is the
-- half that converts. Everything here rides F4 (migration 0020).

-- ---- 1. What gets looked at alongside what --------------------------------
--
-- "You may also like" on the product page is filed by category today, which
-- means it recommends whatever happens to sit near it on a shelf. This is the
-- shop's own shoppers answering the same question: the pieces people open in
-- the same visit as this one, ranked by how often.
--
-- Rebuilt whole on the cron rather than updated per event — it is a few
-- thousand rows, it only has to be right once a day, and a rebuild cannot drift.
CREATE TABLE product_affinity (
  product_id TEXT NOT NULL,
  other_id   TEXT NOT NULL,
  score      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, other_id)
);
CREATE INDEX idx_affinity_score ON product_affinity(product_id, score DESC);

-- ---- 2. Getting a cart back -----------------------------------------------
--
-- The abandoned-cart automation has been enqueuing messages since Phase 1, and
-- the message could only ever say "you left something" and drop the shopper on
-- the home page to find it again. Most do not.
--
-- The token is what turns that into one tap. It is random, single-purpose, and
-- carries nothing: it names a row, and the row is already keyed on a contact the
-- shopper themselves typed into our checkout.
ALTER TABLE abandoned_checkouts ADD COLUMN token TEXT;
ALTER TABLE abandoned_checkouts ADD COLUMN items TEXT NOT NULL DEFAULT '[]';
ALTER TABLE abandoned_checkouts ADD COLUMN recovered_at TEXT;
CREATE UNIQUE INDEX idx_abandoned_token ON abandoned_checkouts(token);

-- ---- 3. The nudge ---------------------------------------------------------
--
-- Ships switched OFF with no copy. A pop-up is the easiest thing in this whole
-- sprint to make a shop worse with, and the house should write its own words
-- and decide its own offer before it shows one to anybody.
UPDATE settings SET value = json_set(value,
  '$.nudgeOn',        json('false'),
  '$.nudgeTitle',     'Still deciding?',
  '$.nudgeBody',      'Your cart is saved. Finish your order and we will get it on its way today.',
  '$.nudgeCta',       'Back to my cart',
  '$.nudgeCode',      '',
  '$.nudgeEveryDays', 7,
  -- The first-order pop-up has shown to everybody since it was built. It can
  -- now wait for somebody who has been in before and not bought, which is who
  -- it was always for.
  '$.promoPopupWhen', 'everyone',
  -- Two rails off the stream: what this shopper was looking at, and what other
  -- shoppers opened alongside it.
  '$.recentlyViewedOn', json('true'),
  '$.alsoViewedOn',     json('true')
) WHERE key = 'site' AND json_extract(value, '$.nudgeOn') IS NULL;
