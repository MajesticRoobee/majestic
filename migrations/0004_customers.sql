-- Phase 1 (F1) — customer identity. Guest-first: accounts are optional and a
-- guest record (no password) can later be "claimed" into a full account.

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  pass_hash TEXT,                         -- NULL until they set a password
  pass_salt TEXT,
  city TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  birthday TEXT,                          -- "MM-DD" for birthday campaigns (Phase 3)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  address TEXT NOT NULL,
  city TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE wishlists (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (customer_id, product_id)
);

-- Orders may belong to a customer (NULL for pure guest orders).
ALTER TABLE orders ADD COLUMN customer_id INTEGER;
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_email ON orders(email);
