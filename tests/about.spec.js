import { writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import site from '../src/data/site.json' with { type: 'json' };
import { aboutTextLines } from './about-text.js';
import { contentTextProblems, inputsDigest, readTextFixture, staleNote, textFixture } from './fixture-inputs.js';

// The About page is built from src/content/pages/about.md (edited in /admin). Its wording must not change by accident:
// tests/fixtures/about-text.txt is the text of the page, line for line, with the digest of the files it came from on its first
// line (tests/fixture-inputs.js). If the author has edited them since, the page is checked against them instead and the test says
// the fixture is out of date. Changed the page on purpose? Rebuild, refresh the fixture and read its diff:
//   npm run build && UPDATE_PAGE_TEXT=1 npx playwright test about
const fixtureUrl = new URL('./fixtures/about-text.txt', import.meta.url);
const INPUTS = ['src/data/site.json', 'src/content/pages/about.md', 'src/content/authors/'];

test('the rendered /about/ text is exactly the fixture: title, description, headings, paragraphs, bold lead-ins, alt text', async ({
  page,
}) => {
  await page.goto('/about/');
  const lines = await aboutTextLines(page);
  const inputs = inputsDigest(INPUTS);
  if (process.env.UPDATE_PAGE_TEXT) return writeFileSync(fixtureUrl, textFixture(inputs, lines));
  const fixture = readTextFixture(fixtureUrl);
  if (fixture.inputs === inputs) expect(lines).toEqual(fixture.lines);
  else {
    test.info().annotations.push({
      type: 'note',
      description: staleNote('tests/fixtures/about-text.txt', 'UPDATE_PAGE_TEXT=1 npx playwright test about'),
    });
    expect(contentTextProblems(lines, 'about'), 'the words its file holds').toEqual([]);
  }
});

test('the Person structured data still comes from site.json, and the page head is unchanged', async ({ page }) => {
  await page.goto('/about/');
  const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent())['@graph'];
  const person = graph.find((n) => n['@type'] === 'Person');
  expect(person.name).toBe(site.author.name);
  expect(person.description).toBe(site.author.bio);
  const profile = graph.find((n) => n['@type'] === 'ProfilePage');
  expect(profile.name).toBe(`About · ${site.name}`);
  const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList').itemListElement.map((i) => i.name);
  expect(crumbs).toEqual(['Home', 'About']);
  await expect(page.locator('nav [aria-current="page"]').first()).toContainText('About');
});

test('each portrait sits beside its text on a wide screen and above it on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/about/');
  // The page is two rows, each a portrait with its text (the author added the second, the R7 logo, after the first).
  const rows = page.locator('.about-grid');
  await expect(rows).toHaveCount(2);
  for (const row of await rows.all()) {
    const portrait = (await row.locator('.portrait').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
    const prose = (await row.locator('.prose').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
    expect(portrait.x + portrait.width, 'portrait is left of the text').toBeLessThanOrEqual(prose.x);
    expect(Math.abs(portrait.y - prose.y), 'the two start level').toBeLessThanOrEqual(1);
  }
  // The heading above the first portrait is in the text column beside it, not above the row.
  const prose = (await rows.first().locator('.prose').boundingBox()) ?? { x: 0 };
  const lead = (await page.getByRole('heading', { level: 2, name: /R7 Orbit Creator/ }).boundingBox()) ?? { x: 0 };
  expect(lead.x).toBeGreaterThanOrEqual(prose.x);

  await page.setViewportSize({ width: 375, height: 800 });
  for (const row of await rows.all()) {
    const small = (await row.locator('.portrait').boundingBox()) ?? { y: 0, height: 0 };
    const smallProse = (await row.locator('.prose').boundingBox()) ?? { y: 0 };
    expect(small.y + small.height, 'portrait is above the text').toBeLessThanOrEqual(smallProse.y);
  }
});

// Same as post titles: one *phrase* in a heading is italic brass (CSS: h1 em, h2 em, h3 em); **bold** is plain bold.
test('a *phrase* in a Heading block is set in the brass accent, like the page title, and ** stays bold', async ({ page }) => {
  await page.goto('/styleguide/sections/');
  const brass = await page.locator('h1 em').evaluate((el) => getComputedStyle(el).color);
  const heading = page.getByRole('heading', { level: 2 }).first();
  await expect(heading).toHaveText('A row of text');
  const em = heading.locator('em');
  await expect(em).toHaveText('text');
  expect(await em.evaluate((el) => getComputedStyle(el))).toMatchObject({ fontStyle: 'italic', color: brass });
  const strong = page.locator('.sections strong').first();
  expect(await strong.evaluate((el) => getComputedStyle(el).color)).not.toBe(brass);
  expect(await page.locator('.sections h2, .sections h3').allInnerTexts()).not.toContainEqual(expect.stringContaining('*'));
});

for (const width of [320, 375, 1280]) {
  test(`no horizontal scroll and no layout shift at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/about/', { waitUntil: 'networkidle' });
    const sizes = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: document.documentElement.clientWidth,
      cls: window.__cls,
    }));
    expect(sizes.doc).toBeLessThanOrEqual(sizes.view);
    // The project's own tolerance for a sub-pixel font swap (docs/DECISIONS.md, Lighthouse CLS); a real shift is far above it.
    expect(sizes.cls).toBeLessThan(0.005);
  });
}
