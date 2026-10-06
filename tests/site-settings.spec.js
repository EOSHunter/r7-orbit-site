import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { siteSchema } from '../src/lib/site-settings.ts';
import { openAdmin, SITE_JSON } from './admin-mock.js';
import { CHROME_PAGES, chromeOf, chromeText } from './site-chrome.js';

// The site settings (src/data/site.json, "Site settings" in /admin): what they draw has not changed since they became editable, the nav
// marks the current section by address so a label can be renamed, and the editor saves a file the build reads.

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fixtureUrl = new URL('./fixtures/site-chrome.txt', import.meta.url);
const NAV = JSON.parse(SITE_JSON).nav;

test.describe('the head, header and footer', () => {
  // See tests/site-chrome.js for what is compared and how to rewrite the fixture after an intended change.
  if (process.env.UPDATE_SITE_CHROME) writeFileSync(fixtureUrl, chromeText(dist));
  const fixture = readFileSync(fixtureUrl, 'utf8').replaceAll('\r\n', '\n');

  for (const path of CHROME_PAGES) {
    test(`${path}: as before the settings moved to /admin`, () => {
      const before = fixture.split(/^(?=== )/m).filter((part) => part.startsWith(`== ${path} `));
      expect(before, `${path} is in tests/fixtures/site-chrome.txt`).toHaveLength(3);
      expect(chromeOf(dist, path).join('\n')).toBe(before.join('').trimEnd());
    });
  }
});

test.describe('the current section is found by address', () => {
  const cases = [
    ['/', '/#latest'],
    ['/blog/', '/blog/'],
    ['/blog/test/', '/blog/'],
    ['/vlogs/', '/vlogs/'],
    ['/projects/vesper-drift/', '/projects/'],
    ['/games/', '/games/'],
    ['/about/', '/about/'],
    ['/latest/', null],
    ['/privacy/', null],
    ['/search/', null],
  ];
  for (const [path, current] of cases) {
    test(`${path}: ${current ?? 'no nav item'} is current`, async ({ page }) => {
      await page.goto(path);
      const marked = page.locator('#site-nav a[aria-current="page"]');
      if (current === null) await expect(marked).toHaveCount(0);
      else {
        await expect(marked).toHaveCount(1);
        await expect(marked).toHaveAttribute('href', current);
      }
    });
  }
});

test.describe('a nav label renamed in /admin', () => {
  // /styleguide/nav/ draws the real nav with every label renamed ("Blog" -> "Renamed blog"), on a page in the Blog section.
  for (const width of [375, 1280]) {
    test(`keeps the current section, the links and the search chips (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/styleguide/nav/');
      const nav = page.locator('#site-nav');
      if (width < 1000) await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(nav.getByRole('link', { name: 'Renamed blog' })).toHaveAttribute('aria-current', 'page');
      await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
      // Same addresses, same order, new labels.
      const links = await nav
        .getByRole('link')
        .evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.getAttribute('href')]));
      expect(links).toEqual(NAV.map((i) => [`Renamed ${i.label.toLowerCase()}`, i.href]));
      // The footer link that comes from the nav, and the search page's archive chips, follow the new labels.
      await expect(page.locator('.site-footer').getByRole('link', { name: 'Renamed games' })).toHaveAttribute(
        'href',
        '/games/',
      );
      const chips = await page
        .locator('.search-kinds a')
        .evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.getAttribute('href')]));
      expect(chips).toEqual([
        ['Renamed news', '/news/'],
        ['Renamed blog', '/blog/'],
        ['Renamed vlogs', '/vlogs/'],
        ['Renamed projects', '/projects/'],
        ['Renamed repos', '/repos/'],
      ]);
      // And the renamed link still goes to the archive.
      await nav.getByRole('link', { name: 'Renamed blog' }).click();
      await expect(page).toHaveURL(/\/blog\/$/);
      await expect(page.locator('#site-nav a[aria-current="page"]')).toHaveAttribute('href', '/blog/');
    });
  }

  test('the search page offers the archives by address', async ({ page }) => {
    await page.goto('/search/');
    const chips = await page
      .locator('.search-kinds a')
      .evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.getAttribute('href')]));
    expect(chips).toEqual([
      ['News', '/news/'],
      ['Blog', '/blog/'],
      ['Vlogs', '/vlogs/'],
      ['Projects', '/projects/'],
      ['Repos', '/repos/'],
    ]);
  });
});

test('the Site settings editor saves a file the build reads, and keeps the fields it does not show', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/settings/entries/site'));
  const tagline = page.getByLabel('Tagline');
  await expect(tagline).toHaveValue('Field notes on building with AI', { timeout: 15_000 });
  await tagline.fill('A tagline changed in the test');

  await page.getByRole('button', { name: /^save$/i }).click();
  await expect
    .poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 20_000 })
    .toBe(true);
  const text = (b) => (b.encoding === 'base64' ? Buffer.from(b.content, 'base64').toString('utf8') : b.content);
  const saved = seen.calls
    .filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs'))
    .map((c) => text(c.body))
    .find((t) => t.trimStart().startsWith('{') && t.includes('"nav"'));
  expect(saved, 'src/data/site.json is committed').toBeDefined();
  const data = JSON.parse(saved);
  const parsed = siteSchema.safeParse(data);
  expect(parsed.success ? '' : JSON.stringify(parsed.error.issues), 'the saved settings are valid').toBe('');
  // Only the tagline changed: url (no field in the form) and everything else are as they were.
  expect(data).toEqual({ ...JSON.parse(SITE_JSON), tagline: 'A tagline changed in the test' });
  expect(seen.errors).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
});
