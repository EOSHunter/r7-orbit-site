import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import site from '../data/site.json';
import { onRequest as joinFunction } from '../../functions/api/waitlist';
import { onRequest as removeFunction } from '../../functions/api/waitlist-remove';
import {
  joinWaitlist,
  leaveWaitlist,
  MESSAGES,
  sameOrigin,
  SITEVERIFY_URL,
  type D1Database,
  type WaitlistContext,
  type WaitlistEnv,
} from './waitlist-api';
import { TURNSTILE_TEST_SECRET } from './waitlist';

// The two endpoints (src/lib/waitlist-api.ts, wired up by functions/api/*.ts) against a real SQLite database made from the real
// migration, standing in for D1 (same SQL dialect: D1 is SQLite). Siteverify is a fake: no test calls Cloudflare.

// node:sqlite is built into Node 22.13 and later (engines allows 22.12, where it needs a flag): without it these tests are skipped.
const sqlite = await import('node:sqlite').catch(() => undefined);
const MIGRATION = readFileSync('migrations/0001_waitlist.sql', 'utf8');

interface Row {
  id: number;
  email: string;
  created_at: string;
  source: string;
}

/** A D1-shaped wrapper around an in-memory SQLite database with the waitlist table. */
function database() {
  const db = new sqlite!.DatabaseSync(':memory:');
  db.exec(MIGRATION);
  const d1: D1Database = {
    prepare(query) {
      const statement = db.prepare(query);
      let values: unknown[] = [];
      const prepared = {
        bind(...args: unknown[]) {
          values = args;
          return prepared;
        },
        async run() {
          const result = statement.run(...(values as never[]));
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
      return prepared;
    },
  };
  const rows = () =>
    db.prepare('SELECT id, email, created_at, source FROM waitlist ORDER BY id').all() as unknown as Row[];
  return { d1, rows };
}

const SITE = 'https://r7orbit.io';

/** Siteverify that accepts the token "good" and refuses the rest, counting its calls. */
function siteverify(answer: (token: string) => unknown = (token) => ({ success: token === 'good' })) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url)).toBe(SITEVERIFY_URL);
    const body = new URLSearchParams(String(init?.body));
    expect(body.get('secret')).toBe(TURNSTILE_TEST_SECRET);
    const result = answer(body.get('response') ?? '');
    if (result instanceof Error) throw result;
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
}

interface Call {
  method?: string;
  origin?: string | null;
  url?: string;
  body?: Record<string, string> | string;
  type?: 'form' | 'json' | 'multipart' | string;
}

function request({
  method = 'POST',
  origin = SITE,
  url = `${SITE}/api/waitlist`,
  body = {},
  type = 'form',
}: Call = {}) {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  let payload: BodyInit | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    if (typeof body === 'string') {
      payload = body;
      headers.set('Content-Type', type);
    } else if (type === 'json') {
      payload = JSON.stringify(body);
      headers.set('Content-Type', 'application/json');
    } else if (type === 'multipart') {
      const form = new FormData();
      for (const [k, v] of Object.entries(body)) form.set(k, v);
      payload = form;
    } else {
      payload = new URLSearchParams(body);
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    }
  }
  return new Request(url, { method, headers, body: payload });
}

const good = { email: ' Reader@Example.com ', 'cf-turnstile-response': 'good', source: 'hero', company: '' };

