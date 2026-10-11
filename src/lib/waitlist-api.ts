// The two waitlist endpoints, as plain functions of a Request: functions/api/waitlist.ts and functions/api/waitlist-remove.ts
// (Cloudflare Pages Functions) only call these. Kept here, in src/lib, so lint, `astro check` and Vitest cover them; nothing here
// is imported by a page, so none of it reaches the built site.
//
// What both endpoints do, in order: POST only (405) -> same origin (403) -> the database binding and the Turnstile secret exist
// (503) -> the waitlist is on in the settings this deploy was built from (404) -> read the body (form or JSON, 4 KB at most) ->
// honeypot filled: answer as if it worked, store nothing -> a plain address (400) -> Turnstile's Siteverify accepts the token
// (400) -> the database write. Success is only ever sent once the row is stored (or was already there, or, for removal, is gone).
// Nothing but the address, the time and the source is stored: no IP address, no user agent, and no email is ever sent.
import { HONEYPOT_FIELD, isWaitlistSource, normaliseEmail, TURNSTILE_FIELD, type WaitlistSource } from './waitlist';

// ---- The parts of Cloudflare's runtime used here (instead of a dependency on @cloudflare/workers-types) ------------------

export interface D1Result {
  success: boolean;
  meta?: { changes?: number };
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

/** The Pages project's bindings: set in the Cloudflare dashboard (docs/WAITLIST.md), never in the repository. */
export interface WaitlistEnv {
  WAITLIST_DB?: D1Database;
  TURNSTILE_SECRET_KEY?: string;
}

export interface WaitlistContext {
  request: Request;
  env: WaitlistEnv;
  /** The site's address from the settings (`url` in src/data/site.json): the only origin allowed in production. */
  siteUrl: string;
  /** `waitlist.enabled` in the settings this deploy was built from. */
  enabled: boolean;
  /** Siteverify is called through this (tests pass a fake). */
  fetch?: typeof fetch;
}

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BODY = 4096;
const MAX_TOKEN = 2048;

/** The words the endpoints answer with. Interim (docs/DECISIONS.md, the waitlist): the form shows `invalidEmail` and `turnstile`
 *  as they are (400s say what to fix); for any other failure it shows the error message from the site settings. */
export const MESSAGES = {
  method: 'Use POST.',
  origin: 'Requests from other sites are not accepted.',
  closed: 'The waitlist is not open.',
  unavailable: 'The waitlist is not available right now. Please try again later.',
  tooLarge: 'The request is too large.',
  badBody: 'The request could not be read.',
  invalidEmail: 'Please enter a valid email address.',
  invalidSource: 'The request could not be read.',
  turnstile: 'The spam check did not pass. Please try again.',
  saveFailed: 'Your address could not be saved. Please try again later.',
  removeFailed: 'Your address could not be removed. Please try again later.',
} as const;

const json = (
  status: number,
  body: { ok: true } | { ok: false; message: string },
  extra: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
  });
const ok = () => json(200, { ok: true });
const fail = (status: number, message: string, extra?: Record<string, string>) =>
  json(status, { ok: false, message }, extra);

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The function is running on this computer (`wrangler pages dev`), not on Cloudflare. */
export const isLocalRequest = (request: Request) => LOCAL_HOSTS.has(new URL(request.url).hostname);

/**
 * Whether the request comes from a page of this site. In production the Origin header must be the site's origin exactly. When the
 * function itself runs locally, a page on localhost (any port) is accepted instead: that is how the form is tried before deploying.
 */
export function sameOrigin(request: Request, siteUrl: string): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  if (origin === new URL(siteUrl).origin) return true;
  if (!isLocalRequest(request)) return false;
  try {
    const from = new URL(origin);
    return (from.protocol === 'http:' || from.protocol === 'https:') && LOCAL_HOSTS.has(from.hostname);
  } catch {
    return false;
  }
}

type Fields = Record<string, string>;

