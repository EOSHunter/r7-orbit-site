import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { definitions } from '../src/lib/sections/definitions.ts';
import { watchPage } from './helpers.js';

// The block gallery: /styleguide/sections/ draws every block of the library once with the real renderer (noindex, unlinked, sample
// content). The same route is also in tests/routes.js, so the smoke, axe, budget, audit and keyboard specs run over it too; this
// file adds what is specific to the blocks: that each is there, that each does what it should, and that none breaks the page at
// any width. The About page itself is tests/about.spec.js.

const PAGE = '/styleguide/sections/';
/** A WAITLIST_PREVIEW=1 build: the waitlist block draws its form. In a normal build (the waitlist off) it draws nothing. */
const waitlistOn = existsSync(new URL('../dist/waitlist/remove/index.html', import.meta.url));
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** A selector for each block as the page draws it. */
const PRESENT = {
  heading: '.sections h2',
  lead: 'p.art-lead',
  text: '.prose > p',
  quote: 'figure.art-quote',
  pullquote: 'aside.art-pullquote',
  callout: '.art-callout',
  code: '.codeblock.art-code pre.code',
  image: 'figure.art-fig img',
  'image-row': 'figure.art-row .art-row-grid figure',
  gallery: '.gallery-wrap .gallery figure button.shot',
  portrait: '.about-grid .portrait img',
  video: '.art-video .yt .player',
  game: '.play-section .play-stage',
  columns: '.art-cols .art-col',
  divider: '.art-divider',
  spacer: '.sec-spacer',
  links: 'ul.link-list li',
  button: 'p.sec-button a.btn',
  toc: 'nav.art-toc li a',
  stats: '.stats',
  latest: '.latest-posts .grid-cards .card',
  // The home page's blocks are made from the posts: they draw while the site has posts, a featured one and an app (it does today).
  feed: 'section#latest[data-list] .feed-head h2',
  pinned: 'section[data-pinned] .card',
  apps: 'section[data-apps-teaser] .app-card',
  author: 'aside.author-box',
  // Only while the waitlist is on (tests/waitlist.spec.js covers the form itself).
  waitlist: 'section.waitlist-band [data-waitlist]',
};

const YT_PAGE = '<!doctype html><title>Video</title><p>video</p>';
const GAME = '<!doctype html><title>Game</title><canvas id="c" width="320" height="240" tabindex="0" aria-label="Game"></canvas>';

test('every block of the library is drawn on the gallery page, and the gallery lists no block the library does not have', async ({ page }) => {
  await page.goto(PAGE);
  expect(Object.keys(PRESENT).sort(), 'this test knows every block').toEqual(definitions.map((d) => d.id).sort());
  for (const d of definitions) {
    if (d.id === 'waitlist' && !waitlistOn) {
      await expect(page.locator('main [data-waitlist]'), 'the waitlist is off: its block draws nothing').toHaveCount(0);
      continue;
    }
    await expect(page.locator(`main ${PRESENT[d.id]}`).first(), d.id).toBeAttached();
  }
});

test('the gallery page is noindex, has one h1 and no axe violations', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))).toEqual([]);
});

test('loads without errors, and without a request to another site', async ({ page, baseURL }) => {
  const problems = watchPage(page, baseURL);
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  expect(problems).toEqual([]);
});

