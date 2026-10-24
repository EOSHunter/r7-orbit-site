import { parseFrontmatter } from '@astrojs/markdown-remark';
import { test, expect } from '@playwright/test';
import { definitions } from '../src/lib/sections/definitions.ts';
import { describeShape } from '../src/lib/sections/describe.ts';
import { sectionsSchema } from '../src/lib/sections/schema.ts';
import { sectionsHeadings } from '../src/lib/sections-to-content.ts';
import { ABOUT_MD, PIXEL, openAdmin } from './admin-mock.js';
import { aboutTitle } from './about-title.js';

// Every block of the library, added in the real editor under its Content-Security-Policy with GitHub stood in for (tests/admin-mock.js):
// the form offers it, it can be filled in with what its definition says, the live preview draws it and finds nothing to warn about
// (the preview runs the real schema over what the editor holds), and what is saved is a page the schema reads. The fields to fill
// come from the definitions themselves (their examples and field descriptions), so a block added to the library is tested here
// without a line of test code, and a field the form cannot fill in fails here.

// The names the author menu shows (src/admin/authors.ts: the name, then the subtitle if there is one).
const AUTHORS = { 'hunter-newton': 'Hunter Newton', r7: 'R7 · Orbit AI Agent' };
// The About page's heading, from its file (the author edits it in /admin).
const ABOUT_TITLE = parseFrontmatter(ABOUT_MD).frontmatter.title;
// A Table of contents lists the page's headings; on an About page with none, the preview says so instead of drawing an empty list.
const ABOUT_HAS_HEADINGS = sectionsHeadings(parseFrontmatter(ABOUT_MD).frontmatter.sections ?? []).length > 0;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const labelRe = (label) => new RegExp(`^${escape(label)}( \\(optional\\))?$`);

/** What the preview must show for the block once it is filled in: a selector inside the preview frame. */
const SHOWS = {
  heading: '.sections h2',
  lead: 'p.art-lead',
  text: '.prose p',
  quote: 'figure.art-quote',
  pullquote: 'aside.art-pullquote',
  callout: '.art-callout',
  code: '.codeblock.art-code',
  image: 'figure.art-fig img',
  'image-row': 'figure.art-row',
  gallery: '.gallery figure',
  portrait: '.about-grid .portrait img',
  video: '.art-video .player',
  game: '.play-section .play-start',
  columns: '.art-cols .art-col',
  divider: '.art-divider',
  spacer: '.sec-spacer',
  links: '.link-list li',
  button: '.sec-button a.btn',
  toc: '.art-toc li',
  stats: '.stats',
  latest: '.latest-posts',
  feed: '.sec-row-band .feed-head h2',
  pinned: '.sec-row-band section.section:not(.ruled) .section-head',
  apps: '.sec-row-band section.section.ruled .section-head',
  author: '.author-box',
  team: '.team-grid .team-card',
  waitlist: '.sec-row-band section[data-waitlist-placeholder] .empty',
};

