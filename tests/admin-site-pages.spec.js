import { parseFrontmatter } from '@astrojs/markdown-remark';
import { test, expect } from '@playwright/test';
import { sectionsSchema } from '../src/lib/sections/schema.ts';
import { pageProblems, SITE_PAGES, sitePage } from '../src/lib/site-pages.ts';
import { openAdmin, PAGE_FILES, SITE_JSON } from './admin-mock.js';

// The home page and the listing pages in the real editor, under its Content-Security-Policy, with GitHub stood in for
// (tests/admin-mock.js serves the real files of src/content/pages/): each is listed under Pages, opens with today's words, draws
// its preview with stand-ins that say what the build fills in, and saves a file the site reads.

async function openEntry(page, name) {
  await page.setViewportSize({ width: 1280, height: 1600 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate((n) => (location.hash = `#/collections/pages/entries/${n}`), name);
  return seen;
}

const committed = (seen, marker) => {
  const blobs = seen.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs')).map((c) => c.body);
  const text = (b) => (b.encoding === 'base64' ? Buffer.from(b.content, 'base64').toString('utf8') : b.content);
  return blobs.map(text).find((t) => t.startsWith('---') && t.includes(marker));
};

async function expectClean(page, seen) {
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
}

test('the Pages collection lists About, then the home page and every listing page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/pages'));
  for (const label of ['About page', ...SITE_PAGES.map((p) => p.admin.label)]) {
    await expect(page.getByRole('link', { name: label, exact: true }).or(page.getByText(label, { exact: true })).first()).toBeVisible({ timeout: 15_000 });
  }
  await expectClean(page, seen);
});

test('home page: opens with today\'s words, previews the hero and stand-ins for the rows made from posts, and saves a valid page', async ({ page }) => {
  const seen = await openEntry(page, 'home');
  // Today's words, read from the file the editor opens (the author edits them in /admin).
  const home = parseFrontmatter(PAGE_FILES['home.md']).frontmatter;
  await expect(page.getByLabel('Headline')).toHaveValue(home.title, { timeout: 15_000 });
  // The tagline is the Site settings' (a token); the preview prints it.
  await expect(page.getByLabel(/^Eyebrow/).first()).toHaveValue('{site.tagline}');

  const preview = page.locator('iframe').first().contentFrame();
  await expect(preview.locator('section.hero h1')).toHaveText(home.title.replaceAll('*', ''), { timeout: 15_000 });
  await expect(preview.locator('section.hero h1 em')).toHaveText('AI agents');
  await expect(preview.locator('.hero .cluster a.btn')).toHaveText(['Start with the latest']);
  await expect(preview.locator('.hero .eyebrow')).toHaveText(JSON.parse(SITE_JSON).tagline);
  await expect(preview.locator('.hero .t-lead')).toHaveText(home.lead.replace('{site.description}', JSON.parse(SITE_JSON).description));
  // Every row made from the posts says so: a stand-in in its frame, and the note under it.
  await expect(preview.getByText('Pinned post: the post marked Featured, as a large card.')).toBeVisible();
  await expect(preview.getByText(/^Latest feed: the 8 newest posts of every kind/)).toBeVisible();
  await expect(preview.getByText(/^Latest posts: 3 newest · project/)).toBeVisible();
  await expect(preview.getByText(/^Latest posts: 3 most recently updated · repo/)).toBeVisible();
  await expect(preview.getByText(/^Apps row: the first 3 published apps/)).toBeVisible();
  await expect(preview.getByText(/^Preview: the home page with the site’s own styles/)).toBeVisible();
  await expect(preview.getByText('Fix before saving.')).toHaveCount(0);

  // The preview follows the form.
  await page.getByLabel('Headline').fill('Plain notes on *building*.');
  await expect(preview.locator('section.hero h1 em')).toHaveText('building');

  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 20_000 }).toBe(true);
  const saved = parseFrontmatter(committed(seen, 'Plain notes on *building*.')).frontmatter;
  const before = parseFrontmatter(PAGE_FILES['home.md']).frontmatter;
  expect(saved.title).toBe('Plain notes on *building*.');
  // Everything else as it was.
  expect({ ...saved, title: before.title }).toMatchObject(before);
  expect(pageProblems(sitePage('home'), saved)).toEqual([]);
  expect(sectionsSchema.safeParse(saved.sections).success).toBe(true);
  await expectClean(page, seen);
});

