import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { onRequest as listFunction } from '../../functions/api/movie-wheel/list';
import { onRequest as chatFunction } from '../../functions/api/movie-wheel/chat';
import {
  accessAllows,
  cleanAddMovies,
  cleanChatMessage,
  cleanMovie,
  forgetAccessKeys,
  handleChat,
  handleChats,
  handleList,
  handleMe,
  MESSAGES,
  splitFollowups,
  type D1Database,
  type MovieWheelContext,
  type MovieWheelEnv,
} from './movie-wheel-api';

// The Movie Wheel endpoints (src/lib/movie-wheel-api.ts, wired up by functions/api/movie-wheel/*.ts) against a real SQLite database made
// from the real migration, standing in for D1 (same SQL dialect), and against real signed Cloudflare Access tokens made with a key pair
// generated here. Access's key list and OpenAI are fakes: no test calls the network.

// node:sqlite is built into Node 22.13 and later (engines allows 22.12, where it needs a flag): without it these tests are skipped.
const sqlite = await import('node:sqlite').catch(() => undefined);
const MIGRATION = ['0002_movie_wheel', '0003_movie_wheel_chats', '0004_movie_wheel_added_by']
  .map((name) => readFileSync(`migrations/${name}.sql`, 'utf8'))
  .join('\n');

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
    const url = ctx.request.url;
    return { ctx, response: await (url.includes('/chats') ? handleChats(ctx) : url.endsWith('/chat') ? handleChat(ctx) : url.endsWith('/me') ? handleMe(ctx) : handleList(ctx)) };
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

describe.skipIf(!sqlite)('R7 adding movies', () => {
  const CHAT = 'https://r7orbit.io/api/movie-wheel/chat';
  const ask = (text: string) => ({ messages: [{ role: 'user', content: text }], context: 'WATCHED\nSaw | 2003\nTO WATCH\nPrey | 2022' });
  const toolCall = (args: unknown, name = 'add_movies', id = 'call_1') => ({
    role: 'assistant',
    content: null,
    tool_calls: [{ id, type: 'function', function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) } }],
  });
  /** OpenAI that answers the first request with `first` and the second with `second`, recording both. */
  function openai(first: Record<string, unknown>, second: Record<string, unknown> | 'fail' = { role: 'assistant', content: 'Added them.' }, keyFetch?: typeof fetch) {
    const sent: Record<string, unknown>[] = [];
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('cloudflareaccess')) return keyFetch!(url, init);
      sent.push(JSON.parse(String(init?.body)));
      const turn = sent.length === 1 ? first : second;
      if (turn === 'fail') return new Response(JSON.stringify({ error: { message: 'boom' } }), { status: 500 });
      return new Response(JSON.stringify({ choices: [{ message: turn }] }), { status: 200 });
    }) as unknown as typeof fetch;
    return { f, sent };
  }
  const run = async (first: Record<string, unknown>, second?: Record<string, unknown> | 'fail') => {
    const { a, call } = await setup();
    const o = openai(first, second, a.keyFetch);
    const { response } = await call('POST', ask('add Get Out and Hereditary'), { url: CHAT, fetch: o.f });
    return { status: response.status, body: await response.json(), sent: o.sent };
  };

  it('offers the add_movies tool, and a plain answer comes back with no actions', async () => {
    const r = await run({ role: 'assistant', content: 'Horror leads.' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ reply: 'Horror leads.' });
    expect(r.sent).toHaveLength(1);
    const tools = r.sent[0].tools as { function: { name: string } }[];
    expect(tools.map((t) => t.function.name)).toEqual(['add_movies']);
  });

  it('passes an add request on as an action, tells the model it was done, and returns its short confirmation', async () => {
    const r = await run(toolCall({ movies: [{ title: 'Get Out', year: 2017 }, { title: '  Us  ' }] }), { role: 'assistant', content: 'I added **Get Out** and **Us**.' });
    expect(r.body.reply).toBe('I added **Get Out** and **Us**.');
    expect(r.body.actions).toEqual([{ type: 'add_movies', movies: [{ title: 'Get Out', year: 2017 }, { title: 'Us' }] }]);
    expect(r.sent).toHaveLength(2);
    const messages = r.sent[1].messages as { role: string; tool_call_id?: string; tool_calls?: unknown }[];
    expect(messages.some((m) => m.role === 'assistant' && m.tool_calls)).toBe(true);
    expect(messages.find((m) => m.role === 'tool')?.tool_call_id).toBe('call_1');
    expect(r.sent[1].tools).toBeUndefined();
  });

  it('cleans what the model asks for: at most 10 movies, titles trimmed to 120 characters, only a plausible year', async () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ title: `Movie ${i}`, year: i === 0 ? 1066 : i === 1 ? 2019.4 : 'x' }));
    many.push({ title: 'T'.repeat(300), year: 2000 });
    const r = await run(toolCall({ movies: [{ title: '' }, { nope: 1 }, ...many] }));
    const movies = r.body.actions[0].movies as { title: string; year?: number }[];
    expect(movies).toHaveLength(10);
    expect(movies[0]).toEqual({ title: 'Movie 0' });
    expect(movies[1]).toEqual({ title: 'Movie 1', year: 2019 });
    expect(cleanAddMovies({ movies: [{ title: 'T'.repeat(300) }] })[0].title).toHaveLength(120);
  });

  it('does nothing for broken arguments or a tool it does not have, and still answers', async () => {
    for (const first of [toolCall('{not json'), toolCall({ movies: 'nope' }), toolCall({ movies: [] }), toolCall({ movies: [{ title: 'X' }] }, 'delete_everything')]) {
      const r = await run(first, { role: 'assistant', content: 'Sorry, I could not add that.' });
      expect(r.status).toBe(200);
      expect(r.body.actions).toBeUndefined();
      expect(r.body.reply).toBe('Sorry, I could not add that.');
    }
  });

  it('still reports the add when the model fails to write its confirmation', async () => {
    const r = await run(toolCall({ movies: [{ title: 'Get Out' }, { title: 'Us' }] }), 'fail');
    expect(r.status).toBe(200);
    expect(r.body.reply).toBe("I'll add Get Out, Us to your list.");
    expect(r.body.actions[0].movies).toHaveLength(2);
  });

  it('is told its name, and to check the lists before adding or recommending', async () => {
    const r = await run({ role: 'assistant', content: 'Hi.' });
    const system = (r.sent[0].messages as { role: string; content: string }[])[0].content;
    expect(system).toContain('You are R7');
    expect(system).toContain('add_movies');
    expect(system).toContain('never suggest a movie that appears in either one');
  });
});

