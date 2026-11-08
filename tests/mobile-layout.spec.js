import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

// Phone and tablet layout fixes asked for on 2026-11-07.

test('About: on a phone each team card uses its full width (the words are not squeezed into a picture column)', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/about/');
    const cards = page.locator('[data-team] .team-card');
    test.skip((await cards.count()) === 0, 'no team block on the About page');
    for (const card of await cards.all()) {
      const [c, bio] = await Promise.all([card.boundingBox(), card.locator('.team-bio').boundingBox()]);
      expect(bio.width, `${width}px: bio width vs card width`).toBeGreaterThan(c.width * 0.8);
    }
  }
});

// A blog post with a featured picture and contents (so it also has the sidebar picture), found in dist/.
const dist = fileURLToPath(new URL('../dist/blog/', import.meta.url));
const POST = existsSync(dist)
  ? readdirSync(dist, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(dist, d.name, 'index.html')))
      .map((d) => ({ path: `/blog/${d.name}/`, html: readFileSync(join(dist, d.name, 'index.html'), 'utf8') }))
      .find((p) => p.html.includes('toc-picture') && p.html.includes('post-picture'))?.path
  : undefined;

test('the featured picture opens the article where the sidebar is not drawn, and opens larger', async ({ page }) => {
  test.skip(!POST, 'no blog post with a featured picture and contents in dist/');
  for (const [width, top] of [[375, true], [1100, true], [1280, false]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(POST);
    await expect(page.locator('.post-picture'), `${width}px`).toBeVisible({ visible: top });
    await expect(page.locator('.toc-picture'), `${width}px`).toBeVisible({ visible: !top });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px: no horizontal scroll`).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(POST);
  const link = page.locator('.post-picture a[data-zoom-link]');
  await link.click();
  const dialog = page.locator('[data-zoom-dialog]');
  await expect(dialog).toHaveAttribute('open', '');
  await expect(dialog.locator('[data-zoom-stage] img')).toHaveAttribute('src', await link.getAttribute('href'));
  // The sidebar's copy of the same picture is not a second entry.
  const count = await dialog.locator('[data-zoom-count]').textContent();
  const pictures = await page.evaluate(() => new Set([...document.querySelectorAll('a[data-zoom-link]')].map((a) => a.getAttribute('href'))).size);
  expect(pictures).toBe(1);
  if (count) expect(count).toMatch(/^1 of /);
  await page.keyboard.press('Escape');
  await expect(link).toBeFocused();
});
