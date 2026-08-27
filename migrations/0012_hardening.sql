-- Hardening pass: login throttling, enforceable promo dates, password reset,
-- and the media table's move towards R2 with responsive widths.
--
-- Four unrelated-looking additions that share one theme: things the audit found
-- were *described* but not *enforced*. A promo carried an end date it never
-- honoured; a login page carried a passphrase it would let you guess forever;
-- an account carried a password it would never let you replace.

-- ---- 1. Login throttling -------------------------------------------------
--
-- There is no KV binding on this Worker, so the attempt counter lives in D1.
-- One row per *failed* attempt; a success deletes the bucket. Rows are counted
-- inside a sliding window and swept opportunistically, so this table stays
-- small without a dedicated cron.
--
-- `bucket` is the thing being throttled, already normalised by the caller:
-- "admin:<ip>|<username>", "admin:<ip>", "cust:<ip>|<email>", "reset:<email>".
-- Keeping both a narrow (identity) and a wide (IP) bucket is deliberate: the
-- narrow one stops a single account being ground down, the wide one stops the
-- same attacker spraying a hundred usernames once each.
CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_login_attempts ON login_attempts(bucket, at);

-- ---- 2. Promo dates that actually bind -----------------------------------
--
-- `starts` and `ends` were free display text ("Aug 1", "Until ended") that
-- nothing ever read, so `promoIsActive()` checked the status column alone and
-- an expired code kept discounting until a human noticed. These two columns
-- hold real ISO dates (YYYY-MM-DD) and are what the server now enforces.
--
-- NULL means unbounded on that side — no start date is "live now", no end date
-- is "runs until ended by hand", which is the behaviour every existing promo
-- already has and must keep.
ALTER TABLE promos ADD COLUMN starts_at TEXT;
ALTER TABLE promos ADD COLUMN ends_at TEXT;

-- Backfill whatever the old free text can be read as a date. SQLite's date()
-- returns NULL for anything it can't parse, so "Aug 1" and "Until ended" are
-- left unbounded rather than guessed at — an unenforceable date is better than
-- a wrong one, and the admin now flags those rows so they can be re-entered.
UPDATE promos SET starts_at = date(starts) WHERE starts IS NOT NULL AND date(starts) IS NOT NULL;
UPDATE promos SET ends_at   = date(ends)   WHERE ends   IS NOT NULL AND date(ends)   IS NOT NULL;

-- ---- 3. Password reset ---------------------------------------------------
--
-- Only the hash of the token is stored, for the same reason only the hash of a
-- password is: a leak of this table must not hand anyone a working reset link.
-- Single-use (`used_at`) and short-lived (`expires_at`).
CREATE TABLE password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_password_resets_customer ON password_resets(customer_id);

-- ---- 4. Media: responsive widths, and a way out of D1 --------------------
--
-- Images were single-size BLOBs in D1. Two changes, both additive so every
-- existing row and every stored /images/<id> URL keeps working exactly as it
-- did:
--
--   `width`     — the pixel width of this row's bytes. 0 on existing rows,
--                 meaning "unknown, treat as the original".
--   `parent_id` — set on a resized derivative, pointing at the original it was
--                 made from. NULL on originals. This is what lets one stored
--                 URL serve a whole srcset: /images/<id>?w=400 resolves to the
--                 nearest derivative of <id>, falling back to <id> itself.
--   `storage`   — 'd1' (bytes in this row) or 'r2' (bytes in the bucket under
--                 this id). Existing rows are 'd1'. When R2 is enabled the
--                 Worker writes 'r2' and reads either, so the two can coexist
--                 during a migration and no product record ever changes.
ALTER TABLE media ADD COLUMN width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN parent_id TEXT;
ALTER TABLE media ADD COLUMN storage TEXT NOT NULL DEFAULT 'd1';
CREATE INDEX idx_media_parent ON media(parent_id, width);
