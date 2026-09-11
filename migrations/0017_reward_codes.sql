-- Reward codes.
--
-- A promo is a public sale: one code, printed on a flyer, used by everybody,
-- running between two dates. A reward is the opposite — **one code, one person,
-- one use** — so it cannot live in the `promos` table without making
-- "redemptions" mean two different things and leaving a storewide sale code one
-- typo away from being single-use.
--
-- What a reward can be is deliberately wider than a promo: as well as a
-- percentage, an amount off or free delivery, it can be a **free product**
-- (`kind = 'item'`) — either one named size, or the cheapest thing in the cart
-- that its scope covers.
--
-- Shoppers never learn the difference. Checkout has one code box; the server
-- reads the promos table first and this one second.

CREATE TABLE reward_codes (
  code TEXT PRIMARY KEY,

  -- pct  — percentage off everything in scope
  -- amt  — naira off everything in scope
  -- ship — free delivery
  -- item — one product free: `free_variant_id` if it names one, otherwise the
  --        cheapest line in scope
  kind TEXT NOT NULL DEFAULT 'pct',
  value INTEGER NOT NULL DEFAULT 0,
  free_variant_id INTEGER REFERENCES variants(id) ON DELETE SET NULL,

  descr TEXT NOT NULL DEFAULT '',
  -- The same four groups a promo scopes to, so one table of category groups
  -- serves both and a reward can never be scoped to something a promo can't be.
  scope TEXT NOT NULL DEFAULT 'Storewide',
  min_spend INTEGER NOT NULL DEFAULT 0,

  -- Who it belongs to. A normalised email or phone, matched against the contact
  -- on the order at checkout. NULL means a bearer code: whoever types it, gets
  -- it — which is what a giveaway or an insert card wants.
  owner_key TEXT,
  owner_email TEXT NOT NULL DEFAULT '',
  owner_name TEXT NOT NULL DEFAULT '',

  -- How it came to exist: 'purchase' (earned by paying for an order), 'manual'
  -- (issued from the admin), or whatever a later rule calls itself.
  source TEXT NOT NULL DEFAULT 'manual',
  earned_order_no TEXT REFERENCES orders(no) ON DELETE SET NULL,
  issued_by TEXT NOT NULL DEFAULT '',

  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,                       -- ISO date, inclusive; NULL = no expiry

  -- Active | Redeemed | Void. `redeemed_at` is set in the same conditional
  -- update that moves the status, so the two can never disagree.
  status TEXT NOT NULL DEFAULT 'Active',
  redeemed_at TEXT,
  -- Deliberately *not* a foreign key, unlike `earned_order_no` above.
  --
  -- A code is claimed in the instant **before** the order that spends it is
  -- written — that ordering is what makes "one use" safe when two checkouts
  -- race, because the database, not the last writer, picks the winner. A
  -- foreign key here would forbid exactly that, forcing the claim to happen
  -- after the order and reopening the race it exists to close. So this is a
  -- plain pointer: it names the order, and nothing depends on it resolving.
  redeemed_order_no TEXT,

  note TEXT NOT NULL DEFAULT '',
  seeded INTEGER NOT NULL DEFAULT 0
);

-- The two reads this table gets: "what has this person got?" and "show me the
-- ledger, newest first".
CREATE INDEX idx_rewards_owner ON reward_codes(owner_key, status);
CREATE INDEX idx_rewards_issued ON reward_codes(issued_at DESC);
CREATE INDEX idx_rewards_earned ON reward_codes(earned_order_no);

-- An order records the reward it spent beside the promo it used. They are
-- separate columns because an order may carry one of each, and because
-- `promo_code` is a foreign-key-shaped reference to a table this code is not in.
ALTER TABLE orders ADD COLUMN reward_code TEXT REFERENCES reward_codes(code);

-- The earning rule, as settings rather than code, so the shop can change what a
-- purchase is worth — or stop giving rewards altogether — without a deploy.
--
-- It opens ON because the homepage already promises it ("The more you shop, the
-- more you earn"): a site that advertises rewards and issues none is worse than
-- one that never mentioned them. Admin → Rewards is where it is tuned.
UPDATE settings SET value = json_set(value,
  '$.rewardsOn',            json('true'),
  '$.rewardEarnKind',       'pct',
  '$.rewardEarnValue',      10,
  '$.rewardEarnMinSpend',   0,
  '$.rewardEarnScope',      'Storewide',
  '$.rewardEarnExpiryDays', 90,
  '$.rewardCodePrefix',     'MR'
) WHERE key = 'site';