test('blog archive: opens with today\'s words, previews the head, a stand-in for the list and the empty words; a block above the list saves', async ({ page }) => {
  const seen = await openEntry(page, 'blog-archive');
  await expect(page.getByLabel('Page heading')).toHaveValue('Writing about *building with agents*', { timeout: 15_000 });
  await expect(page.getByLabel(/^Browser title/)).toHaveValue('Blog');
  await expect(page.getByLabel(/^When there is nothing to list: heading/)).toHaveValue('No posts yet.');

  const preview = page.locator('iframe').first().contentFrame();
  await expect(preview.locator('.page-head h1')).toHaveText('Writing about building with agents', { timeout: 15_000 });
  await expect(preview.locator('.page-head .eyebrow')).toHaveText('Blog');
  await expect(preview.getByText(/Stand-in\. The posts are listed here/)).toBeVisible();
  await expect(preview.getByRole('heading', { name: 'No posts yet.' })).toBeVisible();
  await expect(preview.getByText('Fix before saving.')).toHaveCount(0);

  // A callout above the list.
  await page.getByRole('button', { name: /add section/i }).first().click();
  await page.getByRole('menuitem', { name: 'Callout', exact: true }).click();
  await page.getByLabel(/^Text/).last().fill('A note above the list.');
  await expect(preview.getByText('A note above the list.')).toBeVisible();

  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 20_000 }).toBe(true);
  const saved = parseFrontmatter(committed(seen, 'A note above the list.')).frontmatter;
  expect(saved.introSections).toEqual([expect.objectContaining({ type: 'callout', text: 'A note above the list.' })]);
  expect(saved.outroSections ?? []).toEqual([]);
  expect(saved.emptyHeading).toBe('No posts yet.');
  expect(pageProblems(sitePage('blog'), saved)).toEqual([]);
  await expectClean(page, seen);
});

test('apps page: the preview shows the empty-state button and the card beside a single app, in the page\'s words', async ({ page }) => {
  const seen = await openEntry(page, 'apps');
  const apps = parseFrontmatter(PAGE_FILES['apps.md']).frontmatter;
  await expect(page.getByLabel('Page heading')).toHaveValue('Apps', { timeout: 15_000 });
  await expect(page.getByLabel(/^Lead paragraph/)).toHaveValue(apps.lead);
  await expect(page.getByLabel(/^Beside a single app: heading/)).toHaveValue(apps.soonTitle);
  const preview = page.locator('iframe').first().contentFrame();
  await expect(preview.getByText(/Stand-in\. The published apps and games are shown here/)).toBeVisible({ timeout: 15_000 });
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText(apps.title);
  await expect(preview.getByRole('link', { name: apps.emptyLinkLabel })).toBeVisible();
  await expect(preview.locator('.app-soon h2')).toHaveText(apps.soonTitle);
  await expect(preview.locator('.app-soon .eyebrow')).toHaveText(apps.soonEyebrow);
  await expectClean(page, seen);
});

test('a required word left empty is caught before saving: the preview names it and nothing is committed', async ({ page }) => {
  const seen = await openEntry(page, 'tags');
  await expect(page.getByLabel(/^When there is nothing to list: heading/)).toHaveValue('No tags yet.', { timeout: 15_000 });
  await page.getByLabel(/^When there is nothing to list: heading/).fill('');
  const preview = page.locator('iframe').first().contentFrame();
  await expect(preview.getByText('Fix before saving.')).toBeVisible();
  await expect(preview.getByText(/"emptyHeading" is missing/)).toBeVisible();
  await page.getByRole('button', { name: /^save$/i }).click();
  // The form refuses it too (the field is required there), so the editor says so instead of committing.
  await expect(page.getByText(/is required/i).first()).toBeVisible();
  expect(seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), 'nothing is saved').toBe(false);
});
