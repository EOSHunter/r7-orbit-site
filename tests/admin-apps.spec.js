import { parseFrontmatter } from '@astrojs/markdown-remark';
import { test, expect } from '@playwright/test';
import { APP_TYPES, APP_TYPE_IDS } from '../src/lib/app-types.ts';
import { openAdmin } from './admin-mock.js';

// A project's type (game or app) in the real editor, under its Content-Security-Policy, with GitHub stood in for
// (tests/admin-mock.js): the Type menu offers exactly APP_TYPES, and the choice is saved as `appType` next to the play address.

async function newProject(page) {
  await page.setViewportSize({ width: 1280, height: 1800 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/projects/new'));
  await expect(page.getByLabel('Title').first()).toBeVisible({ timeout: 15_000 });
  return seen;
}

const typeMenu = (page) => page.getByLabel(/^Type( \(optional\))?$/);

test('the Type menu offers each type of APP_TYPES by its label, with the hint saying what it does', async ({ page }) => {
  const seen = await newProject(page);
  await typeMenu(page).click();
  await expect(page.getByRole('option')).toHaveText(APP_TYPE_IDS.map((t) => APP_TYPES[t].label));
  await page.keyboard.press('Escape');
  await expect(page.getByText(/What it is on the Apps page/)).toBeVisible();
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('choosing Game saves appType: game in the project file', async ({ page }) => {
  const seen = await newProject(page);
  await page.getByLabel('Title').first().fill('A typed project');
  await page.getByLabel('Summary').first().fill('One line about it.');
  await page.getByLabel(/^Play URL/).fill('https://vesper.r7orbit.io/');
  await typeMenu(page).click();
  await page.getByRole('option', { name: 'Game', exact: true }).click();
  await page.locator('[data-slate-editor]').first().fill('Some body text.');
  await page.getByRole('button', { name: /^save$/i }).click();

  await expect
    .poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 15_000 })
    .toBe(true);
  const text = (b) => (b.encoding === 'base64' ? Buffer.from(b.content, 'base64').toString('utf8') : b.content);
  const saved = seen.calls
    .filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs'))
    .map((c) => text(c.body))
    .find((t) => t.includes('A typed project'));
  expect(saved, 'the project file is committed').toBeDefined();
  expect(parseFrontmatter(saved).frontmatter).toMatchObject({ playUrl: 'https://vesper.r7orbit.io/', appType: 'game' });
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
});
