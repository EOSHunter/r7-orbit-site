-- The Movie Wheel's saved chats with R7 (functions/api/movie-wheel/chats.ts). One row per chat; its messages are kept as JSON in one column.
-- A deleted chat keeps its row (with deleted_at set and its messages emptied) for 30 days so a device that still has it open cannot bring it
-- back; the row is then pruned. Times are milliseconds since 1970. Applied once to the D1 database bound as WAITLIST_DB, like 0002:
--   npx wrangler d1 execute r7-waitlist --remote --file=migrations/0003_movie_wheel_chats.sql
CREATE TABLE IF NOT EXISTS movie_wheel_chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  messages TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER NOT NULL DEFAULT 0
);
