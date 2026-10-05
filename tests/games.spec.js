import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const { url: SITE_URL } = JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8'));

// The games hub. /games/ shows whatever is published (an empty state today), so its layouts are tested on a fixture:
// src/pages/styleguide/games.astro draws the real components with made-up projects (no published content) for none, one,
// two and five games, and includes a draft, a future-dated game and a project that is not a game that must not appear.

const FIXTURE = '/styleguide/games/';
const PLAY_URL = 'https://play.example.test/fixture-link/';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// The order the five published games must come in: `order` ascending, then the rest newest first.
const ORDER = ['Fixture first', 'Fixture second', 'Fixture newest', 'Fixture link', 'Fixture older'];
const HIDDEN = ['Fixture draft', 'Fixture scheduled', 'Fixture not a game'];

const variant = (page, name) => page.locator(`[data-fixture="${name}"]`);
const cardsIn = (section) => section.locator('article.game-card');
const jsonLd = (page) =>
  page.$$eval('script[type="application/ld+json"]', (els) =>
    els.flatMap((e) => {
      const data = JSON.parse(e.textContent ?? '');
      return Array.isArray(data) ? data : (data['@graph'] ?? [data]);
    }),
  );
const overflowOf = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---- the fixture: layouts, order, drafts, the Play link --------------------------------------------------------------------

test('no games: an empty state in the site voice, no grid, no placeholder card', async ({ page }) => {
  await page.goto(FIXTURE);
  const none = variant(page, 'none');
  await expect(none.getByRole('heading', { level: 2, name: 'No games yet.' })).toBeVisible();
  await expect(none.getByRole('link', { name: 'See the projects' })).toHaveAttribute('href', '/projects/');
  await expect(none.locator('[data-games], article')).toHaveCount(0);
  await expect(none.getByText('More games coming')).toHaveCount(0);
});

test('one game: its card and a final "More games coming" card with no links', async ({ page }) => {
  await page.goto(FIXTURE);
  const one = variant(page, 'one');
  await expect(cardsIn(one)).toHaveCount(1);
  const soon = one.locator('[data-games-soon]');
  await expect(soon).toHaveCount(1);
  await expect(soon.getByRole('heading', { name: 'More games coming' })).toBeVisible();
  await expect(soon.locator('a, button')).toHaveCount(0);
  const game = await cardsIn(one).boundingBox();
  const next = await soon.boundingBox();
  expect(next.x, 'the soon card follows the game').toBeGreaterThan(game.x);
});

test('the soon card appears only with exactly one game', async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(cardsIn(variant(page, 'two'))).toHaveCount(2);
  await expect(cardsIn(variant(page, 'many'))).toHaveCount(5);
  await expect(page.locator('[data-games-soon]')).toHaveCount(1);
  await expect(variant(page, 'two').locator('[data-games-soon]')).toHaveCount(0);
  await expect(variant(page, 'many').locator('[data-games-soon]')).toHaveCount(0);
});

test('games are ordered by `order`, then newest first; drafts, scheduled games and non-games are left out', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const titles = (name) => cardsIn(variant(page, name)).getByRole('heading', { level: 2 }).allTextContents();
  expect(await titles('many')).toEqual(ORDER);
  expect(await titles('two')).toEqual(ORDER.slice(0, 2));
  const text = await page.locator('main').innerText();
  for (const hidden of HIDDEN) expect(text, hidden).not.toContain(hidden);
});

test('each card has the poster or placeholder, title, one line, platform chips, Playable badge, Play and Details', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const cards = cardsIn(variant(page, 'many'));
  const first = cards.nth(0);
  const poster = first.locator('.card-media img:not(.media-ph img)');
  await expect(poster).toHaveAttribute('alt', 'A fixture poster');
  await expect(poster).toHaveAttribute('width', '1280');
  await expect(poster).toHaveAttribute('height', '720');
  await expect(first.getByText('A made-up game called fixture-first.')).toBeVisible();
  await expect(first.locator('.game-platforms li')).toHaveText(['Mobile']);
  await expect(cards.nth(2).locator('.game-platforms li')).toHaveText(['Desktop', 'Mobile']);
  await expect(cards.nth(4).locator('.game-platforms')).toHaveCount(0);
  const badge = first.locator('.playable-badge');
  await expect(badge).toHaveText('Playable');
  await expect(badge.locator('svg use')).toHaveAttribute('href', '#i-play');
  // No cover: the placeholder plate from MediaPlaceholder, not a broken image.
  await expect(cards.nth(1).locator('.card-media .media-ph')).toHaveCount(1);
  await expect(cards.nth(1).locator('.card-media img:not(.media-ph img)')).toHaveCount(0);
  await expect(first.getByRole('link', { name: 'Details for Fixture first' })).toHaveAttribute(
    'href',
    '/projects/fixture-first/',
  );
});

