import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { onRequest as r7Function } from '../../functions/api/movie-wheel/r7';
import { forgetAccessKeys, handleList, MESSAGES, type D1Database, type MovieWheelContext, type MovieWheelEnv } from './movie-wheel-api';
import { findMovie, handleR7, nextEpisode, normTitle, R7_MESSAGES } from './movie-wheel-r7';

// /api/movie-wheel/r7, the endpoint R7 Home (the household assistant) uses, against a real SQLite database made from the real migrations
// and real signed Access tokens from a key pair made here (the same approach as movie-wheel-api.vitest.ts). No test calls the network.

const sqlite = await import('node:sqlite').catch(() => undefined);
const MIGRATION = ['0002_movie_wheel', '0003_movie_wheel_chats', '0004_movie_wheel_added_by', '0005_movie_wheel_poster', '0006_movie_wheel_uploaded_posters', '0007_movie_wheel_shows']
  .map((name) => readFileSync(`migrations/${name}.sql`, 'utf8'))
  .join('\n');

function database(): D1Database {
  const db = new sqlite!.DatabaseSync(':memory:');
  db.exec(MIGRATION);
  return {
    prepare(query: string) {
      const statement = db.prepare(query);
      let values: unknown[] = [];
      const prepared = {
        bind(...args: unknown[]) {
          values = args;
          return prepared;
        },
        async run() {
          return { success: true, meta: { changes: Number(statement.run(...(values as never[])).changes) } };
        },
        async all() {
          return { results: statement.all(...(values as never[])) as never[] };
        },
      };
      return prepared;
    },
    async batch(statements) {
      const out = [];
      for (const s of statements) out.push(await s.run());
      return out;
    },
  };
}

const TEAM = 'r7team';
const HOST = `${TEAM}.cloudflareaccess.com`;
const AUD = 'aud-1234';
const CLIENT_ID = 'abc123def456.access';
const NOW = 1_800_000_000_000;
const DAY = 24 * 3600 * 1000;
const b64 = (data: string | ArrayBuffer) => Buffer.from(typeof data === 'string' ? data : new Uint8Array(data)).toString('base64url');

