import { test, expect } from '@playwright/test';
import { watchPage } from './helpers.js';

// Site polish (phase 2, site.js (i) and (j)). The reveal is off for automated browsers (navigator.webdriver), so the other
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

test('a linked card follows the pointer with its light', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/', { waitUntil: 'networkidle' });
  const card = page.locator('main a.card, main .card.link').first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + 40, box.y + 30);
  await page.mouse.move(box.x + 60, box.y + 50);
  await expect.poll(() => card.evaluate((el) => el.style.getPropertyValue('--mx'))).toBe('60px');
  expect(await card.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('radial-gradient');
});