/** The body as text fields, from a form post or JSON. Undefined when it cannot be read, 'too-large' past 4 KB. */
async function readFields(request: Request): Promise<Fields | 'too-large' | undefined> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY) return 'too-large';
  const text = await request.text();
  if (text.length > MAX_BODY) return 'too-large';
  const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const fields: Fields = {};
  if (type === 'application/json') {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return undefined;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
    for (const [key, value] of Object.entries(data)) if (typeof value === 'string') fields[key] = value;
    return fields;
  }
  if (type === 'application/x-www-form-urlencoded') {
    for (const [key, value] of new URLSearchParams(text)) fields[key] = value;
    return fields;
  }
  if (type === 'multipart/form-data') {
    try {
      const form = await new Request(request.url, { method: 'POST', headers: request.headers, body: text }).formData();
      for (const [key, value] of form) if (typeof value === 'string') fields[key] = value;
      return fields;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Asks Turnstile whether the token is good. False on any doubt: a missing or oversized token, an error, a timeout. */
export async function verifyTurnstile(token: string, secret: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!token || token.length > MAX_TOKEN) return false;
  try {
    const response = await fetcher(SITEVERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}

interface Checked {
  db: D1Database;
  email: string;
  fields: Fields;
}

/** Everything both endpoints check before touching the list. Returns the Response to send when a check fails. */
async function check(ctx: WaitlistContext): Promise<Response | Checked | 'honeypot'> {
  const { request, env } = ctx;
  if (request.method !== 'POST') return fail(405, MESSAGES.method, { Allow: 'POST' });
  if (!sameOrigin(request, ctx.siteUrl)) return fail(403, MESSAGES.origin);
  // The bindings before the switch, so the setup can be checked while the form is still off: 503 = not bound yet, 404 = ready.
  const db = env.WAITLIST_DB;
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!db || !secret) return fail(503, MESSAGES.unavailable);
  if (!ctx.enabled && !isLocalRequest(request)) return fail(404, MESSAGES.closed);

  const fields = await readFields(request);
  if (fields === 'too-large') return fail(413, MESSAGES.tooLarge);
  if (!fields) return fail(400, MESSAGES.badBody);
  // A person never sees the honeypot box; a bot that fills it is told it worked, and nothing is stored or checked.
  if ((fields[HONEYPOT_FIELD] ?? '').trim()) return 'honeypot';

  const email = normaliseEmail(fields.email);
  if (!email) return fail(400, MESSAGES.invalidEmail);
  const token = fields[TURNSTILE_FIELD] ?? fields.turnstile ?? '';
  if (!(await verifyTurnstile(token, secret, ctx.fetch))) return fail(400, MESSAGES.turnstile);
  return { db, email, fields };
}

/** POST /api/waitlist: adds the address. A duplicate gets the same answer as a new one, so nobody can test who is on the list. */
export async function joinWaitlist(ctx: WaitlistContext): Promise<Response> {
  const checked = await check(ctx);
  if (checked === 'honeypot') return ok();
  if (checked instanceof Response) return checked;
  const source: WaitlistSource | undefined = isWaitlistSource(checked.fields.source)
    ? checked.fields.source
    : undefined;
  if (!source) return fail(400, MESSAGES.invalidSource);
  try {
    const result = await checked.db
      .prepare('INSERT OR IGNORE INTO waitlist (email, source) VALUES (?1, ?2)')
      .bind(checked.email, source)
      .run();
    if (!result.success) return fail(500, MESSAGES.saveFailed);
  } catch {
    return fail(500, MESSAGES.saveFailed);
  }
  return ok();
}

/** POST /api/waitlist-remove: deletes the address if it is there. The answer never says whether it was. */
export async function leaveWaitlist(ctx: WaitlistContext): Promise<Response> {
  const checked = await check(ctx);
  if (checked === 'honeypot') return ok();
  if (checked instanceof Response) return checked;
  try {
    const result = await checked.db.prepare('DELETE FROM waitlist WHERE email = ?1').bind(checked.email).run();
    if (!result.success) return fail(500, MESSAGES.removeFailed);
  } catch {
    return fail(500, MESSAGES.removeFailed);
  }
  return ok();
}
