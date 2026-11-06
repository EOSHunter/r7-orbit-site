import { test, expect } from '@playwright/test';
import { PIXEL, openAdmin } from './admin-mock.js';

// Adding a picture through the real editor, under the admin's Content-Security-Policy, with GitHub stood in for (tests/admin-mock.js).
// What is checked: where the file is committed, what is written into the post, that the live preview shows it, and that a post
// whose picture has no alt text cannot be saved. docs/IMAGES.md is the author-facing version.

const photo = (name) => ({ name, mimeType: 'image/png', buffer: PIXEL });

async function newPost(page, collection, title) {
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate((c) => (location.hash = `#/collections/${c}/new`), collection);
  await page.getByLabel('Title').first().fill(title);
  await page.getByLabel('Summary').first().fill('One line about it.');
  return seen;
}

async function addBlock(page, name) {
  await page.locator('[data-slate-editor]').first().click();
  await page.getByRole('button', { name: 'Add Component' }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

/** Opens the picker of the image widget inside the body's block, uploads a file and chooses it. */
async function chooseInBlock(page, file) {
  await page.locator('[data-slate-editor]').getByRole('button', { name: /choose an image/i }).first().click();
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole('button', { name: /choose selected/i }).click();
}

const saved = (seen) => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls'));

const committed = (seen) =>
  seen.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/git/trees')).flatMap((t) => t.body.tree.map((e) => e.path));

const contentOf = (seen) =>
  seen.calls
    .filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs') && c.body.encoding === 'base64')
    .map((c) => Buffer.from(c.body.content, 'base64').toString('utf8'));

async function expectClean(page, seen) {
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
}

test('an Image block in a blog post: renamed safely, stored in src/assets/blog, shown in the preview, written as a Figure', async ({
  page,
}) => {
  const seen = await newPost(page, 'blog', 'Pictures in a post');
  await addBlock(page, 'Image');
  await chooseInBlock(page, photo('My Photo (1).PNG'));
  await page.locator('[data-slate-editor]').getByLabel(/^Alt text/).fill('A single blue pixel');
  await page.locator('[data-slate-editor]').getByLabel('Caption').fill('Not much to see');

  // The live preview draws the picture (Decap holds it as a blob: URL until it is saved) with the site's own classes.
  const frame = page.locator('iframe').first().contentFrame();
  const img = frame.locator('figure.art-fig img.art-img');
  await expect(img).toHaveAttribute('src', /^blob:/);
  await expect(img).toHaveAttribute('alt', 'A single blue pixel');
  await expect(frame.locator('figcaption')).toHaveText('Not much to see');
  await expect(frame.locator('.admin-alt-warning')).toHaveCount(0);

  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => saved(seen), { timeout: 15_000 }).toBe(true);

  const paths = committed(seen);
  expect(paths).toContain('src/assets/blog/my-photo-1-.png');
  expect(paths.some((p) => /^src\/content\/blog\/.+\.mdx$/.test(p))).toBe(true);
  const post = contentOf(seen).find((c) => c.includes('<Figure'));
  expect(post).toContain('<Figure src="/src/assets/blog/my-photo-1-.png" alt="A single blue pixel" caption="Not much to see" />');
  await expect(page.getByText(/failed to persist/i)).toHaveCount(0);
  await expectClean(page, seen);
});

test('a post with a picture that has no alt text cannot be saved, and says why', async ({ page }) => {
  const seen = await newPost(page, 'blog', 'No alt text');
  await addBlock(page, 'Image');
  await chooseInBlock(page, photo('chart.png'));
  // The preview shouts about it at once.
  await expect(page.locator('iframe').first().contentFrame().locator('.admin-alt-warning')).toBeVisible();

  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/no alt text/i).first()).toBeVisible({ timeout: 10_000 });
  expect(saved(seen)).toBe(false);

  // Ticking "Decoration only" is the way out for a purely decorative picture.
  await page.locator('[data-slate-editor]').getByLabel(/decoration only/i).check();
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => saved(seen), { timeout: 15_000 }).toBe(true);
  expect(contentOf(seen).find((c) => c.includes('<Figure'))).toContain('<Figure src="/src/assets/blog/chart.png" decorative={true} />');
});

test('the Image block of a news item writes Markdown into public/media/news', async ({ page }) => {
  const seen = await newPost(page, 'news', 'Pictures in news');
  await page.getByLabel('Source URL').fill('https://example.com/story');
  await page.getByLabel('Source name').fill('Example');
  await addBlock(page, 'Image');
  await chooseInBlock(page, photo('Screenshot 1.png'));
  await page.locator('[data-slate-editor]').getByLabel(/^Alt text/).fill('A screenshot');
  await page.locator('[data-slate-editor]').getByLabel('Caption').fill('The first one');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => saved(seen), { timeout: 15_000 }).toBe(true);
  expect(committed(seen)).toContain('public/media/news/screenshot-1.png');
  expect(contentOf(seen).find((c) => c.includes('![A screenshot]'))).toContain(
    '![A screenshot](/media/news/screenshot-1.png)\n*The first one*',
  );
  await expectClean(page, seen);
});

test('a vlog poster goes to public/media/vlogs and is written as /media/vlogs/x.png', async ({ page }) => {
  const seen = await newPost(page, 'vlogs', 'A vlog with a poster');
  await page.getByLabel('YouTube video ID').fill('dQw4w9WgXcQ');
  await page.getByLabel('Duration').fill('1:23');
  await page.locator('[data-slate-editor]').first().fill('Some notes.');
  await page
    .getByRole('button', { name: /choose an image/i })
    .first()
    .click();
  await page.locator('input[type="file"]').setInputFiles(photo('Poster Shot.PNG'));
  await page.getByRole('button', { name: /choose selected/i }).click();
  // The thumbnail in the field shows the upload at once (asset-bridge.ts), not a broken /media/... address.
  await expect(page.locator('img[role="presentation"]').first()).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => saved(seen), { timeout: 15_000 }).toBe(true);
  expect(committed(seen)).toContain('public/media/vlogs/poster-shot.png');
  expect(contentOf(seen).find((c) => c.includes('youtubeId'))).toContain('poster: /media/vlogs/poster-shot.png');
});

