import { parseFrontmatter } from '@astrojs/markdown-remark';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import site from '../src/data/site.json' with { type: 'json' };
import { openAdmin } from './admin-mock.js';

// Subscribe, privacy, 404 and search open in the real editor (under its Content-Security-Policy, GitHub stood in for by
// tests/admin-mock.js) with the words of their files, and the preview shows them as the reader gets them: settings tokens filled
// from site.json, and only the newsletter paragraphs that match the settings.

const titleOf = (name) =>
  parseFrontmatter(readFileSync(new URL(`../src/content/pages/${name}.md`, import.meta.url), 'utf8')).frontmatter.title;

async function openPage(page, name) {
  await page.setViewportSize({ width: 1280, height: 1800 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate((n) => (location.hash = `#/collections/pages/entries/${n}`), name);
  await expect(page.getByLabel('Page heading')).toHaveValue(titleOf(name), { timeout: 15_000 });
  return seen;
}

async function expectClean(page, seen) {
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
}

for (const name of ['subscribe', 'privacy', '404', 'search']) {
  test(`${name}: opens in the editor with its file's words, and the preview draws them with nothing to fix`, async ({ page }) => {
    const seen = await openPage(page, name);
    const preview = page.locator('iframe').first().contentFrame();
    await expect(preview.locator('.page-head h1')).toBeVisible({ timeout: 15_000 });
    await expect(preview.getByText(/keeps its own frame around these blocks/)).toBeVisible();
    await expect(preview.getByText('Fix before saving')).toHaveCount(0);
    expect(await preview.locator('body').innerText()).not.toMatch(/\{(?:[a-z]+\.[a-zA-Z.]+|if [^}]*)\}/);
    await expectClean(page, seen);
  });
}

test('privacy: the preview prints the email from the settings and only the newsletter text that matches them', async ({ page }) => {
  const seen = await openPage(page, 'privacy');
  const preview = page.locator('iframe').first().contentFrame();
  await expect(preview.locator('a', { hasText: site.author.email })).toBeVisible({ timeout: 15_000 });
  const connected = Boolean(site.newsletter.formAction);
  await expect(preview.getByText("The newsletter isn't connected yet", { exact: false })).toHaveCount(connected ? 0 : 1);
  await expect(preview.getByText('If you subscribe, your email address', { exact: false })).toHaveCount(connected ? 1 : 0);
  await expectClean(page, seen);
});
