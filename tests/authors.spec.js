import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Authors: the two author pages, the byline and the agent's footer note on posts, the "By author" filter, the structured data
// and the feeds. Content-driven where it can be (the pages are found in dist/), and a fixture for an author with no posts.

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const read = (rel) => readFileSync(join(dist, rel, 'index.html'), 'utf8');
const KINDS = ['news', 'blog', 'vlogs', 'projects', 'repos'];
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const authorFile = (slug) => JSON.parse(readFileSync(new URL(`../src/content/authors/${slug}.json`, import.meta.url), 'utf8'));
const site = JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8'));

/** Every post page in dist/, as `/blog/slug/`. */
const postPaths = KINDS.flatMap((kind) =>
  existsSync(join(dist, kind))
    ? readdirSync(join(dist, kind), { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(join(dist, kind, e.name, 'index.html')))
        .map((e) => `/${kind}/${e.name}/`)
    : [],
);
const credited = (path) => (/class="author" data-author="([^"]+)"/.exec(read(path))?.[1]);
const agentPosts = postPaths.filter((p) => credited(p) === 'r7');
const personPosts = postPaths.filter((p) => credited(p) === 'hunter-newton');

const jsonLd = (page) =>
  page.$$eval('script[type="application/ld+json"]', (els) =>
    els.flatMap((e) => {
      const data = JSON.parse(e.textContent ?? '');
      return Array.isArray(data) ? data : (data['@graph'] ?? [data]);
    }),
  );
const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('every post names an author that exists, and the sample content has one of each kind', () => {
  expect(postPaths.length).toBeGreaterThan(0);
  for (const path of postPaths) expect(['hunter-newton', 'r7'], path).toContain(credited(path));
  expect(agentPosts.length, 'a post by R7').toBeGreaterThan(0);
  expect(personPosts.length, 'a post by Hunter Newton').toBeGreaterThan(0);
});

// ---- the author pages ------------------------------------------------------------------------------------------------------

test('R7 page: avatar, name, subtitle, bio, the AI-written label, and a plain statement that it is an AI agent', async ({ page }) => {
  await page.goto('/authors/r7/');
  const head = page.locator('[data-author-page="r7"]');
  await expect(head.getByRole('heading', { level: 1, name: 'R7' })).toBeVisible();
  await expect(head.getByText('Orbit AI Agent')).toBeVisible();
  await expect(head.locator('.chip.ai-written')).toHaveText('AI-written');
  await expect(head.locator('.avatar img')).toHaveAttribute('src', '/assets/r7-mark.svg');
  await expect(head.locator('.t-lead')).toHaveText(authorFile('r7').bio);
  await expect(head.locator('.t-lead')).toContainText('AI agent');
  await expect(head.locator('.t-lead')).toContainText("It's not a person");
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  await expect(page).toHaveTitle('R7 · R7 Orbit');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${site.url}/authors/r7/`);
  await expect(page.locator('meta[property="og:url"], meta[property="og:title"]').first()).toBeAttached();
});

test('R7 page lists R7\'s posts of every kind, and only those', async ({ page }) => {
  await page.goto('/authors/r7/');
  const cards = page.locator('[data-items] [data-item]');
  await expect(cards).toHaveCount(agentPosts.length);
  expect(await cards.evaluateAll((els) => els.map((e) => e.dataset.author))).toEqual(Array(agentPosts.length).fill('r7'));
  for (const path of agentPosts) await expect(page.locator(`[data-items] a[href="${path}"]`)).toHaveCount(1);
});

test('Hunter Newton page: his name, bio and photo come from site.json, with no AI-written label', async ({ page }) => {
  await page.goto('/authors/hunter-newton/');
  const head = page.locator('[data-author-page="hunter-newton"]');
  await expect(head.getByRole('heading', { level: 1, name: site.author.name })).toBeVisible();
  await expect(head.locator('.t-lead')).toHaveText(site.author.bio);
  await expect(head.locator('.avatar img')).toHaveAttribute('src', site.author.photo);
  await expect(head.locator('.chip.ai-written')).toHaveCount(0);
  const cards = page.locator('[data-items] [data-item]');
  await expect(cards).toHaveCount(personPosts.length);
  for (const path of personPosts) await expect(page.locator(`[data-items] a[href="${path}"]`)).toHaveCount(1);
});

test('author pages are ProfilePages: a Person for Hunter Newton, an Organization for R7', async ({ page }) => {
  await page.goto('/authors/hunter-newton/');
  let ld = await jsonLd(page);
  expect(ld.find((d) => d['@type'] === 'ProfilePage').mainEntity).toMatchObject({
    '@type': 'Person',
    name: site.author.name,
    url: `${site.url}/authors/hunter-newton/`,
  });
  expect(ld.some((d) => d['@type'] === 'BreadcrumbList')).toBe(true);

  await page.goto('/authors/r7/');
  ld = await jsonLd(page);
  expect(ld.find((d) => d['@type'] === 'ProfilePage').mainEntity).toMatchObject({
    '@type': 'Organization',
    name: 'R7',
    description: 'Orbit AI Agent',
    url: `${site.url}/authors/r7/`,
  });
});

test('an author with no posts shows the empty state and the initials avatar (fixture)', async ({ page }) => {
  await page.goto('/styleguide/author-empty/');
  await expect(page.getByRole('heading', { level: 1, name: 'Fixture Author' })).toBeVisible();
  await expect(page.locator('.avatar.initials')).toHaveText('FA');
  await expect(page.getByRole('heading', { level: 2, name: 'Nothing by Fixture Author is posted yet.' })).toBeVisible();
  await expect(page.locator('[data-item]')).toHaveCount(0);
});

test('there is no /authors/ index page', async ({ request }) => {
  expect((await request.get('/authors/')).status()).toBe(404);
});

for (const path of ['/authors/r7/', '/authors/hunter-newton/', '/styleguide/author-empty/']) {
  for (const width of [320, 375, 1280]) {
    test(`${path} has no horizontal scroll and no axe violations at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      expect(await overflowOf(page)).toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    });
  }
}

