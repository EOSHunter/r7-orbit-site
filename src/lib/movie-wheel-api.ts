// The Movie Wheel's two endpoints, as plain functions of a Request: functions/api/movie-wheel/list.ts and chat.ts (Cloudflare Pages
// Functions) only call these. Kept in src/lib so lint, `astro check` and Vitest cover them; nothing here reaches the built site.
//
//   GET  /api/movie-wheel/list   -> { list, removed, savedAt }  (list is null while nothing has ever been saved)
//   PUT  /api/movie-wheel/list   { list, removed } -> the merged { list, removed, savedAt }
//   POST /api/movie-wheel/chat   { messages, context } -> { reply }   (asks OpenAI; the key is a secret on the Pages project)
//
// Who may call: only a signed-in visitor of Cloudflare Access (the page and these endpoints are one Access application). Access puts a
// signed token in the Cf-Access-Jwt-Assertion header; it is checked here, so the endpoints stay closed even if the Access rule is
// ever removed or its path is wrong. With no Access settings in the Pages project they answer 503 and do nothing.
// Setup: docs/MOVIE_WHEEL.md.

// ---- The parts of Cloudflare's runtime used here ---------------------------------------------------------------------------

export interface D1Result {
  success: boolean;
  meta?: { changes?: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

/** The Pages project's bindings, variables and secrets: set in the Cloudflare dashboard (docs/MOVIE_WHEEL.md), never in the repository. */
export interface MovieWheelEnv {
  /** The waitlist's D1 database (docs/WAITLIST.md). The movie tables live in it under their own names. */
  WAITLIST_DB?: D1Database;
  /** Optional: a database of its own for the movies. Used instead of WAITLIST_DB when present. */
  MOVIES_DB?: D1Database;
  /** The Zero Trust team name, as in https://<team>.cloudflareaccess.com (the name alone, or the whole host). */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's Audience (AUD) tag. */
  ACCESS_AUD?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  /** The Movie Database's "API Read Access Token" (a secret): the posters, and details for the movies you add. */
  TMDB_TOKEN?: string;
  /** Who is who, as "email=Name" pairs separated by commas, such as "me@example.com=Hunter, mollie@example.com=Mollie". Names the people on "added by". */
  MOVIE_WHEEL_PEOPLE?: string;
  /** Only with DEV_BYPASS_ACCESS: the email to act as when trying the endpoints on your own computer. */
  DEV_EMAIL?: string;
  /** "1" only in .dev.vars, to try the endpoints on your own computer without Access. Never set it on the live site. */
  DEV_BYPASS_ACCESS?: string;
}

export interface MovieWheelContext {
  request: Request;
  env: MovieWheelEnv;
  /** Tests pass fakes for the two outside calls (Access's keys, OpenAI). */
  fetch?: typeof fetch;
  /** Milliseconds since 1970; tests fix it. */
  now?: number;
}

const MAX_MOVIES = 3000;
const MAX_BODY_BYTES = 700_000;
const REMOVED_KEEP_MS = 90 * 24 * 3600 * 1000;
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTEXT_CHARS = 80_000;
const MAX_REPLY_TOKENS = 900;

export const MESSAGES = {
  origin: 'Requests from other sites are not accepted.',
  closed: 'Sign-in protection is not set up for the Movie Wheel yet.',
  signIn: 'Please sign in again.',
  noDatabase: 'The Movie Wheel database is not connected to the site yet.',
  badBody: 'The request could not be read.',
  tooLarge: 'That list is too large.',
  method: 'Use GET or PUT.',
  noKey: 'The OpenAI key is not set on the site yet.',
  noTmdb: 'The TMDB token is not set on the site yet.',
  tmdbDown: 'The movie database could not be reached just now.',
  tmdbRefused: 'TMDB did not accept the site\'s token.',
  badPicture: 'That is not a picture the site can keep (a JPEG, PNG or WebP under 400 KB).',
  postersFull: 'The site already keeps as many uploaded posters as it allows.',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
const fail = (status: number, error: string) => json({ error }, status);

// ---- Who is calling: Cloudflare Access -------------------------------------------------------------------------------------

interface Jwk {
  kid?: string;
  kty: string;
  n?: string;
  e?: string;
  alg?: string;
}
let keyCache: { host: string; at: number; keys: Jwk[] } | undefined;
/** Forgets the kept Access keys (tests use a new key pair each time). */
export function forgetAccessKeys(): void {
  keyCache = undefined;
}

function teamHost(team: string): string {
  const t = team.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return t.includes('.') ? t : `${t}.cloudflareaccess.com`;
}
function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function b64urlToJson(s: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as Record<string, unknown>;
}

async function accessKeys(host: string, doFetch: typeof fetch, now: number): Promise<Jwk[]> {
  if (keyCache && keyCache.host === host && now - keyCache.at < 10 * 60_000) return keyCache.keys;
  const res = await doFetch(`https://${host}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('keys');
  const data = (await res.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  keyCache = { host, at: now, keys };
  return keys;
}

/** The signed-in visitor's email (lower case, empty when the token has none) if the request carries a valid Cloudflare Access token for this
 *  application, or null when it does not. */
export async function accessIdentity(ctx: MovieWheelContext): Promise<string | null> {
  const { env, request } = ctx;
  const doFetch = ctx.fetch ?? fetch;
  const now = ctx.now ?? Date.now();
  const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? '';
  const parts = token.split('.');
  if (parts.length !== 3 || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  try {
    const host = teamHost(env.ACCESS_TEAM_DOMAIN);
    const header = b64urlToJson(parts[0]);
    const payload = b64urlToJson(parts[1]);
    if (header.alg !== 'RS256') return null;
    const keys = await accessKeys(host, doFetch, now);
    const jwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk as JsonWebKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(parts[2]) as BufferSource,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`) as BufferSource,
    );
    if (!ok) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const seconds = Math.floor(now / 1000);
    const valid =
      aud.includes(env.ACCESS_AUD) &&
      payload.iss === `https://${host}` &&
      typeof payload.exp === 'number' &&
      payload.exp > seconds &&
      (payload.nbf === undefined || (typeof payload.nbf === 'number' && payload.nbf <= seconds + 60));
    return valid ? String(payload.email ?? '').trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/** True when the request carries a valid Cloudflare Access token for this application. */
export async function accessAllows(ctx: MovieWheelContext): Promise<boolean> {
  return (await accessIdentity(ctx)) !== null;
}

// ---- Who is who -------------------------------------------------------------------------------------------------------------

export interface Person {
  key: string;
  name: string;
  email: string;
}

/** The people named in MOVIE_WHEEL_PEOPLE, a list like "me@example.com=Hunter, mollie@example.com=Mollie" (a name per email address). */
export function peopleOf(env: MovieWheelEnv): Person[] {
  const out: Person[] = [];
  for (const part of String(env.MOVIE_WHEEL_PEOPLE ?? '').split(',')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const email = part.slice(0, i).trim().toLowerCase();
    const name = part.slice(i + 1).trim().slice(0, 24);
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
    if (email && name && key && key !== 'r7') out.push({ key, name, email });
  }
  return out;
}

/** Who is calling: the configured person for this email, or else a name made from the start of the address. */
export function whoIs(env: MovieWheelEnv, email: string): { key: string; name: string } {
  const person = peopleOf(env).find((p) => p.email === email);
  if (person) return { key: person.key, name: person.name };
  const local = email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 24).toLowerCase();
  const key = local && local !== 'r7' ? local : 'me';
  return { key, name: key.charAt(0).toUpperCase() + key.slice(1) };
}

/** The checks every endpoint shares. Returns the Response to send when one fails, or the caller's email when they may go on. */
async function guard(ctx: MovieWheelContext, methods: string[]): Promise<Response | { email: string }> {
  const { request, env } = ctx;
  if (!methods.includes(request.method)) return fail(405, `Use ${methods.join(' or ')}.`);
  const origin = request.headers.get('Origin');
  if (request.method !== 'GET' && origin && origin !== new URL(request.url).origin) return fail(403, MESSAGES.origin);
  if (env.DEV_BYPASS_ACCESS === '1') return { email: (env.DEV_EMAIL ?? 'dev@localhost').toLowerCase() };
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return fail(503, MESSAGES.closed);
  const email = await accessIdentity(ctx);
  if (email === null) return fail(401, MESSAGES.signIn);
  return { email };
}

/** GET /api/movie-wheel/me -> { key, name, people }: who is signed in, and the names the page can show for "added by". */
export async function handleMe(ctx: MovieWheelContext): Promise<Response> {
  const who = await guard(ctx, ['GET']);
  if (who instanceof Response) return who;
  const me = whoIs(ctx.env, who.email);
  const people = peopleOf(ctx.env).map((p) => ({ key: p.key, name: p.name }));
  if (!people.some((p) => p.key === me.key)) people.push(me);
  people.push({ key: 'r7', name: 'R7' });
  return json({ key: me.key, name: me.name, people });
}

// ---- The list ---------------------------------------------------------------------------------------------------------------

export interface Movie {
  id: string;
  title: string;
  watched: boolean;
  genres: string[];
  runtime: number;
  year: number;
  rating: number;
  review: string;
  addedAt: number;
  watchedAt: number;
  updatedAt: number;
  /** Who added the movie: a person's key (such as 'hunter' or 'mollie'), 'r7' for the chat assistant, or empty when it is not known. */
  addedBy: string;
  /** TMDB's file path for the poster, such as '/abc123.jpg', or empty. */
  poster: string;
}

interface Row {
  id: string;
  title: string;
  watched: number;
  genres: string;
  runtime: number;
  year: number;
  rating: number;
  review: string;
  added_at: number;
  watched_at: number;
  updated_at: number;
  added_by: string;
  poster: string;
  deleted_at: number;
}

/** TMDB's poster file path, such as '/abc123.jpg'. */
const TMDB_PATH = /^\/[A-Za-z0-9_-]{5,60}\.(jpg|png|webp)$/;
/** The name of a picture the owner uploaded, such as 'custom-0123456789abcdef'. */
const UPLOAD_NAME = /^custom-[0-9a-f]{16}$/;
const POSTER_PATH = { test: (v: string) => TMDB_PATH.test(v) || UPLOAD_NAME.test(v) };

/** Keeps only what a movie is allowed to hold, trimmed to size. Anything else the page sends is dropped. */
export function cleanMovie(x: unknown): Movie | null {
  if (!x || typeof x !== 'object') return null;
  const m = x as Record<string, unknown>;
  const title = String(m.title ?? '').trim().slice(0, 120);
  const id = String(m.id ?? '').slice(0, 64);
  if (!title || !id) return null;
  const num = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v)) || 0));
  return {
    id,
    title,
    watched: !!m.watched,
    genres: (Array.isArray(m.genres) ? m.genres : []).map((g) => String(g).trim().slice(0, 24)).filter(Boolean).slice(0, 12),
    runtime: num(m.runtime, 0, 999),
    year: num(m.year, 0, 2100),
    rating: num(m.rating, 0, 5),
    review: String(m.review ?? '').slice(0, 280),
    addedAt: Math.max(0, Number(m.addedAt) || 0),
    watchedAt: Math.max(0, Number(m.watchedAt) || 0),
    updatedAt: Math.max(0, Number(m.updatedAt) || 0),
    addedBy: /^[a-z0-9_-]{1,24}$/.test(String(m.addedBy ?? '')) ? String(m.addedBy) : '',
    poster: POSTER_PATH.test(String(m.poster ?? '')) ? String(m.poster) : '',
  };
}

