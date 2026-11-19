// GET and POST /api/movie-wheel/r7: R7 Home (the household assistant) reading and changing the Movie Wheel. A Cloudflare Pages Function;
// everything it does is handleR7 in src/lib/movie-wheel-r7.ts. Only R7 Home's Access service token may call it. Setup is docs/MOVIE_WHEEL.md.
import type { MovieWheelEnv } from '../../../src/lib/movie-wheel-api';
import { handleR7 } from '../../../src/lib/movie-wheel-r7';

export const onRequest = (context: { request: Request; env: MovieWheelEnv }): Promise<Response> => handleR7(context);
