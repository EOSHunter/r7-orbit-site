/**
 * Build-time GitHub loader: repo stats + README as sanitised HTML.
 * Talks only to api.github.com. Caches in .cache/github.json (git-ignored).
 * Never throws: it returns data (fresh or cached) or a typed `unavailable` result.
 * GITHUB_TOKEN is optional and is only ever sent as an Authorization header; it is never logged.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sanitizeHtml from 'sanitize-html';

export interface GitHubStats {
  repo: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  license: string | null;
  topics: string[];
  pushedAt: string | null;
  defaultBranch: string;
  homepage: string | null;
  url: string;
}

export interface GitHubRepoData {
  stats: GitHubStats;
  /** Sanitised HTML, links and images absolute. `null` when the repo has no README. */
  readmeHtml: string | null;
  /** When this data was fetched from GitHub (ISO). */
  fetchedAt: string;
}

export type UnavailableReason = 'invalid-repo' | 'offline' | 'rate-limited' | 'not-found' | 'error';

export type GitHubResult =
  | ({ status: 'ok'; source: 'network' | 'cache'; stale: boolean } & GitHubRepoData)
  | { status: 'unavailable'; repo: string; reason: UnavailableReason };

export interface GitHubLoaderOptions {
  fetch?: typeof fetch;
  cacheFile?: string;
  token?: string;
  /** Cached data younger than this is used without touching the network. Default 6 hours. */
  ttlMs?: number;
  timeoutMs?: number;
  now?: () => number;
}

const API = 'https://api.github.com';
const REPO_RE = /^(?!\.)[\w.-]+\/(?!\.{1,2}$)[\w.-]+$/;
const DEFAULT_CACHE = '.cache/github.json';
const DEFAULT_TTL = 6 * 60 * 60 * 1000;

type Cache = Record<string, GitHubRepoData>;

async function readCache(file: string): Promise<Cache> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Cache) : {};
  } catch {
    return {};
  }
}

async function writeCache(file: string, cache: Cache): Promise<void> {
  try {
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(cache, null, 2));
    await rename(tmp, file);
  } catch {
    // A cache that cannot be written must never break the build.
  }
}

/** Resolve a README URL against the repo. Absolute URLs, protocol-relative URLs and #anchors pass through. */
export function absoluteUrl(url: string, repo: string, branch: string, kind: 'link' | 'image'): string {
  const value = url.trim();
  if (!value || value.startsWith('#') || value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  const base =
    kind === 'image'
      ? `https://raw.githubusercontent.com/${repo}/${branch}/`
      : `https://github.com/${repo}/blob/${branch}/`;
  try {
    return new URL(value.replace(/^\/+/, ''), base).href;
  } catch {
    return '';
  }
}

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

/** Sanitise README HTML and make its links and images absolute. */
export function sanitizeReadme(html: string, repo: string, branch: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...HEADINGS,
      'p', 'br', 'hr', 'blockquote', 'pre', 'code', 'kbd', 'samp', 'em', 'strong', 'del', 'ins', 'sub', 'sup',
      'b', 'i', 'u', 's', 'a', 'img', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'details', 'summary', 'div', 'span', 'picture',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'id', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      th: ['align'],
      td: ['align'],
      ol: ['start'],
      ...Object.fromEntries(HEADINGS.map((h) => [h, ['id']])),
    },
    allowedSchemes: ['http', 'https'],
    allowProtocolRelative: false,
    // Drop the content of these, not just the tag.
    nonTextTags: ['script', 'style', 'textarea', 'option', 'iframe', 'noscript', 'object', 'embed'],
    transformTags: {
      a: (tag, attribs) => {
        const out: Record<string, string> = { ...attribs };
        if (out.href !== undefined) out.href = absoluteUrl(out.href, repo, branch, 'link');
        if (out.href && !out.href.startsWith('#')) out.rel = 'noopener noreferrer';
        return { tagName: tag, attribs: out };
      },
      img: (tag, attribs) => {
        const out: Record<string, string> = { ...attribs, loading: 'lazy' };
        if (out.src !== undefined) out.src = absoluteUrl(out.src, repo, branch, 'image');
        return { tagName: tag, attribs: out };
      },
    },
  });
}

function failReason(res: Response): UnavailableReason {
  if (res.status === 404) return 'not-found';
  if (res.status === 429 || res.status === 403) return 'rate-limited';
  return 'error';
}

interface ApiRepo {
  description?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  language?: string | null;
  license?: { spdx_id?: string | null; name?: string | null } | null;
  topics?: string[];
  pushed_at?: string | null;
  default_branch?: string;
  homepage?: string | null;
  html_url?: string;
}

async function fetchFresh(
  repo: string,
  f: typeof fetch,
  token: string | undefined,
  timeoutMs: number,
  now: () => number,
): Promise<GitHubRepoData | UnavailableReason> {
  const base: Record<string, string> = {
    'User-Agent': 'r7-orbit-site-build',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) base.Authorization = `Bearer ${token}`;
  const get = (path: string, accept: string) =>
    f(`${API}/repos/${repo}${path}`, { headers: { ...base, Accept: accept }, signal: AbortSignal.timeout(timeoutMs) });
  try {
    const res = await get('', 'application/vnd.github+json');
    if (!res.ok) return failReason(res);
    const r = (await res.json()) as ApiRepo;
    const defaultBranch = r.default_branch || 'main';
    const license = r.license ? (r.license.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : r.license.name) : null;
    const stats: GitHubStats = {
      repo,
      description: r.description ?? null,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      language: r.language ?? null,
      license: license ?? null,
      topics: Array.isArray(r.topics) ? r.topics : [],
      pushedAt: r.pushed_at ?? null,
      defaultBranch,
      homepage: r.homepage || null,
      url: r.html_url || `https://github.com/${repo}`,
    };

    let readmeHtml: string | null = null;
    const rr = await get('/readme', 'application/vnd.github.html+json');
    if (rr.ok) readmeHtml = sanitizeReadme(await rr.text(), repo, defaultBranch);
    else if (rr.status !== 404) return failReason(rr);
    return { stats, readmeHtml, fetchedAt: new Date(now()).toISOString() };
  } catch {
    return 'offline';
  }
}

/** Load stats and README for `owner/name`. Never throws. */
export async function loadGitHubRepo(repo: string, options: GitHubLoaderOptions = {}): Promise<GitHubResult> {
  if (!REPO_RE.test(repo)) return { status: 'unavailable', repo, reason: 'invalid-repo' };
  const f = options.fetch ?? globalThis.fetch;
  const cacheFile = options.cacheFile ?? DEFAULT_CACHE;
  const ttl = options.ttlMs ?? DEFAULT_TTL;
  const now = options.now ?? Date.now;
  const token = options.token ?? process.env.GITHUB_TOKEN;

  const cache = await readCache(cacheFile);
  const key = repo.toLowerCase();
  const cached = cache[key];
  const age = cached ? now() - Date.parse(cached.fetchedAt) : Infinity;
  if (cached && age >= 0 && age < ttl) return { status: 'ok', source: 'cache', stale: false, ...cached };

  const fresh = await fetchFresh(repo, f, token || undefined, options.timeoutMs ?? 10_000, now);
  if (typeof fresh === 'string') {
    if (cached) return { status: 'ok', source: 'cache', stale: true, ...cached };
    return { status: 'unavailable', repo, reason: fresh };
  }
  cache[key] = fresh;
  await writeCache(cacheFile, cache);
  return { status: 'ok', source: 'network', stale: false, ...fresh };
}