function database(env: MovieWheelEnv): D1Database | undefined {
  return env.MOVIES_DB ?? env.WAITLIST_DB;
}

async function readAll(db: D1Database): Promise<{ list: Movie[] | null; removed: Record<string, number>; savedAt: number }> {
  const rows = (await db.prepare('SELECT * FROM movie_wheel_movies ORDER BY added_at, id').all<Row>()).results;
  const meta = (await db.prepare("SELECT value FROM movie_wheel_meta WHERE key = 'version'").all<{ value: number }>()).results;
  const savedAt = meta[0]?.value ?? 0;
  const removed: Record<string, number> = {};
  const list: Movie[] = [];
  for (const r of rows) {
    if (r.deleted_at > 0) {
      removed[r.id] = r.deleted_at;
      continue;
    }
    let genres: string[] = [];
    try {
      const parsed: unknown = JSON.parse(r.genres);
      if (Array.isArray(parsed)) genres = parsed.map(String);
    } catch {
      /* a bad value reads as no genres */
    }
    list.push({
      id: r.id, title: r.title, watched: !!r.watched, genres, runtime: r.runtime, year: r.year, rating: r.rating,
      review: r.review, addedAt: r.added_at, watchedAt: r.watched_at, updatedAt: r.updated_at, addedBy: r.added_by ?? '', poster: r.poster ?? '',
    });
  }
  if (savedAt === 0 && !list.length && !Object.keys(removed).length) return { list: null, removed, savedAt };
  return { list, removed, savedAt };
}