async function openAbout(page) {
  // Tall, so a block's whole form is on screen.
  await page.setViewportSize({ width: 1280, height: 1800 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/pages/entries/about'));
  await expect(page.getByLabel('Page heading')).toHaveValue(aboutTitle, { timeout: 15_000 });
  return seen;
}

let uploads = 0;

/**
 * Fills one field of the block just added (the last in the page, so `.last()` finds its fields) from the example's value.
 * `state.markdown` counts the Markdown editors already filled in the block, which have no label of their own.
 */
async function fillField(page, field, value, state) {
  const label = labelRe(field.label);
  switch (field.widget) {
    case 'string':
    case 'text':
      await page.getByLabel(label).last().fill(String(value));
      break;
    case 'markdown': {
      const editors = page.locator('[data-slate-editor]');
      const editor = editors.nth(state.firstMarkdown + state.markdown++);
      await editor.click();
      await editor.fill(`Words for ${field.name}`);
      break;
    }
    case 'image': {
      uploads += 1;
      await page.getByRole('button', { name: /choose an image/i }).last().click();
      await page.locator('input[type="file"]').setInputFiles({ name: `block-${uploads}.png`, mimeType: 'image/png', buffer: PIXEL });
      await page.getByRole('button', { name: /choose selected/i }).click();
      break;
    }
    case 'boolean': {
      const box = page.getByLabel(label).last();
      if (value === true) await box.check();
      break;
    }
    case 'number':
      await page.getByLabel(label).last().fill(String(value));
      break;
    case 'select': {
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        const option = field.options?.find((o) => String(o.value) === String(v));
        const name = field.source === 'authors' ? AUTHORS[v] : (option?.label ?? String(v));
        await page.getByLabel(label).last().click();
        await page.getByRole('option', { name, exact: true }).click();
      }
      break;
    }
    case 'list': {
      for (const row of value) {
        await page.getByRole('button', { name: new RegExp(`^add ${escape(field.itemLabel ?? 'item')}$`, 'i') }).last().click();
        await fillFields(page, field.fields, row, state);
      }
      break;
    }
  }
}

/** Fills every field of `fields` that the example has a value for, in the form's order. */
async function fillFields(page, fields, example, state) {
  for (const field of fields) {
    const value = example[field.name];
    if (value === undefined) continue;
    // A menu or switch left at its default needs no click.
    if (field.hasDefault && JSON.stringify(value) === JSON.stringify(field.default)) continue;
    await fillField(page, field, value, state);
  }
}

/** Adds the block `d` at the end of the page and fills it in from its example. */
async function addAndFill(page, d) {
  const firstMarkdown = await page.locator('[data-slate-editor]').count();
  await page.getByRole('button', { name: /add section/i }).click();
  await page.getByRole('menuitem', { name: d.label, exact: true }).click();
  await fillFields(page, describeShape(d.schema.shape), d.example, { markdown: 0, firstMarkdown });
}

const committedAbout = (seen) => {
  const blobs = seen.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs')).map((c) => c.body);
  const text = (b) => (b.encoding === 'base64' ? Buffer.from(b.content, 'base64').toString('utf8') : b.content);
  return blobs.map(text).find((t) => t.startsWith('---') && t.includes('description:'));
};

async function expectClean(page, seen) {
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
}

/** What the saved block must hold: the example's values, except the pictures (uploaded under new names) and the Markdown (retyped). */
function expected(fields, example) {
  const out = {};
  for (const field of fields) {
    const value = example[field.name];
    if (value === undefined || field.widget === 'image' || field.widget === 'markdown') continue;
    out[field.name] = field.widget === 'list' ? value.map((row) => expected(field.fields, row)) : field.widget === 'number' ? Number(value) : value;
  }
  return out;
}

test('the "Add section" menu offers every block of the library, in its order', async ({ page }) => {
  const seen = await openAbout(page);
  await page.getByRole('button', { name: /add section/i }).click();
  const items = await page.getByRole('menuitem').allInnerTexts();
  expect(items).toEqual(definitions.map((d) => d.label));
  await page.keyboard.press('Escape');
  await expectClean(page, seen);
});

for (const d of definitions) {
  test(`${d.id}: added in the editor, filled in, drawn by the preview with nothing to fix, and saved as a page the schema reads`, async ({ page }) => {
    const seen = await openAbout(page);
    // A table of contents lists the page's headings, so it needs one above it when the page has none.
    if (d.id === 'toc') await addAndFill(page, definitions.find((x) => x.id === 'heading'));
    await addAndFill(page, d);

    // The preview (the page with the site's styles) shows the block, and has nothing to warn about.
    const preview = page.locator('iframe').first().contentFrame();
    if (d.id === 'toc' && !ABOUT_HAS_HEADINGS) await expect(preview.getByText(/^No headings yet/)).toBeVisible({ timeout: 15_000 });
    else await expect(preview.locator(SHOWS[d.id]).last()).toBeVisible({ timeout: 15_000 });
    await expect(preview.getByText('Fix before saving.')).toHaveCount(0);
    // `.last()`: the page may already hold a block of the same type (About has a Team block).
    if (d.previewNote) await expect(preview.getByText(`Preview: ${d.previewNote}`).last()).toBeVisible();

    await page.getByRole('button', { name: /^save$/i }).click();
    await expect.poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 20_000 }).toBe(true);

    // What was committed: the About file, with the new block last, and the whole list valid for the schema.
    const saved = committedAbout(seen);
    expect(saved, 'the About file is committed').toBeDefined();
    const { sections } = parseFrontmatter(saved).frontmatter;
    const parsed = sectionsSchema.safeParse(sections);
    expect(parsed.success ? '' : JSON.stringify(parsed.error.issues), 'the saved page is valid').toBe('');
    const block = sections.at(-1);
    expect(block).toMatchObject({ type: d.id, ...expected(describeShape(d.schema.shape), d.example) });
    // Pictures went to the pages' own folder, named by the editor.
    const files = seen.calls.find((c) => c.method === 'POST' && c.path.endsWith('/git/trees'))?.body.tree.map((t) => t.path) ?? [];
    const hasPicture = (fields, data) =>
      fields.some((f) => (f.widget === 'image' && data[f.name]) || (f.widget === 'list' && (data[f.name] ?? []).some((row) => hasPicture(f.fields, row))));
    if (hasPicture(describeShape(d.schema.shape), d.example)) {
      expect(files.some((f) => /^public\/media\/about\/block-\d+\.png$/.test(f)), files.join(', ')).toBe(true);
    }
    await expect(page.getByText(/failed to persist/i)).toHaveCount(0);
    await expectClean(page, seen);
  });
}

