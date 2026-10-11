import { writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { contentTextProblems, inputsDigest, readTextFixture, staleNote, textFixture } from './fixture-inputs.js';
import { pageTextLines } from './page-text.js';

// Privacy, 404 and search are built from src/content/pages/*.md (edited in /admin) inside their own frame. Their
// wording must not change by accident: tests/fixtures/pages/<page>.txt is the text of each page, line for line, links included,
// with the digest of the files it came from on its first line (tests/fixture-inputs.js). If the author has edited them since,
// the page is checked against them instead and the test says the fixture is out of date. Changed a page on purpose? Rebuild,
// refresh the fixtures and read the diff:
//   npm run build && UPDATE_PAGE_TEXT=1 npx playwright test pages.spec
const fixtureUrl = (name) => new URL(`./fixtures/pages/${name}.txt`, import.meta.url);

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
    const lines = await pageTextLines(page);
    const inputs = inputsDigest(['src/data/site.json', `src/content/pages/${name}.md`]);
    if (process.env.UPDATE_PAGE_TEXT) return writeFileSync(fixtureUrl(name), textFixture(inputs, lines));
    const fixture = readTextFixture(fixtureUrl(name));
    if (fixture.inputs === inputs) expect(lines).toEqual(fixture.lines);
    else {
      test.info().annotations.push({
        type: 'note',
        description: staleNote(`tests/fixtures/pages/${name}.txt`, 'UPDATE_PAGE_TEXT=1 npx playwright test pages.spec'),
      });
      expect(contentTextProblems(lines, name), 'the words its file holds').toEqual([]);
    }
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
