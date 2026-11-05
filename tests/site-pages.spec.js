import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { test, expect } from '@playwright/test';

// The home page and the listing pages built from src/content/pages/*.md. Their words are tests/page-text.spec.js; this file checks
// what the entries drive: the hero's buttons reach their targets, the home rows come in the entry's order, and an archive draws
// the blocks above and below its list where they belong (on the fixture /styleguide/listing/, as no real page has any yet).

const homeEntry = () => parseFrontmatter(readFileSync(new URL('../src/content/pages/home.md', import.meta.url), 'utf8')).frontmatter;

// The buttons are the entry's (the author edits them in /admin, and may have none): read them from home.md, then check that each
// one is drawn, in order, and reaches something that exists: an anchor on the page (#latest is the Latest feed) or a page of the site.
test("home: the hero buttons are the entry's, and go to parts of the page or pages that exist (#latest is the Latest feed)", async ({
  page,
  request,
}) => {
  const buttons = homeEntry().buttons ?? [];
  await page.goto('/');
  const drawn = page.locator('.hero .cluster a.btn');
  expect(await drawn.evaluateAll((links) => links.map((a) => a.getAttribute('href')))).toEqual(buttons.map((b) => b.url));
  for (const [i, button] of buttons.entries()) {
    await expect(drawn.nth(i)).toHaveText(button.label);
    if (button.url.startsWith('#')) await expect(page.locator(`[id="${button.url.slice(1)}"]`), button.url).toHaveCount(1);
    else if (button.url.startsWith('/')) expect((await request.get(button.url)).status(), button.url).toBe(200);
  }
  // The anchor a button may point at: the Latest feed carries #latest, once, whether or not a button uses it today.
  if (homeEntry().sections.some((s) => s.type === 'feed')) await expect(page.locator('section#latest[data-list]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('home: the rows below the hero are the entry\'s blocks, in its order, each labelled by its heading', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('main .sections > .sec-row > section');
  const names = await rows.evaluateAll((sections) =>
    sections.map((s) => {
      const id = s.getAttribute('aria-labelledby');
      return id ? document.getElementById(id)?.textContent?.trim() : undefined;
    }),
  );
  // Pinned and Apps show while a post is featured and an app is published; Repos is left out while there is no repo.
  expect(names.filter(Boolean)).toEqual(expect.arrayContaining(['Latest']));
  // The headings in the entry's order, read from the file (the author renames them in /admin).
  const headings = parseFrontmatter(readFileSync(new URL('../src/content/pages/home.md', import.meta.url), 'utf8')).frontmatter.sections.map((s) =>
    s.heading.replaceAll('*', ''),
  );
  expect(headings).toContain('Apps');
  const order = headings.filter((n) => names.includes(n));
  expect(names).toEqual(order);
});

test('an archive draws the blocks above its list after the lead, and the blocks below it after the list, with its own empty words', async ({ page }) => {
  await page.goto('/styleguide/listing/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A listing fixture');
  const y = async (locator) => (await locator.boundingBox())?.y ?? -1;
  const lead = await y(page.locator('.page-head .t-lead'));
  const intro = await y(page.getByRole('heading', { level: 2, name: 'Above the list' }));
  const empty = await y(page.getByRole('heading', { level: 2, name: 'Nothing in the fixture.' }));
  const outro = await y(page.getByText('An outro block, from outroSections.'));
  expect(lead).toBeGreaterThan(0);
  expect(intro, 'intro after the lead').toBeGreaterThan(lead);
  expect(empty, 'the list after the intro').toBeGreaterThan(intro);
  expect(outro, 'outro after the list').toBeGreaterThan(empty);
  await expect(page.getByText('The fixture has no posts, so its own empty words show.')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

for (const width of [375, 1280]) {
  test(`an archive with blocks around its list has no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/styleguide/listing/');
    const { doc, view } = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
    expect(doc).toBeLessThanOrEqual(view);
  });
}
