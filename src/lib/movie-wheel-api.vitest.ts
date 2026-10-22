import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { onRequest as listFunction } from '../../functions/api/movie-wheel/list';
import { onRequest as chatFunction } from '../../functions/api/movie-wheel/chat';
import {
  accessAllows,
  cleanMovie,
  forgetAccessKeys,
  handleChat,
  handleList,
  MESSAGES,
  type D1Database,
  type MovieWheelContext,
  type MovieWheelEnv,
} from './movie-wheel-api';

// The Movie Wheel endpoints (src/lib/movie-wheel-api.ts, wired up by functions/api/movie-wheel/*.ts) against a real SQLite database made
// from the real migration, standing in for D1 (same SQL dialect), and against real signed Cloudflare Access tokens made with a key pair
// generated here. Access's key list and OpenAI are fakes: no test calls the network.

// node:sqlite is built into Node 22.13 and later (engines allows 22.12, where it needs a flag): without it these tests are skipped.
const sqlite = await import('node:sqlite').catch(() => undefined);
const MIGRATION = readFileSync('migrations/0002_movie_wheel.sql', 'utf8');

function database() {
  const db = new sqlite!.DatabaseSync(':memory:');
  db.exec(MIGRATION);
  const wrap = (query: string) => {
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
      async all() {
        return { results: statement.all(...(values as never[])) as never[] };
      },
    };
    return prepared;
  };
  const d1: D1Database = {
    prepare: wrap,
    async batch(statements) {
      const out = [];
      for (const s of statements) out.push(await s.run());
      return out;
    },
  };
  return { d1, rows: () => db.prepare('SELECT * FROM movie_wheel_movies ORDER BY id').all() as Record<string, unknown>[] };
}

const TEAM = 'r7team';
const HOST = `${TEAM}.cloudflareaccess.com`;
const AUD = 'aud-1234';
const NOW = 1_800_000_000_000; // ms
const b64 = (data: string | ArrayBuffer) =>
  Buffer.from(typeof data === 'string' ? data : new Uint8Array(data)).toString('base64url');

