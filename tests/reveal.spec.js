import { test, expect } from '@playwright/test';
import { watchPage } from './helpers.js';

// Site polish (phase 2, site.js (i)). The reveal is off for automated browsers (navigator.webdriver), so the other
// specs and full-page screenshots see every card; these tests switch it back on, as a visitor's browser would have it.
const asVisitor = (page) => page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
const CARDS = 'main .grid-cards > *';

test('cards below the first screen rise in as they scroll into view; the ones on screen at load never hide', async ({ page, baseURL }) => {
  const problems = watchPage(page, baseURL);
  await asVisitor(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/', { waitUntil: 'networkidle' });

  const states = await page.locator(CARDS).evaluateAll((cards) =>
    cards.map((c) => ({ below: c.getBoundingClientRect().top > innerHeight, waiting: c.classList.contains('reveal') })),
  );
  expect(states.length).toBeGreaterThan(0);
  expect(states.filter((s) => s.below).length, 'some cards start below the first screen').toBeGreaterThan(0);
  expect(states.every((s) => s.waiting === s.below), 'only the cards below the first screen wait').toBe(true);

  const last = page.locator(CARDS).last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).not.toHaveClass(/\breveal\b/, { timeout: 3000 });
  await expect.poll(() => last.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  expect(problems).toEqual([]);
});

test('under reduced motion nothing waits to be revealed', async ({ page }) => {
  await asVisitor(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('.reveal')).toHaveCount(0);
});

// Design audit, cards: a grid of cards fits its count, so every row reaches the grid's right edge (no card alone on a row).
for (const path of ['/', '/blog/', '/latest/', '/projects/', '/vlogs/', '/authors/orion/']) {
  for (const width of [800, 1280]) {
    test(`every row of cards on ${path} fills its grid at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path, { waitUntil: 'networkidle' });
      const short = await page.locator('main .grid-cards').evaluateAll((grids) =>
        grids.flatMap((grid) => {
          const cards = [...grid.children].filter((c) => c instanceof HTMLElement && c.offsetParent !== null);
          const rows = new Map();
          for (const card of cards) {
            const top = Math.round(card.getBoundingClientRect().top);
            rows.set(top, Math.max(rows.get(top) ?? 0, card.getBoundingClientRect().right));
          }
          const edge = grid.getBoundingClientRect().right;
          return [...rows.values()].filter((right) => edge - right > 2).map((right) => `${Math.round(edge - right)}px short`);
        }),
      );
      expect(short).toEqual([]);
    });
  }
}