test('Play goes to the project page where the game is embedded; a link-mode game opens its own address in a new tab', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const cards = cardsIn(variant(page, 'many'));
  const embedded = cards.nth(0).getByRole('link', { name: /^Play Fixture first/ });
  await expect(embedded).toHaveAttribute('href', '/projects/fixture-first/#play');
  await expect(embedded).not.toHaveAttribute('target', /.+/);
  await expect(embedded).toHaveClass(/solid/);

  const link = cards.nth(3).getByRole('link', { name: /^Play Fixture link/ });
  await expect(link).toHaveAttribute('href', PLAY_URL);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(link).toContainText('opens in a new tab');
  // Details still goes to the project page.
  await expect(cards.nth(3).getByRole('link', { name: /^Details/ })).toHaveAttribute('href', '/projects/fixture-link/');
});

test('images are lazy-loaded except the first row, and every poster frame is 16:9 so nothing shifts', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const imgs = variant(page, 'many').locator('.card-media img:not(.media-ph img)');
  await expect(imgs).toHaveCount(3); // first, newest and older have covers
  expect(await imgs.evaluateAll((els) => els.map((e) => e.getAttribute('loading')))).toEqual([
    'eager',
    'eager',
    'lazy',
  ]);
  for (const media of await variant(page, 'many').locator('.card-media').all()) {
    const box = await media.boundingBox();
    expect(box.width / box.height, 'a 16:9 frame whether it holds an image or the placeholder').toBeCloseTo(16 / 9, 1);
  }
});

test('outside the hub (the home teaser) every game poster is lazy, so none competes with the page LCP', async ({ page }) => {
  await page.goto('/');
  const imgs = page.locator('[data-games] .card-media img:not(.media-ph img)');
  test.skip((await imgs.count()) === 0, 'no published game with a poster on the home page');
  expect(new Set(await imgs.evaluateAll((els) => els.map((e) => e.getAttribute('loading'))))).toEqual(new Set(['lazy']));
});

test('the JSON-LD is an ItemList of the games in the order shown, with the page and the breadcrumb', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const graph = await jsonLd(page);
  const list = graph.find((n) => n['@type'] === 'ItemList');
  expect(list, 'an ItemList').toBeTruthy();
  expect(list.numberOfItems).toBe(5);
  expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2, 3, 4, 5]);
  expect(list.itemListElement.map((i) => i.name)).toEqual(ORDER);
  expect(list.itemListElement[0].url).toBe(`${SITE_URL}/projects/fixture-first/`);
  expect(graph.find((n) => n['@type'] === 'CollectionPage')).toMatchObject({
    name: 'Games',
    url: `${SITE_URL}/games/`,
  });
  const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList').itemListElement;
  expect(crumbs.map((c) => c.name)).toEqual(['Home', 'Games']);
});