async function setup(env: Partial<MovieWheelEnv> = {}) {
  forgetAccessKeys();
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' };
  const sign = async (payload: Record<string, unknown>) => {
    const head = `${b64(JSON.stringify({ alg: 'RS256', kid: 'k1' }))}.${b64(JSON.stringify(payload))}`;
    return `${head}.${b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(head)))}`;
  };
  const base = { aud: [AUD], iss: `https://${HOST}`, exp: NOW / 1000 + 7 * 24 * 3600 };
  const r7Token = await sign({ ...base, common_name: CLIENT_ID, type: 'app' });
  const personToken = await sign({ ...base, email: 'me@example.com' });
  // Access's key list, and TMDB when a test hands it answers
  let tmdb: (url: string) => unknown = () => ({ results: [] });
  const doFetch = vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u === `https://${HOST}/cdn-cgi/access/certs`) return new Response(JSON.stringify({ keys: [jwk] }));
    if (u.startsWith('https://api.themoviedb.org/')) return new Response(JSON.stringify(tmdb(u)));
    if (u === 'https://image.tmdb.org/t/p/w342/heat123.jpg') return new Response(new Uint8Array([0xff, 0xd8, 0xff, 1]), { headers: { 'Content-Type': 'image/jpeg' } });
    if (u.startsWith('https://image.tmdb.org/')) return new Response('missing', { status: 404 });
    throw new Error(`unexpected fetch ${u}`);
  }) as unknown as typeof fetch;
  const db = database();
  const fullEnv: MovieWheelEnv = { WAITLIST_DB: db, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, MOVIE_WHEEL_R7_CLIENT_ID: CLIENT_ID, ...env };
  const request = (url: string, method: string, body: unknown, token: string | null, headers: Record<string, string> = {}) =>
    new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const r7 = async (method: string, body?: unknown, o: { token?: string | null; now?: number; headers?: Record<string, string>; env?: MovieWheelEnv } = {}) => {
    const ctx: MovieWheelContext = {
      request: request('https://r7orbit.io/api/movie-wheel/r7', method, body, o.token === undefined ? r7Token : o.token, o.headers),
      env: o.env ?? fullEnv,
      fetch: doFetch,
      now: o.now ?? NOW,
    };
    const response = await handleR7(ctx);
    return { ctx, response, data: (await response.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any -- test answers are read loosely
  };
  /** What a device sees: the list endpoint, as a signed-in person. */
  const device = async (method = 'GET', body?: unknown) => {
    const ctx: MovieWheelContext = { request: request('https://r7orbit.io/api/movie-wheel/list', method, body, personToken), env: fullEnv, fetch: doFetch, now: NOW };
    return (await (await handleList(ctx)).json()) as { list: Record<string, unknown>[] | null; savedAt: number };
  };
  const seed = (list: Record<string, unknown>[]) =>
    device('PUT', { list: list.map((m, i) => ({ id: `m${i}`, watched: false, genres: [], addedAt: i + 1, updatedAt: 100, ...m })), removed: {} });
  /** A raw GET of the R7 endpoint with a query (the poster pictures), answered as a Response. */
  const r7Get = async (query: string, token: string | null = r7Token) =>
    handleR7({ request: request(`https://r7orbit.io/api/movie-wheel/r7?${query}`, 'GET', undefined, token), env: fullEnv, fetch: doFetch, now: NOW });
  return { r7, r7Get, device, seed, sign, base, personToken, db, setTmdb: (f: typeof tmdb) => (tmdb = f), env: fullEnv };
}

describe.skipIf(!sqlite)('who may use the R7 endpoint', () => {
  it("lets R7 Home's service token in", async () => {
    const { r7 } = await setup();
    expect((await r7('GET')).response.status).toBe(200);
  });

  it('accepts the Client ID with or without ".access"', async () => {
    const { r7, env } = await setup();
    expect((await r7('GET', undefined, { env: { ...env, MOVIE_WHEEL_R7_CLIENT_ID: 'abc123def456' } })).response.status).toBe(200);
  });

  it('refuses a person, another service token, no token, and a browser', async () => {
    const { r7, sign, base, personToken } = await setup();
    expect((await r7('GET', undefined, { token: personToken })).data.error).toBe(R7_MESSAGES.notR7);
    expect((await r7('GET', undefined, { token: await sign({ ...base, common_name: 'someone-else.access' }) })).response.status).toBe(403);
    expect((await r7('GET', undefined, { token: null })).response.status).toBe(401);
    expect((await r7('GET', undefined, { headers: { Origin: 'https://r7orbit.io' } })).response.status).toBe(403);
  });

  it('stays closed until the Client ID is set, and refuses other methods', async () => {
    const { r7, env } = await setup();
    const unset = await r7('GET', undefined, { env: { ...env, MOVIE_WHEEL_R7_CLIENT_ID: undefined } });
    expect(unset.response.status).toBe(503);
    expect(unset.data.error).toBe(R7_MESSAGES.notSetUp);
    expect((await r7('DELETE')).response.status).toBe(405);
  });

  it("keeps R7's service token off the people's endpoints", async () => {
    const { sign, base, env } = await setup();
    const token = await sign({ ...base, common_name: CLIENT_ID });
    const ctx: MovieWheelContext = {
      request: new Request('https://r7orbit.io/api/movie-wheel/list', { headers: { 'Cf-Access-Jwt-Assertion': token } }),
      env,
      now: NOW,
      fetch: (async () => new Response('{}')) as unknown as typeof fetch,
    };
    forgetAccessKeys();
    const res = await handleList(ctx);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe(MESSAGES.signIn);
  });

  it('is wired up by its Function file', async () => {
    const { r7 } = await setup();
    const { ctx, response } = await r7('GET');
    forgetAccessKeys();
    expect((await r7Function(ctx)).status).toBe(response.status);
  });
});

describe.skipIf(!sqlite)('R7 reading the list', () => {
  it('lists to watch (newest first) and watched (most recent first), with ratings, reviews and show progress', async () => {
    const { r7, seed } = await setup();
    await seed([
      { title: 'Alien', year: 1979, watched: true, watchedAt: NOW - 2 * DAY, rating: 4.5, review: 'Still great', runtime: 117, genres: ['Horror', 'Sci-fi'] },
      { title: 'Saw', year: 2004, watched: true, watchedAt: NOW - DAY, rating: 3 },
      { title: 'Heat', year: 1995, runtime: 170 },
      { title: 'Severance', kind: 'show', season: 1, episode: 4, seasonEps: [9, 10] },
    ]);
    const { data } = await r7('GET');
    expect(data.counts).toEqual({ toWatch: 2, watched: 2 });
    expect(data.toWatch.map((m: { title: string }) => m.title)).toEqual(['Severance', 'Heat']);
    expect(data.toWatch[0]).toMatchObject({ kind: 'show', progress: 'S1 E4' });
    expect(data.watched[0].title).toBe('Saw');
    expect(data.watched[1]).toMatchObject({ title: 'Alien', rating: 4.5, review: 'Still great', minutes: 117, watchedOn: new Date(NOW - 2 * DAY).toISOString().slice(0, 10) });
  });
});

describe.skipIf(!sqlite)('R7 picking', () => {
  it('picks at random from the to-watch list, never a watched one', async () => {
    const { r7, seed } = await setup();
    await seed([{ title: 'Alien', watched: true }, { title: 'Heat' }, { title: 'Saw' }]);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const { data } = await r7('POST', { action: 'pick' });
      expect(data.how).toBe('random');
      expect(data.poolSize).toBe(2);
      seen.add(data.picked.title);
    }
    expect([...seen].sort()).toEqual(['Heat', 'Saw']);
  });

  it('narrows by genre (in any spelling), kind and length, and says when nothing fits', async () => {
    const { r7, seed } = await setup();
    await seed([
      { title: 'Alien', genres: ['Horror', 'Sci-fi'], runtime: 117 },
      { title: 'Saw', genres: ['Horror'], runtime: 103 },
      { title: 'Heat', genres: ['Crime'], runtime: 170 },
      { title: 'Severance', kind: 'show', genres: ['Sci-fi'], runtime: 50 },
    ]);
    expect((await r7('POST', { action: 'pick', genre: 'science fiction', kind: 'movie' })).data.picked.title).toBe('Alien');
    expect((await r7('POST', { action: 'pick', genre: 'horror', maxMinutes: 110 })).data.picked.title).toBe('Saw');
    expect((await r7('POST', { action: 'pick', kind: 'show' })).data.picked.title).toBe('Severance');
    const none = await r7('POST', { action: 'pick', genre: 'Western' });
    expect(none.response.status).toBe(404);
    expect(none.data.error).toBe(R7_MESSAGES.nothingToPick);
  });

  it("records R7's own choice when it names one from the to-watch list, and changes nothing", async () => {
    const { r7, seed, device } = await setup();
    await seed([{ title: 'The Thing', year: 1982 }, { title: 'Heat' }]);
    const before = (await device()).savedAt;
    const { data } = await r7('POST', { action: 'pick', title: 'thing' });
    expect(data).toMatchObject({ how: 'chosen', picked: { title: 'The Thing' } });
    expect((await device()).savedAt).toBe(before);
    expect((await r7('POST', { action: 'pick', title: 'Jaws' })).response.status).toBe(404);
  });
});

