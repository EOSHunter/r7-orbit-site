-- Posters you upload yourself for movies TMDB has no picture of (or the wrong one): the picture, kept as text (base64), under a random name that the
-- movie's poster field holds (such as 'custom-0123456789abcdef'). Applied once, after 0005, to the D1 database bound as WAITLIST_DB:
--   npx wrangler d1 execute r7-waitlist --remote --file=migrations/0006_movie_wheel_uploaded_posters.sql
-- Running it twice does no harm.
CREATE TABLE IF NOT EXISTS movie_wheel_posters (
  token TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT 0
);
