import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// A post's pictures open larger in a dialog (src/components/ImageZoom.astro, src/scripts/image-zoom.js). Checked on the tests'
// fixture posts (tests/fixtures/posts/<kind>/, drawn at /styleguide/posts/<kind>/): the blog fixture has one picture, the project
// fixture a row of two, and the project page also has a gallery and a Play poster, which keep their own behaviour.

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const BLOG = '/styleguide/posts/blog/';
const PROJECT = '/styleguide/posts/projects/';

test('a picture in a post is a button that opens it larger; Esc closes and focus goes back', async ({ page }) => {
  await page.goto(BLOG);
  const alt = await page.locator('.post-main figure img[alt]:not([alt=""])').first().getAttribute('alt');
  const open = page.getByRole('button', { name: `Enlarge: ${alt}` });
  await expect(open).toHaveCount(1);
  await expect(open.locator('img')).toHaveAttribute('alt', alt);

  await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('[data-zoom-dialog]');
  await expect(dialog).toHaveAttribute('open', '');
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  const big = dialog.locator('[data-zoom-stage] img');
  await expect(big).toHaveAttribute('alt', alt);
  await expect.poll(() => big.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  // One picture: no count and no Previous/Next.
  await expect(dialog.locator('[data-zoom-nav]')).toBeHidden();
  await expect(dialog.locator('[data-zoom-count]')).toHaveText('');

  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(dialog).not.toHaveAttribute('open', '');
  await expect(open).toBeFocused();
  await expect(dialog.locator('[data-zoom-stage] img')).toHaveCount(0);
});

test('a click on the backdrop closes the dialog', async ({ page }) => {
  await page.goto(BLOG);
  await page.locator('.zoom-btn').first().click();
  const dialog = page.locator('[data-zoom-dialog]');
  await expect(dialog).toHaveAttribute('open', '');
  await page.mouse.click(4, 4);
  await expect(dialog).not.toHaveAttribute('open', '');
});

test('several pictures: Previous, Next and the arrow keys step through them, with a count', async ({ page }) => {
  await page.goto(PROJECT);
  const buttons = page.locator('.zoom-btn');
  const n = await buttons.count();
  expect(n, 'zoomable pictures on the project fixture').toBeGreaterThanOrEqual(2);
  await buttons.first().click();
  const dialog = page.locator('[data-zoom-dialog]');
  const count = dialog.locator('[data-zoom-count]');
  await expect(count).toHaveText(`1 of ${n}`);
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText(`2 of ${n}`);
  await dialog.getByRole('button', { name: 'Previous' }).click();
  await expect(count).toHaveText(`1 of ${n}`);
  await page.keyboard.press('ArrowLeft');
  await expect(count).toHaveText(`${n} of ${n}`);
});

test('only real pictures of the post are enlargeable: not decorative ones, links, the gallery or the Play poster', async ({ page }) => {
  await page.goto(PROJECT);
  await expect(page.locator('.zoom-btn').first()).toBeAttached();
  const wrapped = await page.locator('.zoom-btn').evaluateAll((els) =>
    els.map((b) => {
      const img = b.querySelector('img');
      return { alt: img?.getAttribute('alt') ?? '', inside: !!b.parentElement.closest('a, button, [data-gallery], [data-play]') };
    }),
  );
  for (const w of wrapped) {
    expect(w.alt.trim()).not.toBe('');
    expect(w.inside).toBe(false);
  }
  await expect(page.locator('[data-gallery] .zoom-btn, [data-play] .zoom-btn, a .zoom-btn, .avatar .zoom-btn')).toHaveCount(0);
});

test('a picture keeps its size when it becomes a button (the same box as without JavaScript, no layout shift, no horizontal scroll)', async ({
  browser,
  baseURL,
}) => {
  const boxes = async (javaScriptEnabled, width) => {
    const context = await browser.newContext({ javaScriptEnabled, baseURL, viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(BLOG, { waitUntil: 'networkidle' });
    const out = {
      box: await page.locator('.post-main figure img[alt]:not([alt=""])').first().boundingBox(),
      cls: await page.evaluate(() => window.__cls ?? 0),
      overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      wrapped: await page.locator('.zoom-btn').count(),
    };
    await context.close();
    return out;
  };
  for (const width of [320, 375, 1280]) {
    const [off, on] = [await boxes(false, width), await boxes(true, width)];
    expect(on.wrapped, `${width}px`).toBeGreaterThan(0);
    // Width and height only: other parts of the page above it differ without JavaScript (the contents list, the share row).
    for (const k of ['width', 'height']) expect(Math.abs(on.box[k] - off.box[k]), `${width}px: ${k}`).toBeLessThanOrEqual(0.5);
    // The project's own tolerance for a sub-pixel font swap (docs/DECISIONS.md, Lighthouse CLS); a real shift is far above it.
    expect(on.cls, `${width}px: CLS`).toBeLessThan(0.005);
    expect(on.overflow, `${width}px: horizontal scroll`).toBeLessThanOrEqual(0);
  }
});

test('without JavaScript the pictures are drawn as before, with no buttons', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto(BLOG);
  await expect(page.locator('.zoom-btn')).toHaveCount(0);
  await expect(page.locator('.post-main figure img').first()).toBeVisible();
  await context.close();
});

// The featured picture above "On this page" (wide screens): a link to the full-size file that opens in the same dialog, first.
// Asked for 2026-11-07. Found in dist/: the first blog post that has one.
const dist = fileURLToPath(new URL('../dist/blog/', import.meta.url));
const FEATURED = existsSync(dist)
  ? readdirSync(dist, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(dist, d.name, 'index.html')) && readFileSync(join(dist, d.name, 'index.html'), 'utf8').includes('data-zoom-link'))
      .map((d) => `/blog/${d.name}/`)[0]
  : undefined;

test("the post's featured picture by the contents opens larger, first, with its credit; a modified click is left to the link", async ({ page }) => {
  test.skip(!FEATURED, 'no blog post with a featured picture in dist/');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(FEATURED);
  const link = page.locator('.toc-picture a[data-zoom-link]');
  const alt = await link.getAttribute('data-zoom-alt');
  await expect(link).toHaveAccessibleName(`Enlarge: ${alt}`);
  const href = await link.getAttribute('href');
  expect((await page.request.get(href)).ok()).toBe(true); // without JavaScript the link opens the file

  await link.click();
  const dialog = page.locator('[data-zoom-dialog]');
  await expect(dialog).toHaveAttribute('open', '');
  const big = dialog.locator('[data-zoom-stage] img');
  await expect(big).toHaveAttribute('alt', alt);
  await expect(big).toHaveAttribute('src', href);
  await expect.poll(() => big.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(1000);
  await expect(dialog.locator('[data-zoom-caption]')).toHaveText(await link.getAttribute('data-zoom-caption'));
  const count = await dialog.locator('[data-zoom-count]').textContent();
  if (count) expect(count).toMatch(/^1 of \d+$/);
  const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toHaveAttribute('open', '');
  await expect(link).toBeFocused();
  expect(page.url()).toContain(FEATURED); // the click did not navigate
});