describe.skipIf(!sqlite)('R7 adding', () => {
  it('adds a title as R7, with the details from TMDB when the title matches exactly, and devices see it', async () => {
    const { r7, device, setTmdb } = await setup({ TMDB_TOKEN: 'tmdb' });
    setTmdb((url) =>
      url.includes('/search/movie')
        ? { results: [{ id: 949, title: 'Heat', release_date: '1995-12-15', genre_ids: [80, 18], poster_path: '/heat123.jpg' }] }
        : url.includes('/movie/949')
          ? { id: 949, title: 'Heat', release_date: '1995-12-15', runtime: 170, genres: [{ id: 80 }, { id: 18 }] }
          : { results: [] },
    );
    const { data } = await r7('POST', { action: 'add', title: 'heat' });
    expect(data).toMatchObject({ status: 'added', details: 'tmdb', before: null, movie: { title: 'Heat', year: 1995, minutes: 170, genres: ['Crime', 'Drama'], addedBy: 'r7', watched: false } });
    const seen = (await device()).list!;
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ title: 'Heat', addedBy: 'r7', poster: '/heat123.jpg', addedAt: NOW });
  });

  it("keeps the title it was given when TMDB has no exact match, so it never adds a different film", async () => {
    const { r7, setTmdb } = await setup({ TMDB_TOKEN: 'tmdb' });
    setTmdb(() => ({ results: [{ id: 1, title: 'Heat Wave', release_date: '2022-01-01' }] }));
    const { data } = await r7('POST', { action: 'add', title: 'Heat', year: 1995 });
    expect(data).toMatchObject({ status: 'added', details: 'title-only', movie: { title: 'Heat', year: 1995, minutes: 0 } });
  });

  it('does not add a title that is already on the list', async () => {
    const { r7, seed, device } = await setup();
    await seed([{ title: 'The Thing', year: 1982, watched: true }]);
    const { data } = await r7('POST', { action: 'add', title: 'thing' });
    expect(data).toMatchObject({ status: 'already', movie: { title: 'The Thing', watched: true } });
    expect((await device()).list).toHaveLength(1);
  });

  it('needs a title and a known action', async () => {
    const { r7 } = await setup();
    expect((await r7('POST', { action: 'add' })).data.error).toBe(R7_MESSAGES.noTitle);
    expect((await r7('POST', { action: 'delete', title: 'x' })).data.error).toBe(R7_MESSAGES.unknownAction);
    expect((await r7('POST', 'nope')).response.status).toBe(400);
  });
});