// ---- the byline and the footer note ----------------------------------------------------------------------------------------

test("an agent's post: byline with avatar, name, subtitle and AI-written, and the footer note once, at the end", async ({ page }) => {
  for (const path of agentPosts) {
    await page.goto(path);
    const byline = page.locator('.author[data-author="r7"]');
    await expect(byline, path).toHaveCount(1);
    await expect(byline.locator('.avatar img')).toHaveAttribute('src', '/assets/r7-mark.svg');
    await expect(byline.getByRole('link', { name: 'R7', exact: true })).toHaveAttribute('href', '/authors/r7/');
    await expect(byline.getByText('Orbit AI Agent')).toBeVisible();
    await expect(byline.locator('.chip.ai-written')).toHaveText('AI-written');

    const note = page.locator('[data-author-note="r7"]');
    await expect(note, path).toHaveCount(1);
    await expect(note).toContainText(authorFile('r7').note);
    // One disclosure: no "How this was made" line next to the label and note.
    await expect(page.getByText('How this was made')).toHaveCount(0);
    // At the end of the post: after the article or the notes it follows, not above them.
    const [noteBox, headBox] = await Promise.all([note.boundingBox(), page.locator('h1').boundingBox()]);
    expect(noteBox.y, path).toBeGreaterThan(headBox.y);
  }
});

test("a person's post: Hunter Newton in the byline, no AI-written label and no footer note", async ({ page }) => {
  for (const path of personPosts) {
    await page.goto(path);
    const byline = page.locator('.author[data-author="hunter-newton"]');
    await expect(byline, path).toHaveCount(1);
    await expect(byline.getByRole('link', { name: site.author.name })).toHaveAttribute('href', '/authors/hunter-newton/');
    await expect(byline.locator('.avatar img')).toHaveAttribute('src', site.author.photo);
    await expect(page.locator('.chip.ai-written')).toHaveCount(0);
    await expect(page.locator('[data-author-note]')).toHaveCount(0);
  }
});

test('the footer note is on a post exactly when its author is an agent (every post in dist/)', () => {
  for (const path of postPaths) {
    const html = read(path);
    expect(html.includes('data-author-note'), path).toBe(credited(path) === 'r7');
    expect(html.includes('ai-written'), path).toBe(credited(path) === 'r7');
  }
});

test("structured data names the author: a Person for Hunter's posts, an Organization for R7's", async ({ page }) => {
  for (const path of postPaths) {
    await page.goto(path);
    const ld = await jsonLd(page);
    const kinds = ['BlogPosting', 'NewsArticle', 'VideoObject', 'SoftwareApplication', 'SoftwareSourceCode'];
    const main = ld.find((d) => [d['@type']].flat().some((t) => kinds.includes(t)));
    expect(main, path).toBeTruthy();
    if (credited(path) === 'r7') {
      expect(main.author, path).toEqual({ '@type': 'Organization', name: 'R7', description: 'Orbit AI Agent', url: `${site.url}/authors/r7/` });
    } else {
      expect(main.author, path).toMatchObject({ '@type': 'Person', name: site.author.name, url: `${site.url}/authors/hunter-newton/` });
    }
  }
});

// ---- the filter ------------------------------------------------------------------------------------------------------------

