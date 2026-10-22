// GET, PUT and DELETE /api/movie-wheel/chats: the Movie Wheel's saved chats with R7. A Cloudflare Pages Function; everything it does is
// handleChats in src/lib/movie-wheel-api.ts. Setup is docs/MOVIE_WHEEL.md.
import { handleChats, type MovieWheelEnv } from '../../../src/lib/movie-wheel-api';

export const onRequest = (context: { request: Request; env: MovieWheelEnv }): Promise<Response> => handleChats(context);
