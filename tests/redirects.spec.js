import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// public/_redirects is read by Cloudflare Pages, not by `astro preview`: the preview server these tests run against ignores it and
// answers a moved address with the 404 page. So this file reads the rules the way Pages does ("from to status", one per line, the
// first match wins) and checks them, and checks that the built site no longer has a page at the old address.

const rules = readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [from, to, status] = line.split(/\s+/);
    return { from, to, status: Number(status) };
  });

const redirectOf = (path) => rules.find((r) => r.from === path);

test('the old Games hub moved for good: /games and /games/ go to /apps/ with a 301', () => {
  for (const path of ['/games', '/games/']) {
    expect(redirectOf(path), path).toEqual({ from: path, to: '/apps/', status: 301 });
  }
  // The new address is not redirected anywhere itself.
  expect(redirectOf('/apps/')).toBeUndefined();
  expect(redirectOf('/apps')).toBeUndefined();
});

test('the post published as /blog/test/ moved to its own address with a 301, and the build has it only there', () => {
  const to = '/blog/how-i-built-a-browser-game-with-r7-orbit/';
  for (const path of ['/blog/test', '/blog/test/']) {
    expect(redirectOf(path), path).toEqual({ from: path, to, status: 301 });
  }
  expect(existsSync(new URL(`../dist${to}index.html`, import.meta.url))).toBe(true);
  expect(existsSync(new URL('../dist/blog/test/index.html', import.meta.url))).toBe(false);
});

test('every rule is well formed: a path, a target, and a status Pages accepts', () => {
  for (const { from, to, status } of rules) {
    expect(from, from).toMatch(/^\//);
    expect(to, from).toMatch(/^(\/|https:\/\/)/);
    expect([200, 301, 302, 303, 307, 308], from).toContain(status);
  }
  const froms = rules.map((r) => r.from);
  expect(new Set(froms).size, 'no path is listed twice').toBe(froms.length);
});

test('the build has the page at /apps/ and none at /games/ (under `astro preview`, which ignores _redirects, /games/ is a 404)', async ({
  request,
}) => {
  expect(existsSync(new URL('../dist/apps/index.html', import.meta.url))).toBe(true);
  expect(existsSync(new URL('../dist/games/index.html', import.meta.url))).toBe(false);
  expect((await request.get('/apps/')).status()).toBe(200);
  expect((await request.get('/games/')).status()).toBe(404);
});