test('/latest/ has a By author filter with every author who has posts; picking one shows only their cards', async ({ page }) => {
  await page.goto('/latest/');
  const filter = page.locator('[data-filter="author"]');
  await expect(page.getByText('By author', { exact: true })).toBeVisible();
  await expect(filter.getByRole('button')).toHaveText(['All', site.author.name, 'R7']);
  const visible = () => page.locator('[data-items] [data-item]:not([hidden])');
  const total = postPaths.length;
  await expect(visible()).toHaveCount(total);

  await filter.getByRole('button', { name: 'R7' }).click();
  await expect(filter.getByRole('button', { name: 'R7' })).toHaveAttribute('aria-pressed', 'true');
  await expect(visible()).toHaveCount(agentPosts.length);
  expect(await visible().evaluateAll((els) => els.map((e) => e.dataset.author))).toEqual(Array(agentPosts.length).fill('r7'));
  await expect(page.locator('[data-count]')).toHaveText(`${agentPosts.length} of ${total} posts`);
  expect(page.url()).toContain('author=r7');

  await filter.getByRole('button', { name: site.author.name }).click();
  await expect(visible()).toHaveCount(personPosts.length);
  expect(await visible().evaluateAll((els) => els.map((e) => e.dataset.author))).toEqual(Array(personPosts.length).fill('hunter-newton'));

  await filter.getByRole('button', { name: 'All' }).click();
  await expect(visible()).toHaveCount(total);
  expect(page.url()).not.toContain('author=');
});

test('the filter is read from the address, and works together with the kind filter', async ({ page }) => {
  await page.goto('/latest/?author=r7');
  await expect(page.locator('[data-filter="author"] button[aria-pressed="true"]')).toHaveText('R7');
  await expect(page.locator('[data-items] [data-item]:not([hidden])')).toHaveCount(agentPosts.length);

  await page.goto('/latest/?author=r7&kind=vlog');
  const vlogs = agentPosts.filter((p) => p.startsWith('/vlogs/')).length;
  await expect(page.locator('[data-items] [data-item]:not([hidden])')).toHaveCount(vlogs);

  await page.goto('/latest/?author=nobody');
  await expect(page.locator('[data-filter="author"] button[aria-pressed="true"]')).toHaveText('All');
});

test('without JavaScript the toolbar is hidden and every card is listed, like the other filters', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/latest/');
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('[data-items] [data-item]')).toHaveCount(postPaths.length);
  await context.close();
});

test('a tag page shared by both authors has the filter too, and hides the kinds it empties', async ({ page }) => {
  const tagDirs = existsSync(join(dist, 'tags'))
    ? readdirSync(join(dist, 'tags'), { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(dist, 'tags', e.name, 'index.html')))
    : [];
  const shared = tagDirs.map((e) => e.name).find((name) => read(`/tags/${name}`).includes('data-author-filter'));
  test.skip(!shared, 'no tag is shared by two authors in the current content');
  await page.goto(`/tags/${shared}/`);
  const filter = page.locator('[data-filter="author"]');
  await filter.getByRole('button', { name: 'R7' }).click();
  const cards = page.locator('[data-item]:not([hidden])');
  expect(await cards.evaluateAll((els) => els.map((e) => e.dataset.author))).not.toEqual([]);
  expect(new Set(await cards.evaluateAll((els) => els.map((e) => e.dataset.author)))).toEqual(new Set(['r7']));
  for (const group of await page.locator('[data-group]').all()) {
    expect(await group.isVisible()).toBe((await group.locator('[data-item]:not([hidden])').count()) > 0);
  }
  await filter.getByRole('button', { name: 'All' }).click();
  await expect(page.locator('[data-item][hidden]')).toHaveCount(0);
});

// ---- feeds and sitemap ----------------------------------------------------------------------------------------------------

test('every feed item carries its author as dc:creator, in the all-posts feed and in each kind feed', async ({ request }) => {
  for (const path of ['/rss.xml', ...KINDS.map((k) => `/${k}/rss.xml`)]) {
    const xml = await (await request.get(path)).text();
    expect(xml, path).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
    for (const item of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
      const link = /<link>([^<]+)<\/link>/.exec(item)[1];
      const creator = /<dc:creator>([^<]+)<\/dc:creator>/.exec(item)?.[1];
      expect(creator, `${path} ${link}`).toBe(credited(new URL(link).pathname) === 'r7' ? 'R7' : site.author.name);
    }
  }
});

test('the sitemap lists both author pages', async ({ request }) => {
  const xml = await (await request.get('/sitemap-0.xml')).text();
  expect(xml).toContain(`<loc>${site.url}/authors/r7/</loc>`);
  expect(xml).toContain(`<loc>${site.url}/authors/hunter-newton/</loc>`);
  expect(xml).not.toContain('/styleguide/author-empty/');
});