function setup(env: Partial<WaitlistEnv> = {}, enabled = true) {
  const db = database();
  const fetch = siteverify();
  const ctx = (call: Call = {}): WaitlistContext => ({
    request: request(call),
    env: { WAITLIST_DB: db.d1, TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET, ...env },
    siteUrl: SITE,
    enabled,
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
  return { ...db, fetch, ctx };
}

async function answer(response: Response) {
  expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  return { status: response.status, body: (await response.json()) as { ok: boolean; message?: string } };
}

describe.skipIf(!sqlite)('POST /api/waitlist', () => {
  it('stores the address trimmed and lowercased, with the time and the source, and answers { ok: true }', async () => {
    const { ctx, rows, fetch } = setup();
    expect(await answer(await joinWaitlist(ctx({ body: good })))).toEqual({ status: 200, body: { ok: true } });
    const [row] = rows();
    expect(row).toMatchObject({ id: 1, email: 'reader@example.com', source: 'hero' });
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Math.abs(Date.parse(row.created_at) - Date.now())).toBeLessThan(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stores only the address, the time and the source', () => {
    const { rows } = setup();
    const columns = (MIGRATION.match(/CREATE TABLE[\s\S]*?\);/)?.[0] ?? '')
      .match(/^\s+(\w+)\s/gm)
      ?.map((c) => c.trim());
    expect(columns).toEqual(['id', 'email', 'created_at', 'source']);
    expect(rows()).toEqual([]);
  });

  it('accepts JSON and multipart bodies, and the token under "turnstile"', async () => {
    const { ctx, rows } = setup();
    await joinWaitlist(
      ctx({ type: 'json', body: { email: 'a@example.com', 'cf-turnstile-response': 'good', source: 'blog' } }),
    );
    await joinWaitlist(ctx({ type: 'multipart', body: { email: 'b@example.com', turnstile: 'good', source: 'vlog' } }));
    await joinWaitlist(ctx({ body: { email: 'c@example.com', turnstile: 'good', source: 'other' } }));
    expect(rows().map((r) => [r.email, r.source])).toEqual([
      ['a@example.com', 'blog'],
      ['b@example.com', 'vlog'],
      ['c@example.com', 'other'],
    ]);
  });

  it('answers a duplicate exactly like a new address, and keeps one row (in any letter case)', async () => {
    const { ctx, rows } = setup();
    const first = await answer(await joinWaitlist(ctx({ body: good })));
    const again = await answer(
      await joinWaitlist(ctx({ body: { ...good, email: 'READER@example.COM', source: 'blog' } })),
    );
    expect(again).toEqual(first);
    expect(rows()).toHaveLength(1);
    expect(rows()[0].source).toBe('hero');
  });

  it('treats a filled honeypot as a success, and stores nothing and asks Turnstile nothing', async () => {
    const { ctx, rows, fetch } = setup();
    expect(await answer(await joinWaitlist(ctx({ body: { ...good, company: 'Acme' } })))).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(rows()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses an address that is not plain, with 400 and a plain message, before asking Turnstile', async () => {
    const { ctx, rows, fetch } = setup();
    for (const email of ['', 'not-an-address', 'a@b', `${'x'.repeat(250)}@example.com`, '"q"@example.com']) {
      expect(await answer(await joinWaitlist(ctx({ body: { ...good, email } })))).toEqual({
        status: 400,
        body: { ok: false, message: MESSAGES.invalidEmail },
      });
    }
    expect(rows()).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses a missing, wrong or unverifiable Turnstile token with 400, and stores nothing', async () => {
    const { ctx, rows } = setup();
    for (const token of ['', 'bad', 'x'.repeat(2049)]) {
      expect(await answer(await joinWaitlist(ctx({ body: { ...good, 'cf-turnstile-response': token } })))).toEqual({
        status: 400,
        body: { ok: false, message: MESSAGES.turnstile },
      });
    }
    for (const broken of [
      () => new Error('network'),
      () => ({ 'error-codes': ['internal-error'] }),
      () => ({ success: 'true' }),
    ]) {
      const failing = setup();
      const response = await joinWaitlist({
        ...failing.ctx({ body: good }),
        fetch: siteverify(broken) as unknown as typeof fetch,
      });
      expect((await answer(response)).status).toBe(400);
      expect(failing.rows()).toEqual([]);
    }
    expect(rows()).toEqual([]);
  });

  it('refuses a source that is not hero, blog, vlog or other', async () => {
    const { ctx, rows } = setup();
    for (const source of ['', 'news', 'HERO']) {
      expect((await answer(await joinWaitlist(ctx({ body: { ...good, source } })))).status).toBe(400);
    }
    const withoutSource: Record<string, string> = { ...good };
    delete withoutSource.source;
    expect((await answer(await joinWaitlist(ctx({ body: withoutSource })))).status).toBe(400);
    expect(rows()).toEqual([]);
  });

  it('answers only POST', async () => {
    const { ctx } = setup();
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS']) {
      const response = await joinWaitlist(ctx({ method }));
      expect((await answer(response)).status, method).toBe(405);
      expect(response.headers.get('Allow')).toBe('POST');
    }
  });

  it('answers only pages of the site itself (403), and a page on localhost only when the function runs locally', async () => {
    const { ctx, rows } = setup();
    for (const origin of [
      null,
      'https://evil.example',
      'http://r7orbit.io',
      'https://www.r7orbit.io',
      'null',
      'http://localhost:4321',
    ]) {
      expect((await answer(await joinWaitlist(ctx({ origin, body: good })))).status, String(origin)).toBe(403);
    }
    expect(rows()).toEqual([]);
    const local = await joinWaitlist(
      ctx({ origin: 'http://localhost:4321', url: 'http://127.0.0.1:8788/api/waitlist', body: good }),
    );
    expect((await answer(local)).status).toBe(200);
    expect(
      sameOrigin(request({ origin: 'https://evil.example', url: 'http://localhost:8788/api/waitlist' }), SITE),
    ).toBe(false);
  });

  it('is closed (404) while the waitlist is off in the settings, except when run locally', async () => {
    const { ctx, rows } = setup({}, false);
    expect(await answer(await joinWaitlist(ctx({ body: good })))).toEqual({
      status: 404,
      body: { ok: false, message: MESSAGES.closed },
    });
    expect(rows()).toEqual([]);
    const local = await joinWaitlist(
      ctx({ origin: 'http://localhost:8788', url: 'http://localhost:8788/api/waitlist', body: good }),
    );
    expect((await answer(local)).status).toBe(200);
  });

  it('answers 503, never success, when the database binding or the secret is missing, whether the waitlist is on or off', async () => {
    for (const enabled of [true, false]) {
      for (const env of [
        { WAITLIST_DB: undefined },
        { TURNSTILE_SECRET_KEY: undefined },
        { TURNSTILE_SECRET_KEY: '  ' },
      ]) {
        const { ctx } = setup(env, enabled);
        expect(await answer(await joinWaitlist(ctx({ body: good })))).toEqual({
          status: 503,
          body: { ok: false, message: MESSAGES.unavailable },
        });
      }
    }
  });

  it('answers 500, never success, when the database write fails', async () => {
    const { ctx } = setup();
    const throwing: D1Database = {
      prepare: () => {
        throw new Error('D1_ERROR: no such table: waitlist');
      },
    };
    const statement = (run: () => Promise<{ success: boolean }>) => {
      const prepared = { bind: () => prepared, run };
      return prepared;
    };
    const unsuccessful: D1Database = { prepare: () => statement(async () => ({ success: false })) };
    const rejecting: D1Database = { prepare: () => statement(() => Promise.reject(new Error('D1_ERROR'))) };
    for (const db of [throwing, unsuccessful, rejecting]) {
      const base = ctx({ body: good });
      const response = await joinWaitlist({ ...base, env: { ...base.env, WAITLIST_DB: db } });
      expect(await answer(response)).toEqual({ status: 500, body: { ok: false, message: MESSAGES.saveFailed } });
    }
    // A database without the table (the migration not applied yet) fails the same way.
    const empty = new sqlite!.DatabaseSync(':memory:');
    const bare: D1Database = { prepare: (q) => (empty.prepare(q), statement(async () => ({ success: true }))) };
    const base = ctx({ body: good });
    expect((await answer(await joinWaitlist({ ...base, env: { ...base.env, WAITLIST_DB: bare } }))).status).toBe(500);
  });

  it('refuses a body it cannot read (400) or that is too large (413)', async () => {
    const { ctx } = setup();
    expect((await answer(await joinWaitlist(ctx({ body: '{not json', type: 'application/json' })))).status).toBe(400);
    expect(
      (await answer(await joinWaitlist(ctx({ body: '["a@example.com"]', type: 'application/json' })))).status,
    ).toBe(400);
    expect((await answer(await joinWaitlist(ctx({ body: 'email=a@example.com', type: 'text/plain' })))).status).toBe(
      400,
    );
    expect((await answer(await joinWaitlist(ctx({ body: { ...good, padding: 'x'.repeat(5000) } })))).status).toBe(413);
  });
});

describe.skipIf(!sqlite)('POST /api/waitlist-remove', () => {
  const remove = { email: 'READER@example.com', 'cf-turnstile-response': 'good', company: '' };

  it('deletes the address in any letter case, and answers the same whether or not it was there', async () => {
    const { ctx, rows } = setup();
    await joinWaitlist(ctx({ body: good }));
    await joinWaitlist(ctx({ body: { ...good, email: 'other@example.com' } }));
    const removed = await answer(await leaveWaitlist(ctx({ url: `${SITE}/api/waitlist-remove`, body: remove })));
    const absent = await answer(
      await leaveWaitlist(ctx({ url: `${SITE}/api/waitlist-remove`, body: { ...remove, email: 'never@example.com' } })),
    );
    expect(removed).toEqual({ status: 200, body: { ok: true } });
    expect(absent).toEqual(removed);
    expect(rows().map((r) => r.email)).toEqual(['other@example.com']);
  });

  it('has the same protections: POST, same origin, honeypot, a plain address, Turnstile, the database', async () => {
    const { ctx, rows, fetch } = setup();
    await joinWaitlist(ctx({ body: good }));
    fetch.mockClear();
    expect((await answer(await leaveWaitlist(ctx({ method: 'GET' })))).status).toBe(405);
    expect((await answer(await leaveWaitlist(ctx({ origin: 'https://evil.example', body: remove })))).status).toBe(403);
    expect(await answer(await leaveWaitlist(ctx({ body: { ...remove, company: 'x' } })))).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(fetch).not.toHaveBeenCalled();
    expect((await answer(await leaveWaitlist(ctx({ body: { ...remove, email: 'nope' } })))).status).toBe(400);
    expect(
      (await answer(await leaveWaitlist(ctx({ body: { ...remove, 'cf-turnstile-response': 'bad' } })))).status,
    ).toBe(400);
    expect(rows()).toHaveLength(1);
    const broken = ctx({ body: remove });
    const failed = await leaveWaitlist({
      ...broken,
      env: {
        ...broken.env,
        WAITLIST_DB: {
          prepare: () => {
            throw new Error();
          },
        },
      },
    });
    expect(await answer(failed)).toEqual({ status: 500, body: { ok: false, message: MESSAGES.removeFailed } });
    expect((await answer(await leaveWaitlist({ ...broken, env: {} }))).status).toBe(503);
    expect((await answer(await leaveWaitlist(setup({}, false).ctx({ body: remove })))).status).toBe(404);
  });
});

describe('the Pages Functions', () => {
  it('pass the site address and the switch from the settings to the handlers', async () => {
    const env = { WAITLIST_DB: undefined, TURNSTILE_SECRET_KEY: undefined };
    const from = (origin: string) => request({ origin, body: good });
    // Another origin is refused against the site's own address...
    expect((await joinFunction({ request: from('https://evil.example'), env })).status).toBe(403);
    expect((await removeFunction({ request: from('https://evil.example'), env })).status).toBe(403);
    // ...and from the site, without bindings, the answer is "unavailable" whatever the switch.
    expect((await joinFunction({ request: from(new URL(site.url).origin), env })).status).toBe(503);
    expect((await removeFunction({ request: from(new URL(site.url).origin), env })).status).toBe(503);
  });

  it('are thin: every rule is in src/lib/waitlist-api.ts', () => {
    for (const file of ['functions/api/waitlist.ts', 'functions/api/waitlist-remove.ts']) {
      const code = readFileSync(file, 'utf8');
      expect(code).toMatch(/export const onRequest = /);
      expect(code).not.toMatch(/prepare\(|siteverify|INSERT|DELETE/i);
    }
  });
});

describe('public/_routes.json', () => {
  it('sends only /api/* to the Functions: every page stays a static file', () => {
    expect(JSON.parse(readFileSync('public/_routes.json', 'utf8'))).toEqual({
      version: 1,
      include: ['/api/*'],
      exclude: [],
    });
  });
});