test('an upload over the size limit is refused in the picker, with the limit stated', async ({ page }) => {
  await newPost(page, 'vlogs', 'Too big');
  const dialogs = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    return d.dismiss();
  });
  await page
    .getByRole('button', { name: /choose an image/i })
    .first()
    .click();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(11 * 1024 * 1024) });
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  expect(dialogs[0]).toMatch(/10485|10 ?MB|limit/i);
});

// The deploys that failed on 2026-11-06: the author chose the same picture for two fields (then the featured image and the cover),
// under two names, in one edit. Decap keyed an upload by its content, so it committed only the last one; the post named a featured
// image that never reached the repository and the build stopped (ImageNotFound). Blog posts no longer have a cover, but the same
// picture can still go in twice: as the featured image and in the body. Both files must be committed (src/admin/decap-patch.mjs).
test('the same picture as the featured image and in the body, under two names: both files are committed', async ({ page }) => {
  const seen = await newPost(page, 'blog', 'One picture, two places');
  await page.getByRole('button', { name: /choose an image/i }).first().click();
  await page.locator('input[type="file"]').setInputFiles(photo('Hero Shot.png'));
  await page.getByRole('button', { name: /choose selected/i }).click();
  await page.getByLabel('Featured image alt text').fill('A town at night');
  await addBlock(page, 'Image');
  await chooseInBlock(page, photo('Hero Shot Again.png'));
  await page.locator('[data-slate-editor]').getByLabel(/decoration only/i).check();
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => saved(seen), { timeout: 15_000 }).toBe(true);
  const post = contentOf(seen).find((c) => c.includes('featuredImage:'));
  expect(post).toContain('featuredImage: ../../assets/blog/hero-shot.png');
  expect(post).toContain('/src/assets/blog/hero-shot-again.png');
  expect(committed(seen)).toEqual(expect.arrayContaining(['src/assets/blog/hero-shot.png', 'src/assets/blog/hero-shot-again.png']));
  await expectClean(page, seen);
});

// The alt text box said "(optional)" and the save then failed without it (2026-11-06). It is required exactly when there is a
// picture, says so, and says why under the box when Save is pressed (src/admin/image-alt.ts).
test('the featured image alt text: not called optional, and asked for under the box when there is a picture', async ({ page }) => {
  const seen = await newPost(page, 'blog', 'Alt text asked for');
  await page.locator('[data-slate-editor]').first().fill('Some words.');
  const label = page.locator('label', { hasText: 'Featured image alt text' });
  await expect(label).toBeVisible();
  expect(await label.innerText(), 'the visible label').not.toMatch(/optional/i);
  await expect(page.getByText(/^Needed whenever there is a featured image/)).toBeVisible();

  await page.getByRole('button', { name: /choose an image/i }).first().click();
  await page.locator('input[type="file"]').setInputFiles(photo('Hero.png'));
  await page.getByRole('button', { name: /choose selected/i }).click();
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/describe the featured image in one plain sentence/i).first()).toBeVisible({ timeout: 10_000 });
  expect(saved(seen)).toBe(false);

  await page.getByLabel('Featured image alt text').fill('A town at night');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => saved(seen), { timeout: 15_000 }).toBe(true);
  // Decap answers a form with an invalid field by rejecting its save with nothing, which the page reports as an uncaught
  // "undefined" (as in tests/site-settings.spec.js): that one is expected, and nothing else.
  expect(seen.errors).toEqual(['undefined']);
  seen.errors.length = 0;
  await expectClean(page, seen);
});

// The safety net behind the fix above (src/admin/picture-presence.ts): whatever the cause, a post that names a picture which is
// neither uploaded in this edit nor in the repository is not saved, and the message names the file.
test('a post naming a picture that is not uploaded and not in the repository cannot be saved, and says which', async ({ page }) => {
  const seen = await newPost(page, 'blog', 'A missing picture');
  await page.route(/\/repos\/EOSHunter\/r7-orbit-site\/contents\/src\/assets\/blog\/gone\.png/, (route) =>
    route.fulfill({ status: 404, json: { message: 'Not Found' }, headers: { 'access-control-allow-origin': '*' } }),
  );
  await page.getByText('Markdown', { exact: true }).first().locator('..').getByRole('switch').click();
  // The Body in Markdown mode: what is typed is the Markdown itself.
  const write = async (markdown) => {
    await page.locator('[data-slate-editor]').first().click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(markdown);
  };
  await write('Words. ![A town at night](/src/assets/blog/gone.png) ![A field](/src/assets/blog/here.png)');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect(page.getByText(/src\/assets\/blog\/gone\.png\. Choose it again/).first()).toBeVisible({ timeout: 10_000 });
  expect(saved(seen)).toBe(false);
  const asked = seen.calls.filter((c) => c.path.includes('/contents/')).map((c) => `${c.method} ${c.path}`);
  expect(asked).toEqual(expect.arrayContaining([
    'HEAD /repos/EOSHunter/r7-orbit-site/contents/src/assets/blog/here.png',
  ]));

  // Without the missing picture the same post saves.
  await write('Words. ![A field](/src/assets/blog/here.png)');
  await page.getByRole('button', { name: /^save$/i }).click();
  await expect.poll(() => saved(seen), { timeout: 15_000 }).toBe(true);
});
