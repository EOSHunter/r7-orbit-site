-- The waitlist for R7 Orbit (docs/WAITLIST.md). One row per address: the address, when it was added
-- (UTC, ISO 8601 with milliseconds) and which form it came from (hero, blog, vlog or other; the endpoint checks the value).
-- Nothing else is stored: no IP address, no user agent, no name.
-- Applied once to the D1 database bound to the Pages project as WAITLIST_DB:
--   npx wrangler d1 execute r7-waitlist --remote --file=migrations/0001_waitlist.sql
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  source TEXT NOT NULL
);