describe.skipIf(!sqlite)('R7 marking watched', () => {
  it('marks a movie watched, and devices see it', async () => {
    const { r7, seed, device } = await setup();
    await seed([{ title: 'Saw', year: 2004 }]);
    const { data } = await r7('POST', { action: 'watched', title: 'saw' });
    expect(data).toMatchObject({ status: 'watched', movie: { watched: true }, before: { watched: false } });
    expect((await device()).list![0]).toMatchObject({ watched: true, watchedAt: NOW, addedBy: 'me' }); // R7 does not take over who added it
  });

  it('moves a show to its next episode, and finishes it after the last one', async () => {
    const { r7, seed } = await setup();
    await seed([{ title: 'Severance', kind: 'show', season: 1, episode: 9, seasonEps: [9, 10] }]);
    expect((await r7('POST', { action: 'watched', title: 'Severance' })).data).toMatchObject({ status: 'next-episode', movie: { progress: 'S2 E1', watched: false } });
    const show = { id: 's', title: 'X', watched: false, genres: [], runtime: 0, year: 0, rating: 0, review: '', addedAt: 0, watchedAt: 0, updatedAt: 0, addedBy: '', poster: '', kind: 'show' as const, season: 2, episode: 9, seasonEps: [9, 10] };
    expect(nextEpisode(show, NOW)).toEqual({ season: 2, episode: 10, watched: true, watchedAt: NOW });
    expect(nextEpisode({ ...show, season: 0, episode: 0 }, NOW)).toEqual({ season: 1, episode: 1 });
  });

  it('says so when it was already watched, and asks which one when two fit', async () => {
    const { r7, seed } = await setup();
    await seed([{ title: 'Alien', watched: true }, { title: 'Halloween', year: 1978 }, { title: 'Halloween', year: 2007 }]);
    expect((await r7('POST', { action: 'watched', title: 'Alien' })).data.status).toBe('already');
    const two = await r7('POST', { action: 'watched', title: 'Halloween' });
    expect(two.response.status).toBe(409);
    expect(two.data.matches).toEqual(['Halloween (1978)', 'Halloween (2007)']);
    expect((await r7('POST', { action: 'watched', title: 'Halloween', year: 2007 })).data.movie.year).toBe(2007);
  });
});

