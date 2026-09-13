-- Sprint 3.1 — the low-stock line the house can actually draw, and legal pages
-- that are content rather than JSX.
--
-- See docs/SPRINT-3-PLAN.md §3 and §5.1.

-- ---- 1. Low stock ---------------------------------------------------------
--
-- `lowStockThreshold` has existed since the first seed and has been saveable
-- through PUT /api/admin/settings all along. No screen ever rendered it, and
-- "low" was only ever a number on a dashboard nobody watches at 6pm. Three
-- things change that: a per-variation override, a mode that reads the line off
-- how fast the thing actually sells, and an alert that leaves the building.

-- The line for this variation, at every store. NULL means "use the store's".
-- A 3ml sample and a ₦180,000 extrait do not run low at the same number.
ALTER TABLE variants ADD COLUMN low_stock_at INTEGER;

-- One row per (variation × store), holding the state the sweep last saw. This
-- is what makes the alert fire on the *crossing* rather than every fifteen
-- minutes for as long as the shelf is thin. Recovery is recorded silently, so
-- the next dip alerts again.
CREATE TABLE stock_alerts (
  variant_id  INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'ok',   -- ok | low | out
  qty         INTEGER NOT NULL DEFAULT 0,
  threshold   INTEGER NOT NULL DEFAULT 0,
  changed_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (variant_id, location_id)
);
CREATE INDEX idx_stock_alerts_state ON stock_alerts(state);

-- Two automations against the two new events. They open enabled because an
-- alert nobody switched on is not an alert; with no email provider they queue
-- in the outbox and are readable from Admin → Integrations, exactly like every
-- other automation here does today.
INSERT INTO automations (id, name, trigger, action, template_title, template_body, delay_minutes, enabled) VALUES
  ('inventory_low', 'Low stock alert', 'inventory_low', 'email', 'Running low', 'A size is down to its last few at one of the stores.', 0, 1),
  ('inventory_out', 'Out of stock alert', 'inventory_out', 'email', 'Sold out', 'A size has just sold out at one of the stores.', 0, 1);

-- How the line is drawn. `flat` is the number as it has always been; `cover`
-- reads it off recent sales — alert when the shelf holds less than N days of
-- what it has been selling — with the flat number as the floor, so a piece that
-- has never sold still gets a warning instead of silence.
UPDATE settings SET value = json_set(value,
  '$.lowStockMode',          'flat',
  '$.lowStockCoverDays',     14,
  '$.lowStockVelocityDays',  30,
  '$.lowStockAlerts',        json('true'),
  '$.lowStockOnStorefront',  json('true')
) WHERE key = 'site' AND json_extract(value, '$.lowStockMode') IS NULL;

-- ---- 2. Legal & information pages ----------------------------------------
--
-- The privacy notice was JSX, down to a "last updated" date only a deploy could
-- move. It is content, and the blog already solved this problem properly: plain
-- text, `## ` for a heading, `> ` for a quote, rendered by PostBody, never
-- handed to dangerouslySetInnerHTML. Same renderer, same discipline.
CREATE TABLE content_pages (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  eyebrow    TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  seo_title  TEXT NOT NULL DEFAULT '',
  seo_desc   TEXT NOT NULL DEFAULT '',
  in_footer  INTEGER NOT NULL DEFAULT 1,
  live       INTEGER NOT NULL DEFAULT 1,
  sort       INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Privacy is seeded with the copy that was on the page, word for word, so
-- nothing is lost in the move and the house edits from where it stood.
INSERT INTO content_pages (slug, title, eyebrow, body, seo_desc, sort) VALUES
  ('privacy', 'Privacy & cookies', 'Legal',
   'Majestic Roobee ("we") respects your privacy. This notice explains what we collect, why, and the choices you have. You can shop as a guest without creating an account.

## What we collect

To fulfil an order we collect your name, phone, email and delivery address, plus the items and amounts in your order. If you contact us or start a live chat, we keep that conversation so we can help. If you join our list, we keep your email until you unsubscribe.

## Payments

Card payments are processed by our payment provider (Paystack). We never see or store your full card details — payment is confirmed to us by the provider.

## Cookies & analytics

We use cookies for two things: essential store function (your cart, your chosen city) and — only if you accept — analytics and marketing tools that help us understand and improve the experience. You can decline the optional cookies from the banner and still shop normally. Optional tools we may use include Google Analytics, Google Ads, Meta Pixel, TikTok Pixel and Microsoft Clarity.

## How we use your information

To process and deliver orders, provide support, prevent fraud, and — where you''ve opted in — send you offers and updates. We do not sell your personal information.

## Your choices

You can decline optional cookies, unsubscribe from marketing at any time, and ask us to access or delete the information we hold about you.

## Contact

Questions about your privacy? Reach us using the details on our contact page.',
   'How Majestic Roobee collects, uses and protects your information, and the choices you have.', 10);

-- Three pages the footer and a shopper both expect, and none of which existed.
-- They open as drafts: a returns policy nobody has written is worse than a
-- missing link, so they stay off the footer until the house fills them in.
INSERT INTO content_pages (slug, title, eyebrow, body, live, in_footer, sort) VALUES
  ('terms', 'Terms & conditions', 'Legal',
   'Write the terms the house trades on here, then publish the page from Admin → Pages.

## Ordering

## Pricing and payment

## Delivery

## Cancellations', 0, 1, 20),
  ('returns', 'Returns & refunds', 'Help',
   'Write the returns policy here, then publish the page from Admin → Pages.

## What can be returned

Fragrance is intimate, and most houses do not take back an opened bottle. Say plainly what you will and will not accept.

## How long you have

## How to start a return

## Refunds', 0, 1, 30),
  ('shipping', 'Shipping & delivery', 'Help',
   'Write the delivery promise here, then publish the page from Admin → Pages.

## Where we deliver

## What it costs

## How long it takes

## Click and collect', 0, 1, 40);