// A movie is kept from whichever copy changed it last (updated_at); a removal wins over an edit made before it, and an edit made after a
// removal brings the movie back. Equal times keep what is stored, so a device with an old copy never undoes newer work.
const UPSERT = `INSERT INTO movie_wheel_movies
  (id, title, watched, genres, runtime, year, rating, review, added_at, watched_at, updated_at, added_by, poster, deleted_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, COALESCE(NULLIF(?12, ''), ?13), ?14, 0)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, watched = excluded.watched, genres = excluded.genres, runtime = excluded.runtime, year = excluded.year,
    rating = excluded.rating, review = excluded.review, added_at = excluded.added_at, watched_at = excluded.watched_at,
    updated_at = excluded.updated_at, added_by = CASE WHEN ?12 != '' THEN ?12 ELSE movie_wheel_movies.added_by END, poster = excluded.poster, deleted_at = 0
  WHERE excluded.updated_at > movie_wheel_movies.updated_at AND excluded.updated_at > movie_wheel_movies.deleted_at`;
const REMOVE = `INSERT INTO movie_wheel_movies (id, title, deleted_at) VALUES (?, '', ?)
  ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at
  WHERE excluded.deleted_at >= movie_wheel_movies.updated_at AND excluded.deleted_at > movie_wheel_movies.deleted_at`;

