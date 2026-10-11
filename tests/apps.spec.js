import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { footerLinks, siteSchema } from '../src/lib/site-settings.ts';

// The settings, read the way the build reads them: the nav and footer are the author's (Site settings in /admin), so whether they
// link to /apps/, and with which label, comes from there.
const SETTINGS = siteSchema.parse(JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8')));
const SITE_URL = SETTINGS.url;
const NAV_APPS = SETTINGS.nav.find((i) => i.href === '/apps/');
const FOOTER_APPS = footerLinks(SETTINGS).find((l) => l.href === '/apps/');
// The hub's words are its page entry's (edited in /admin, Pages > Apps page), so the tests read them from there, not a copy.
const front = (file) => parseFrontmatter(readFileSync(new URL(`../src/content/pages/${file}`, import.meta.url), 'utf8')).frontmatter;
const HUB = front('apps.md');
const HOME_ROW = front('home.md').sections.find((s) => s.type === 'apps');

// The apps hub. /apps/ shows whatever is published, so its layouts are tested on a fixture: src/pages/styleguide/apps.astro
// draws the real components with made-up projects (no published content) for none, one, two and five apps, and for several
// apps of one type, and includes a draft, a future-dated app and a project that is not an app that must not appear.

const FIXTURE = '/styleguide/apps/';
const PLAY_URL = 'https://play.example.test/fixture-link/';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// The order the five published apps must come in: `order` ascending, then the rest newest first. And their types: a project
// with no appType (Fixture newest) is an app.
const ORDER = ['Fixture first', 'Fixture second', 'Fixture newest', 'Fixture link', 'Fixture older'];
const TYPES = ['game', 'app', 'app', 'game', 'game'];
const GAMES = ORDER.filter((_, i) => TYPES[i] === 'game');
const APPS = ORDER.filter((_, i) => TYPES[i] === 'app');
const HIDDEN = ['Fixture draft', 'Fixture scheduled', 'Fixture not an app'];

const variant = (page, name) => page.locator(`[data-fixture="${name}"]`);
const cardsIn = (section) => section.locator('article.app-card');
const visibleTitles = (section) => cardsIn(section).locator('h2:visible').allTextContents();
const filterIn = (section) => section.getByRole('group', { name: 'Type' });
const jsonLd = (page) =>
  page.$$eval('script[type="application/ld+json"]', (els) =>
    els.flatMap((e) => {
      const data = JSON.parse(e.textContent ?? '');
      return Array.isArray(data) ? data : (data['@graph'] ?? [data]);
    }),
  );
const overflowOf = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// ---- the fixture: layouts, order, drafts, types, the primary link ----------------------------------------------------------

test('no apps: an empty state in the page entry\'s words, no grid, no placeholder card, no filter', async ({ page }) => {
  await page.goto(FIXTURE);
  const none = variant(page, 'none');
  await expect(none.getByRole('heading', { level: 2, name: HUB.emptyHeading })).toBeVisible();
  await expect(none.getByText(HUB.emptyText)).toBeVisible();
  await expect(none.getByRole('link', { name: HUB.emptyLinkLabel })).toHaveAttribute('href', '/projects/');
  await expect(none.locator('[data-apps], article, [data-filter]')).toHaveCount(0);
  await expect(none.getByText(HUB.soonTitle)).toHaveCount(0);
});

test('one app: its card and a final "More apps coming" card with no links', async ({ page }) => {
  await page.goto(FIXTURE);
  const one = variant(page, 'one');
  await expect(cardsIn(one)).toHaveCount(1);
  const soon = one.locator('[data-apps-soon]');
  await expect(soon).toHaveCount(1);
  await expect(soon.getByRole('heading', { name: HUB.soonTitle })).toBeVisible();
  await expect(soon.getByText(HUB.soonEyebrow)).toBeVisible();
  await expect(soon.getByText(HUB.soonText)).toBeVisible();
  await expect(soon.locator('a, button')).toHaveCount(0);
  const app = await cardsIn(one).boundingBox();
  const next = await soon.boundingBox();
  expect(next.x, 'the soon card follows the app').toBeGreaterThan(app.x);
});

test('the soon card appears only with exactly one app', async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(cardsIn(variant(page, 'two'))).toHaveCount(2);
  await expect(cardsIn(variant(page, 'many'))).toHaveCount(5);
  await expect(page.locator('[data-apps-soon]')).toHaveCount(1);
  for (const name of ['two', 'many', 'one-type']) await expect(variant(page, name).locator('[data-apps-soon]'), name).toHaveCount(0);
});

