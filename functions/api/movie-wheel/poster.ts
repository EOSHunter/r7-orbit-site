// GET /api/movie-wheel/poster?id=custom-...: a poster you uploaded. POST /api/movie-wheel/poster: keeps a picture and answers its name. A Cloudflare Pages
// Function; everything it does is handlePoster in src/lib/movie-wheel-api.ts. Setup is docs/MOVIE_WHEEL.md.
import { handlePoster, type MovieWheelEnv } from '../../../src/lib/movie-wheel-api';

export const onRequest = (context: { request: Request; env: MovieWheelEnv }): Promise<Response> => handlePoster(context);