export async function handleList(ctx: MovieWheelContext): Promise<Response> {
  const who = await guard(ctx, ['GET', 'PUT']);
  if (who instanceof Response) return who;
  const db = database(ctx.env);
  if (!db) return fail(503, MESSAGES.noDatabase);
  const now = ctx.now ?? Date.now();

  if (ctx.request.method === 'GET') return json(await readAll(db));

  const text = await ctx.request.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, MESSAGES.tooLarge);
  let body: { list?: unknown; removed?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return fail(400, MESSAGES.badBody);
  }
  if (!body || !Array.isArray(body.list) || body.list.length > MAX_MOVIES) return fail(400, MESSAGES.badBody);

  const me = whoIs(ctx.env, who.email);
  const known = new Set([...peopleOf(ctx.env).map((p) => p.key), me.key, 'r7']);
  const statements: D1PreparedStatement[] = [];
  for (const raw of body.list) {
    const m = cleanMovie(raw);
    if (!m) continue;
    if (!known.has(m.addedBy)) m.addedBy = '';
    statements.push(
      db.prepare(UPSERT).bind(m.id, m.title, m.watched ? 1 : 0, JSON.stringify(m.genres), m.runtime, m.year, m.rating, m.review, m.addedAt, m.watchedAt, m.updatedAt, m.addedBy, me.key, m.poster),
    );
  }
  if (body.removed && typeof body.removed === 'object') {
    for (const [id, ts] of Object.entries(body.removed as Record<string, unknown>).slice(0, 5000)) {
      const t = Number(ts);
      if (id.length <= 64 && t > 0 && now - t < REMOVED_KEEP_MS) statements.push(db.prepare(REMOVE).bind(id, Math.round(t)));
    }
  }
  const results = statements.length ? await db.batch(statements) : [];
  const changed = results.some((r) => (r.meta?.changes ?? 0) > 0);
  const after: D1PreparedStatement[] = [db.prepare('DELETE FROM movie_wheel_movies WHERE deleted_at > 0 AND deleted_at < ?').bind(now - REMOVED_KEEP_MS)];
  if (changed) {
    after.push(db.prepare("INSERT INTO movie_wheel_meta (key, value) VALUES ('version', 1) ON CONFLICT(key) DO UPDATE SET value = value + 1"));
  }
  await db.batch(after);
  return json(await readAll(db));
}

// ---- TMDB: posters and details ----------------------------------------------------------------------------------------------

// The Movie Database's genre ids, as the names the page uses ("Sci-fi", not "Science Fiction"). A TV movie is not a genre of film.
const TMDB_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy',
  36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-fi', 53: 'Thriller', 10752: 'War', 37: 'Western',
};
const POSTER_SIZES = new Set(['w92', 'w154', 'w185', 'w342', 'w500']);

export interface TmdbMovie {
  id: number;
  title: string;
  year: number;
  poster: string;
  overview: string;
  genres: string[];
  runtime?: number;
}

function tmdbMovie(x: unknown): TmdbMovie | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const id = Math.round(Number(r.id));
  const title = String(r.title ?? '').trim().slice(0, 120);
  if (!(id > 0) || !title) return null;
  const ids = Array.isArray(r.genre_ids) ? r.genre_ids : Array.isArray(r.genres) ? r.genres.map((g) => (g as { id?: unknown })?.id) : [];
  const out: TmdbMovie = {
    id,
    title,
    year: Math.max(0, Math.min(2100, Math.round(Number(String(r.release_date ?? '').slice(0, 4))) || 0)),
    poster: TMDB_PATH.test(String(r.poster_path ?? '')) ? String(r.poster_path) : '',
    overview: String(r.overview ?? '').slice(0, 300),
    genres: ids.map((g) => TMDB_GENRES[Number(g)]).filter((g): g is string => !!g),
  };
  const runtime = Math.round(Number(r.runtime));
  if (runtime > 0) out.runtime = Math.min(999, runtime);
  return out;
}

/**
 * GET /api/movie-wheel/tmdb?q=<title>[&year=<year>]  -> { results: TmdbMovie[] } (the best eight matches)
 * GET /api/movie-wheel/tmdb?id=<tmdb id>             -> TmdbMovie, with its length
 * GET /api/movie-wheel/tmdb?img=/abc123.jpg[&w=w185] -> the poster picture, kept by the browser for a year
 * The token stays here; the page never sees it. The picture goes through here too, so the page asks nobody but its own site.
 */