test('apps are ordered by `order`, then newest first; drafts, scheduled apps and non-apps are left out', async ({ page }) => {
  await page.goto(FIXTURE);
  const titles = (name) => cardsIn(variant(page, name)).getByRole('heading', { level: 2 }).allTextContents();
  expect(await titles('many')).toEqual(ORDER);
  expect(await titles('two')).toEqual(ORDER.slice(0, 2));
  expect(await titles('one-type')).toEqual(GAMES);
  const text = await page.locator('main').innerText();
  for (const hidden of HIDDEN) expect(text, hidden).not.toContain(hidden);
});

test('each card has the poster or placeholder, its type (icon and label), title, one line, platform chips, the button and Details', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const cards = cardsIn(variant(page, 'many'));
  const first = cards.nth(0);
  const poster = first.locator('.card-media img:not(.media-ph img)');
  await expect(poster).toHaveAttribute('alt', 'A fixture poster');
  await expect(poster).toHaveAttribute('width', '1280');
  await expect(poster).toHaveAttribute('height', '720');
  await expect(first.getByText('A made-up app called fixture-first.')).toBeVisible();
  await expect(first.locator('.app-platforms li')).toHaveText(['Mobile']);
  await expect(cards.nth(2).locator('.app-platforms li')).toHaveText(['Desktop', 'Mobile']);
  await expect(cards.nth(4).locator('.app-platforms')).toHaveCount(0);
  // No cover: the placeholder plate from MediaPlaceholder, not a broken image.
  await expect(cards.nth(1).locator('.card-media .media-ph')).toHaveCount(1);
  await expect(cards.nth(1).locator('.card-media img:not(.media-ph img)')).toHaveCount(0);
  await expect(first.getByRole('link', { name: 'Details for Fixture first' })).toHaveAttribute('href', '/projects/fixture-first/');
});

test('the type chip says Game or App with its icon, and the button says Play or Open; a card without appType is an App', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const cards = cardsIn(variant(page, 'many'));
  for (const [i, type] of TYPES.entries()) {
    const card = cards.nth(i);
    const chip = card.locator('.app-type');
    await expect(chip, ORDER[i]).toHaveText(type === 'game' ? 'Game' : 'App');
    await expect(chip.locator('svg use'), ORDER[i]).toHaveAttribute('href', type === 'game' ? '#i-play' : '#i-project');
    // A chip like the others: no colour of its own (brass is the only accent, and kinds are told apart by icon and label).
    await expect(chip).toHaveClass('chip app-type');
    const button = card.locator('a.btn.solid');
    await expect(button, ORDER[i]).toHaveText(new RegExp(`^${type === 'game' ? 'Play' : 'Open'} ${ORDER[i]}`));
  }
  // The same card in a hub of one type.
  await expect(cardsIn(variant(page, 'one-type')).locator('.app-type')).toHaveText(GAMES.map(() => 'Game'));
});

