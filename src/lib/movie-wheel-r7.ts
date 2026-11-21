// R7 Home's door into the Movie Wheel: GET and POST /api/movie-wheel/r7 (functions/api/movie-wheel/r7.ts only calls handleR7).
// R7 Home is the household assistant on the Pi. It signs in with a Cloudflare Access service token, so it is never a person; anything it adds
// is marked as added by R7, like the chat's additions. Setup: docs/MOVIE_WHEEL.md, "R7 Home".
//
//   GET  -> { toWatch, watched, counts }                          the list, short enough to read aloud from
//   GET  ?poster=<path>&w=<size>                                -> the poster picture (a TMDB path or an uploaded one), for R7 Home's screen
//   POST { action: 'pick', genre?, kind?, maxMinutes?, title? } -> { picked, poolSize, how, pool }   choose from the to-watch list (changes nothing)
//   POST { action: 'add', title, year?, kind? }                 -> { status: 'added' | 'already', movie, before, pool }
//   POST { action: 'watched', title, year? }                    -> { status: 'watched' | 'next-episode' | 'already', movie, before }
//   POST { action: 'rate', title, year?, rating?, review? }     -> { status: 'rated', movie, before, markedWatched }
//   POST { action: 'undo', id, before }                         -> { status: 'undone', movie? }   puts back what a change replaced
//
// A title is matched loosely (case, punctuation and a leading "The" do not matter); when several movies fit, the answer is 409 with the
// candidates so R7 can ask which one. Every change goes through the same merge as a device's save and counts a new version, so phones and
// laptops show it on their next sync (within a minute).
//
// `pool` is what R7 Home's screen draws as the wheel: up to 24 titles from the set the result came from (the filtered to-watch list for a
// spin, the whole to-watch list otherwise), always including the result, in a shuffled order.

import {
  accessClaims,
  cleanMovie,
  database,
  fail,
  json,
  MESSAGES,
  posterPicture,
  readAll,
  saveMovies,
  tmdbMovie,
  type Movie,
  type MovieWheelContext,
  type TmdbMovie,
} from './movie-wheel-api';

export const R7_MESSAGES = {
  notSetUp: 'R7 Home is not set up for the Movie Wheel yet (MOVIE_WHEEL_R7_CLIENT_ID).',
  notR7: 'This endpoint is for R7 Home only.',
  unknownAction: 'Unknown action. Use pick, add, watched, rate or undo.',
  noTitle: 'Say which movie or show.',
  notFound: 'That is not on the list.',
  ambiguous: 'More than one movie or show fits that title.',
  nothingToPick: 'Nothing on the to-watch list matches that.',
  nothingToRate: 'Give a rating from half a star to 5 stars, a review, or both.',
  badRating: 'A rating goes from half a star to 5 stars, in half-star steps.',
  cannotUndo: 'That change cannot be undone from here.',
};

const MAX_BODY_BYTES = 8_000;
const MAX_LISTED = 400;
const UNDO_ADD_MS = 24 * 3600 * 1000;

/** True when a service token's Client ID is the configured one. Cloudflare writes it with or without a trailing ".access". */
function sameClientId(a: unknown, b: string): boolean {
  const norm = (v: string) => v.trim().toLowerCase().replace(/\.access$/, '');
  return typeof a === 'string' && !!norm(b) && norm(a) === norm(b);
}

/** Lets only R7 Home through: a valid Access token that is a service token, and the configured one. */
async function guardR7(ctx: MovieWheelContext): Promise<Response | null> {
  const { request, env } = ctx;
  if (request.method !== 'GET' && request.method !== 'POST') return fail(405, 'Use GET or POST.');
  if (request.headers.get('Origin')) return fail(403, MESSAGES.origin); // R7 Home calls from its server; a browser never may
  if (env.DEV_BYPASS_ACCESS === '1') return null;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return fail(503, MESSAGES.closed);
  if (!env.MOVIE_WHEEL_R7_CLIENT_ID) return fail(503, R7_MESSAGES.notSetUp);
  const claims = await accessClaims(ctx);
  if (!claims) return fail(401, MESSAGES.signIn);
  if (String(claims.email ?? '').trim() || !sameClientId(claims.common_name, env.MOVIE_WHEEL_R7_CLIENT_ID)) return fail(403, R7_MESSAGES.notR7);
  return null;
}

// ---- Matching what was said to what is on the list ------------------------------------------------------------------------

/** A title as it is matched: lower case, no accents or punctuation, "&" as "and", no leading "the". */
export function normTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

