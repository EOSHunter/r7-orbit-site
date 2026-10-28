-- TV shows on the Movie Wheel's list. kind is 'movie' or 'show'; for a show, season and episode are the last episode watched (0 and 0 when not
-- started) and season_eps is a JSON list of how many episodes each season has (such as '[10,8,8]'), from TMDB, so the page can add up the hours.
-- Applied once, after 0006, to the D1 database bound as WAITLIST_DB:
--   npx wrangler d1 execute r7-waitlist --remote --file=migrations/0007_movie_wheel_shows.sql
-- Each line adds a column, so running this twice fails with "duplicate column name": that error means it was already applied.
ALTER TABLE movie_wheel_movies ADD COLUMN kind TEXT NOT NULL DEFAULT 'movie';
ALTER TABLE movie_wheel_movies ADD COLUMN season INTEGER NOT NULL DEFAULT 0;
ALTER TABLE movie_wheel_movies ADD COLUMN episode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE movie_wheel_movies ADD COLUMN season_eps TEXT NOT NULL DEFAULT '';