test('the primary button goes to the project page where it is embedded; a link-mode one opens its own address in a new tab', async ({
  page,
}) => {
  await page.goto(FIXTURE);
  const cards = cardsIn(variant(page, 'many'));
  const embedded = cards.nth(0).getByRole('link', { name: /^Play Fixture first/ });
  await expect(embedded).toHaveAttribute('href', '/projects/fixture-first/#play');
  await expect(embedded).not.toHaveAttribute('target', /.+/);
  await expect(embedded).toHaveClass(/solid/);
  await expect(cards.nth(1).getByRole('link', { name: /^Open Fixture second/ })).toHaveAttribute('href', '/projects/fixture-second/#play');

  const link = cards.nth(3).getByRole('link', { name: /^Play Fixture link/ });
  await expect(link).toHaveAttribute('href', PLAY_URL);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(link).toContainText('opens in a new tab');
  // Details still goes to the project page.
  await expect(cards.nth(3).getByRole('link', { name: /^Details/ })).toHaveAttribute('href', '/projects/fixture-link/');
});

test('images are lazy-loaded except the first row, and every poster frame is 16:9 so nothing shifts', async ({ page }) => {
  await page.goto(FIXTURE);
  const imgs = variant(page, 'many').locator('.card-media img:not(.media-ph img)');
  await expect(imgs).toHaveCount(3); // first, newest and older have covers
  expect(await imgs.evaluateAll((els) => els.map((e) => e.getAttribute('loading')))).toEqual(['eager', 'eager', 'lazy']);
  for (const media of await variant(page, 'many').locator('.card-media').all()) {
    const box = await media.boundingBox();
    expect(box.width / box.height, 'a 16:9 frame whether it holds an image or the placeholder').toBeCloseTo(16 / 9, 1);
  }
});

test('outside the hub (the home row) every poster is lazy, so none competes with the page LCP', async ({ page }) => {
  await page.goto('/');
  const imgs = page.locator('[data-apps] .card-media img:not(.media-ph img)');
  test.skip((await imgs.count()) === 0, 'no published app with a poster on the home page');
  expect(new Set(await imgs.evaluateAll((els) => els.map((e) => e.getAttribute('loading'))))).toEqual(new Set(['lazy']));
});

test('the JSON-LD is an ItemList of the apps in the order shown, with the page and the breadcrumb', async ({ page }) => {
  await page.goto(FIXTURE);
  const graph = await jsonLd(page);
  const list = graph.find((n) => n['@type'] === 'ItemList');
  expect(list, 'an ItemList').toBeTruthy();
  expect(list.numberOfItems).toBe(5);
  expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2, 3, 4, 5]);
  expect(list.itemListElement.map((i) => i.name)).toEqual(ORDER);
  expect(list.itemListElement[0].url).toBe(`${SITE_URL}/projects/fixture-first/`);
  expect(graph.find((n) => n['@type'] === 'CollectionPage')).toMatchObject({ name: 'Apps', url: `${SITE_URL}/apps/` });
  const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList').itemListElement;
  expect(crumbs.map((c) => c.name)).toEqual(['Home', 'Apps']);
});

// ---- the type filter -----------------------------------------------------------------------------------------------------