export async function handleTmdb(ctx: MovieWheelContext): Promise<Response> {
  const who = await guard(ctx, ['GET']);
  if (who instanceof Response) return who;
  const doFetch = ctx.fetch ?? fetch;
  const params = new URL(ctx.request.url).searchParams;

  const img = params.get('img');
  if (img !== null) {
    const size = params.get('w') ?? 'w185';
    if (!TMDB_PATH.test(img) || !POSTER_SIZES.has(size)) return fail(400, MESSAGES.badBody);
    let res: Response;
    try {
      res = await doFetch(`https://image.tmdb.org/t/p/${size}${img}`);
    } catch {
      return fail(502, MESSAGES.tmdbDown);
    }
    if (!res.ok) return fail(res.status === 404 ? 404 : 502, MESSAGES.tmdbDown);
    const type = res.headers.get('Content-Type') ?? '';
    if (!type.startsWith('image/')) return fail(502, MESSAGES.tmdbDown);
    return new Response(res.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  }

  const token = ctx.env.TMDB_TOKEN;
  if (!token) return fail(503, MESSAGES.noTmdb);
  const q = (params.get('q') ?? '').trim().slice(0, 120);
  const idParam = params.get('id');
  let url: string;
  if (idParam !== null) {
    if (!/^[1-9][0-9]{0,9}$/.test(idParam)) return fail(400, MESSAGES.badBody);
    url = `https://api.themoviedb.org/3/movie/${idParam}?language=en-US`;
  } else if (q.length >= 2) {
    const year = Math.round(Number(params.get('year')));
    url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1${year >= 1870 && year <= 2100 ? `&year=${year}` : ''}`;
  } else {
    return fail(400, MESSAGES.badBody);
  }
  let res: Response;
  try {
    res = await doFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  } catch {
    return fail(502, MESSAGES.tmdbDown);
  }
  if (res.status === 401) return fail(502, MESSAGES.tmdbRefused);
  if (res.status === 404 && idParam !== null) return fail(404, MESSAGES.badBody);
  if (!res.ok) return fail(502, MESSAGES.tmdbDown);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return fail(502, MESSAGES.tmdbDown);
  }
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' };
  if (idParam !== null) {
    const movie = tmdbMovie(data);
    return movie ? new Response(JSON.stringify(movie), { headers }) : fail(502, MESSAGES.tmdbDown);
  }
  const found = (data as { results?: unknown })?.results;
  const results = (Array.isArray(found) ? found : []).map(tmdbMovie).filter((m): m is TmdbMovie => !!m).slice(0, 8);
  return new Response(JSON.stringify({ results }), { headers });
}

// ---- Uploaded posters ---------------------------------------------------------------------------------------------------------

const MAX_UPLOAD_BYTES = 400_000;
const MAX_UPLOADS = 500;
const PICTURE_TYPES: Record<string, (b: Uint8Array) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/webp': (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * POST /api/movie-wheel/poster (the picture as the body: JPEG, PNG or WebP, under 400 KB) -> { poster: 'custom-...' }
 * GET  /api/movie-wheel/poster?id=custom-...   -> the picture, kept by the browser for a year (the name changes with every upload)
 * The page shrinks a picture before sending it, so a poster is about 30 KB.
 */
export async function handlePoster(ctx: MovieWheelContext): Promise<Response> {
  const who = await guard(ctx, ['GET', 'POST']);
  if (who instanceof Response) return who;
  const db = database(ctx.env);
  if (!db) return fail(503, MESSAGES.noDatabase);

  if (ctx.request.method === 'GET') {
    const id = new URL(ctx.request.url).searchParams.get('id') ?? '';
    if (!UPLOAD_NAME.test(id)) return fail(400, MESSAGES.badBody);
    const row = (await db.prepare('SELECT type, data FROM movie_wheel_posters WHERE token = ?').bind(id).all<{ type: string; data: string }>()).results[0];
    if (!row || !PICTURE_TYPES[row.type]) return fail(404, MESSAGES.badBody);
    return new Response(fromBase64(row.data), {
      headers: { 'Content-Type': row.type, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
    });
  }

  const type = (ctx.request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const check = PICTURE_TYPES[type];
  if (!check) return fail(415, MESSAGES.badPicture);
  const bytes = new Uint8Array(await ctx.request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES || !check(bytes)) return fail(400, MESSAGES.badPicture);
  const count = (await db.prepare('SELECT COUNT(*) AS n FROM movie_wheel_posters').all<{ n: number }>()).results[0]?.n ?? 0;
  if (count >= MAX_UPLOADS) return fail(507, MESSAGES.postersFull);
  const random = crypto.getRandomValues(new Uint8Array(8));
  const token = `custom-${[...random].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  await db.prepare('INSERT INTO movie_wheel_posters (token, type, data, created_at) VALUES (?, ?, ?, ?)').bind(token, type, toBase64(bytes), ctx.now ?? Date.now()).run();
  return json({ poster: token });
}

// ---- The chat ---------------------------------------------------------------------------------------------------------------

const SYSTEM = `You are R7, the movie assistant inside the owner's personal Movie Wheel app. If asked your name, say you are R7.
You can see their full movie history below: what they have watched (with their own star ratings and short reviews), what is still on their to-watch list, genres, lengths and release years.
Answer using that data. Be specific: name titles, give counts and hours, and say when something is not in the data instead of guessing.
You may recommend films from outside the list when asked, but say they are not on the list. When you recommend from the to-watch list, use exactly the titles shown.
Keep answers short and plain. Do not use emoji. Rating scale is 1 to 5 stars; 4 and 5 stars count as favorites.
Format with simple Markdown: **bold** for movie titles and key numbers, and a numbered or bulleted list when naming several movies. No tables and no headings.
When asked to recommend movies to add or watch, first check every title against the WATCHED and TO WATCH lists, and never suggest a movie that appears in either one.
You can add movies to the to-watch list with the add_movies tool. Use it only when the user asks you to add movies (or to add what you just recommended). Never add movies on your own, and never add a title that is already on either list. After adding, say in one short sentence which movies you added.
After your answer, add one last line in exactly this form, with nothing after it: [[followups: first | second | third]]
Give 2 or 3 short things the user could say next, written as the user would say them and under 60 characters each: a next step, a recommendation, or a related question. When you have just recommended movies, make one of them ask you to add them to the list. Never mention or explain this line.`;

/** What R7 may do to the list. The server only passes these requests on; the page carries them out (and shows an Undo). */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_movies',
      description: "Add movies to the user's to-watch list. Only when the user asks you to add movies. Never add a title that is already on the WATCHED or TO WATCH lists.",
      parameters: {
        type: 'object',
        properties: {
          movies: {
            type: 'array',
            maxItems: 10,
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'The movie title, as it is usually written.' },
                year: { type: 'integer', description: 'The release year, if you are sure of it.' },
              },
              required: ['title'],
            },
          },
        },
        required: ['movies'],
      },
    },
  },
];

