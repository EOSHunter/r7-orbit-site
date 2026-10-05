import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import site from '../src/data/site.json' with { type: 'json' };
import { pageTextLines } from './page-text.js';

// Subscribe, privacy, 404 and search are built from src/content/pages/*.md (edited in /admin) inside their own frame. Their
// wording must not change by accident: tests/fixtures/pages/<page>.txt is the text of each page as it was before it became
// editable (captured from main), line for line, links included. If you change a page on purpose, change its fixture in the same
// commit. The privacy fixture is the "newsletter not connected" text; src/lib/page-copy.vitest.ts checks the other one.
// Split on CRLF too: a Windows checkout (core.autocrlf) gives the fixtures CRLF line ends.
const fixture = (name) =>
  readFileSync(new URL(`./fixtures/pages/${name}.txt`, import.meta.url), 'utf8')
    .trimEnd()
    .split(/\r?\n/);

const PAGES = [
  { name: 'subscribe', path: '/subscribe/' },
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

test('the privacy contact address and the RSS link are the site settings, not text in the page file', async ({
  page,
}) => {
  await page.goto('/privacy/');
  const mail = page.locator('main a[href^="mailto:"]');
  await expect(mail).toHaveAttribute('href', `mailto:${site.author.email}`);
  await expect(mail).toHaveText(site.author.email);
  await expect(page.locator('main a', { hasText: 'RSS' })).toHaveAttribute('href', site.links.rss);
  expect(readFileSync(new URL('../src/content/pages/privacy.md', import.meta.url), 'utf8')).not.toContain(
    site.author.email,
  );
});

test('the last privacy line and the subscribe privacy line are small print, as before', async ({ page }) => {
  await page.goto('/privacy/');
  await expect(page.locator('.prose > p').last()).toHaveClass('t-meta');
  await page.goto('/subscribe/');
  await expect(page.locator('main p.t-meta', { hasText: 'privacy page' })).toHaveCount(1);
});

test('subscribe: the text sits beside the form on a wide screen and above it on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/subscribe/');
  const box = page.locator('.subscribe');
  const text = await box.getByRole('heading', { level: 2, name: "What you'll get" }).boundingBox();
  const form = await box.locator('form').boundingBox();
  expect(text.x + text.width).toBeLessThanOrEqual(form.x);
  await page.setViewportSize({ width: 375, height: 900 });
  const small = await box.locator('> div p').last().boundingBox();
  const smallForm = await box.locator('form').boundingBox();
  expect(small.y + small.height).toBeLessThanOrEqual(smallForm.y);
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