test('the type filter shows only when two or more types have a published app: All, then each type with one', async ({ page }) => {
  await page.goto(FIXTURE);
  for (const name of ['none', 'one', 'one-type']) await expect(variant(page, name).locator('[data-filter]'), name).toHaveCount(0);
  for (const name of ['two', 'many']) {
    const filter = filterIn(variant(page, name));
    await expect(filter, name).toBeVisible();
    await expect(filter.getByRole('button')).toHaveText(['All', 'Games', 'Apps']);
    await expect(filter.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  }
  // The one-type hub has unpublished apps (a draft, a scheduled one) in its pool: only what is published counts.
  await expect(variant(page, 'many').locator('[data-count]')).toHaveText('5 apps');
});

test('filtering by type shows only that type, keeps it in the address (?type=game) and says how many are shown', async ({ page }) => {
  await page.goto(FIXTURE);
  const many = variant(page, 'many');
  const filter = filterIn(many);
  await filter.getByRole('button', { name: 'Games' }).click();
  await expect(filter.getByRole('button', { name: 'Games' })).toHaveAttribute('aria-pressed', 'true');
  await expect(filter.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  expect(await visibleTitles(many)).toEqual(GAMES);
  await expect(many.locator('[data-count]')).toHaveText(`${GAMES.length} of 5 apps`);
  expect(new URL(page.url()).searchParams.get('type')).toBe('game');

  await filter.getByRole('button', { name: 'Apps' }).click();
  expect(await visibleTitles(many)).toEqual(APPS);
  expect(new URL(page.url()).searchParams.get('type')).toBe('app');
  // Two cards left: they stay at two columns, as a hub of two does.
  await expect(many.locator('[data-apps]')).toHaveClass(/few/);

  await filter.getByRole('button', { name: 'All' }).click();
  expect(await visibleTitles(many)).toEqual(ORDER);
  expect(new URL(page.url()).searchParams.has('type')).toBe(false);
  await expect(many.locator('[data-apps]')).not.toHaveClass(/few/);
});

test('the filter starts from the address, and ignores a type it does not offer', async ({ page }) => {
  await page.goto(`${FIXTURE}?type=app`);
  const many = variant(page, 'many');
  expect(await visibleTitles(many)).toEqual(APPS);
  await expect(filterIn(many).getByRole('button', { name: 'Apps' })).toHaveAttribute('aria-pressed', 'true');
  // A hub with only games offers no filter, so ?type=app leaves it whole.
  expect(await visibleTitles(variant(page, 'one-type'))).toEqual(GAMES);

  await page.goto(`${FIXTURE}?type=tool`);
  expect(await visibleTitles(many)).toEqual(ORDER);
  await expect(filterIn(many).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
});

test('the filter works from the keyboard, with a visible focus ring', async ({ page }) => {
  await page.goto(FIXTURE);
  const many = variant(page, 'many');
  const all = filterIn(many).getByRole('button', { name: 'All' });
  await all.focus();
  expect(await all.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Tab');
  await expect(filterIn(many).getByRole('button', { name: 'Games' })).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await visibleTitles(many)).toEqual(GAMES);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  expect(await visibleTitles(many)).toEqual(APPS);
});

test('with a type chosen, axe still passes and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${FIXTURE}?type=game`, { waitUntil: 'networkidle' });
  expect(await overflowOf(page), 'no horizontal scroll').toBeLessThanOrEqual(0);
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }))).toEqual([]);
});

// ---- layouts -------------------------------------------------------------------------------------------------------------

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
      const xs = await cardsIn(variant(page, name)).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
      return new Set(xs).size;
    };
    expect(await columns('many')).toBe(cols);
    // One or two cards never spread over more than two columns.
    expect(await columns('two')).toBe(Math.min(cols, 2));
    for (const card of await page.locator('article.app-card').all()) {
      const box = await card.boundingBox();
      expect(box.x, 'inside the viewport').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, 'inside the viewport').toBeLessThanOrEqual(width);
    }
    const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }))).toEqual([]);
  });
}

test('cards in a row are the same height, so the buttons line up', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const row = cardsIn(variant(page, 'many'));
  const rect = (i) =>
    row.nth(i).evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), height: Math.round(r.height), play: Math.round(e.querySelector('.btn.solid').getBoundingClientRect().top) };
    });
  const [a, b, c] = [await rect(0), await rect(1), await rect(2)];
  expect([b.top, c.top]).toEqual([a.top, a.top]);
  expect([b.height, c.height]).toEqual([a.height, a.height]);
  expect([b.play, c.play]).toEqual([a.play, a.play]);
});

test('works with JavaScript off: every card and its links are plain HTML, and the filter is hidden', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(new URL(`${FIXTURE}?type=game`, baseURL).href);
  const many = variant(page, 'many');
  await expect(cardsIn(many)).toHaveCount(5);
  expect(await visibleTitles(many)).toEqual(ORDER);
  await expect(many.locator('.toolbar')).toBeHidden();
  const play = cardsIn(many).nth(0).locator('a.btn.solid');
  await expect(play).toBeVisible();
  await expect(play).toHaveAttribute('href', '/projects/fixture-first/#play');
  await context.close();
});

