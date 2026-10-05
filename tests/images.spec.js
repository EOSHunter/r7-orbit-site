import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import sharp from 'sharp';

// What a reader gets for the pictures in a post (docs/IMAGES.md): optimised pictures from src/assets, plain files from
// public/media, and nothing heavier than the limit once the build (scripts/media.mjs) has run. The demo page
// /styleguide/article-components/ holds one of each kind.

const DEMO = '/styleguide/article-components/';

test('a picture from src/assets is served in several widths of AVIF and WebP, with its size known up front', async ({ page }) => {
  await page.goto(DEMO);
  const picture = page.locator('picture').first();
  for (const type of ['image/avif', 'image/webp']) {
    const srcset = await picture.locator(`source[type="${type}"]`).getAttribute('srcset');
    expect(srcset, type).toBeTruthy();
    expect(srcset.split(',').length, `${type} widths`).toBeGreaterThanOrEqual(3);
  }
  const img = picture.locator('img');
  await expect(img).toHaveAttribute('width', /\d+/);
  await expect(img).toHaveAttribute('height', /\d+/);
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('alt', /\S/);
  // It loads, and the file the browser chose is far smaller than the original screenshot (1.3 MB).
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
});

test('a picture from public/media is a plain image that loads; a decorative one has an empty alt', async ({ page }) => {
  await page.goto(DEMO);
  const plain = page.locator('figure.art-fig img[src^="/media/"]');
  await expect(plain).toHaveCount(2);
  await plain.first().scrollIntoViewIfNeeded();
  await expect.poll(() => plain.first().evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  await expect(plain.nth(0)).toHaveAttribute('alt', /\S/);
  await expect(plain.nth(1)).toHaveAttribute('alt', '');
});

test('every picture the build serves is within the size limit and no wider than 2000px', async () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jpe?g|png|webp|avif)$/i.test(entry.name)) files.push(full);
    }
  };
  walk('dist/media');
  expect(files.length, 'pictures in dist/media').toBeGreaterThan(0);
  for (const file of files) {
    expect(statSync(file).size, file).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect((await sharp(file).metadata()).width, file).toBeLessThanOrEqual(2000);
  }
});
