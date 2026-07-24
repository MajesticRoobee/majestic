-- Per-user staff accounts. The master passphrase (ADMIN_PASSWORD secret) always
-- works as a break-glass super-admin login; individual accounts are issued from
-- the admin panel by a super admin.

CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,          -- login handle (lowercase)
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager',   -- super | manager
  scope TEXT,                             -- NULL for super; abuja|lagos|ibadan for managers
  pass_hash TEXT NOT NULL,                -- PBKDF2-SHA256, base64
  pass_salt TEXT NOT NULL,                -- base64
  must_change INTEGER NOT NULL DEFAULT 1, -- force change of an issued passphrase
  totp_secret TEXT,                       -- base32; set during 2FA enrolment
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);