test('the primary and Details links are reachable by keyboard, in that order, with a visible focus ring', async ({ page }) => {
  await page.goto(FIXTURE);
  const first = cardsIn(variant(page, 'many')).nth(0);
  const play = first.getByRole('link', { name: /^Play/ });
  await play.focus();
  await expect(play).toBeFocused();
  expect(await play.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Tab');
  await expect(first.getByRole('link', { name: /^Details/ })).toBeFocused();
});

// ---- structured data per type ----------------------------------------------------------------------------------------------

test('a game\'s project page is a VideoGame; an app\'s is a SoftwareApplication of category WebApplication; the author follows the byline', async ({
  page,
}) => {
  const mainOf = (graph) => graph.find((n) => [n['@type']].flat().includes('SoftwareApplication'));

  // Vesper Drift: appType game, credited to Hunter (no author field).
  await page.goto('/projects/vesper-drift/');
  const game = mainOf(await jsonLd(page));
  expect([game['@type']].flat()).toEqual(['VideoGame', 'SoftwareApplication']);
  expect(game).toMatchObject({ applicationCategory: 'Game', operatingSystem: 'Web browser', url: 'https://vesper.r7orbit.io/' });
  expect(game.author).toMatchObject({ '@type': 'Person', name: 'Hunter Newton' });

  // The tests' fixture project: a playUrl and no appType, so an app; credited to R7, an agent, so an Organization.
  await page.goto('/styleguide/posts/projects/');
  const app = mainOf(await jsonLd(page));
  expect(app['@type']).toBe('SoftwareApplication');
  expect(app).toMatchObject({ applicationCategory: 'WebApplication', operatingSystem: 'Web browser' });
  expect(app.author['@type']).toBe('Organization');
});

// ---- the real pages: /apps/, the navigation, the sitemap, the home row, the project page --------------------------------------

test('/apps/: heading, lead, canonical and Open Graph tags from its page entry, and the nav marks it as the current page', async ({ page }) => {
  await page.goto('/apps/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(HUB.title);
  await expect(page.locator('.page-head .t-lead')).toHaveText(HUB.lead);
  await expect(page.locator('.page-head .eyebrow')).toHaveText('Apps');
  await expect(page).toHaveTitle(new RegExp(`^${HUB.seoTitle} · `));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}/apps/`);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${SITE_URL}/apps/`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', HUB.seoTitle);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', HUB.description);
  // The nav marks the hub as the current page when the settings' nav links to it, and marks nothing when it does not.
  const current = page.getByRole('navigation', { name: 'Primary' }).locator('a[aria-current="page"]');
  if (NAV_APPS) {
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('href', '/apps/');
  } else await expect(current).toHaveCount(0);
  const graph = await jsonLd(page);
  expect(graph.find((n) => n['@type'] === 'BreadcrumbList').itemListElement.map((c) => c.name)).toEqual(['Home', 'Apps']);
});

test('/apps/ lists what is published: an empty state (noindex) or the apps with an ItemList and a sitemap entry; /games/ is gone', async ({
  page,
  request,
}) => {
  await page.goto('/apps/');
  const cards = await cardsIn(page.locator('main')).count();
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  const graph = await jsonLd(page);
  const robots = await page.locator('meta[name="robots"]').count();
  if (cards === 0) {
    await expect(page.getByRole('heading', { level: 2, name: HUB.emptyHeading })).toBeVisible();
    expect(robots, 'noindex while empty').toBe(1);
    expect(sitemap).not.toContain(`${SITE_URL}/apps/`);
    expect(graph.some((n) => n['@type'] === 'ItemList')).toBe(false);
  } else {
    expect(robots).toBe(0);
    expect(sitemap).toContain(`<loc>${SITE_URL}/apps/</loc>`);
    expect(graph.find((n) => n['@type'] === 'ItemList').numberOfItems).toBe(cards);
    await expect(page.locator('[data-apps-empty]')).toHaveCount(0);
  }
  expect(sitemap).not.toContain('/games/');
});

