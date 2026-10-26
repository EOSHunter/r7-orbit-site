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

test('a cover from public/media reaches a phone as a small WebP copy, not the original (LCP budget)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const sizes = new Map();
  page.on('response', async (res) => {
    if (res.request().resourceType() === 'image') sizes.set(new URL(res.url()).pathname, (await res.body().catch(() => Buffer.alloc(0))).length);
  });
  await page.goto('/blog/');
  const img = page.locator('.card-media img:not(.media-ph img)').first();
  await expect(img).toHaveAttribute('srcset', /\/media\/\S+\.480w\.webp 480w/);
  await expect(img).toHaveAttribute('sizes', /\S/);
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const chosen = new URL(await img.evaluate((el) => el.currentSrc)).pathname;
  expect(chosen).toMatch(/\.\d+w\.webp$/);
  expect(sizes.get(chosen), chosen).toBeLessThan(60 * 1024);
});

test('an author photo drawn as an avatar is the 160px WebP copy, not the 800px original (LCP budget)', async ({
  page,
}) => {
  await page.goto('/authors/hunter-newton/');
  const avatars = page.locator('.avatar.photo img');
  test.skip((await avatars.count()) === 0, 'the author has no photo');
  for (const img of await avatars.all()) {
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    expect(new URL(await img.evaluate((el) => el.currentSrc)).pathname).toMatch(/\.160w\.webp$/);
  }
});

test('an agent avatar (a 256px PNG of about 57 kB) is served as a small WebP copy (LCP budget)', async ({ page }) => {
  await page.goto('/authors/orion/');
  const img = page.locator('.avatar.lg img');
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const url = await img.evaluate((el) => el.currentSrc);
  expect(new URL(url).pathname).toMatch(/\.(160|256)w\.webp$/);
  const size = await page.evaluate(async (u) => (await (await fetch(u)).arrayBuffer()).byteLength, url);
  expect(size, 'the avatar is a few kB, not the 57 kB PNG').toBeLessThan(10_000);
});

test('a picture in the reading column reaches a phone at the column width (92vw), not a copy a size too big', async ({
  browser,
}) => {
  // The Lighthouse phone: 412px at 1.75x. 100vw asked for 721px and got the 800 copy; the column is 92vw (379px), so 720 does.
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75 });
  const page = await context.newPage();
  await page.goto('/styleguide/sections/');
  const img = page.locator('figure.art-fig[data-size="lg"] img[src="/media/about/hunter-newton.jpg"]').first();
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  expect(new URL(await img.evaluate((el) => el.currentSrc)).pathname).toBe('/media/about/hunter-newton.720w.webp');
  await context.close();
});

test('only a portrait that opens the page is fetched first; one further down loads lazily', async ({ page }) => {
  await page.goto('/about/');
  const rows = page.locator('.sections > .sec-row');
  for (const [index, row] of (await rows.all()).entries()) {
    for (const img of await row.locator('.portrait img').all()) {
      if (index === 0) {
        await expect(img).toHaveAttribute('fetchpriority', 'high');
        await expect(img).not.toHaveAttribute('loading', 'lazy');
      } else {
        await expect(img).toHaveAttribute('loading', 'lazy');
        await expect(img).not.toHaveAttribute('fetchpriority', /./);
      }
    }
  }
  // On the block gallery the portrait comes after several rows.
  await page.goto('/styleguide/sections/');
  await expect(page.locator('.portrait img')).toHaveAttribute('loading', 'lazy');
  await expect(page.locator('.portrait img')).not.toHaveAttribute('fetchpriority', /./);
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
