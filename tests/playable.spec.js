import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Playable projects, tested on a fixture (src/pages/styleguide/playable.astro: the real components, a made-up play address,
// no published content). The game is answered by the test itself, so nothing leaves the machine.

const FIXTURE = '/styleguide/playable/';
const PLAY_URL = 'https://play.example.test/fixture-game/';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const GAME = `<!doctype html><title>Fixture game</title><canvas id="c" width="320" height="240" tabindex="0" aria-label="Game"></canvas>
<script>document.getElementById('c').focus()</script>`;

/** Answers the fake play address with a tiny page, and records every request made to it. */
async function serveGame(page) {
  const hits = [];
  await page.route('https://play.example.test/**', (route) => {
    hits.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: GAME });
  });
  return hits;
}

const embed = (page) => page.locator('[data-fixture="embed"] [data-play]');

test('the facade loads nothing from the game until Play is pressed', async ({ page }) => {
  const hits = await serveGame(page);
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });

  const panel = embed(page);
  await expect(panel.getByRole('heading', { level: 2, name: 'Play' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Play Fixture game' })).toBeVisible();
  await expect(panel.locator('iframe')).toHaveCount(0);
  expect(hits, 'requests to the game before Play').toEqual([]);
  expect(requests.filter((u) => u.includes('example.test'))).toEqual([]);

  // The facade is a 4:3 frame (playAspect), and the page has a fallback link, controls, note and platform.
  const box = await panel.locator('.play-stage').boundingBox();
  expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
  await expect(panel.getByRole('link', { name: /Open in a new tab/ })).toHaveAttribute('href', PLAY_URL);
  await expect(panel.getByRole('link', { name: /Open in a new tab/ })).toHaveAttribute('target', '_blank');
  await expect(panel.getByRole('link', { name: /Open in a new tab/ })).toHaveAttribute('rel', /noopener/);
  await expect(panel.getByText('Best on desktop with a mouse')).toBeVisible();
  await expect(panel.getByText('Desktop', { exact: true })).toBeVisible();
  const legend = panel.getByRole('heading', { name: 'Controls' });
  await expect(legend).toBeVisible();
  await expect(panel.locator('.play-controls dt')).toHaveText(['W / Up arrow', 'Space']);
  await expect(panel.locator('.play-controls dd')).toHaveText(['Thrust', 'Fire']);
  // The no-JS fallback is hidden while JavaScript is on.
  await expect(panel.locator('.play-nojs')).toBeHidden();
});

test('Play adds a sandboxed iframe, moves keyboard focus into it, and offers Fullscreen', async ({ page }) => {
  const hits = await serveGame(page);
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text())); // e.g. an invalid sandbox flag
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const panel = embed(page);

  await panel.getByRole('button', { name: 'Play Fixture game' }).click();
  const frame = panel.locator('iframe');
  await expect(frame).toHaveCount(1);
  await expect(frame).toHaveAttribute('src', PLAY_URL);
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
  await expect(frame).toHaveAttribute('allow', 'fullscreen; gamepad; autoplay');
  await expect(frame).toHaveAttribute('title', 'Fixture game (playable game)');
  await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  // The facade is gone, and keyboard focus is on the game (the iframe) so it can be played at once.
  await expect(panel.getByRole('button', { name: 'Play Fixture game' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME');
  expect(hits.length, 'the game was requested after Play').toBeGreaterThan(0);

  await expect(panel.locator('[data-play-status]')).toContainText(/Keyboard focus is in the game/);
  await expect(panel.getByRole('button', { name: 'Fullscreen' })).toBeVisible();
  await expect(panel.getByRole('link', { name: /Open in a new tab/ })).toBeVisible();
  await expect(panel.locator('[data-play-hint]')).toContainText('Esc');
  expect(errors, 'console errors').toEqual([]);
});

test('Play works from the keyboard', async ({ page }) => {
  await serveGame(page);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await embed(page).getByRole('button', { name: 'Play Fixture game' }).focus();
  await page.keyboard.press('Enter');
  await expect(embed(page).locator('iframe')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME');
});

test('link mode shows only the button: no facade, no iframe, no script work', async ({ page }) => {
  const hits = await serveGame(page);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const panel = page.locator('[data-fixture="link"] [data-play]');
  const link = panel.getByRole('link', { name: /Play Link only game/ });
  await expect(link).toHaveAttribute('href', PLAY_URL);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(panel.locator('.play-stage, iframe, button')).toHaveCount(0);
  await expect(panel.getByText('Opens in a new tab')).toBeVisible();
  expect(hits).toEqual([]);
});

test('a playable project card has the Playable badge (icon and label), and others do not', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const cards = page.locator('[data-fixture="cards"] a.card');
  await expect(cards).toHaveCount(2);
  const badge = cards.nth(0).locator('.playable-badge');
  await expect(badge).toHaveText('Playable');
  await expect(badge.locator('svg use')).toHaveAttribute('href', '#i-play');
  await expect(cards.nth(1).locator('.playable-badge')).toHaveCount(0);
});

test('the JSON-LD says it is a VideoGame and a SoftwareApplication for the web', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const blocks = await page.$$eval('script[type="application/ld+json"]', (els) => els.map((e) => e.textContent ?? ''));
  const graph = blocks.flatMap((b) => {
    const data = JSON.parse(b);
    return data['@graph'] ?? [data];
  });
  const game = graph.find((n) => [n['@type']].flat().includes('VideoGame'));
  expect(game, 'a VideoGame node').toBeTruthy();
  expect([game['@type']].flat()).toEqual(expect.arrayContaining(['VideoGame', 'SoftwareApplication']));
  expect(game.name).toBe('Fixture game');
  expect(game.url).toBe(PLAY_URL);
  expect(game.applicationCategory).toBe('Game');
  expect(game.operatingSystem).toBe('Web browser');
  expect(game.author).toMatchObject({ '@type': 'Person' });
  expect(game.author.name).toBeTruthy();
  expect(graph.some((n) => n['@type'] === 'BreadcrumbList')).toBe(true);
});

for (const width of [375, 1280]) {
  test(`axe passes before and after the game loads [${width}px]`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await serveGame(page);
    await page.goto(FIXTURE, { waitUntil: 'networkidle' });
    const scan = async () => {
      const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
      return violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
    };
    expect(await scan(), 'axe before Play').toEqual([]);
    await embed(page).getByRole('button', { name: 'Play Fixture game' }).click();
    await expect(embed(page).locator('iframe')).toHaveCount(1);
    await expect(embed(page).getByRole('button', { name: 'Fullscreen' })).toBeVisible();
    expect(await scan(), 'axe after Play').toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });
}