test('the home Apps row shows only when there are apps, at most three, with its heading and a link to /apps/', async ({ page }) => {
  await page.goto('/apps/');
  const apps = await cardsIn(page.locator('main')).count();
  await page.goto('/');
  const teaser = page.locator('[data-apps-teaser]');
  if (apps === 0 || !HOME_ROW) {
    await expect(teaser).toHaveCount(0);
  } else {
    await expect(cardsIn(teaser)).toHaveCount(Math.min(apps, 3));
    await expect(teaser.getByRole('link', { name: new RegExp(HOME_ROW.moreLabel) })).toHaveAttribute('href', HOME_ROW.moreUrl);
    await expect(teaser.getByRole('heading', { level: 2, name: HOME_ROW.heading })).toBeVisible();
    await expect(teaser.locator('[data-apps-soon]')).toHaveCount(0);
    // No filter outside the hub.
    await expect(teaser.locator('[data-filter]')).toHaveCount(0);
  }
  // The row's heading and link are the author's (Pages > Home page in /admin); the link must go to the hub.
  expect(HOME_ROW?.moreUrl ?? '/apps/').toBe('/apps/');
});

test('Apps is in the header and the footer where the settings put it, never /games/, and the menu opens with every link inside', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/about/');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const footer = page.getByRole('navigation', { name: 'Footer' });
  if (NAV_APPS) await expect(nav.locator('a[href="/apps/"]')).toHaveText(NAV_APPS.label);
  else await expect(nav.locator('a[href="/apps/"]')).toHaveCount(0);
  if (FOOTER_APPS) await expect(footer.locator('a[href="/apps/"]')).toHaveText(FOOTER_APPS.label);
  else await expect(footer.locator('a[href="/apps/"]')).toHaveCount(0);
  await expect(page.locator('a[href="/games/"]')).toHaveCount(0);

  for (const width of [320, 375, 900, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/about/');
    const toggle = page.getByRole('button', { name: /menu/i });
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
    for (const link of await nav.getByRole('link').all()) await expect(link).toBeVisible();
    expect(await overflowOf(page), `no horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
  }
});

test('a playable project page ends with "More apps": the others of any type, not itself, and a link to /apps/', async ({ page }) => {
  await page.goto('/apps/');
  const all = await cardsIn(page.locator('main')).getByRole('heading', { level: 2 }).allTextContents();
  test.skip(all.length === 0, 'no app is published');
  const first = cardsIn(page.locator('main')).first();
  const href = await first.getByRole('link', { name: /^Details/ }).getAttribute('href');
  await page.goto(href);
  const strip = page.locator('[data-more-apps]');
  await expect(strip.getByRole('heading', { level: 2, name: 'More apps' })).toBeVisible();
  await expect(strip.getByRole('link', { name: 'All apps' })).toHaveAttribute('href', '/apps/');
  const others = await cardsIn(strip).getByRole('heading', { level: 3 }).allTextContents();
  expect(others).not.toContain(all[0]);
  expect(others).toEqual(all.slice(1, 4));
});

test('a game is found by search and its result is labelled Game (when a game is published)', async ({ page }) => {
  await page.goto('/apps/');
  const game = cardsIn(page.locator('main')).filter({ has: page.locator('.app-type[data-app-type="game"]') });
  const titles = await game.getByRole('heading', { level: 2 }).allTextContents();
  test.skip(titles.length === 0, 'no game is published, so there is nothing to find');
  await page.goto(`/search/?q=${encodeURIComponent(titles[0])}`);
  const result = page.locator('.search-result', { hasText: titles[0] }).first();
  await expect(result).toBeVisible();
  await expect(result.locator('.kind')).toHaveText('Game');
  await expect(result.locator('.kind svg use')).toHaveAttribute('href', '#i-play');
});
