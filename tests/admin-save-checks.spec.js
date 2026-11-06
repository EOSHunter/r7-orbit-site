import { test, expect } from '@playwright/test';
import { openAdmin } from './admin-mock.js';

// The build's own content rules, run by the real editor when Save is pressed (src/admin/content-check.ts): a post the build would
// stop on is not saved, and the author is told what to fix. The cases are ones the audit of 2026-11-06 found the editor let through.

const saved = (seen) => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls'));

test('a blog post with a stray "{" in its body and a series without its part number is not saved, and says why', async ({ page }) => {
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/blog/new'));
  await page.getByLabel('Title').first().fill('A post with a brace');
  await page.getByLabel('Summary').first().fill('One line about it.');
  await page.getByLabel(/^Series \(optional\)$/).fill('Building R7');
  // The rich text editor writes a typed "{" as it is: MDX then reads it as code.
  await page.locator('[data-slate-editor]').first().click();
  await page.keyboard.insertText('A set {like this} in a sentence.');

  await page.getByRole('button', { name: /^save$/i }).click();
  const message = page.getByText(/Not saved: the site would not build with this/).first();
  await expect(message).toBeVisible({ timeout: 10_000 });
  await expect(message).toContainText('Part number in the series: seriesOrder is required when series is set');
  await expect(message).toContainText(/Body, line 1: Could not parse expression with acorn/);
  expect(saved(seen)).toBe(false);

  // Fixed: the brace in backticks, and the part number set.
  await page.locator('[data-slate-editor]').first().click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('A set like this in a sentence.');
  await page.getByLabel(/^Part number in the series/).fill('1');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => saved(seen), { timeout: 15_000 }).toBe(true);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
});

test('an author cannot be deleted from the editor', async ({ page }) => {
  await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/authors/new'));
  await expect(page.getByLabel('Slug', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
});