describe.skipIf(!sqlite)('R7 rating and reviewing', () => {
  it('saves a half-star rating and a review, and devices see them', async () => {
    const { r7, seed, device } = await setup();
    await seed([{ title: 'Saw', watched: true, watchedAt: 5 }]);
    const { data } = await r7('POST', { action: 'rate', title: 'Saw', rating: 3.5, review: '  Gross but fun.  ' });
    expect(data).toMatchObject({ status: 'rated', markedWatched: false, movie: { rating: 3.5, review: 'Gross but fun.' } });
    expect((await device()).list![0]).toMatchObject({ rating: 3.5, review: 'Gross but fun.', watchedAt: 5 });
  });

  it('marks an unwatched movie watched when rating it, and can change only the review', async () => {
    const { r7, seed } = await setup();
    await seed([{ title: 'Heat', rating: 0 }]);
    expect((await r7('POST', { action: 'rate', title: 'Heat', rating: 4 })).data).toMatchObject({ markedWatched: true, movie: { watched: true, rating: 4 } });
    expect((await r7('POST', { action: 'rate', title: 'Heat', review: 'Long, worth it.' })).data.movie).toMatchObject({ rating: 4, review: 'Long, worth it.' });
  });

  it('rounds to half stars and refuses ratings out of range or nothing at all', async () => {
    const { r7, seed } = await setup();
    await seed([{ title: 'Saw', watched: true }]);
    expect((await r7('POST', { action: 'rate', title: 'Saw', rating: 3.3 })).data.movie.rating).toBe(3.5);
    expect((await r7('POST', { action: 'rate', title: 'Saw', rating: 7 })).data.error).toBe(R7_MESSAGES.badRating);
    expect((await r7('POST', { action: 'rate', title: 'Saw', rating: 0 })).data.error).toBe(R7_MESSAGES.badRating);
    expect((await r7('POST', { action: 'rate', title: 'Saw' })).data.error).toBe(R7_MESSAGES.nothingToRate);
    expect((await r7('POST', { action: 'rate', title: 'Saw', review: 'x'.repeat(400) })).data.movie.review).toHaveLength(280);
  });

  it("wins over a device whose clock ran ahead", async () => {
    const { r7, seed, device } = await setup();
    await seed([{ title: 'Saw', watched: true, updatedAt: NOW + DAY }]);
    await r7('POST', { action: 'rate', title: 'Saw', rating: 2 });
    expect((await device()).list![0].rating).toBe(2);
  });
});

describe.skipIf(!sqlite)('R7 undoing', () => {
  it('puts back a rating and review it replaced, and devices see that', async () => {
    const { r7, seed, device } = await setup();
    await seed([{ title: 'Saw', watched: true, rating: 2, review: 'Meh' }]);
    const changed = (await r7('POST', { action: 'rate', title: 'Saw', rating: 4.5, review: 'Better than I said' })).data;
    const undone = (await r7('POST', { action: 'undo', id: changed.movie.id, before: changed.before }, { now: NOW + 1000 })).data;
    expect(undone).toMatchObject({ status: 'undone', movie: { rating: 2, review: 'Meh' } });
    expect((await device()).list![0]).toMatchObject({ rating: 2, review: 'Meh' });
  });

  it('removes a movie R7 added, but not one a person added, nor after a day', async () => {
    const { r7, seed, device } = await setup();
    await seed([{ title: 'Heat' }]);
    const added = (await r7('POST', { action: 'add', title: 'Jaws' })).data;
    expect((await r7('POST', { action: 'undo', id: 'm0', before: null })).data.error).toBe(R7_MESSAGES.cannotUndo);
    expect((await r7('POST', { action: 'undo', id: added.movie.id, before: null }, { now: NOW + 2 * DAY })).response.status).toBe(409);
    expect((await r7('POST', { action: 'undo', id: added.movie.id, before: null }, { now: NOW + 1000 })).data.status).toBe('undone');
    expect((await device()).list!.map((m) => m.title)).toEqual(['Heat']);
  });
});

describe('matching a spoken title', () => {
  const m = (title: string, year = 0, watched = false) => ({ id: title + year, title, year, watched }) as never;
  it('ignores case, punctuation, accents, "&" and a leading "The"', () => {
    expect(normTitle('The Lord of the Rings: The Fellowship & Friends')).toBe('lord of the rings the fellowship and friends');
    expect(normTitle('Amélie')).toBe('amelie');
    expect(findMovie([m('Spider-Man: No Way Home')], 'spiderman no way home')).toMatchObject({ error: R7_MESSAGES.notFound });
    expect(findMovie([m('Spider-Man: No Way Home')], 'spider man no way home')).toHaveProperty('movie');
  });

  it('takes a unique partial match, prefers what the caller prefers, and reports ties', () => {
    expect(findMovie([m('Alien'), m('Aliens')], 'alien')).toHaveProperty('movie.title', 'Alien');
    expect(findMovie([m('Insidious', 2010), m('Insidious: Chapter 2', 2013)], 'chapter 2')).toHaveProperty('movie.year', 2013);
    expect(findMovie([m('Halloween', 1978, true), m('Halloween', 2007)], 'halloween', undefined, (x) => !(x as { watched: boolean }).watched)).toHaveProperty('movie.year', 2007);
    expect(findMovie([m('Halloween', 1978), m('Halloween', 2007)], 'halloween')).toMatchObject({ status: 409 });
    expect(findMovie([m('Saw')], '')).toMatchObject({ status: 400 });
  });
});