export interface ChatAction {
  type: 'add_movies';
  movies: { title: string; year?: number }[];
}

/** The movies in an add_movies call, cleaned: up to 10, a title of up to 120 characters, a plausible year. */
export function cleanAddMovies(args: unknown): { title: string; year?: number }[] {
  let parsed: unknown = args;
  if (typeof args === 'string') {
    try {
      parsed = JSON.parse(args);
    } catch {
      return [];
    }
  }
  const list = (parsed as { movies?: unknown } | null)?.movies;
  if (!Array.isArray(list)) return [];
  const out: { title: string; year?: number }[] = [];
  for (const m of list.slice(0, 50)) {
    const title = String((m as { title?: unknown } | null)?.title ?? '').trim().slice(0, 120);
    if (!title) continue;
    const year = Math.round(Number((m as { year?: unknown }).year));
    out.push(year >= 1880 && year <= 2100 ? { title, year } : { title });
  }
  return out.slice(0, 10);
}

interface OpenAiMessage {
  role: string;
  content?: string | null;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
}
interface OpenAiReply {
  error?: { message?: string };
  choices?: { message?: OpenAiMessage }[];
}

/** Takes the "[[followups: a | b | c]]" line off the end of a reply: the reply without it, and up to 3 short follow-up messages. */
export function splitFollowups(text: string): { reply: string; followups: string[] } {
  const m = /\[\[\s*followups\s*:([\s\S]*?)\]\]\s*$/i.exec(text);
  if (!m) return { reply: text.replace(/\[\[\s*followups[\s\S]*$/i, '').trimEnd(), followups: [] };   // a cut-off or stray marker is dropped, not shown
  const followups = m[1]
    .split('|')
    .map((x) => x.replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 80))
    .filter(Boolean)
    .slice(0, 3);
  return { reply: text.slice(0, m.index).trimEnd(), followups };
}

export async function handleChat(ctx: MovieWheelContext): Promise<Response> {
  const who = await guard(ctx, ['POST']);
  if (who instanceof Response) return who;
  const { env } = ctx;
  if (!env.OPENAI_API_KEY) return fail(503, MESSAGES.noKey);
  let body: { messages?: unknown; context?: unknown };
  try {
    body = (await ctx.request.json()) as typeof body;
  } catch {
    return fail(400, MESSAGES.badBody);
  }
  const { messages, context } = body ?? {};
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) return fail(400, `Send between 1 and ${MAX_MESSAGES} messages.`);
  const clean: { role: string; content: string }[] = [];
  for (const m of messages as Record<string, unknown>[]) {
    const role = m?.role;
    const content = m?.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim() || content.length > MAX_MESSAGE_CHARS) {
      return fail(400, `Each message needs a role of user or assistant and text under ${MAX_MESSAGE_CHARS} characters.`);
    }
    clean.push({ role, content });
  }
  if (clean[clean.length - 1].role !== 'user') return fail(400, 'The last message must be from the user.');
  const ctxText = typeof context === 'string' ? context.slice(0, MAX_CONTEXT_CHARS) : '';
  const system = { role: 'system', content: `${SYSTEM}\n\n--- MOVIE DATA ---\n${ctxText}` };

  const ask = async (payload: Record<string, unknown>): Promise<{ data: OpenAiReply | null } | Response> => {
    let res: Response;
    try {
      res = await (ctx.fetch ?? fetch)('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: env.OPENAI_MODEL || 'gpt-4o-mini', max_completion_tokens: MAX_REPLY_TOKENS, ...payload }),
      });
    } catch {
      return fail(502, 'Could not reach OpenAI.');
    }
    const data = (await res.json().catch(() => null)) as OpenAiReply | null;
    if (!res.ok) return fail(502, `OpenAI said: ${String(data?.error?.message ?? `status ${res.status}.`).slice(0, 300)}`);
    return { data };
  };

  const first = await ask({ messages: [system, ...clean], tools: TOOLS });
  if (first instanceof Response) return first;
  const message = first.data?.choices?.[0]?.message;
  const calls = (message?.tool_calls ?? []).filter((c) => c?.type === 'function');
  if (!calls.length) {
    const raw = message?.content;
    if (!raw) return fail(502, 'OpenAI sent an empty answer.');
    const { reply, followups } = splitFollowups(raw);
    return json(followups.length ? { reply, followups } : { reply });
  }

  // R7 asked to add movies. The page does the adding; the model is told it was done and writes the short confirmation.
  const actions: ChatAction[] = [];
  const results = calls.map((c) => {
    if (c.function?.name !== 'add_movies') return { role: 'tool', tool_call_id: c.id, content: 'That tool does not exist.' };
    const movies = cleanAddMovies(c.function.arguments);
    if (!movies.length) return { role: 'tool', tool_call_id: c.id, content: 'No valid movies were given, so nothing was added.' };
    actions.push({ type: 'add_movies', movies });
    return { role: 'tool', tool_call_id: c.id, content: 'Done. The app adds them to the to-watch list and skips any title that is already on it.' };
  });
  const names = actions.flatMap((a) => a.movies.map((m) => m.title));
  const second = await ask({
    messages: [system, ...clean, { role: 'assistant', content: message?.content ?? null, tool_calls: calls }, ...results],
  });
  const text = second instanceof Response ? '' : second.data?.choices?.[0]?.message?.content;
  const split = splitFollowups(text || '');
  const reply = split.reply || (names.length ? 'I\'ll add ' + names.join(', ') + ' to your list.' : "I couldn't add anything from that.");
  return json({ reply, ...(split.followups.length ? { followups: split.followups } : {}), ...(actions.length ? { actions } : {}) });
}

