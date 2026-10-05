import { test, expect } from '@playwright/test';

// The home page and the listing pages built from src/content/pages/*.md. Their words are tests/page-text.spec.js; this file checks
// what the entries drive: the hero's buttons reach their targets, the home rows come in the entry's order, and an archive draws
// the blocks above and below its list where they belong (on the fixture /styleguide/listing/, as no real page has any yet).

test('home: the hero buttons go to parts of the page that exist (#latest is the Latest feed, #subscribe the newsletter band)', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('.hero .cluster a.btn').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs).toEqual(['#latest', '#subscribe']);
  await expect(page.locator('section#latest[data-list]')).toHaveCount(1);
  await expect(page.locator('section.band#subscribe')).toHaveCount(1);
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
  // Pinned and Games show while a post is featured and a game is published; Repos is left out while there is no repo.
  expect(names.filter(Boolean)).toEqual(expect.arrayContaining(['Latest', 'Projects']));
  const order = ['Start here', 'Latest', 'Projects', 'Games', 'Repos'].filter((n) => names.includes(n));
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
  const band = await y(page.locator('section.band#subscribe'));
  expect(lead).toBeGreaterThan(0);
  expect(intro, 'intro after the lead').toBeGreaterThan(lead);
  expect(empty, 'the list after the intro').toBeGreaterThan(intro);
  expect(outro, 'outro after the list').toBeGreaterThan(empty);
  expect(band, 'the newsletter band last').toBeGreaterThan(outro);
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