/** A key pair standing in for Access's signing key, a way to sign tokens with it, and the fake key-list fetch. */
async function access() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' };
  const sign = async (payload: Record<string, unknown>, key: CryptoKey = pair.privateKey, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1' }) => {
    const head = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(payload))}`;
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head));
    return `${head}.${b64(sig)}`;
  };
  const good = { aud: [AUD], iss: `https://${HOST}`, exp: NOW / 1000 + 3600, email: 'me@example.com' };
  const keyFetch = vi.fn(async (url: string | URL | Request) => {
    expect(String(url)).toBe(`https://${HOST}/cdn-cgi/access/certs`);
    return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { sign, good, keyFetch, privateKey: pair.privateKey };
}

const URL_LIST = 'https://r7orbit.io/api/movie-wheel/list';
const movie = (id: string, title: string, updatedAt: number, extra: Record<string, unknown> = {}) => ({
  id, title, watched: false, genres: [], addedAt: 1, updatedAt, ...extra,
});

async function setup(env: Partial<MovieWheelEnv> = {}) {
  forgetAccessKeys();
  const a = await access();
  const db = database();
  const base: MovieWheelEnv = { WAITLIST_DB: db.d1, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, OPENAI_API_KEY: 'sk-secret', ...env };
  const call = async (method: string, body?: unknown, o: { token?: string | null; origin?: string; url?: string; env?: MovieWheelEnv; now?: number; fetch?: typeof fetch } = {}) => {
    const token = o.token === undefined ? await a.sign(a.good) : o.token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Cf-Access-Jwt-Assertion'] = token;
    if (o.origin) headers.Origin = o.origin;
    const request = new Request(o.url ?? URL_LIST, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const ctx: MovieWheelContext = { request, env: o.env ?? base, fetch: o.fetch ?? a.keyFetch, now: o.now ?? NOW };
    return { ctx, response: await (ctx.request.url.endsWith('/chat') ? handleChat(ctx) : handleList(ctx)) };
  };
  return { a, db, env: base, call };
}

describe.skipIf(!sqlite)('who may call', () => {
  it('lets a request with a valid Access token through', async () => {
    const { call } = await setup();
    expect((await call('GET')).response.status).toBe(200);
  });

  it('refuses a request with no token, a token for another application, an expired one, one from another issuer, and one signed by another key', async () => {
    const { a, call } = await setup();
    const other = await access();
    expect((await call('GET', undefined, { token: null })).response.status).toBe(401);
    expect((await call('GET', undefined, { token: await a.sign({ ...a.good, aud: ['someone-else'] }) })).response.status).toBe(401);
    expect((await call('GET', undefined, { token: await a.sign({ ...a.good, exp: NOW / 1000 - 10 }) })).response.status).toBe(401);
    expect((await call('GET', undefined, { token: await a.sign({ ...a.good, iss: 'https://evil.cloudflareaccess.com' }) })).response.status).toBe(401);
    expect((await call('GET', undefined, { token: await a.sign(a.good, other.privateKey) })).response.status).toBe(401);
    expect((await call('GET', undefined, { token: await a.sign(a.good, a.privateKey, { alg: 'none', kid: 'k1' }) })).response.status).toBe(401);
    expect((await call('GET', undefined, { token: 'not.a.jwt' })).response.status).toBe(401);
  });

  it('stays closed (503) when the Access settings are missing, even with a token', async () => {
    const { call, env } = await setup();
    const { response } = await call('GET', undefined, { env: { ...env, ACCESS_AUD: undefined } });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe(MESSAGES.closed);
  });

  it('accepts anyone only when DEV_BYPASS_ACCESS is 1 (a local .dev.vars setting)', async () => {
    const { call, env } = await setup();
    const open = { ...env, ACCESS_TEAM_DOMAIN: undefined, ACCESS_AUD: undefined };
    expect((await call('GET', undefined, { token: null, env: open })).response.status).toBe(503);
    expect((await call('GET', undefined, { token: null, env: { ...open, DEV_BYPASS_ACCESS: '1' } })).response.status).toBe(200);
  });

  it('accepts the team name alone or the whole host, and asks Access for its keys once', async () => {
    const { a, call, env } = await setup();
    expect((await call('GET', undefined, { env: { ...env, ACCESS_TEAM_DOMAIN: `https://${HOST}/` } })).response.status).toBe(200);
    const before = vi.mocked(a.keyFetch).mock.calls.length;
    expect(await accessAllows((await call('GET')).ctx)).toBe(true);
    expect(await accessAllows((await call('GET')).ctx)).toBe(true);
    expect(vi.mocked(a.keyFetch).mock.calls.length).toBe(before); // the keys from the first call are kept for ten minutes
  });

  it('refuses a write from another site (403) and allows one from the site itself', async () => {
    const { call } = await setup();
    expect((await call('PUT', { list: [] }, { origin: 'https://evil.example' })).response.status).toBe(403);
    expect((await call('PUT', { list: [] }, { origin: 'https://r7orbit.io' })).response.status).toBe(200);
  });

  it('refuses other methods', async () => {
    const { call } = await setup();
    expect((await call('DELETE')).response.status).toBe(405);
  });

  it('is wired up by the two Function files', async () => {
    const { ctx, response } = await setup().then((s) => s.call('GET'));
    expect((await listFunction(ctx)).status).toBe(response.status);
    expect(typeof chatFunction).toBe('function');
  });
});

describe.skipIf(!sqlite)('the list', () => {
  it('answers list: null until something has been saved', async () => {
    const { call } = await setup();
    expect(await (await call('GET')).response.json()).toEqual({ list: null, removed: {}, savedAt: 0 });
  });

  it('stores a list and returns it with a version', async () => {
    const { call, db } = await setup();
    const saved = await (await call('PUT', { list: [movie('1', 'Saw', 100), movie('2', 'Alien', 100, { genres: ['Sci-fi'], rating: 5, runtime: 117 })], removed: {} })).response.json();
    expect(saved.list.map((m: { title: string }) => m.title)).toEqual(['Saw', 'Alien']);
    expect(saved.savedAt).toBe(1);
    expect(db.rows()).toHaveLength(2);
    const again = await (await call('GET')).response.json();
    expect(again.list[1]).toMatchObject({ title: 'Alien', genres: ['Sci-fi'], rating: 5, runtime: 117, watched: false });
    expect(again.savedAt).toBe(1);
  });

  it('keeps the most recent edit of each movie, whichever device sends it', async () => {
    const { call } = await setup();
    await call('PUT', { list: [movie('1', 'Saw', 100)] });
    const newer = await (await call('PUT', { list: [movie('1', 'Saw', 300, { rating: 5 })] })).response.json();
    expect(newer.list[0].rating).toBe(5);
    const older = await (await call('PUT', { list: [movie('1', 'Saw (old title)', 200, { rating: 1 })] })).response.json();
    expect(older.list[0]).toMatchObject({ title: 'Saw', rating: 5 });
  });

  it('keeps movies added on another device when a device sends a smaller list', async () => {
    const { call } = await setup();
    await call('PUT', { list: [movie('1', 'Saw', 100), movie('2', 'Alien', 100)] });
    const merged = await (await call('PUT', { list: [movie('1', 'Saw', 100), movie('3', 'Prey', 200)] })).response.json();
    expect(merged.list.map((m: { id: string }) => m.id).sort()).toEqual(['1', '2', '3']);
  });

  it('removes a movie for good: an older copy cannot bring it back, a newer edit can', async () => {
    const { call } = await setup();
    await call('PUT', { list: [movie('1', 'Saw', 100), movie('2', 'Alien', 100)] });
    const removed = await (await call('PUT', { list: [movie('1', 'Saw', 100)], removed: { '2': NOW - 1000 } })).response.json();
    expect(removed.list.map((m: { id: string }) => m.id)).toEqual(['1']);
    expect(removed.removed['2']).toBe(NOW - 1000);
    const stale = await (await call('PUT', { list: [movie('2', 'Alien', 500)], removed: {} })).response.json();
    expect(stale.list.map((m: { id: string }) => m.id)).toEqual(['1']);
    const edited = await (await call('PUT', { list: [movie('2', 'Alien', NOW)], removed: {} })).response.json();
    expect(edited.list.map((m: { id: string }) => m.id).sort()).toEqual(['1', '2']);
    expect(edited.removed['2']).toBeUndefined();
  });

  it('forgets removals older than 90 days and ignores such removals when they arrive', async () => {
    const { a, call, db } = await setup();
    await call('PUT', { list: [movie('1', 'Saw', 100)] });
    const day = 24 * 3600 * 1000;
    const later = await a.sign({ ...a.good, exp: (NOW + 200 * day) / 1000 });
    await call('PUT', { list: [], removed: { '1': NOW - 10 * day } });
    expect(db.rows()[0].deleted_at).toBe(NOW - 10 * day);
    await call('PUT', { list: [], removed: { '1': NOW - 10 * day } }, { now: NOW + 100 * day, token: later });
    expect(db.rows()).toHaveLength(0);
    const late = await (await call('PUT', { list: [movie('9', 'X', 5)], removed: { '9': NOW - 200 * day } })).response.json();
    expect(late.list).toHaveLength(1);
  });

  it('counts a save as a change only when something changed', async () => {
    const { call } = await setup();
    const list = [movie('1', 'Saw', 100)];
    expect((await (await call('PUT', { list })).response.json()).savedAt).toBe(1);
    expect((await (await call('PUT', { list })).response.json()).savedAt).toBe(1);
    expect((await (await call('PUT', { list: [movie('1', 'Saw', 101, { rating: 3 })] })).response.json()).savedAt).toBe(2);
  });

  it('drops bad rows and trims the rest to size', async () => {
    const { call } = await setup();
    const saved = await (await call('PUT', {
      list: [{ id: '9', title: '  ' }, 'bad', null, { id: '8', title: 'T'.repeat(300), rating: 99, runtime: -4, year: 99999, genres: ['a'.repeat(50), ''], review: 'r'.repeat(999), watched: 1, junk: 'x', updatedAt: 5 }],
    })).response.json();
    expect(saved.list).toHaveLength(1);
    const m = saved.list[0];
    expect(m.title).toHaveLength(120);
    expect(m).toMatchObject({ rating: 5, runtime: 0, year: 2100, watched: true });
    expect(m.genres).toEqual(['a'.repeat(24)]);
    expect(m.review).toHaveLength(280);
    expect('junk' in m).toBe(false);
    expect(cleanMovie({ id: '', title: 'x' })).toBeNull();
  });

  it('refuses unreadable, wrong-shaped and oversized bodies', async () => {
    const { a, env } = await setup();
    const put = (body: string) =>
      handleList({
        request: new Request(URL_LIST, { method: 'PUT', headers: { 'Cf-Access-Jwt-Assertion': '' }, body }),
        env: { ...env, DEV_BYPASS_ACCESS: '1' },
        fetch: a.keyFetch,
        now: NOW,
      });
    expect((await put('not json')).status).toBe(400);
    expect((await put(JSON.stringify({ list: 'nope' }))).status).toBe(400);
    expect((await put(JSON.stringify({ list: Array.from({ length: 3001 }, (_, i) => movie(`x${i}`, 't', 1)) }))).status).toBe(400);
    expect((await put(JSON.stringify({ list: [movie('big', 't', 1, { review: 'z'.repeat(800_000) })] }))).status).toBe(413);
  });

  it('answers 503 with no database connected, and uses MOVIES_DB when there is one', async () => {
    const { call, env } = await setup();
    expect((await call('GET', undefined, { env: { ...env, WAITLIST_DB: undefined } })).response.status).toBe(503);
    const own = database();
    await call('PUT', { list: [movie('1', 'Saw', 100)] }, { env: { ...env, MOVIES_DB: own.d1 } });
    expect(own.rows()).toHaveLength(1);
  });
});

describe.skipIf(!sqlite)('the chat', () => {
  const ask = (text: string, extra: Record<string, unknown> = {}) => ({ messages: [{ role: 'user', content: text }], context: 'WATCHED\nSaw | 2003', ...extra });
  const openai = (answer: () => Response) =>
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('cloudflareaccess')) return (await access()).keyFetch(url, init);
      expect(String(url)).toBe('https://api.openai.com/v1/chat/completions');
      return answer();
    }) as unknown as typeof fetch;

  it('asks OpenAI with the movie data, keeps the key out of the answer, and sends no key to the page', async () => {
    const { a, call } = await setup();
    const sent: { init?: RequestInit }[] = [];
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('cloudflareaccess')) return a.keyFetch(url, init);
      sent.push({ init });
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Horror leads.' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const { response } = await call('POST', ask('What do I watch most?'), { url: 'https://r7orbit.io/api/movie-wheel/chat', fetch: f });
    expect(response.status).toBe(200);
    const text = JSON.stringify(await response.json());
    expect(text).toContain('Horror leads.');
    expect(text).not.toContain('sk-secret');
    const body = JSON.parse(String(sent[0].init?.body));
    expect((sent[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-secret');
    expect(body.messages[0].content).toContain('Saw | 2003');
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('needs a signed-in visitor and an OpenAI key', async () => {
    const { call, env } = await setup();
    const chat = 'https://r7orbit.io/api/movie-wheel/chat';
    expect((await call('POST', ask('hi'), { url: chat, token: null })).response.status).toBe(401);
    expect((await call('POST', ask('hi'), { url: chat, env: { ...env, OPENAI_API_KEY: undefined } })).response.status).toBe(503);
    expect((await call('GET', undefined, { url: chat })).response.status).toBe(405);
  });

  it('checks the messages and reports OpenAI trouble plainly', async () => {
    const { call, a } = await setup();
    const chat = 'https://r7orbit.io/api/movie-wheel/chat';
    const status = async (body: unknown, f: typeof fetch = a.keyFetch) => (await call('POST', body, { url: chat, fetch: f })).response.status;
    expect(await status({ messages: [{ role: 'system', content: 'x' }] })).toBe(400);
    expect(await status({ messages: [{ role: 'assistant', content: 'x' }] })).toBe(400);
    expect(await status(ask('x'.repeat(4001)))).toBe(400);
    expect(await status({ messages: [] })).toBe(400);
    const wrongKey = openai(() => new Response(JSON.stringify({ error: { message: 'Incorrect API key provided' } }), { status: 401 }));
    const r = await call('POST', ask('hi'), { url: chat, fetch: wrongKey });
    expect(r.response.status).toBe(502);
    expect((await r.response.json()).error).toContain('Incorrect API key');
    const down = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('cloudflareaccess')) return a.keyFetch(url, init);
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect(await status(ask('hi'), down)).toBe(502);
  });
});