// ---- Saved chats ------------------------------------------------------------------------------------------------------------
//   GET    /api/movie-wheel/chats            -> { chats: [{ id, title, createdAt, updatedAt }] }   newest first
//   GET    /api/movie-wheel/chats?id=ID      -> { chat: { id, title, messages, createdAt, updatedAt } }
//   PUT    /api/movie-wheel/chats            { id, title, messages } -> { chat: summary }          create or replace
//   DELETE /api/movie-wheel/chats?id=ID      -> { ok: true }
// A chat is one row holding its messages as JSON. A message is { role: 'user' | 'assistant' | 'note', content, ... }; a note records what R7
// did to the list ({ ids, titles, skipped, undone }) so its Undo still works after a reload.

const MAX_CHATS = 500;
const MAX_CHAT_MESSAGES = 200;
const MAX_CHAT_JSON = 400_000;
const DELETED_KEEP_MS = 30 * 24 * 3600 * 1000;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'note';
  content: string;
  followups?: string[];
  ids?: string[];
  titles?: string[];
  skipped?: string[];
  undone?: boolean;
}
interface ChatRow {
  id: string;
  title: string;
  messages: string;
  created_at: number;
  updated_at: number;
}

const strings = (v: unknown, max: number, len: number): string[] =>
  (Array.isArray(v) ? v : []).map((x) => String(x).slice(0, len)).filter(Boolean).slice(0, max);

