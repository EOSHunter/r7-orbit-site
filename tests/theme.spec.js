import { test, expect } from '@playwright/test';
import { watchPage } from './helpers.js';

// The site is dark only. Earlier builds saved a theme choice in localStorage ("r7-theme"); a visitor who still has one,
// or anything that sets data-theme, must see the same dark page and no errors.

const OBSIDIAN = 'rgb(9, 9, 10)';

for (const stored of ['ivory', 'light', 'dark']) {
  test(`a stored "${stored}" preference changes nothing`, async ({ page, baseURL }) => {
    const problems = watchPage(page, baseURL);
    await page.addInitScript((value) => {
      for (const key of ['r7-theme', 'theme']) localStorage.setItem(key, value);
    }, stored);

    for (const path of ['/', '/blog/an-article-built-from-components/']) {
      await page.goto(path, { waitUntil: 'networkidle' });
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), stored);
      await expect(page.locator('body'), path).toHaveCSS('background-color', OBSIDIAN);
      await expect(page.locator('html'), path).toHaveCSS('color-scheme', 'dark');
    }
    expect(problems).toEqual([]);
  });
}

test('no page script or style reads a theme', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('[data-theme-toggle], .theme-toggle').count()).toBe(0);
});
