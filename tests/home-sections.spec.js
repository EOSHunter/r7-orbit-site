import { test, expect } from '@playwright/test';

// The home page's new rows (2026-11-13, docs/DECISIONS.md): What I'm building, the R7 Orbit spotlight, the series shelf, the crew
// (the Team block's steps alone), the site numbers and the newsletter sign-up. What they show comes from the posts and settings,
// so the test reads the archives for what to expect rather than naming posts.

test('What I\'m building: one linked tile per thing, each with a status', async ({ page }) => {
  await page.goto('/');
  const tiles = page.locator('[data-building] a.building-tile');
  expect(await tiles.count()).toBeGreaterThan(1);
  for (const tile of await tiles.all()) {
    await expect(tile).toHaveAttribute('href', /^(\/|https:\/\/)/);
    await expect(tile.locator('.status')).toHaveText(/^(Building|Shipped|Paused|Idea)$/);
    await expect(tile.locator('.building-title')).not.toBeEmpty();
  }
});

test('the spotlight has its words, points, a described picture and a button', async ({ page }) => {
  await page.goto('/');
  const spot = page.locator('section[data-spotlight]');
  await expect(spot).toHaveCount(1);
  await expect(spot.locator('h2')).not.toBeEmpty();
  expect(await spot.locator('.spotlight-points li').count()).toBeGreaterThan(0);
  const alt = await spot.locator('.spotlight-picture img').getAttribute('alt');
  expect(alt?.length).toBeGreaterThan(20);
  // Waitlist off in this build: the button is the solid one; on, it is a quieter link beside the form.
  const form = await spot.locator('[data-waitlist]').count();
  await expect(spot.locator('.spotlight-actions a')).toHaveClass(form ? /more-link/ : /btn solid/);
});

test('the series shelf lists each series\' parts in order, as links to the posts', async ({ page }) => {
  await page.goto('/');
  const cols = page.locator('[data-series-shelf] .series-col');
  expect(await cols.count()).toBeGreaterThan(0);
  for (const col of await cols.all()) {
    const numbers = (await col.locator('.series-n').allTextContents()).map(Number);
    expect(numbers.length).toBeGreaterThan(1);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    const total = Number((await col.locator('.series-total').textContent())?.match(/\d+/)?.[0]);
    expect(total).toBeGreaterThanOrEqual(numbers.length);
    for (const href of await col.locator('.series-parts a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) expect(href).toMatch(/^\/blog\/[^/]+\/$/);
    if (total > numbers.length) await expect(col.locator('a.series-more')).toHaveText(`All ${total} parts`);
  }
});

test('the site numbers are counted from the site: the apps number is the Apps page\'s', async ({ page }) => {
  await page.goto('/apps/');
  const apps = await page.locator('main .app-grid .app-card').count();
  await page.goto('/');
  const items = page.locator('section.counts .counts-item');
  expect(await items.count()).toBeGreaterThan(1);
  const first = await items.first().locator('dd').textContent();
  expect(Number(first)).toBe(apps);
  for (const n of await items.locator('dd').allTextContents()) expect(n).toMatch(/^\d[\d,]*$/);
});

test('the crew row is the steps alone: no cards, every name links to its author page', async ({ page }) => {
  await page.goto('/');
  const crew = page.locator('section[data-team-section]');
  await expect(crew).toHaveCount(1);
  await expect(crew.locator('.team-card')).toHaveCount(0);
  const hrefs = await crew.locator('.team-step-who a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(3);
  for (const href of hrefs) expect(href).toMatch(/^\/authors\/[^/]+\/$/);
  await expect(crew.locator('a.more-link')).toHaveAttribute('href', '/about/');
});

test('the newsletter sign-up is a plain form with a labelled email box', async ({ page }) => {
  await page.goto('/');
  const band = page.locator('section[data-newsletter-band]');
  await expect(band).toHaveCount(1);
  const form = band.locator('form.newsletter-form');
  await expect(form).toHaveAttribute('method', 'post');
  await expect(form).toHaveAttribute('action', /^https:\/\/buttondown\.com\//);
  await expect(band.getByLabel(/email/i)).toHaveAttribute('type', 'email');
});

for (const width of [320, 375, 768, 1024, 1280, 1480]) {
  test(`the home page fits ${width}px with no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
