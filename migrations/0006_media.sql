-- Product imagery. Stored in D1 today so uploads work without extra
-- infrastructure; served by the Worker at a stable /images/<id> URL behind an
-- immutable cache header, so the storage backend can move to R2 later without
-- changing a single stored URL.

CREATE TABLE media (
  id TEXT PRIMARY KEY,              -- e.g. "img_ab12cd34"
  mime TEXT NOT NULL,
  bytes BLOB NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  alt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
