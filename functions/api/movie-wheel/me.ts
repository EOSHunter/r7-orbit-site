// GET /api/movie-wheel/me: who is signed in, and the names the Movie Wheel shows for "added by". A Cloudflare Pages Function; everything it does
// is handleMe in src/lib/movie-wheel-api.ts. Setup is docs/MOVIE_WHEEL.md.
import { handleMe, type MovieWheelEnv } from '../../../src/lib/movie-wheel-api';

export const onRequest = (context: { request: Request; env: MovieWheelEnv }): Promise<Response> => handleMe(context);
