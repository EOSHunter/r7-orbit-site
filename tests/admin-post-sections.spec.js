import { parseFrontmatter } from '@astrojs/markdown-remark';
import { test, expect } from '@playwright/test';
import { PIXEL, openAdmin } from './admin-mock.js';

// A post written as sections in the real editor, under its Content-Security-Policy, with GitHub stood in for (tests/admin-mock.js):
// every kind offers the block list and draws it in its live preview (blog: preview.ts; the others: post-preview.ts), with the reading
// time and contents list from the blocks; a post with both sections and a Body cannot be saved; one with sections only is saved
// with no Markdown body, its pictures in public/media/<kind>/. docs/SECTIONS.md "Posts".

const saved = (seen) => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls'));
const contentOf = (seen) =>
  seen.calls
    .filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs'))
    .map((c) => (c.body.encoding === 'base64' ? Buffer.from(c.body.content, 'base64').toString('utf8') : c.body.content));
const committed = (seen) =>
  seen.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/git/trees')).flatMap((t) => t.body.tree.map((e) => e.path));

async function expectClean(page, seen) {
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
}

async function newPost(page, collection) {
  await page.setViewportSize({ width: 1280, height: 1800 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate((c) => (location.hash = `#/collections/${c}/new`), collection);
  await page.getByLabel('Title').first().fill('Written as sections');
  await page.getByLabel('Summary').first().fill('One line about it.');
  return seen;
}

/** Adds a block at the end of the Sections list. */
async function addSection(page, label) {
  await page.getByRole('button', { name: /add section/i }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}

/** Adds a Heading block and a Text block. The Text block's box is the Markdown editor that was not there before (a vlog's transcript box comes after the list). */
async function addHeadingAndText(page, heading, text) {
  await addSection(page, 'Heading');
  await page.getByLabel(/^Heading text/).last().fill(heading);
  await page.locator('[data-slate-editor]').evaluateAll((editors) => editors.forEach((e) => (e.dataset.seen = '1')));
  await addSection(page, 'Text');
  const editor = page.locator('[data-slate-editor]:not([data-seen])');
  await editor.click();
  await editor.fill(text);
}

const preview = (page) => page.locator('iframe').first().contentFrame();

for (const kind of ['blog', 'news', 'vlogs', 'projects', 'repos']) {
  test(`${kind}: the Sections list is offered next to the Body, and the preview draws the blocks in the post's column`, async ({ page }) => {
    const seen = await newPost(page, kind);
    await expect(page.getByText('Use sections OR the body, not both').first()).toBeVisible();
    await addHeadingAndText(page, 'A *heading* block', 'Words in a text block.');
    const frame = preview(page);
    const body = frame.locator('.sections[data-layout="column"]');
    await expect(body.locator('h2')).toHaveText('A heading block', { timeout: 15_000 });
    await expect(body.locator('.prose p').first()).toHaveText('Words in a text block.');
    await expect(frame.getByText('Fix before saving.')).toHaveCount(0);
    // A repo's headline is its repository's name, as on the page (none typed yet).
    await expect(frame.locator('h1')).toHaveText(kind === 'repos' ? 'owner/name' : 'Written as sections');
    // The other kinds' preview says what it leaves out.
    if (kind !== 'blog') await expect(frame.locator('.admin-preview-note').first()).toContainText(/are not (drawn|shown)/);
    await expectClean(page, seen);
  });
}

test('blog: the contents list and reading time of the preview come from the blocks', async ({ page }) => {
  const seen = await newPost(page, 'blog');
  for (const name of ['One', 'Two', 'Three']) await addHeadingAndText(page, `Part ${name}`, `Text of part ${name.toLowerCase()}.`);
  const frame = preview(page);
  await expect(frame.locator('.toc-inline a, .toc-aside a').first()).toBeAttached({ timeout: 15_000 });
  await expect(frame.locator('details.toc-inline nav > ol > li > a')).toHaveText(['Part One', 'Part Two', 'Part Three']);
  await expect(frame.locator('header.post-head .eyebrow')).toContainText('1 min read');
  await expectClean(page, seen);
});

test('a post with both sections and a Body is refused on save, with the reason, and nothing is committed', async ({ page }) => {
  const seen = await newPost(page, 'news');
  await page.getByLabel('Source URL').fill('https://example.com/story');
  await page.getByLabel('Source name').fill('Example');
  const body = page.locator('[data-slate-editor]').first();
  await body.click();
  await body.fill('Some Markdown in the Body.');
  await addHeadingAndText(page, 'A heading', 'And a text block.');
  await expect(preview(page).getByText(/This post has both sections and a Body/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/Not saved\. This post has both sections and a Body/)).toBeVisible({ timeout: 15_000 });
  expect(saved(seen)).toBe(false);
});

test('a post written as sections only is saved with no Body, and its pictures go to public/media/<kind>/', async ({ page }) => {
  const seen = await newPost(page, 'blog');
  await addHeadingAndText(page, 'A heading', 'A text block.');
  await addSection(page, 'Image');
  await page.getByRole('button', { name: /choose an image/i }).last().click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'section-picture.png', mimeType: 'image/png', buffer: PIXEL });
  await page.getByRole('button', { name: /choose selected/i }).click();
  await page.getByLabel(/^Alt text/).last().fill('A single blue pixel');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => saved(seen), { timeout: 20_000 }).toBe(true);
  await expect(page.getByText(/failed to persist/i)).toHaveCount(0);

  const file = contentOf(seen).find((t) => t.startsWith('---') && t.includes('Written as sections'));
  expect(file, 'the post is committed').toBeDefined();
  const { frontmatter, content } = parseFrontmatter(file);
  expect(content.trim(), 'no Markdown body').toBe('');
  expect(frontmatter.sections.map((s) => s.type)).toEqual(['heading', 'text', 'image']);
  expect(frontmatter.sections[2]).toMatchObject({ image: '/media/blog/section-picture.png', alt: 'A single blue pixel' });
  expect(committed(seen)).toContain('public/media/blog/section-picture.png');
  await expectClean(page, seen);
});
