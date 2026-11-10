import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { siteSchema } from '../src/lib/site-settings.ts';
import { openAdmin, SITE_JSON } from './admin-mock.js';
import { inputsDigest, readTextFixture, staleNote } from './fixture-inputs.js';
import { builtPage, CHROME_INPUTS, CHROME_PAGES, chromeOf, chromeProblems, chromeText } from './site-chrome.js';
import NAV_FIXTURE from './fixtures/site-nav.json' with { type: 'json' };

// The site settings (src/data/site.json, "Site settings" in /admin): what they draw has not changed by accident, the nav marks the
// current section by address so a label can be renamed, and the editor saves a file the build reads. The author edits the
// settings, so what a test expects of the real site comes from that file (SETTINGS), never from a copy of its values; the tests of
// a renamed label run on a fixed nav (tests/fixtures/site-nav.json, drawn by /styleguide/nav/).

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fixtureUrl = new URL('./fixtures/site-chrome.txt', import.meta.url);
const SETTINGS = JSON.parse(SITE_JSON);
const NAV = siteSchema.parse(SETTINGS).nav;

test.describe('the head, header and footer', () => {
  // See tests/site-chrome.js for what is compared and how to rewrite the fixture after an intended change.
  if (process.env.UPDATE_SITE_CHROME) writeFileSync(fixtureUrl, chromeText(dist));
  const fixture = readTextFixture(fixtureUrl);
  const current = fixture.inputs === inputsDigest(CHROME_INPUTS);
  const text = fixture.lines.join('\n');

  for (const path of CHROME_PAGES) {
    test(`${path}: as the fixture has it, or as the settings say if they were edited since`, () => {
      test.skip(!builtPage(dist, path), `${path} is not published any more`);
      if (!current) {
        test.info().annotations.push({
          type: 'note',
          description: staleNote('tests/fixtures/site-chrome.txt', 'UPDATE_SITE_CHROME=1 npx playwright test site-settings'),
        });
        expect(chromeProblems(dist, path)).toEqual([]);
        return;
      }
      const before = text.split(/^(?=== )/m).filter((part) => part.startsWith(`== ${path} `));
      expect(before, `${path} is in tests/fixtures/site-chrome.txt`).toHaveLength(3);
      expect(chromeOf(dist, path).join('\n')).toBe(before.join('').trimEnd());
    });
  }
});