describe.skipIf(!sqlite)("the wheel on R7 Home's screen", () => {
  const titles = (pool: { title: string }[]) => pool.map((s) => s.title).sort();

  it('sends the filtered pool with a spin, always including the pick, at most 24 slices', async () => {
    const { r7, seed } = await setup();
    await seed([
      { title: 'Alien', genres: ['Horror'] },
      { title: 'Saw', genres: ['Horror'] },
      { title: 'Heat', genres: ['Crime'] },
      { title: 'Seen', genres: ['Horror'], watched: true },
    ]);
    const { data } = await r7('POST', { action: 'pick', genre: 'horror' });
    expect(titles(data.pool)).toEqual(['Alien', 'Saw']);
    expect(data.pool.some((s: { id: string }) => s.id === data.picked.id)).toBe(true);
    expect(data.pool[0]).toEqual({ id: expect.any(String), title: expect.any(String), kind: 'movie' });

    await seed(Array.from({ length: 40 }, (_, i) => ({ title: `Film ${i}` })));
    for (let i = 0; i < 5; i++) {
      const big = (await r7('POST', { action: 'pick' })).data;
      expect(big.pool).toHaveLength(24);
      expect(big.pool.some((s: { id: string }) => s.id === big.picked.id)).toBe(true);
      expect(new Set(big.pool.map((s: { id: string }) => s.id)).size).toBe(24);
    }
  });

  it("sends the to-watch list with R7's own choice, and with an add (including the new title)", async () => {
    const { r7, seed } = await setup();
    await seed([{ title: 'The Thing' }, { title: 'Heat' }, { title: 'Alien', watched: true }]);
    const chosen = (await r7('POST', { action: 'pick', title: 'thing' })).data;
    expect(titles(chosen.pool)).toEqual(['Heat', 'The Thing']);
    const added = (await r7('POST', { action: 'add', title: 'Jaws' })).data;
    expect(titles(added.pool)).toEqual(['Heat', 'Jaws', 'The Thing']);
    const already = (await r7('POST', { action: 'add', title: 'heat' })).data;
    expect(already.status).toBe('already');
    expect(titles(already.pool)).toEqual(['Heat', 'Jaws', 'The Thing']);
  });

  it('includes the poster path in what R7 is told about a movie', async () => {
    const { r7, seed } = await setup();
    await seed([{ title: 'Heat', poster: '/heat123.jpg' }, { title: 'Saw' }]);
    const { data } = await r7('GET');
    expect(data.toWatch.find((m: { title: string }) => m.title === 'Heat').poster).toBe('/heat123.jpg');
    expect('poster' in data.toWatch.find((m: { title: string }) => m.title === 'Saw')).toBe(false);
  });

  it('serves a TMDB poster and an uploaded one to R7 Home, and nothing else', async () => {
    const { r7Get, db, personToken } = await setup();
    const tmdb = await r7Get('poster=/heat123.jpg&w=w342');
    expect(tmdb.status).toBe(200);
    expect(tmdb.headers.get('Content-Type')).toBe('image/jpeg');
    expect([...new Uint8Array(await tmdb.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff, 1]);
    expect((await r7Get('poster=/gone1234.jpg&w=w342')).status).toBe(404);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
    await db.prepare('INSERT INTO movie_wheel_posters (token, type, data, created_at) VALUES (?, ?, ?, ?)').bind('custom-0123456789abcdef', 'image/png', png, 1).run();
    const upload = await r7Get('poster=custom-0123456789abcdef');
    expect(upload.status).toBe(200);
    expect(upload.headers.get('Content-Type')).toBe('image/png');
    expect((await r7Get('poster=custom-ffffffffffffffff')).status).toBe(404);

    expect((await r7Get('poster=https://evil.example/x.jpg')).status).toBe(400);
    expect((await r7Get('poster=/heat123.jpg&w=original')).status).toBe(400);
    expect((await r7Get('poster=/heat123.jpg&w=w342', personToken)).status).toBe(403);
    expect((await r7Get('poster=/heat123.jpg&w=w342', null)).status).toBe(401);
  });
});
