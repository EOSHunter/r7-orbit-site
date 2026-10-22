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

/** True when the request carries a valid Cloudflare Access token for this application. */
export async function accessAllows(ctx: MovieWheelContext): Promise<boolean> {
  const { env, request } = ctx;
  const doFetch = ctx.fetch ?? fetch;
  const now = ctx.now ?? Date.now();
  const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? '';
  const parts = token.split('.');
  if (parts.length !== 3 || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  try {
    const host = teamHost(env.ACCESS_TEAM_DOMAIN);
    const header = b64urlToJson(parts[0]);
    const payload = b64urlToJson(parts[1]);
    if (header.alg !== 'RS256') return false;
    const keys = await accessKeys(host, doFetch, now);
    const jwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk as JsonWebKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(parts[2]) as BufferSource,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`) as BufferSource,
    );
    if (!ok) return false;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const seconds = Math.floor(now / 1000);
    return (
      aud.includes(env.ACCESS_AUD) &&
      payload.iss === `https://${host}` &&
      typeof payload.exp === 'number' &&
      payload.exp > seconds &&
      (payload.nbf === undefined || (typeof payload.nbf === 'number' && payload.nbf <= seconds + 60))
    );
  } catch {
    return false;
  }
}

/** The checks both endpoints share. Returns the Response to send when one fails, or nothing when the caller may go on. */
async function guard(ctx: MovieWheelContext, methods: string[]): Promise<Response | undefined> {
  const { request, env } = ctx;
  if (!methods.includes(request.method)) return fail(405, `Use ${methods.join(' or ')}.`);
  const origin = request.headers.get('Origin');
  if (request.method !== 'GET' && origin && origin !== new URL(request.url).origin) return fail(403, MESSAGES.origin);
  if (env.DEV_BYPASS_ACCESS === '1') return undefined;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return fail(503, MESSAGES.closed);
  if (!(await accessAllows(ctx))) return fail(401, MESSAGES.signIn);
  return undefined;
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
  deleted_at: number;
}

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
      review: r.review, addedAt: r.added_at, watchedAt: r.watched_at, updatedAt: r.updated_at,
    });
  }
  if (savedAt === 0 && !list.length && !Object.keys(removed).length) return { list: null, removed, savedAt };
  return { list, removed, savedAt };
}

// A movie is kept from whichever copy changed it last (updated_at); a removal wins over an edit made before it, and an edit made after a
// removal brings the movie back. Equal times keep what is stored, so a device with an old copy never undoes newer work.
const UPSERT = `INSERT INTO movie_wheel_movies
  (id, title, watched, genres, runtime, year, rating, review, added_at, watched_at, updated_at, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, watched = excluded.watched, genres = excluded.genres, runtime = excluded.runtime, year = excluded.year,
    rating = excluded.rating, review = excluded.review, added_at = excluded.added_at, watched_at = excluded.watched_at,
    updated_at = excluded.updated_at, deleted_at = 0
  WHERE excluded.updated_at > movie_wheel_movies.updated_at AND excluded.updated_at > movie_wheel_movies.deleted_at`;
const REMOVE = `INSERT INTO movie_wheel_movies (id, title, deleted_at) VALUES (?, '', ?)
  ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at
  WHERE excluded.deleted_at >= movie_wheel_movies.updated_at AND excluded.deleted_at > movie_wheel_movies.deleted_at`;

export async function handleList(ctx: MovieWheelContext): Promise<Response> {
  const denied = await guard(ctx, ['GET', 'PUT']);
  if (denied) return denied;
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

  const statements: D1PreparedStatement[] = [];
  for (const raw of body.list) {
    const m = cleanMovie(raw);
    if (!m) continue;
    statements.push(
      db.prepare(UPSERT).bind(m.id, m.title, m.watched ? 1 : 0, JSON.stringify(m.genres), m.runtime, m.year, m.rating, m.review, m.addedAt, m.watchedAt, m.updatedAt),
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

// ---- The chat ---------------------------------------------------------------------------------------------------------------

const SYSTEM = `You are the movie assistant inside the owner's personal Movie Wheel app.
You can see their full movie history below: what they have watched (with their own star ratings and short reviews), what is still on their to-watch list, genres, lengths and release years.
Answer using that data. Be specific: name titles, give counts and hours, and say when something is not in the data instead of guessing.
You may recommend films from outside the list when asked, but say they are not on the list. When you recommend from the to-watch list, use exactly the titles shown.
Keep answers short and plain. Do not use emoji. Rating scale is 1 to 5 stars; 4 and 5 stars count as favorites.`;

export async function handleChat(ctx: MovieWheelContext): Promise<Response> {
  const denied = await guard(ctx, ['POST']);
  if (denied) return denied;
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
  const clean: { role: 'user' | 'assistant'; content: string }[] = [];
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

  let res: Response;
  try {
    res = await (ctx.fetch ?? fetch)('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4o-mini',
        max_completion_tokens: MAX_REPLY_TOKENS,
        messages: [{ role: 'system', content: `${SYSTEM}\n\n--- MOVIE DATA ---\n${ctxText}` }, ...clean],
      }),
    });
  } catch {
    return fail(502, 'Could not reach OpenAI.');
  }
  const data = (await res.json().catch(() => null)) as { error?: { message?: string }; choices?: { message?: { content?: string } }[] } | null;
  if (!res.ok) return fail(502, `OpenAI said: ${String(data?.error?.message ?? `status ${res.status}.`).slice(0, 300)}`);
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) return fail(502, 'OpenAI sent an empty answer.');
  return json({ reply });
}
