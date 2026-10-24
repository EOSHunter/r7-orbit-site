-- A movie's poster on the Movie Wheel: the file path TMDB gives (such as '/abc123.jpg'), empty when there is none. The page shows it through
-- /api/movie-wheel/tmdb?img=... Applied once, after 0004, to the D1 database bound as WAITLIST_DB:
--   npx wrangler d1 execute r7-waitlist --remote --file=migrations/0005_movie_wheel_poster.sql
-- SQLite has no "ADD COLUMN IF NOT EXISTS", so running this twice fails with "duplicate column name": that error means it was already applied.
ALTER TABLE movie_wheel_movies ADD COLUMN poster TEXT NOT NULL DEFAULT '';