const layouts = [
  { width: 320, cols: 1 },
  { width: 375, cols: 1 },
  { width: 700, cols: 2 },
  { width: 1280, cols: 3 },
  { width: 1480, cols: 3 },
];
for (const { width, cols } of layouts) {
  test(`layout at ${width}px: ${cols} column(s), no horizontal scroll, axe passes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(FIXTURE, { waitUntil: 'networkidle' });
    expect(await overflowOf(page), 'no horizontal scroll').toBeLessThanOrEqual(0);
    const columns = async (name) => {
      const xs = await cardsIn(variant(page, name)).evaluateAll((els) =>
        els.map((e) => Math.round(e.getBoundingClientRect().left)),
      );
      return new Set(xs).size;
    };
    expect(await columns('many')).toBe(cols);
    // One or two cards never spread over more than two columns.
    expect(await columns('two')).toBe(Math.min(cols, 2));
    for (const card of await page.locator('article.game-card').all()) {
      const box = await card.boundingBox();
      expect(box.x, 'inside the viewport').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, 'inside the viewport').toBeLessThanOrEqual(width);
    }
    const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }))).toEqual(
      [],
    );
  });
}

test('cards in a row are the same height, so the Play buttons line up', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const row = cardsIn(variant(page, 'many'));
  const rect = (i) =>
    row.nth(i).evaluate((e) => {
      const r = e.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        height: Math.round(r.height),
        play: Math.round(e.querySelector('.btn.solid').getBoundingClientRect().top),
      };
    });
  const [a, b, c] = [await rect(0), await rect(1), await rect(2)];
  expect([b.top, c.top]).toEqual([a.top, a.top]);
  expect([b.height, c.height]).toEqual([a.height, a.height]);
  expect([b.play, c.play]).toEqual([a.play, a.play]);
});

test('works with JavaScript off: the cards and their links are plain HTML', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(new URL(FIXTURE, baseURL).href);
  await expect(cardsIn(variant(page, 'many'))).toHaveCount(5);
  const play = cardsIn(variant(page, 'many')).nth(0).locator('a.btn.solid');
  await expect(play).toBeVisible();
  await expect(play).toHaveAttribute('href', '/projects/fixture-first/#play');
  await context.close();
});

test('the Play and Details links are reachable by keyboard, in that order, with a visible focus ring', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const first = cardsIn(variant(page, 'many')).nth(0);
  const play = first.getByRole('link', { name: /^Play/ });
  await play.focus();
  await expect(play).toBeFocused();
  expect(await play.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Tab');
  await expect(first.getByRole('link', { name: /^Details/ })).toBeFocused();
});

// ---- the real pages: /games/, the navigation, the sitemap, the teaser -----------------------------------------------------

test('/games/: heading, intro, canonical and Open Graph tags, and the nav marks it as the current page', async ({
  page,
}) => {
  await page.goto('/games/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Games');
  await expect(page.getByText('Small games that run in your browser. No install.')).toBeVisible();
  await expect(page).toHaveTitle(/^Games · /);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/games/`);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${SITE_URL}/games/`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Games');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /browser/);
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Games' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const graph = await jsonLd(page);
  expect(graph.find((n) => n['@type'] === 'BreadcrumbList').itemListElement.map((c) => c.name)).toEqual([
    'Home',
    'Games',
  ]);
});

test('/games/ lists what is published: an empty state (noindex) or the games with an ItemList and a sitemap entry', async ({
  page,
  request,
}) => {
  await page.goto('/games/');
  const cards = await cardsIn(page.locator('main')).count();
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  const graph = await jsonLd(page);
  const robots = await page.locator('meta[name="robots"]').count();
  if (cards === 0) {
    await expect(page.getByRole('heading', { level: 2, name: 'No games yet.' })).toBeVisible();
    expect(robots, 'noindex while empty').toBe(1);
    expect(sitemap).not.toContain(`${SITE_URL}/games/`);
    expect(graph.some((n) => n['@type'] === 'ItemList')).toBe(false);
  } else {
    expect(robots).toBe(0);
    expect(sitemap).toContain(`<loc>${SITE_URL}/games/</loc>`);
    expect(graph.find((n) => n['@type'] === 'ItemList').numberOfItems).toBe(cards);
    await expect(page.locator('[data-games-empty]')).toHaveCount(0);
  }
});

test('the home Games teaser shows only when there are games, at most three, with a link to /games/', async ({
  page,
}) => {
  await page.goto('/games/');
  const games = await cardsIn(page.locator('main')).count();
  await page.goto('/');
  const teaser = page.locator('[data-games-teaser]');
  if (games === 0) {
    await expect(teaser).toHaveCount(0);
  } else {
    await expect(cardsIn(teaser)).toHaveCount(Math.min(games, 3));
    await expect(teaser.getByRole('link', { name: /All games/ })).toHaveAttribute('href', '/games/');
    await expect(teaser.getByRole('heading', { level: 2, name: 'Games' })).toBeVisible();
    await expect(teaser.locator('[data-games-soon]')).toHaveCount(0);
  }
});

test('Games is in the header and the footer, and the menu still opens with it inside', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/about/');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'Games' })).toHaveAttribute('href', '/games/');
  await expect(page.getByRole('navigation', { name: 'Footer' }).getByRole('link', { name: 'Games' })).toHaveAttribute(
    'href',
    '/games/',
  );
  const labels = await nav.getByRole('link').allTextContents();
  expect(labels.indexOf('Games')).toBe(labels.indexOf('Projects') + 1);

  for (const width of [320, 375, 900, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/about/');
    const toggle = page.getByRole('button', { name: /menu/i });
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
    await expect(nav.getByRole('link', { name: 'Games' })).toBeVisible();
    expect(await overflowOf(page), `no horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  }
});

test('a game is found by search and its result is labelled Game (when a game is published)', async ({ page }) => {
  await page.goto('/games/');
  const titles = await cardsIn(page.locator('main')).getByRole('heading', { level: 2 }).allTextContents();
  test.skip(titles.length === 0, 'no game is published, so there is nothing to find');
  await page.goto(`/search/?q=${encodeURIComponent(titles[0])}`);
  const result = page.locator('.search-result', { hasText: titles[0] }).first();
  await expect(result).toBeVisible();
  await expect(result.locator('.kind')).toHaveText('Game');
  await expect(result.locator('.kind svg use')).toHaveAttribute('href', '#i-play');
});
