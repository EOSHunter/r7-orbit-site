-- The Movie Wheel's list (the unlisted page under public/mw-.../ and functions/api/movie-wheel/). One row per movie. A removed movie
-- stays as a row with deleted_at set, so a device that was offline cannot bring it back; those rows are pruned after 90 days.
-- All times are milliseconds since 1970 (what the page's JavaScript uses). Applied once to the D1 database bound to the Pages project:
--   npx wrangler d1 execute r7-waitlist --remote --file=migrations/0002_movie_wheel.sql
-- It lives in the same database as the waitlist (binding WAITLIST_DB) under its own table names, so no new database or binding is needed.
CREATE TABLE IF NOT EXISTS movie_wheel_movies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  watched INTEGER NOT NULL DEFAULT 0,
  genres TEXT NOT NULL DEFAULT '[]',
  runtime INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 0,
  review TEXT NOT NULL DEFAULT '',
  added_at INTEGER NOT NULL DEFAULT 0,
  watched_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER NOT NULL DEFAULT 0
);
-- One counter that goes up whenever the list changes, so a device can tell whether it is up to date with one cheap read.
CREATE TABLE IF NOT EXISTS movie_wheel_meta (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
