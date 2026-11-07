import { test, expect } from '@playwright/test';
import { watchPage } from './helpers.js';

// Hover clips on cards (docs/IMAGES.md "Hover clips", src/scripts/card-motion.js). Runs on the first listing that has a card with a
// clip; skipped when no post has `coverMotion`.

const LISTINGS = ['/blog/', '/', '/latest/'];

async function openListingWithClip(page) {
  for (const path of LISTINGS) {
    await page.goto(path, { waitUntil: 'networkidle' });
    if ((await page.locator('video.card-motion').count()) > 0) return path;
  }
  return null;
}

test('a hover clip loads nothing with the page, plays on hover and keyboard focus, and fades back', async ({ page, baseURL }) => {
  const problems = watchPage(page, baseURL);
  const fetched = [];
  page.on('request', (r) => {
    if (/\/media\/motion\//.test(r.url())) fetched.push(r.url());
  });
  const path = await openListingWithClip(page);
  test.skip(!path, 'no post has a hover clip');

  const video = page.locator('video.card-motion').first();
  const card = video.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " card ")][1]');
  const media = video.locator('xpath=..');
  await expect(video).toHaveAttribute('aria-hidden', 'true');
  await expect(video).toHaveAttribute('tabindex', '-1');
  expect(await video.locator('source').count(), 'no source before any interaction').toBe(0);
  expect(fetched, 'nothing fetched with the page').toEqual([]);
  await expect(video).toHaveCSS('opacity', '0');

  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await expect(media).toHaveClass(/is-playing/, { timeout: 10_000 });
  await expect.poll(() => video.evaluate((v) => v.currentTime), { timeout: 10_000 }).toBeGreaterThan(0.3);
  expect(fetched.length, 'the clip is fetched on hover').toBeGreaterThan(0);

  await page.mouse.move(2, 2);
  await expect(media).not.toHaveClass(/is-playing/);

  // Keyboard: focus the card from the previous focusable element with Tab, so it matches :focus-visible.
  await card.evaluate((el) => {
    const all = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => e.getClientRects().length);
    all[all.indexOf(el) - 1]?.focus();
  });
  await page.keyboard.press('Tab');
  await expect(card).toBeFocused();
  await expect(media).toHaveClass(/is-playing/, { timeout: 10_000 });
  await page.keyboard.press('Tab');
  await expect(media).not.toHaveClass(/is-playing/);
  expect(problems).toEqual([]);
});

test('with reduced motion a hover clip never shows or loads', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const path = await openListingWithClip(page);
  test.skip(!path, 'no post has a hover clip');
  const video = page.locator('video.card-motion').first();
  await expect(video).toHaveCSS('display', 'none');
  const card = video.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " card ")][1]');
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(600);
  expect(await video.locator('source').count()).toBe(0);
  await expect(video.locator('xpath=..')).not.toHaveClass(/is-playing/);
});

test('cards do not zoom on hover: the picture stays still and only a hover clip moves', async ({ page }) => {
  await page.goto('/blog/', { waitUntil: 'networkidle' });
  const card = page.locator('.grid-cards > a.card').filter({ has: page.locator('.card-media img') }).first();
  test.skip((await card.count()) === 0, 'no card with a picture');
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await page.waitForTimeout(700); // longer than any transition
  await expect(card.locator('.card-media img').first()).toHaveCSS('transform', 'none');
  const clip = card.locator('video.card-motion');
  if (await clip.count()) await expect(clip).toHaveCSS('transform', 'none');
});
