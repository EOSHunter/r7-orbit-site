// POST /api/movie-wheel/chat: the Movie Wheel's chat. A Cloudflare Pages Function; everything it does is handleChat in
// src/lib/movie-wheel-api.ts. Setup is docs/MOVIE_WHEEL.md.
import { handleChat, type MovieWheelEnv } from '../../../src/lib/movie-wheel-api';

export const onRequest = (context: { request: Request; env: MovieWheelEnv }): Promise<Response> => handleChat(context);