/** A genre as it is matched ("Sci-fi", "sci fi", "science fiction" are one). */
function normGenre(g: string): string {
  const n = normTitle(g).replace(/ /g, '');
  return n === 'sciencefiction' ? 'scifi' : n;
}

type Found = { movie: Movie } | { error: string; status: number; matches?: string[] };

function label(m: Movie): string {
  return m.year ? `${m.title} (${m.year})` : m.title;
}

/** The one movie on the list that `title` (and `year`, when given) names, or why there is not exactly one. `prefer` breaks a tie. */
export function findMovie(list: Movie[], title: string, year?: number, prefer?: (m: Movie) => boolean): Found {
  const q = normTitle(title);
  if (!q) return { error: R7_MESSAGES.noTitle, status: 400 };
  const narrow = (ms: Movie[]) => {
    let out = ms;
    if (year && out.some((m) => m.year === year)) out = out.filter((m) => m.year === year);
    if (out.length > 1 && prefer && out.some(prefer)) out = out.filter(prefer);
    return out;
  };
  let hits = narrow(list.filter((m) => normTitle(m.title) === q));
  if (!hits.length && q.length >= 3) hits = narrow(list.filter((m) => normTitle(m.title).includes(q)));
  if (hits.length === 1) return { movie: hits[0] };
  if (!hits.length) return { error: R7_MESSAGES.notFound, status: 404 };
  return { error: R7_MESSAGES.ambiguous, status: 409, matches: hits.slice(0, 8).map(label) };
}

// ---- What R7 is told about a movie ----------------------------------------------------------------------------------------

export interface R7Movie {
  id: string;
  title: string;
  year: number;
  kind: 'movie' | 'show';
  /** A film's length, or a show's episode length, in minutes (0 when not known). */
  minutes: number;
  genres: string[];
  watched: boolean;
  rating: number;
  review: string;
  addedBy: string;
  /** A show's last episode watched, such as "S2 E4", when started. */
  progress?: string;
  /** The day it was marked watched, as YYYY-MM-DD. */
  watchedOn?: string;
  /** The poster: a TMDB path such as '/abc123.jpg' or an uploaded picture's name, for GET ?poster=. Absent when there is none. */
  poster?: string;
}

function brief(m: Movie): R7Movie {
  const out: R7Movie = {
    id: m.id, title: m.title, year: m.year, kind: m.kind, minutes: m.runtime, genres: m.genres, watched: m.watched,
    rating: m.rating, review: m.review, addedBy: m.addedBy,
  };
  if (m.poster) out.poster = m.poster;
  if (m.kind === 'show' && (m.season || m.episode)) out.progress = `S${m.season || 1} E${m.episode}`;
  if (m.watched && m.watchedAt) out.watchedOn = new Date(m.watchedAt).toISOString().slice(0, 10);
  return out;
}

// ---- Shows: the next episode, as the page does it -------------------------------------------------------------------------

/** After watching the next episode: S1 E1 when not started, the next one in the season, the first of the next season after a season's
 *  last. The last episode of the last season finishes the show. Same rule as nextEpisode() in the page. */
export function nextEpisode(m: Movie, now: number): Partial<Movie> {
  const se = m.seasonEps;
  const started = m.season || m.episode;
  const sn = m.season || 1;
  const ep = m.episode || 0;
  let ns: number;
  let ne: number;
  if (!started) [ns, ne] = [1, 1];
  else if (se.length && ep >= (se[sn - 1] || 0) && sn < se.length) [ns, ne] = [sn + 1, 1];
  else [ns, ne] = [sn, ep + 1];
  const p: Partial<Movie> = { season: ns, episode: ne };
  if (se.length && ns === se.length && ne >= se[ns - 1]) Object.assign(p, { watched: true, watchedAt: now });
  return p;
}

// ---- TMDB details for a movie R7 adds -------------------------------------------------------------------------------------

/** Looks a title up on TMDB and returns it only when the title is the same (and the year, when one was given), so R7 never adds a
 *  different film than the one asked for. Null when there is no token, no exact match, or TMDB cannot be reached. */
