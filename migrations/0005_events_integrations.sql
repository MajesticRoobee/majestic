-- Phase 1 (F2 + F3) — event/automation backbone and the integration layer.

-- F2: append-only domain event log.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                 -- order_placed | order_paid | order_status_changed | customer_registered | checkout_abandoned | product_restocked | waitlist_joined | inquiry_created | lead_captured
  entity TEXT,                        -- order no / customer id / product id
  payload TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_at ON events(at);

-- F2: automation rules (event → action).
CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,              -- an event type, or 'cron'
  action TEXT NOT NULL DEFAULT 'email',   -- email | whatsapp | webhook | notify
  template_title TEXT NOT NULL DEFAULT '',
  template_body TEXT NOT NULL DEFAULT '',
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0,
  runs INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- F2: outbox — one row per (automation × triggering event).
CREATE TABLE automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id TEXT NOT NULL,
  event_id INTEGER,
  recipient TEXT,                     -- email or phone
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | queued | skipped | failed
  detail TEXT NOT NULL DEFAULT '',
  scheduled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX idx_runs_status ON automation_runs(status);

-- F2: back-in-stock waitlist (powers the "Notify me" button).
CREATE TABLE stock_waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  size TEXT,
  contact TEXT NOT NULL,
  city TEXT,
  notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_waitlist_product ON stock_waitlist(product_id);

-- one-time recovery flag so abandoned carts are only chased once
ALTER TABLE abandoned_checkouts ADD COLUMN reminded INTEGER NOT NULL DEFAULT 0;

-- F3: outbound webhooks (the "connect anything" plane).
CREATE TABLE webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '*',   -- '*' or a comma-separated list of event types
  enabled INTEGER NOT NULL DEFAULT 1,
  last_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- F3: scoped API keys for the partner/integration API and the MCP endpoint.
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,      -- sha256(key)
  prefix TEXT NOT NULL,               -- first chars, for display
  scopes TEXT NOT NULL DEFAULT 'read',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_used TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO automations (id, name, trigger, action, template_title, template_body, delay_minutes, enabled) VALUES
  ('abandoned_cart', 'Abandoned cart recovery', 'cron', 'email', 'Your trail is waiting', 'The pieces in your cart are still yours — complete your order and leave your trail.', 60, 1),
  ('post_purchase', 'Post-purchase thank you', 'order_paid', 'email', 'Thank you — your trail is on its way', 'We''re perfuming and packing your order with care. Here''s what happens next.', 0, 1),
  ('back_in_stock', 'Back-in-stock alert', 'product_restocked', 'email', 'It''s back', 'The fragrance you were waiting for is back in stock at your store.', 0, 1),
  ('order_status', 'Order status updates', 'order_status_changed', 'email', 'An update on your order', 'Your order status just changed.', 0, 1),
  ('welcome', 'Welcome new customers', 'customer_registered', 'email', 'Welcome to the house', 'Your account is ready — track orders, save favourites and earn perks.', 0, 1),
  ('birthday', 'Birthday treat', 'cron', 'email', 'A little something for your day', 'Happy birthday from Majestic Roobee — enjoy a treat on us.', 0, 0);