for (const width of [320, 375, 1280, 1480]) {
  test(`no horizontal scroll, and no block wider than the window, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    const wide = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: document.documentElement.clientWidth,
      over: [...document.querySelectorAll('main *')]
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !el.closest('pre, .codeblock, dialog, table'))
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
        .slice(0, 5),
    }));
    expect(wide.over, 'elements past the right edge').toEqual([]);
    expect(wide.doc).toBeLessThanOrEqual(wide.view);
  });
}

test('blocks that need room leave the reading column; text blocks share it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PAGE);
  for (const id of ['image-row', 'gallery', 'game', 'columns', 'latest']) {
    expect(await page.locator(`main ${PRESENT[id]}`).first().evaluate((el) => !!el.closest('.prose')), `${id} is outside .prose`).toBe(false);
  }
  for (const id of ['lead', 'quote', 'pullquote', 'callout', 'code', 'video', 'links', 'button', 'toc', 'author']) {
    expect(await page.locator(`main ${PRESENT[id]}`).first().evaluate((el) => !!el.closest('.prose')), `${id} is in .prose`).toBe(true);
  }
  // The latest feed is a section of its own, outside the container too.
  expect(await page.locator('section#latest').evaluate((el) => !el.closest('.prose') && !!el.closest('.sec-row-band'))).toBe(true);
});

test('two columns sit side by side from 720px up and stack below it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PAGE);
  const cols = page.locator('.art-cols .art-col');
  const [a, b] = [await cols.nth(0).boundingBox(), await cols.nth(1).boundingBox()];
  expect(b.x, 'right column to the right of the left').toBeGreaterThan(a.x + a.width - 1);
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(a.width / b.width, 'the 2:1 ratio').toBeGreaterThan(1.5);
  await page.setViewportSize({ width: 375, height: 800 });
  const [c, d] = [await cols.nth(0).boundingBox(), await cols.nth(1).boundingBox()];
  expect(d.y).toBeGreaterThan(c.y + c.height - 1);
});

test('the image row reserves its space: every picture has its size, and loads', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  const imgs = page.locator('figure.art-row img');
  await expect(imgs).toHaveCount(2);
  for (const img of await imgs.all()) {
    await expect(img).toHaveAttribute('width', /^\d+$/);
    await expect(img).toHaveAttribute('height', /^\d+$/);
    // The pictures load lazily: bring each into view first.
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test('the gallery opens a picture full size, steps through with the arrow keys and closes with Escape', async ({ page }) => {
  await page.goto(PAGE);
  const wrap = page.locator('.gallery-wrap');
  const dialog = wrap.locator('dialog');
  await expect(dialog).toBeHidden();
  await wrap.locator('button.shot').first().click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-gallery-count]')).toHaveText('1 of 2');
  await page.keyboard.press('ArrowRight');
  await expect(dialog.locator('[data-gallery-count]')).toHaveText('2 of 2');
  await expect(dialog.locator('[data-gallery-caption]')).toHaveText('The second.');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(wrap.locator('button.shot').first()).toBeFocused();
});

test('the video asks YouTube for nothing until play is pressed, then adds the player', async ({ page }) => {
  const asked = [];
  await page.route(/youtube/, (route) => {
    asked.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: YT_PAGE });
  });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  expect(asked, 'before play').toEqual([]);
  const video = page.locator('.art-video');
  await expect(video.locator('iframe')).toHaveCount(0);
  await expect(video.getByRole('button', { name: 'Play video: A fixture video' })).toBeVisible();
  await expect(video.locator('ol.chapters li')).toHaveCount(2);
  await expect(video.locator('figcaption')).toContainText('Nothing is requested');
  await video.getByRole('button', { name: 'Play video: A fixture video' }).click();
  await expect(video.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
});

test('the game loads nothing until Play is pressed, then a sandboxed frame on the allowed address', async ({ page }) => {
  const asked = [];
  await page.route('https://vesper.r7orbit.io/**', (route) => {
    asked.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: GAME });
  });
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  expect(asked, 'before Play').toEqual([]);
  const panel = page.locator('.play-section');
  // The block hides the panel's own "Play" heading (the page's headings are the author's), but names the region for screen readers.
  await expect(panel.locator('h2.visually-hidden')).toHaveText('Play');
  await expect(panel.getByText('Best on desktop with a mouse')).toBeVisible();
  await expect(panel.locator('.play-controls dt')).toHaveText(['W / Up arrow', 'Space']);
  const box = await panel.locator('.play-stage').boundingBox();
  expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
  await panel.getByRole('button', { name: 'Play Vesper Drift' }).click();
  const frame = panel.locator('iframe');
  await expect(frame).toHaveAttribute('src', 'https://vesper.r7orbit.io/');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
  expect(asked.length).toBeGreaterThan(0);
});

test('the contents list links to headings that exist, in page order, with unique ids', async ({ page }) => {
  await page.goto(PAGE);
  const links = await page.locator('nav.art-toc a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(links.length).toBeGreaterThan(3);
  expect(new Set(links).size, 'no link twice').toBe(links.length);
  for (const href of links) {
    expect(await page.locator(`main [id="${href.slice(1)}"]`).count(), href).toBe(1);
  }
  // The first heading of the page is first in the list, and its brass phrase is plain text in the list.
  await expect(page.locator('nav.art-toc a').first()).toHaveText('A row of text');
  const all = await page.locator('main h2[id], main h3[id]').evaluateAll((hs) => hs.map((h) => h.id));
  expect(links.map((l) => l.slice(1))).toEqual(expect.arrayContaining(all.slice(0, 2)));
  const ids = await page.locator('main [id]').evaluateAll((els) => els.map((e) => e.id));
  expect(new Set(ids).size, 'ids on the page are unique').toBe(ids.length);
});

test('the pull quote is hidden from screen readers, the spacer too; the code block has its copy button', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('aside.art-pullquote')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.sec-spacer').first()).toHaveAttribute('aria-hidden', 'true');
  const code = page.locator('.codeblock.art-code');
  await expect(code.locator('.codeblock-bar span').first()).toHaveText('Build the site');
  await expect(code.getByRole('button', { name: /copy/i })).toBeVisible();
  await expect(code.locator('pre.code')).toContainText('npm run build');
});

test('the latest posts are the newest published ones as cards, and only published ones', async ({ page }) => {
  await page.goto(PAGE);
  const cards = page.locator('.latest-posts .grid-cards .card');
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(3);
  for (const card of await cards.all()) {
    expect(await card.getAttribute('href')).toMatch(/^\/(blog|news|vlogs|projects|repos)\/[a-z0-9-]+\/$/);
    await expect(card, 'no "Draft" or "Scheduled" label in a build').not.toContainText(/Draft|Scheduled for/);
  }
  await expect(page.locator('.latest-posts h2.section-title em')).toHaveText('latest');
});

test('the author box links to the author page, and names an agent as AI-written', async ({ page }) => {
  await page.goto(PAGE);
  const box = page.locator('aside.author-box');
  await expect(box.locator('a.author-name')).toHaveAttribute('href', '/authors/hunter-newton/');
  await expect(box.locator('.chip.ai-written')).toHaveCount(0);
  await expect(box).not.toHaveAttribute('data-author-note', /.*/);
});

test('the GitHub stats are a row of numbers, or a plain link when GitHub could not be reached at build time', async ({ page }) => {
  await page.goto(PAGE);
  const stats = page.locator('main .stats').first();
  await expect(stats).toBeVisible();
  const text = (await stats.innerText()).trim();
  expect(text).toMatch(/stars|EOSHunter\/r7-orbit-site on GitHub/);
});

test('a decorative picture has an empty alt, and every other picture on the page has alt text', async ({ page }) => {
  await page.goto(PAGE);
  const alts = await page.locator('main img').evaluateAll((imgs) => imgs.map((i) => ({ alt: i.getAttribute('alt'), src: i.getAttribute('src') })));
  expect(alts.filter((i) => i.alt === null), 'every img has an alt attribute').toEqual([]);
  expect(alts.filter((i) => i.alt === '').length, 'the one decorative picture').toBeGreaterThan(0);
});
