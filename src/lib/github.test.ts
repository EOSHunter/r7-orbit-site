import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { absoluteUrl, loadGitHubRepo, sanitizeReadme } from './github.ts';

const REPO = 'someone/example';
const apiRepo = {
  description: 'An example',
  stargazers_count: 12,
  forks_count: 3,
  language: 'TypeScript',
  license: { spdx_id: 'MIT', name: 'MIT License' },
  topics: ['ai', 'game'],
  pushed_at: '2026-10-01T00:00:00Z',
  default_branch: 'trunk',
  homepage: '',
  html_url: 'https://github.com/someone/example',
};
const readme = '<h1>Hi</h1><a href="docs/a.md">doc</a><img src="img/x.png" alt="x"><script>alert(1)</script>';

function mockFetch(calls: string[] = []): typeof fetch {
  return (async (url: string | URL | Request) => {
    const u = String(url);
    calls.push(u);
    assert.ok(u.startsWith('https://api.github.com/'), 'only the GitHub API is contacted');
    if (u.endsWith('/readme')) return new Response(readme, { status: 200 });
    return new Response(JSON.stringify(apiRepo), { status: 200 });
  }) as typeof fetch;
}
const offline = (async () => {
  throw new TypeError('fetch failed');
}) as typeof fetch;

async function tmpCache() {
  return join(await mkdtemp(join(tmpdir(), 'ghcache-')), '.cache', 'github.json');
}

test('fetches stats and sanitised README, then writes the cache', async () => {
  const cacheFile = await tmpCache();
  const r = await loadGitHubRepo(REPO, { fetch: mockFetch(), cacheFile });
  assert.equal(r.status, 'ok');
  if (r.status !== 'ok') return;
  assert.equal(r.source, 'network');
  assert.deepEqual(r.stats.topics, ['ai', 'game']);
  assert.equal(r.stats.license, 'MIT');
  assert.equal(r.stats.defaultBranch, 'trunk');
  assert.ok(r.readmeHtml?.includes('<h1>Hi</h1>'));
  assert.ok(JSON.parse(await readFile(cacheFile, 'utf8'))[REPO]);
});

test('cache hit: fresh cache makes no network call', async () => {
  const cacheFile = await tmpCache();
  await loadGitHubRepo(REPO, { fetch: mockFetch(), cacheFile });
  const calls: string[] = [];
  const r = await loadGitHubRepo(REPO, { fetch: mockFetch(calls), cacheFile });
  assert.equal(calls.length, 0);
  assert.ok(r.status === 'ok' && r.source === 'cache' && !r.stale);
});

test('offline with a cache falls back to stale data', async () => {
  const cacheFile = await tmpCache();
  let t = Date.now();
  await loadGitHubRepo(REPO, { fetch: mockFetch(), cacheFile, now: () => t });
  t += 7 * 24 * 60 * 60 * 1000;
  const r = await loadGitHubRepo(REPO, { fetch: offline, cacheFile, now: () => t });
  assert.ok(r.status === 'ok' && r.source === 'cache' && r.stale);
  if (r.status === 'ok') assert.equal(r.stats.stars, 12);
});

test('offline without a cache returns unavailable and does not throw', async () => {
  const r = await loadGitHubRepo(REPO, { fetch: offline, cacheFile: await tmpCache() });
  assert.deepEqual(r, { status: 'unavailable', repo: REPO, reason: 'offline' });
});

test('rate limit without a cache is reported as rate-limited', async () => {
  const limited = (async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } })) as typeof fetch;
  const r = await loadGitHubRepo(REPO, { fetch: limited, cacheFile: await tmpCache() });
  assert.ok(r.status === 'unavailable' && r.reason === 'rate-limited');
});

test('rejects malformed repo names without a network call', async () => {
  const calls: string[] = [];
  const r = await loadGitHubRepo('../etc', { fetch: mockFetch(calls), cacheFile: await tmpCache() });
  assert.ok(r.status === 'unavailable' && r.reason === 'invalid-repo');
  assert.equal(calls.length, 0);
});

test('token is sent as a header when provided', async () => {
  const seen: Record<string, string>[] = [];
  const spy = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push(init?.headers as Record<string, string>);
    return String(url).endsWith('/readme') ? new Response('<p>x</p>') : new Response(JSON.stringify(apiRepo));
  }) as typeof fetch;
  await loadGitHubRepo(REPO, { fetch: spy, cacheFile: await tmpCache(), token: 'secret' });
  assert.equal(seen[0].Authorization, 'Bearer secret');
});

test('sanitising strips scripts, handlers, iframes and javascript: URLs', () => {
  const dirty =
    '<p onclick="x()">a</p><script>alert(1)</script><iframe src="https://evil.test"></iframe>' +
    '<a href="javascript:alert(1)">bad</a><a href="JaVaScRiPt:alert(1)">bad2</a><img src="x" onerror="alert(1)">' +
    '<a href="data:text/html;base64,AAAA">d</a><style>p{}</style><b>ok</b>';
  const out = sanitizeReadme(dirty, REPO, 'main');
  assert.ok(!/script|onclick|onerror|iframe|javascript:|data:|<style|alert/i.test(out), out);
  assert.ok(out.includes('<b>ok</b>'));
});

test('relative links and images become absolute for the default branch', () => {
  const out = sanitizeReadme(
    '<a href="docs/a.md">d</a><a href="/LICENSE">l</a><img src="./img/x.png" alt="x"><a href="#top">t</a><a href="https://example.com/">e</a>',
    REPO,
    'trunk',
  );
  assert.ok(out.includes('href="https://github.com/someone/example/blob/trunk/docs/a.md"'), out);
  assert.ok(out.includes('href="https://github.com/someone/example/blob/trunk/LICENSE"'), out);
  assert.ok(out.includes('src="https://raw.githubusercontent.com/someone/example/trunk/img/x.png"'), out);
  assert.ok(out.includes('href="#top"'), out);
  assert.ok(out.includes('href="https://example.com/"'), out);
  assert.equal(absoluteUrl('//evil.test/x', REPO, 'main', 'link'), '//evil.test/x');
});
