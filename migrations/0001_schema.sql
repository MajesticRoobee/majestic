-- Majestic Roobee — core schema

CREATE TABLE locations (
  id TEXT PRIMARY KEY,              -- abuja | lagos | ibadan
  city TEXT NOT NULL,
  store TEXT NOT NULL,
  address TEXT NOT NULL,
  ship_ngn INTEGER NOT NULL,
  ship_usd INTEGER NOT NULL,
  eta TEXT NOT NULL,
  phone TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cat TEXT NOT NULL REFERENCES categories(id),
  gender TEXT NOT NULL DEFAULT 'Unisex',
  family TEXT NOT NULL DEFAULT 'Amber',
  notes TEXT NOT NULL DEFAULT '',
  descr TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  live INTEGER NOT NULL DEFAULT 1,  -- 0 = draft, hidden from storefront
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  price_ngn INTEGER NOT NULL,
  UNIQUE (product_id, size)
);

CREATE TABLE stock (
  variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id),
  qty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (variant_id, location_id)
);

CREATE TABLE orders (
  no TEXT PRIMARY KEY,              -- MR-10234
  customer TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,               -- customer's city id
  address TEXT NOT NULL DEFAULT '',
  fulfilled_from TEXT NOT NULL REFERENCES locations(id),
  method TEXT NOT NULL,             -- Delivery | Click & collect
  pay TEXT NOT NULL,                -- Paystack | Bank transfer | WhatsApp
  pay_status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed
  pay_ref TEXT,
  status TEXT NOT NULL,             -- Processing | Packed | In transit | Ready for pickup | Delivered | Collected | Cancelled
  promo_code TEXT,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  all_in_city INTEGER NOT NULL DEFAULT 1,
  placed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_placed ON orders(placed_at);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL REFERENCES orders(no) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_ngn INTEGER NOT NULL
);

CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL REFERENCES orders(no) ON DELETE CASCADE,
  step TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  at TEXT,                          -- display time; NULL for future steps
  done INTEGER NOT NULL DEFAULT 0,
  current INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE promos (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL,               -- pct | amt | ship
  value INTEGER NOT NULL DEFAULT 0,
  descr TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'Storewide',
  starts TEXT,                      -- display text (e.g. "Jul 1") or ISO date
  ends TEXT,
  status TEXT NOT NULL DEFAULT 'Active',  -- Active | Ended
  redemptions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,               -- Popup | Banner | Email | Push
  audience TEXT NOT NULL DEFAULT 'All visitors',
  status TEXT NOT NULL DEFAULT 'Live',
  stat TEXT NOT NULL DEFAULT '—',
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL,            -- Live chat | WhatsApp | Email
  subject TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',  -- Open | Pending | Resolved
  guest_key TEXT,                   -- lets the guest who opened it append messages
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE inquiry_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  from_us INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'popup',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE abandoned_checkouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_key TEXT NOT NULL UNIQUE, -- phone or email, normalised
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  value_ngn INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'Cart',   -- Cart | Delivery details | Payment
  converted INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