async function lookUp(ctx: MovieWheelContext, title: string, year: number | undefined, kind: 'movie' | 'show' | 'any'): Promise<TmdbMovie | null> {
  const token = ctx.env.TMDB_TOKEN;
  if (!token) return null;
  const doFetch = ctx.fetch ?? fetch;
  const get = async (url: string): Promise<unknown> => {
    try {
      const res = await doFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };
  const want = normTitle(title);
  const types: ('movie' | 'tv')[] = kind === 'movie' ? ['movie'] : kind === 'show' ? ['tv'] : ['movie', 'tv'];
  for (const t of types) {
    const when = year ? (t === 'tv' ? `&first_air_date_year=${year}` : `&year=${year}`) : '';
    const data = await get(`https://api.themoviedb.org/3/search/${t}?query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1${when}`);
    const results = (data as { results?: unknown } | null)?.results;
    const found = (Array.isArray(results) ? results : [])
      .map((x) => tmdbMovie(x, t === 'tv' ? 'show' : 'movie'))
      .find((m): m is TmdbMovie => !!m && normTitle(m.title) === want && (!year || m.year === year));
    if (!found) continue;
    const details = tmdbMovie(await get(`https://api.themoviedb.org/3/${t}/${found.id}?language=en-US`), found.kind);
    return details ? { ...found, runtime: details.runtime, seasonEps: details.seasonEps, genres: details.genres.length ? details.genres : found.genres } : found;
  }
  return null;
}

// ---- The endpoint ---------------------------------------------------------------------------------------------------------

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function yearOf(v: unknown): number | undefined {
  const y = Math.round(Number(v));
  return y >= 1870 && y <= 2100 ? y : undefined;
}
function newId(now: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `r7${now.toString(36)}${Array.from(bytes, (b) => b.toString(36)).join('').slice(0, 6)}`;
}
function randomIndex(n: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] % n;
}

const WHEEL_SLICES = 24;

/** A slice of the wheel on R7 Home's screen. */
export interface WheelSlice {
  id: string;
  title: string;
  kind: 'movie' | 'show';
}

/** Up to 24 titles from `from` for the wheel on R7 Home's screen, always including `result`, shuffled. */
export function wheelPool(from: Movie[], result: Movie): WheelSlice[] {
  const others = from.filter((m) => m.id !== result.id);
  for (let i = others.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [others[i], others[j]] = [others[j], others[i]];
  }
  const chosen = [result, ...others.slice(0, WHEEL_SLICES - 1)];
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen.map((m) => ({ id: m.id, title: m.title, kind: m.kind }));
}