test.describe('the current section is found by address', () => {
  // Each page and the address of the nav section it says it is in. That section's link is marked when the settings' nav has it;
  // a page outside the nav's sections, or whose section the author has taken out of the nav, marks none.
  const cases = [
    ['/', '/#latest'],
    ['/blog/', '/blog/'],
    ['/blog/test/', '/blog/'],
    ['/vlogs/', '/vlogs/'],
    ['/projects/vesper-drift/', '/projects/'],
    ['/apps/', '/apps/'],
    ['/about/', '/about/'],
    ['/latest/', null],
    ['/privacy/', null],
    ['/search/', null],
  ];
  for (const [path, section] of cases) {
    const current = NAV.some((i) => i.href === section) ? section : null;
    test(`${path}: ${current ?? 'no nav item'} is current`, async ({ page }) => {
      const response = await page.goto(path);
      test.skip(response.status() === 404, `${path} is not published any more`);
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
  // /styleguide/nav/ draws a fixed nav (tests/fixtures/site-nav.json) with every label renamed ("Blog" -> "Renamed blog"), on a
  // page in the Blog section: the real components, but not the author's nav, which can lose its Blog or Apps link in /admin.
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
      expect(links).toEqual(NAV_FIXTURE.map((i) => [`Renamed ${i.label.toLowerCase()}`, i.href]));
      // The footer link that comes from the nav, and the search page's archive chips, follow the new labels.
      await expect(page.locator('.site-footer').getByRole('link', { name: 'Renamed apps' })).toHaveAttribute(
        'href',
        '/apps/',
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
    // The archives the settings' nav links to, labelled as it labels them, in its order (searchKinds).
    const archives = ['/news/', '/blog/', '/vlogs/', '/projects/', '/repos/'];
    expect(chips).toEqual(NAV.filter((i) => archives.includes(i.href)).map((i) => [i.label, i.href]));
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
  await expect(tagline).toHaveValue(SETTINGS.tagline, { timeout: 15_000 });
  await tagline.fill('A tagline changed in the test');

  // The waitlist "Enabled" with no site key is not saved: the build would draw no form anywhere (waitlistKeyError). Whatever the
  // author's file holds, tick Enabled and empty the key: the save is refused with the reason, and nothing is committed.
  // The Waitlist group opens collapsed: its Expand button is the last one in the innermost block that holds its title.
  await page
    .locator('div')
    .filter({ has: page.getByText('Waitlist', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Expand' }) })
    .last()
    .getByRole('button', { name: 'Expand' })
    .last()
    .click();
  const key = page.getByLabel('Turnstile site key');
  await expect(key).toBeVisible({ timeout: 15_000 });
  const enabled = page.getByRole('switch', { name: /^Enabled/ });
  if (!(await enabled.isChecked())) await enabled.click();
  await expect(enabled).toBeChecked();
  await key.fill('');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/Waitlist: "Enabled" is ticked but the Turnstile site key is empty/)).toBeVisible({
    timeout: 15_000,
  });
  expect(seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), 'nothing committed').toBe(false);
  // Decap answers a form with an invalid field by rejecting its save with nothing, which the page reports as an uncaught
  // "undefined": that one is expected, and nothing else.
  await expect.poll(() => seen.errors).toEqual(['undefined']);
  seen.errors.length = 0;
  // With the site key pasted, it saves.
  const KEY = '0x4AAAAAAABkMYinukE8nzY';
  await key.fill(KEY);

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
  // Only the tagline and the waitlist switch and key changed: url (no field in the form) and everything else are as they were.
  expect(data).toEqual({
    ...SETTINGS,
    tagline: 'A tagline changed in the test',
    waitlist: { ...SETTINGS.waitlist, enabled: true, turnstileSiteKey: KEY },
  });
  expect(seen.errors).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
});

test('the Site settings editor will not save nav or footer links the build would stop on', async ({ page }) => {
  // The deploys that failed on 2026-10-21: the settings were saved with two footer links to the same address. The check that
  // spans several links (siteLinksError) runs from the footer's Note box when Save is pressed.
  await page.setViewportSize({ width: 1280, height: 1800 });
  const seen = await openAdmin(page, { signedIn: true });
  const first = SETTINGS.footer.links.find((l) => l.href) ?? { label: 'Meridian', icon: 'link', href: 'https://r7meridian.app/' };
  // The settings may hold only profile links (2026-11-10): then the sample address goes in twice.
  const extra = SETTINGS.footer.links.includes(first) ? [{ ...first, label: 'Twice' }] : [first, { ...first, label: 'Twice' }];
  const doubled = { ...SETTINGS, footer: { ...SETTINGS.footer, links: [...SETTINGS.footer.links, ...extra] } };
  expect(siteSchema.safeParse(doubled).success, 'the build refuses this file').toBe(false);
  // Registered after openAdmin's handler, so it answers first: the settings file the editor opens has the doubled link.
  const text = JSON.stringify(doubled, null, 2);
  await page.route('https://api.github.com/repos/EOSHunter/r7-orbit-site/git/blobs/sitefilesha*', (route) =>
    route.fulfill({ json: { sha: 'sitefilesha', encoding: 'base64', content: Buffer.from(text).toString('base64'), size: text.length } }),
  );
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/settings/entries/site'));
  const tagline = page.getByLabel('Tagline');
  await expect(tagline).toHaveValue(SETTINGS.tagline, { timeout: 15_000 });
  await tagline.fill('A tagline changed in the test');

  await page.getByRole('button', { name: /^save$/i }).click();
  const message = page.getByText(`two footer links go to ${first.href}: each address is in the footer once`, { exact: false });
  // Refused: the reason is written under the Note, in the Footer group (collapsed, as Decap draws it; the Waitlist key's is the same).
  await expect(message).toBeAttached({ timeout: 15_000 });
  await page
    .locator('div')
    .filter({ has: page.getByText('Footer', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Expand' }) })
    .last()
    .getByRole('button', { name: 'Expand' })
    .last()
    .click();
  await expect(message).toBeVisible();
  expect(seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), 'nothing committed').toBe(false);
  // Decap answers a form with an invalid field by rejecting its save with nothing (an uncaught "undefined"), as for the waitlist key.
  await expect.poll(() => seen.errors).toEqual(['undefined']);
});
