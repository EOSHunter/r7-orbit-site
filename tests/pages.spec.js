import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { pageTextLines } from './page-text.js';

// Privacy, 404 and search are built from src/content/pages/*.md (edited in /admin) inside their own frame. Their
// wording must not change by accident: tests/fixtures/pages/<page>.txt is the text of each page as it was before it became
// editable (captured from main), line for line, links included. If you change a page on purpose, change its fixture in the same
// commit.
// Split on CRLF too: a Windows checkout (core.autocrlf) gives the fixtures CRLF line ends.
const fixture = (name) =>
  readFileSync(new URL(`./fixtures/pages/${name}.txt`, import.meta.url), 'utf8')
    .trimEnd()
    .split(/\r?\n/);

const PAGES = [
  { name: 'privacy', path: '/privacy/' },
  { name: '404', path: '/no-such-page/' },
  { name: 'search', path: '/search/' },
];

for (const { name, path } of PAGES) {
  test(`the rendered ${name} text is exactly the fixture: title, description, robots, headings, paragraphs, links, form text`, async ({
    page,
  }) => {
    await page.goto(path);
    expect(await pageTextLines(page)).toEqual(fixture(name));
  });

  for (const width of [375, 1280]) {
    test(`${name}: no horizontal scroll and no settings token left in the page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const sizes = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        view: document.documentElement.clientWidth,
      }));
      expect(sizes.doc).toBeLessThanOrEqual(sizes.view);
      expect(await page.locator('main').innerText()).not.toMatch(/\{(?:[a-z]+\.[a-zA-Z.]+|if [^}]*)\}/);
    });
  }
}

test('privacy: no contact address and no feed link', async ({ page }) => {
  await page.goto('/privacy/');
  await expect(page.locator('main a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.locator('main a[href*="rss"]')).toHaveCount(0);
  expect(await page.locator('main').innerText()).not.toMatch(/@/);
});

test('the last privacy line is small print, as before', async ({ page }) => {
  await page.goto('/privacy/');
  await expect(page.locator('.prose > p').last()).toHaveClass('t-meta');
});

test('404: a real 404 response, noindex, and the orbit is drawn', async ({ page }) => {
  const response = await page.goto('/no-such-page/');
  expect(response.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('.lost [data-orbit] svg')).toHaveCount(1);
  await expect(page.locator('.lost h1 em')).toHaveText('out of orbit');
});

test('search: the note for readers without JavaScript comes from the page file', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/search/');
  await expect(page.locator('.search-note')).toHaveText('Search needs JavaScript. Without it, browse by kind:');
  await context.close();
});
