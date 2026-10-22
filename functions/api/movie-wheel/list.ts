// GET and PUT /api/movie-wheel/list: the Movie Wheel's list. A Cloudflare Pages Function; everything it does is handleList in
// src/lib/movie-wheel-api.ts. Setup is docs/MOVIE_WHEEL.md.
import { handleList, type MovieWheelEnv } from '../../../src/lib/movie-wheel-api';

export const onRequest = (context: { request: Request; env: MovieWheelEnv }): Promise<Response> => handleList(context);