describe.skipIf(!sqlite)('saved chats', () => {
  const CHATS = 'https://r7orbit.io/api/movie-wheel/chats';
  const chat = (id: string, messages: unknown[], title = 'Hello') => ({ id, title, messages });
  const msgs = [{ role: 'user', content: 'Hi R7' }, { role: 'assistant', content: 'Hello! **R7** here.' }];

  it('starts empty, saves a chat, lists it and loads it back', async () => {
    const { call } = await setup();
    expect(await (await call('GET', undefined, { url: CHATS })).response.json()).toEqual({ chats: [] });
    const saved = await (await call('PUT', chat('c1', msgs, 'Hi R7'), { url: CHATS })).response.json();
    expect(saved.chat).toMatchObject({ id: 'c1', title: 'Hi R7', createdAt: NOW, updatedAt: NOW });
    const list = await (await call('GET', undefined, { url: CHATS })).response.json();
    expect(list.chats).toEqual([{ id: 'c1', title: 'Hi R7', createdAt: NOW, updatedAt: NOW }]);
    const one = await (await call('GET', undefined, { url: `${CHATS}?id=c1` })).response.json();
    expect(one.chat.messages).toEqual(msgs);
  });

  it('lists the most recently updated chat first, and updating a chat moves it up', async () => {
    const { call } = await setup();
    await call('PUT', chat('a', msgs, 'First'), { url: CHATS, now: NOW });
    await call('PUT', chat('b', msgs, 'Second'), { url: CHATS, now: NOW + 1000 });
    let ids = (await (await call('GET', undefined, { url: CHATS })).response.json()).chats.map((c: { id: string }) => c.id);
    expect(ids).toEqual(['b', 'a']);
    await call('PUT', chat('a', [...msgs, { role: 'user', content: 'More' }], 'First'), { url: CHATS, now: NOW + 2000 });
    ids = (await (await call('GET', undefined, { url: CHATS })).response.json()).chats.map((c: { id: string }) => c.id);
    expect(ids).toEqual(['a', 'b']);
    const first = await (await call('GET', undefined, { url: `${CHATS}?id=a` })).response.json();
    expect(first.chat.messages).toHaveLength(3);
    expect(first.chat.createdAt).toBe(NOW);
  });

  it("keeps a note about what R7 did to the list, so its Undo works after a reload", async () => {
    const { call } = await setup();
    const note = { role: 'note', content: '', ids: ['m1', 'm2'], titles: ['Get Out', 'Us'], skipped: ['Saw'], undone: true, junk: 1 };
    await call('PUT', chat('n', [...msgs, note]), { url: CHATS });
    const back = await (await call('GET', undefined, { url: `${CHATS}?id=n` })).response.json();
    expect(back.chat.messages[2]).toEqual({ role: 'note', content: '', ids: ['m1', 'm2'], titles: ['Get Out', 'Us'], skipped: ['Saw'], undone: true });
  });

  it('drops messages it cannot keep and trims the rest to size', async () => {
    const { call } = await setup();
    const bad = [{ role: 'system', content: 'x' }, { role: 'user', content: '   ' }, 'nope', null, { role: 'user', content: 'x'.repeat(9000) }, { role: 'assistant', content: 'ok' }];
    await call('PUT', chat('t', bad, '  A   very   spaced   title  '.padEnd(200, 'z')), { url: CHATS });
    const back = await (await call('GET', undefined, { url: `${CHATS}?id=t` })).response.json();
    expect(back.chat.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant']);
    expect(back.chat.messages[0].content).toHaveLength(8000);
    expect(back.chat.title.length).toBeLessThanOrEqual(80);
    expect(back.chat.title.startsWith('A very spaced title')).toBe(true);
    expect(cleanChatMessage({ role: 'user', content: '' })).toBeNull();
  });

  it('deletes a chat for good: it leaves the list, cannot be loaded, and an open copy cannot bring it back', async () => {
    const { call, db } = await setup();
    await call('PUT', chat('d', msgs), { url: CHATS });
    expect((await call('DELETE', undefined, { url: `${CHATS}?id=d` })).response.status).toBe(200);
    expect((await (await call('GET', undefined, { url: CHATS })).response.json()).chats).toEqual([]);
    expect((await call('GET', undefined, { url: `${CHATS}?id=d` })).response.status).toBe(404);
    expect((await call('PUT', chat('d', msgs), { url: CHATS })).response.status).toBe(410);
    expect(db.rows).toBeDefined();
  });

  it('forgets a deleted chat after 30 days', async () => {
    const { a, call } = await setup();
    const day = 24 * 3600 * 1000;
    await call('PUT', chat('old', msgs), { url: CHATS });
    await call('DELETE', undefined, { url: `${CHATS}?id=old` });
    const later = await a.sign({ ...a.good, exp: (NOW + 100 * day) / 1000 });
    await call('DELETE', undefined, { url: `${CHATS}?id=other`, now: NOW + 40 * day, token: later });
    expect((await call('PUT', chat('old', msgs), { url: CHATS, now: NOW + 40 * day, token: later })).response.status).toBe(200);
  });

  it('refuses bad ids, wrong shapes, too many messages, oversized chats and a 501st chat', async () => {
    const { call } = await setup();
    const status = async (method: string, body?: unknown, url = CHATS) => (await call(method, body, { url })).response.status;
    expect(await status('PUT', chat('bad id!', msgs))).toBe(400);
    expect(await status('PUT', { id: 'x', messages: 'nope' })).toBe(400);
    expect(await status('PUT', chat('m', Array.from({ length: 201 }, () => ({ role: 'user', content: 'x' }))))).toBe(400);
    expect(await status('PUT', chat('big', Array.from({ length: 60 }, () => ({ role: 'user', content: 'y'.repeat(8000) }))))).toBe(413);
    expect(await status('GET', undefined, `${CHATS}?id=bad%20id`)).toBe(400);
    expect(await status('DELETE', undefined, CHATS)).toBe(400);
    for (let i = 0; i < 500; i++) {
      await call('PUT', chat(`c${i}`, [{ role: 'user', content: 'x' }], `Chat ${i}`), { url: CHATS });
    }
    expect(await status('PUT', chat('one-too-many', msgs))).toBe(400);
    expect(await status('PUT', chat('c3', [...msgs, { role: 'user', content: 'still fine' }]))).toBe(200);
  });

  it('needs a signed-in visitor, a database, and refuses other methods', async () => {
    const { call, env } = await setup();
    expect((await call('GET', undefined, { url: CHATS, token: null })).response.status).toBe(401);
    expect((await call('GET', undefined, { url: CHATS, env: { ...env, WAITLIST_DB: undefined } })).response.status).toBe(503);
    expect((await call('POST', {}, { url: CHATS })).response.status).toBe(405);
    expect((await call('PUT', chat('x', msgs), { url: CHATS, origin: 'https://evil.example' })).response.status).toBe(403);
  });
});

describe.skipIf(!sqlite)('who added a movie', () => {
  const PEOPLE = 'me@example.com=Hunter, mollie@example.com=Mollie';
  const ME_URL = 'https://r7orbit.io/api/movie-wheel/me';

  /** A setup where the two people are configured, and a way to call as either of them. */
  async function twoPeople(people: string | null = PEOPLE) {
    const s = await setup({ MOVIE_WHEEL_PEOPLE: people ?? undefined });
    const as = async (who: 'hunter' | 'mollie' | string, method: string, body?: unknown, url = URL_LIST) => {
      const email = who === 'hunter' ? 'me@example.com' : who === 'mollie' ? 'mollie@example.com' : who;
      const token = await s.a.sign({ ...s.a.good, email });
      return (await s.call(method, body, { token, url: url })).response;
    };
    const list = async () => (await (await as('hunter', 'GET')).json()).list as { id: string; title: string; addedBy: string; rating: number }[];
    const byTitle = async () => Object.fromEntries((await list()).map((m) => [m.title, m.addedBy]));
    return { ...s, as, list, byTitle };
  }

  it('says who is signed in, and the names the page can show', async () => {
    const { as } = await twoPeople();
    expect(await (await as('mollie', 'GET', undefined, ME_URL)).json()).toEqual({
      key: 'mollie',
      name: 'Mollie',
      people: [{ key: 'hunter', name: 'Hunter' }, { key: 'mollie', name: 'Mollie' }, { key: 'r7', name: 'R7' }],
    });
  });

  it('makes a name from the start of the email address when the people are not set up, and adds the caller to the names', async () => {
    const { as } = await twoPeople(null);
    expect(await (await as('Pat.Smith+x@example.com', 'GET', undefined, ME_URL)).json()).toEqual({
      key: 'patsmithx',
      name: 'Patsmithx',
      people: [{ key: 'patsmithx', name: 'Patsmithx' }, { key: 'r7', name: 'R7' }],
    });
  });

  it("stamps a new movie with whoever is signed in, and keeps R7's own marker", async () => {
    const { as, byTitle } = await twoPeople();
    await as('hunter', 'PUT', { list: [movie('1', 'Saw', 100)] });
    await as('mollie', 'PUT', { list: [movie('2', 'Us', 100), movie('3', 'Get Out', 100, { addedBy: 'r7' })] });
    expect(await byTitle()).toEqual({ Saw: 'hunter', Us: 'mollie', 'Get Out': 'r7' });
  });

  it('does not accept a made-up name: it counts as the signed-in person', async () => {
    const { as, byTitle } = await twoPeople();
    await as('mollie', 'PUT', { list: [movie('1', 'Saw', 100, { addedBy: 'nobody' })] });
    expect(await byTitle()).toEqual({ Saw: 'mollie' });
  });

  it("does not change who added a movie when someone else edits it", async () => {
    const { as, byTitle } = await twoPeople();
    await as('hunter', 'PUT', { list: [movie('1', 'Saw', 100)] });
    await as('mollie', 'PUT', { list: [movie('1', 'Saw', 200, { rating: 4 })] });
    const list = await (await as('hunter', 'GET')).json();
    expect(list.list[0]).toMatchObject({ rating: 4, addedBy: 'hunter' });
    expect(await byTitle()).toEqual({ Saw: 'hunter' });
  });

  it('leaves a movie from before this feature unattributed when it is edited, until a name is chosen for it', async () => {
    const { as, db, byTitle } = await twoPeople();
    await db.d1.prepare("INSERT INTO movie_wheel_movies (id, title, updated_at) VALUES ('old', 'Old Movie', 1)").run();
    await as('mollie', 'PUT', { list: [movie('old', 'Old Movie', 50, { rating: 3 })] });
    expect(await byTitle()).toEqual({ 'Old Movie': '' });
    await as('mollie', 'PUT', { list: [movie('old', 'Old Movie', 60, { rating: 3, addedBy: 'hunter' })] });
    expect(await byTitle()).toEqual({ 'Old Movie': 'hunter' });
  });

  it('keeps R7 as the adder through later edits, including ones that send no name', async () => {
    const { as, byTitle } = await twoPeople();
    await as('hunter', 'PUT', { list: [movie('1', 'Get Out', 100, { addedBy: 'r7' })] });
    await as('mollie', 'PUT', { list: [movie('1', 'Get Out', 200, { rating: 5 })] });
    expect(await byTitle()).toEqual({ 'Get Out': 'r7' });
  });

  it('refuses /me without a signed-in visitor or with another method', async () => {
    const { call } = await setup();
    expect((await call('GET', undefined, { url: ME_URL, token: null })).response.status).toBe(401);
    expect((await call('POST', {}, { url: ME_URL })).response.status).toBe(405);
  });
});

describe.skipIf(!sqlite)('follow-up suggestions', () => {
  const CHAT = 'https://r7orbit.io/api/movie-wheel/chat';
  const ask = { messages: [{ role: 'user', content: 'hi' }], context: 'WATCHED\nSaw | 2003' };
  const reply = async (content: string | null, extra: Record<string, unknown> = {}) => {
    const { a, call } = await setup();
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('cloudflareaccess')) return a.keyFetch(url, init);
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content, ...extra } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    return (await call('POST', ask, { url: CHAT, fetch: f })).response;
  };

  it('splits the follow-up line off the reply', () => {
    expect(splitFollowups('Horror leads.\n\n[[followups: Why is that? | Recommend 3 more | Add them to my list]]')).toEqual({
      reply: 'Horror leads.',
      followups: ['Why is that?', 'Recommend 3 more', 'Add them to my list'],
    });
  });

  it('copes with quotes, spacing, case, a trailing space, more than three, long items and empty ones', () => {
    expect(splitFollowups('Ok.\n[[ Followups :  "One" |  \'Two\' | | Three | Four ]]  ')).toEqual({ reply: 'Ok.', followups: ['One', 'Two', 'Three'] });
    expect(splitFollowups('Ok. [[followups: ' + 'x'.repeat(200) + ']]').followups[0]).toHaveLength(80);
    expect(splitFollowups('Ok.\n[[followups:]]')).toEqual({ reply: 'Ok.', followups: [] });
  });

  it('leaves a reply with no follow-up line alone, and drops a cut-off or stray marker instead of showing it', () => {
    expect(splitFollowups('Just an answer.')).toEqual({ reply: 'Just an answer.', followups: [] });
    expect(splitFollowups('Answer.\n[[followups: One | Tw')).toEqual({ reply: 'Answer.', followups: [] });
    expect(splitFollowups('See [[followups: mid]] sentence and more.').reply).not.toContain('[[followups');
  });

  it('returns the follow-ups next to the cleaned reply', async () => {
    const r = await reply('Horror leads.\n[[followups: Recommend 3 more | Add them to my list]]');
    expect(await r.json()).toEqual({ reply: 'Horror leads.', followups: ['Recommend 3 more', 'Add them to my list'] });
  });

  it('answers with no followups field when the model sent none', async () => {
    expect(await (await reply('Plain answer.')).json()).toEqual({ reply: 'Plain answer.' });
  });

  it('keeps the follow-ups of an assistant message in a saved chat, but only for assistant messages', async () => {
    const { call } = await setup();
    const url = 'https://r7orbit.io/api/movie-wheel/chats';
    await call('PUT', {
      id: 'f',
      title: 'x',
      messages: [
        { role: 'user', content: 'hi', followups: ['nope'] },
        { role: 'assistant', content: 'Hello', followups: ['One', '', 'Two', 'Three', 'Four'] },
        { role: 'assistant', content: 'No chips' },
      ],
    }, { url });
    const back = await (await call('GET', undefined, { url: `${url}?id=f` })).response.json();
    expect(back.chat.messages[0]).toEqual({ role: 'user', content: 'hi' });
    expect(back.chat.messages[1].followups).toEqual(['One', 'Two', 'Three']);
    expect(back.chat.messages[2].followups).toBeUndefined();
  });

  it('tells the model to end every reply with that line', async () => {
    const { a, call } = await setup();
    let system = '';
    const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('cloudflareaccess')) return a.keyFetch(url, init);
      system = (JSON.parse(String(init?.body)).messages as { content: string }[])[0].content;
      return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Hi.' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    await call('POST', ask, { url: CHAT, fetch: f });
    expect(system).toContain('[[followups: first | second | third]]');
  });
});
