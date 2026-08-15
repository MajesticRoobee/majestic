-- Payments become a first-class part of an order, not a boolean.
--
-- Until now an order carried `pay_status` ('pending' | 'paid') and a bare
-- `pay_ref`, and stock was decremented the moment the order row was written.
-- Three things were wrong with that:
--
--   1. Nothing recorded *what the gateway actually said* — the amount, the
--      currency, the channel — so a charge could never be reconciled against
--      the order it claims to settle, and a webhook was trusted on its word.
--   2. A shopper who opened Paystack and walked away held that stock forever.
--      The order sat 'pending' and the goods were unsellable.
--   3. `markPaid` could run twice (the return leg *and* the webhook), firing
--      the post-purchase automation twice.
--
-- This migration gives the order the columns needed to settle a payment
-- exactly once and to let an unclaimed one lapse, plus an append-only log of
-- every exchange with the gateway.

-- ---- Order-level payment state ----

-- The amount, in kobo, that the gateway was asked to collect. Written at
-- initialization from the server's own total and compared against every
-- callback: a charge for a different amount never settles the order.
ALTER TABLE orders ADD COLUMN pay_amount INTEGER;

-- How it was actually paid, once it is ('card', 'bank', 'ussd'...).
ALTER TABLE orders ADD COLUMN pay_channel TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;

-- When an unpaid card order stops holding its stock. NULL for the manual
-- methods (bank transfer, WhatsApp), which a human settles.
ALTER TABLE orders ADD COLUMN pay_expires_at TEXT;

-- Whether this order's reservation has been given back to the shelves, so a
-- lapse can never be applied twice and a late payment can re-take it.
ALTER TABLE orders ADD COLUMN stock_released INTEGER NOT NULL DEFAULT 0;

-- The sweep looks for pending orders past their hold; the redirect leg and the
-- webhook both look an order up by the reference the gateway hands back.
CREATE INDEX idx_orders_pay_expiry ON orders(pay_status, pay_expires_at);
CREATE INDEX idx_orders_pay_ref ON orders(pay_ref);

-- ---- The gateway conversation, kept ----

-- Append-only. Every initialization, verification and webhook lands here with
-- what the gateway reported, including the ones that were refused — a charge
-- whose amount didn't match is the single most important thing to be able to
-- look up later.
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL REFERENCES orders(no) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paystack',
  reference TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,          -- kobo, as the gateway stated it
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL,                       -- initialized | success | failed | mismatch | expired
  channel TEXT,
  source TEXT NOT NULL,                       -- init | verify | webhook | sweep
  detail TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_payments_order ON payments(order_no, at);
CREATE INDEX idx_payments_reference ON payments(reference);

-- Orders already in the book were settled under the old rules; record what we
-- know so the reconciliation view isn't blank for them.
UPDATE orders SET paid_at = placed_at WHERE pay_status = 'paid' AND paid_at IS NULL;
UPDATE orders SET pay_amount = total * 100 WHERE pay_amount IS NULL;
