// GET /api/movie-wheel/tmdb: searches The Movie Database for a title, reads one movie's details, or serves a poster picture. A Cloudflare Pages Function;
// everything it does is handleTmdb in src/lib/movie-wheel-api.ts. Setup is docs/MOVIE_WHEEL.md.
import { handleTmdb, type MovieWheelEnv } from '../../../src/lib/movie-wheel-api';

export const onRequest = (context: { request: Request; env: MovieWheelEnv }): Promise<Response> => handleTmdb(context);
