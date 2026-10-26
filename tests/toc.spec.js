import { test, expect } from '@playwright/test';

// The table of contents marks the heading being read (aria-current, set by the IntersectionObserver in src/scripts/site.js).
// The script no longer measures the page when it starts (that forced a layout of the whole post before the first paint), so
// the mark comes from the observer's first report: nothing is marked at the top, a heading is once it is scrolled to.

test('the table of contents marks the heading being read, and nothing at the top of the post', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/blog/test/', { waitUntil: 'load' });
  const links = page.locator('.toc a[href^="#"]');
  const marked = page.locator('.toc a[aria-current="true"]');
  expect(await links.count()).toBeGreaterThan(2);
  await expect(marked).toHaveCount(0);

  const id = decodeURIComponent((await links.nth(2).getAttribute('href')).slice(1));
  await page.evaluate((target) => document.getElementById(target).scrollIntoView(), id);
  await expect(marked).toHaveCount(1);
  await expect(marked).toHaveText(await links.nth(2).innerText());

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(marked).toHaveCount(0);
});