test('every block together: one page with all of them draws, saves, and is read back by the schema', async ({ page }) => {
  test.setTimeout(300_000);
  const seen = await openAbout(page);
  for (const d of definitions) await addAndFill(page, d);

  const preview = page.locator('iframe').first().contentFrame();
  for (const d of definitions) await expect(preview.locator(SHOWS[d.id]).first(), d.id).toBeAttached({ timeout: 15_000 });
  await expect(preview.getByText('Fix before saving.')).toHaveCount(0);

  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 30_000 }).toBe(true);
  const { sections } = parseFrontmatter(committedAbout(seen)).frontmatter;
  expect(sectionsSchema.safeParse(sections).success).toBe(true);
  // The old blocks first, untouched, then the new ones in the order they were added.
  const old = parseFrontmatter(ABOUT_MD).frontmatter.sections.map((s) => s.type);
  expect(sections.slice(0, old.length).map((s) => s.type)).toEqual(old);
  expect(sections.slice(old.length).map((s) => s.type)).toEqual(definitions.map((d) => d.id));
  await expectClean(page, seen);
});

test('a block with a missing required field cannot be saved: the editor says what, and nothing is committed', async ({ page }) => {
  const seen = await openAbout(page);
  await page.getByRole('button', { name: /add section/i }).click();
  await page.getByRole('menuitem', { name: 'Video embed', exact: true }).click();
  await page.getByLabel('Video title').fill('No id');
  // The id is wrong: a whole link, which the form and the build both refuse.
  await page.getByLabel('YouTube video ID').fill('https://youtu.be/dQw4w9WgXcQ');
  const preview = page.locator('iframe').first().contentFrame();
  await expect(preview.getByText('Fix before saving.')).toBeVisible();
  await expect(preview.getByText(/a YouTube id is exactly 11 characters/)).toBeVisible();
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/a YouTube id is exactly 11 characters/i).first()).toBeVisible();
  expect(seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), 'nothing is saved').toBe(false);
});