export async function handleR7(ctx: MovieWheelContext): Promise<Response> {
  const refused = await guardR7(ctx);
  if (refused) return refused;
  const db = database(ctx.env);
  if (!db) return fail(503, MESSAGES.noDatabase);
  const now = ctx.now ?? Date.now();
  const list = (await readAll(db)).list ?? [];

  if (ctx.request.method === 'GET') {
    const params = new URL(ctx.request.url).searchParams;
    const posterPath = params.get('poster');
    if (posterPath !== null) return posterPicture(ctx, posterPath, params.get('w') ?? 'w342');
    const toWatch = list.filter((m) => !m.watched).sort((a, b) => b.addedAt - a.addedAt);
    const watched = list.filter((m) => m.watched).sort((a, b) => b.watchedAt - a.watchedAt);
    return json({
      toWatch: toWatch.slice(0, MAX_LISTED).map(brief),
      watched: watched.slice(0, MAX_LISTED).map(brief),
      counts: { toWatch: toWatch.length, watched: watched.length },
    });
  }

  const text = await ctx.request.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, MESSAGES.tooLarge);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return fail(400, MESSAGES.badBody);
  }
  if (!body || typeof body !== 'object') return fail(400, MESSAGES.badBody);
  const title = str(body.title, 120);
  const year = yearOf(body.year);
  const kind = body.kind === 'movie' || body.kind === 'show' ? body.kind : 'any';
  const notFound = (f: Exclude<Found, { movie: Movie }>) => json({ error: f.error, ...(f.matches ? { matches: f.matches } : {}) }, f.status);
  /** Saves an edited copy of `m`, newer than what is stored even if a device's clock ran ahead. */
  const edit = async (m: Movie, patch: Partial<Movie>): Promise<Movie> => {
    const next: Movie = { ...m, ...patch, updatedAt: Math.max(now, m.updatedAt + 1) };
    await saveMovies(db, [next], 'r7');
    return next;
  };

  switch (body.action) {
    case 'pick': {
      if (title) {
        const toWatch = list.filter((m) => !m.watched);
        const f = findMovie(toWatch, title, year);
        if (!('movie' in f)) return notFound(f);
        return json({ picked: brief(f.movie), poolSize: 1, how: 'chosen', pool: wheelPool(toWatch, f.movie) });
      }
      const genre = normGenre(str(body.genre, 24));
      const max = Math.round(Number(body.maxMinutes)) || 0;
      const pool = list.filter(
        (m) =>
          !m.watched &&
          (kind === 'any' || m.kind === kind) &&
          (!genre || m.genres.some((g) => normGenre(g) === genre)) &&
          (max <= 0 || (m.runtime > 0 && m.runtime <= max)),
      );
      if (!pool.length) return fail(404, R7_MESSAGES.nothingToPick);
      const picked = pool[randomIndex(pool.length)];
      return json({ picked: brief(picked), poolSize: pool.length, how: 'random', pool: wheelPool(pool, picked) });
    }

    case 'add': {
      if (!title) return fail(400, R7_MESSAGES.noTitle);
      const already = list.find((m) => normTitle(m.title) === normTitle(title) && (!year || !m.year || m.year === year));
      if (already) return json({ status: 'already', movie: brief(already), before: null, pool: wheelPool(list.filter((x) => !x.watched), already) });
      const found = await lookUp(ctx, title, year, kind);
      const m = cleanMovie({
        id: newId(now),
        title: found?.title ?? title,
        watched: false,
        genres: found?.genres ?? [],
        runtime: found?.runtime ?? 0,
        year: found?.year || year || 0,
        addedAt: now,
        updatedAt: now,
        addedBy: 'r7',
        poster: found?.poster ?? '',
        kind: found?.kind ?? (kind === 'show' ? 'show' : 'movie'),
        seasonEps: found?.seasonEps ?? [],
      });
      if (!m) return fail(400, R7_MESSAGES.noTitle);
      await saveMovies(db, [m], 'r7');
      return json({ status: 'added', movie: brief(m), before: null, details: found ? 'tmdb' : 'title-only', pool: wheelPool([...list.filter((x) => !x.watched), m], m) });
    }

    case 'watched': {
      const f = findMovie(list, title, year, (m) => !m.watched);
      if (!('movie' in f)) return notFound(f);
      const m = f.movie;
      if (m.watched) return json({ status: 'already', movie: brief(m), before: null });
      if (m.kind === 'show') {
        const next = await edit(m, nextEpisode(m, now));
        return json({ status: next.watched ? 'watched' : 'next-episode', movie: brief(next), before: m });
      }
      const next = await edit(m, { watched: true, watchedAt: now });
      return json({ status: 'watched', movie: brief(next), before: m });
    }

    case 'rate': {
      const hasRating = body.rating !== undefined && body.rating !== null;
      const hasReview = typeof body.review === 'string';
      if (!hasRating && !hasReview) return fail(400, R7_MESSAGES.nothingToRate);
      const rating = Math.round(Number(body.rating) * 2) / 2;
      if (hasRating && !(rating >= 0.5 && rating <= 5)) return fail(400, R7_MESSAGES.badRating);
      const f = findMovie(list, title, year, (m) => m.watched);
      if (!('movie' in f)) return notFound(f);
      const m = f.movie;
      const patch: Partial<Movie> = {};
      if (hasRating) patch.rating = rating;
      if (hasReview) patch.review = String(body.review).trim().slice(0, 280);
      if (!m.watched) Object.assign(patch, { watched: true, watchedAt: now });
      const next = await edit(m, patch);
      return json({ status: 'rated', movie: brief(next), before: m, markedWatched: !m.watched });
    }

    case 'undo': {
      const id = str(body.id, 64);
      const current = list.find((m) => m.id === id);
      if (body.before === null || body.before === undefined) {
        // undoing an add: only a movie R7 added, within a day
        if (!current || current.addedBy !== 'r7' || now - current.addedAt > UNDO_ADD_MS) return fail(409, R7_MESSAGES.cannotUndo);
        await saveMovies(db, [], 'r7', [{ id, at: Math.max(now, current.updatedAt) }]);
        return json({ status: 'undone' });
      }
      const before = cleanMovie(body.before);
      if (!current || !before || before.id !== id) return fail(409, R7_MESSAGES.cannotUndo);
      // only the fields R7 changes go back; who added it and when stay as they are
      const next = await edit(current, {
        watched: before.watched, watchedAt: before.watchedAt, rating: before.rating, review: before.review, season: before.season, episode: before.episode,
      });
      return json({ status: 'undone', movie: brief(next) });
    }

    default:
      return fail(400, R7_MESSAGES.unknownAction);
  }
}