/** Keeps only what a saved message may hold, trimmed to size. */
export function cleanChatMessage(x: unknown): ChatMessage | null {
  if (!x || typeof x !== 'object') return null;
  const m = x as Record<string, unknown>;
  if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'note') return null;
  const content = String(m.content ?? '').slice(0, 8000);
  if (m.role !== 'note' && !content.trim()) return null;
  const out: ChatMessage = { role: m.role, content };
  if (m.role === 'assistant') {
    const followups = strings(m.followups, 3, 80);
    if (followups.length) out.followups = followups;
  }
  if (m.role === 'note') {
    out.ids = strings(m.ids, 10, 64);
    out.titles = strings(m.titles, 10, 120);
    out.skipped = strings(m.skipped, 10, 120);
    out.undone = !!m.undone;
  }
  return out;
}

export async function handleChats(ctx: MovieWheelContext): Promise<Response> {
  const who = await guard(ctx, ['GET', 'PUT', 'DELETE']);
  if (who instanceof Response) return who;
  const db = database(ctx.env);
  if (!db) return fail(503, MESSAGES.noDatabase);
  const now = ctx.now ?? Date.now();
  const url = new URL(ctx.request.url);
  const id = url.searchParams.get('id') ?? '';
  const validId = /^[A-Za-z0-9_-]{1,64}$/.test(id);

  if (ctx.request.method === 'GET') {
    if (!id) {
      const rows = (await db.prepare('SELECT id, title, created_at, updated_at FROM movie_wheel_chats WHERE deleted_at = 0 ORDER BY updated_at DESC LIMIT 500').all<ChatRow>()).results;
      return json({ chats: rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at })) });
    }
    if (!validId) return fail(400, MESSAGES.badBody);
    const rows = (await db.prepare('SELECT * FROM movie_wheel_chats WHERE id = ? AND deleted_at = 0').bind(id).all<ChatRow>()).results;
    if (!rows.length) return fail(404, 'That chat was not found.');
    let messages: unknown = [];
    try {
      messages = JSON.parse(rows[0].messages);
    } catch {
      /* a bad value reads as an empty chat */
    }
    return json({ chat: { id: rows[0].id, title: rows[0].title, messages: Array.isArray(messages) ? messages : [], createdAt: rows[0].created_at, updatedAt: rows[0].updated_at } });
  }

  if (ctx.request.method === 'DELETE') {
    if (!validId) return fail(400, MESSAGES.badBody);
    await db.batch([
      db.prepare('UPDATE movie_wheel_chats SET deleted_at = ?, messages = ? WHERE id = ? AND deleted_at = 0').bind(now, '[]', id),
      db.prepare('DELETE FROM movie_wheel_chats WHERE deleted_at > 0 AND deleted_at < ?').bind(now - DELETED_KEEP_MS),
    ]);
    return json({ ok: true });
  }

  const text = await ctx.request.text();
  if (text.length > MAX_CHAT_JSON + 20_000) return fail(413, MESSAGES.tooLarge);
  let body: { id?: unknown; title?: unknown; messages?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return fail(400, MESSAGES.badBody);
  }
  const chatId = String(body?.id ?? '');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(chatId) || !Array.isArray(body.messages) || body.messages.length > MAX_CHAT_MESSAGES) return fail(400, MESSAGES.badBody);
  const messages = body.messages.map(cleanChatMessage).filter((m): m is ChatMessage => !!m);
  const json_ = JSON.stringify(messages);
  if (json_.length > MAX_CHAT_JSON) return fail(413, MESSAGES.tooLarge);
  const title = String(body.title ?? '').trim().replace(/\s+/g, ' ').slice(0, 80) || 'New chat';

  const existing = (await db.prepare('SELECT deleted_at FROM movie_wheel_chats WHERE id = ?').bind(chatId).all<{ deleted_at: number }>()).results;
  if (existing.length && existing[0].deleted_at > 0) return fail(410, 'That chat was deleted.');
  if (!existing.length) {
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM movie_wheel_chats WHERE deleted_at = 0').all<{ n: number }>()).results[0]?.n ?? 0;
    if (count >= MAX_CHATS) return fail(400, 'There are too many saved chats. Delete some first.');
  }
  await db
    .prepare(
      `INSERT INTO movie_wheel_chats (id, title, messages, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, messages = excluded.messages, updated_at = excluded.updated_at WHERE deleted_at = 0`,
    )
    .bind(chatId, title, json_, now, now)
    .run();
  const row = (await db.prepare('SELECT id, title, created_at, updated_at FROM movie_wheel_chats WHERE id = ?').bind(chatId).all<ChatRow>()).results[0];
  return json({ chat: { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at } });
}