test('the facade does not animate with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const durations = await page
    .locator('[data-fixture="embed"] .play-start')
    .evaluate((el) => [
      getComputedStyle(el).transitionDuration,
      getComputedStyle(el.querySelector('svg')).transitionDuration,
    ]);
  for (const d of durations) expect(parseFloat(d)).toBe(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the facade is hidden and a plain link to the game takes its place', async ({ page }) => {
    await page.goto(FIXTURE);
    const panel = embed(page);
    await expect(panel.locator('.play-stage')).toBeHidden();
    const fallback = panel.locator('.play-nojs a');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('href', PLAY_URL);
    await expect(panel.locator('iframe')).toHaveCount(0);
  });
});

// ---- public/_headers ---------------------------------------------------------------------------------------------------

test('every embedded playUrl in src/content/projects/ is on the frame-src allow-list in public/_headers', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  const block = headers.split(/\r?\n/);
  const at = block.findIndex((l) => l.trim() === '/projects/*');
  expect(at, 'a /projects/* block').toBeGreaterThan(-1);
  const csp = block[at + 1].split(':').slice(1).join(':').trim();
  expect(csp, 'frame-src is the only directive').toMatch(/^frame-src [^;]+$/);
  const allowed = csp.replace('frame-src', '').trim().split(/\s+/);
  expect(allowed, 'no wildcards, no other schemes').toEqual(allowed.filter((s) => /^https:\/\/[a-z0-9.-]+$/.test(s)));

  const dir = new URL('../src/content/projects/', import.meta.url);
  if (!existsSync(dir)) return; // no projects published yet
  for (const file of readdirSync(dir).filter((f) => /\.mdx?$/.test(f))) {
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(new URL(file, dir), 'utf8'))?.[1] ?? '';
    const url = /^playUrl:\s*["']?([^"'\s]+)["']?\s*$/m.exec(front)?.[1];
    const mode = /^playMode:\s*["']?(\w+)["']?\s*$/m.exec(front)?.[1] ?? 'embed';
    if (url && mode !== 'link') expect(allowed, `${file}: ${url}`).toContain(new URL(url).origin);
  }
});
