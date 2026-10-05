import { parseFrontmatter } from '@astrojs/markdown-remark';
import { test, expect } from '@playwright/test';
import { ABOUT_MD, PIXEL, headersFor, openAdmin, rules } from './admin-mock.js';

// public/_headers is read by Cloudflare Pages, not by `astro preview`. So this file reads it the way Pages does (every block
// whose path matches applies, and a header set by two blocks is sent with both values joined) and checks it:
//   - what each kind of path gets;
//   - that the admin still starts and works with its Content-Security-Policy on, which is the one header that can break a page.

test('every page gets the baseline security headers, and no header is set twice', () => {
  for (const path of ['/', '/blog/', '/admin/', '/_astro/x.js']) {
    const h = headersFor(path);
    expect(h['x-content-type-options'], path).toBe('nosniff');
    expect(h['x-frame-options'], path).toBe('SAMEORIGIN');
    expect(h['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
  }
  for (const rule of rules) {
    const names = rule.headers.map(([n]) => n);
    expect(new Set(names).size, `${rule.pattern} repeats a header`).toBe(names.length);
  }
  // Two blocks setting the same header would send both values joined with a comma.
  for (const path of ['/', '/admin/', '/_astro/x.js', '/fonts/x.woff2']) {
    for (const [name, value] of Object.entries(headersFor(path))) {
      expect(value, `${path} ${name}`).not.toMatch(/, (default-src|public|nosniff)/);
    }
  }
});

test('project pages may frame the play origin and nothing else; no other page gets a policy of its own', () => {
  const csp = headersFor('/projects/vesper-drift/')['content-security-policy'];
  expect(csp).toBe('frame-src https://vesper.r7orbit.io');
  // Not script-src, so nothing about scripts is loosened.
  expect(csp).not.toMatch(/script-src|default-src|\*/);
  for (const path of ['/', '/vlogs/x/', '/blog/x/', '/repos/x/']) {
    expect(headersFor(path)['content-security-policy'], path).toBeUndefined();
  }
  // The admin keeps its own policy, unjoined with this one (it needs frame-src 'self' blob: for the live preview).
  expect(headersFor('/admin/')['content-security-policy']).not.toContain('vesper.r7orbit.io');
});

test('the sign-in popup keeps its link to the admin: no Cross-Origin-Opener-Policy', () => {
  for (const path of ['/', '/admin/']) expect(headersFor(path)['cross-origin-opener-policy'], path).toBeUndefined();
});

test('only the admin is noindex and uncached, and only it has a CSP', () => {
  const admin = headersFor('/admin/');
  expect(admin['x-robots-tag']).toBe('noindex, nofollow');
  expect(admin['cache-control']).toBe('no-store');
  const csp = Object.fromEntries(
    admin['content-security-policy']
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .map(([name, ...sources]) => [name, sources]),
  );
  // Scripts: only the bundled editor, plus eval for Decap's Ajv. Never inline, never another host.
  expect(csp['default-src']).toEqual(["'self'"]);
  expect(csp['script-src']).toEqual(["'self'", "'unsafe-eval'"]);
  expect(csp['frame-ancestors']).toEqual(["'none'"]);
  // Where the editor may send data: itself, its own blob: URLs (uploaded images), GitHub's API and status page. Nothing else.
  expect(csp['connect-src']).toEqual(["'self'", 'blob:', 'https://api.github.com', 'https://www.githubstatus.com']);
  expect(csp['img-src']).toEqual([
    "'self'",
    'data:',
    'blob:',
    'https://avatars.githubusercontent.com',
    'https://raw.githubusercontent.com',
  ]);
  expect(admin['content-security-policy'], 'no wildcard hosts').not.toContain('*');
  for (const path of ['/', '/blog/', '/about/']) {
    const h = headersFor(path);
    expect(h['x-robots-tag'], path).toBeUndefined();
    expect(h['content-security-policy'], path).toBeUndefined();
  }
  expect(headersFor('/_astro/app.abc123.js')['cache-control']).toMatch(/immutable/);
});

// ---- The admin under its CSP ----------------------------------------------------------------------------------------


test('the admin starts under its CSP and shows the GitHub login, with no violations or stray requests', async ({
  page,
}) => {
  const seen = await openAdmin(page, { signedIn: false });
  await expect(page.getByRole('button', { name: /login with github/i })).toBeVisible();
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('the signed-in editor draws under its CSP (list, new post form, live preview) with no violations', async ({
  page,
}) => {
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  // A new blog post opens the form, the Markdown editor and the preview pane (an iframe the editor fills with styles).
  await page.evaluate(() => (location.hash = '#/collections/blog/new'));
  await expect(page.getByText('Summary', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Title').first().fill('A *test* post');
  await expect(page.locator('iframe').first().contentFrame().getByRole('heading', { level: 1 })).toContainText('test');
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('saving a post with an uploaded image (a blob: URL) works under the admin CSP', async ({ page }) => {
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/blog/new'));
  await page.getByLabel('Title').first().fill('A post with a picture');
  await page.getByLabel('Summary').first().fill('One line about it.');
  await page.locator('[data-slate-editor]').first().fill('Some body text.');

  // The featured image: upload a file in the media library. Decap holds it as a blob: URL until it is saved, and reads
  // that URL back with fetch() to keep a draft backup and to build the commit.
  await page
    .getByRole('button', { name: /choose an image/i })
    .first()
    .click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL });
  await page.getByRole('button', { name: /choose selected/i }).click();
  await page.getByRole('button', { name: /^save$/i }).click();

  // Saving in the editorial workflow ends with a pull request, so reaching it means every step before it worked.
  await expect
    .poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 15_000 })
    .toBe(true);
  const uploads = seen.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs')).map((c) => c.body);
  expect(
    uploads.some((b) => b.content === PIXEL.toString('base64')),
    'the image is uploaded to GitHub',
  ).toBe(true);
  await expect(page.getByText(/failed to persist/i)).toHaveCount(0);
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('the editor checks GitHub status every five minutes without breaking the CSP', async ({ page }) => {
  await page.clock.install();
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.clock.fastForward('05:05');
  await expect.poll(() => seen.statusChecks.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
});

// ---- Editing the About page under the admin CSP ---------------------------------------------------------------------

/** What Decap committed: the files in the `git/trees` request, and each blob's text by its place in the call order. */
function committedFiles(calls) {
  const blobs = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs')).map((c) => c.body);
  const trees = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/git/trees'));
  return { blobs, trees };
}

test('the About page opens in the editor with its blocks and a live preview, with no violations', async ({ page }) => {
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/pages/entries/about'));

  // The form shows the page's heading and its blocks, each with a line saying what it holds.
  await expect(page.getByLabel('Page heading')).toHaveValue('About', { timeout: 15_000 });
  await expect(page.getByText('Heading: Hunter Newton · R7 Orbit Creator')).toBeVisible();
  await expect(page.getByText(/^Portrait: I build software/)).toBeVisible();
  await expect(page.getByText(/^Portrait: ## R7 · Orbit AI Agent/)).toBeVisible();

  // The preview is the page with the site's styles: the h1, the two headings in order (the second is inside the second portrait's
  // text), the portrait grid.
  const preview = page.locator('iframe').first().contentFrame();
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText('About');
  await expect(preview.getByRole('heading', { level: 2 })).toHaveText(['Hunter Newton · R7 Orbit Creator', 'R7 · Orbit AI Agent']);
  await expect(preview.locator('.about-grid .portrait img').first()).toHaveAttribute('alt', 'Portrait of Hunter Newton');
  await expect(preview.getByText('How a piece gets here:')).toBeVisible();

  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('saving an About change works under the admin CSP: a new image block, two sections swapped, the picture uploaded', async ({
  page,
}) => {
  // Tall, so every block (and the new one's form) is on screen and can be dragged without scrolling.
  await page.setViewportSize({ width: 1280, height: 1800 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/pages/entries/about'));
  await expect(page.getByLabel('Page heading')).toHaveValue('About', { timeout: 15_000 });

  // Add an Image block (it opens at the end of the list), choose a picture and describe it.
  await page.getByRole('button', { name: /add section/i }).click();
  await page.getByRole('menuitem', { name: 'Image', exact: true }).click();
  await page.getByRole('button', { name: /choose an image/i }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'desk.png', mimeType: 'image/png', buffer: PIXEL });
  await page.getByRole('button', { name: /choose selected/i }).click();
  await page.getByLabel('Alt text (optional)').last().fill('A tidy desk with one laptop');

  // The preview shows the new block, with its alt text.
  const preview = page.locator('iframe').first().contentFrame();
  await expect(preview.locator('figure.art-fig img')).toHaveAttribute('alt', 'A tidy desk with one laptop');

  // Re-order: fold the new block to one line, then drag it up above the first block by its handle (the editor has no keyboard
  // way to do this). A tall block is hard to drop: the editor picks the nearest block by its centre.
  const handles = page.locator('[aria-roledescription="sortable"]');
  await handles.last().locator('xpath=preceding-sibling::button[1]').click();
  await expect(handles).toHaveCount(4);
  await expect(page.getByLabel('Alt text (optional)').last()).toBeHidden();
  const from = (await handles.nth(3).boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const to = (await handles.nth(0).boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const x = from.x + from.width / 2;
  await page.mouse.move(x, from.y + from.height / 2);
  await page.mouse.down();
  // Past the editor's 4px drag threshold, then up to the first block.
  await page.mouse.move(x, from.y - 10, { steps: 6 });
  await page.mouse.move(x, to.y + 5, { steps: 30 });
  await page.mouse.up();
  // The editor swallows any click for a moment after a drop (so letting go over a button does not press it); a person is never
  // that quick, but a test is.
  await page.waitForTimeout(300);
  await expect(page.getByText(/^(Heading|Portrait|Text|Image): /)).toHaveCount(4);
  expect(await page.getByText(/^(Heading|Portrait|Text|Image): /).allInnerTexts()).toEqual([
    'Image: A tidy desk with one laptop',
    'Heading: Hunter Newton · R7 Orbit Creator',
    expect.stringMatching(/^Portrait: /),
    expect.stringMatching(/^Portrait: /),
  ]);

  await page.getByRole('button', { name: /^save$/i }).click();
  await expect
    .poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 15_000 })
    .toBe(true);
  const { blobs } = committedFiles(seen.calls);
  const text = (b) => (b.encoding === 'base64' ? Buffer.from(b.content, 'base64').toString('utf8') : b.content);
  const saved = blobs.map(text).find((t) => t.startsWith('---') && t.includes('description:'));
  expect(saved, 'the About file is committed').toBeDefined();
  // Read back what was committed: the new block is first, and every old block follows it exactly as it was written, word for
  // word (the editor re-wraps long lines in the file, which is the same text).
  const { frontmatter: before } = parseFrontmatter(ABOUT_MD);
  const { frontmatter: after } = parseFrontmatter(saved);
  expect(after.title).toBe(before.title);
  expect(after.description).toBe(before.description);
  expect(after.sections[0]).toEqual({
    type: 'image',
    image: '/media/about/desk.png',
    alt: 'A tidy desk with one laptop',
    decorative: false,
    width: 'narrow',
    // The two menus every picture block now has (centred, large), written like every menu the editor shows.
    align: 'center',
    size: 'lg',
  });
  expect(after.sections.slice(1)).toEqual(before.sections);
  // The picture itself is uploaded too, as a file of the site.
  expect(blobs.some((b) => b.content === PIXEL.toString('base64'))).toBe(true);
  const tree = seen.calls.find((c) => c.method === 'POST' && c.path.endsWith('/git/trees'))?.body.tree ?? [];
  expect(tree.map((t) => t.path)).toEqual(expect.arrayContaining(['src/content/pages/about.md', 'public/media/about/desk.png']));

  await expect(page.getByText(/failed to persist/i)).toHaveCount(0);
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('the editor refuses a button address that is not https or a page on the site, and nothing is saved', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/pages/entries/about'));
  await expect(page.getByLabel('Page heading')).toHaveValue('About', { timeout: 15_000 });

  await page.getByRole('button', { name: /add section/i }).click();
  await page.getByRole('menuitem', { name: 'Button', exact: true }).click();
  await page.getByLabel('Button text').fill('Subscribe');
  await page.getByLabel('Address').fill('http://example.com/subscribe');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/use a full https:\/\/ address, or a page on this site/i)).toBeVisible();
  expect(
    seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')),
    'nothing is saved',
  ).toBe(false);

  // A page on this site is fine: the message goes and the save goes through.
  const address = page.getByLabel('Address');
  await address.click();
  await address.press('Control+A');
  await address.pressSequentially('/subscribe/');
  await expect(address).toHaveValue('/subscribe/');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect
    .poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 15_000 })
    .toBe(true);
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  // A refused save makes Decap reject its own promise with no reason, which the page reports as an error whose message is
  // "undefined". That is the refusal itself, so it is not counted.
  expect(seen.errors.filter((e) => e !== 'undefined')).toEqual([]);
});
