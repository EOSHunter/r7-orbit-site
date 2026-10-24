-- Who added a movie to the Movie Wheel's list: 'r7' for a movie the chat assistant added, empty for one you added yourself. The page uses it to
-- filter "added by R7" from "added by me". Applied once, after 0002, to the D1 database bound as WAITLIST_DB:
--   npx wrangler d1 execute r7-waitlist --remote --file=migrations/0004_movie_wheel_added_by.sql
-- SQLite has no "ADD COLUMN IF NOT EXISTS", so running this twice fails with "duplicate column name": that error means it was already applied.
ALTER TABLE movie_wheel_movies ADD COLUMN added_by TEXT NOT NULL DEFAULT '';
