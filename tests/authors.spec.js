import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Authors: the author pages, the byline on posts, the "By author" filter, the structured data
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
const isAgentSlug = (slug) => authorFile(slug).kind === 'agent';
/** Posts by any agent (R7 or one of the writing team), and R7's own. */
const agentPosts = postPaths.filter((p) => isAgentSlug(credited(p)));
const r7Posts = postPaths.filter((p) => credited(p) === 'r7');
const personPosts = postPaths.filter((p) => credited(p) === 'hunter-newton');
/** Cards /latest/ shows before any filter: one page (PAGE_SIZE in src/lib/listing.ts); a filter pulls in the other pages' cards. */
const PAGE_SIZE = 12;
const firstPage = Math.min(postPaths.length, PAGE_SIZE);

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
  const slugs = readdirSync(new URL('../src/content/authors/', import.meta.url)).map((f) => f.replace(/\.json$/, ''));
  for (const path of postPaths) expect(slugs, path).toContain(credited(path));
  expect(agentPosts.length, 'a post by an agent').toBeGreaterThan(0);
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
  await expect(cards).toHaveCount(r7Posts.length);
  expect(await cards.evaluateAll((els) => els.map((e) => e.dataset.author))).toEqual(Array(r7Posts.length).fill('r7'));
  for (const path of r7Posts) await expect(page.locator(`[data-items] a[href="${path}"]`)).toHaveCount(1);
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

// ---- the byline ----------------------------------------------------------------------------------------------------------

test("an agent's post: byline with avatar, name, subtitle and AI-written, and no footer note", async ({ page }) => {
  for (const path of agentPosts) {
    await page.goto(path);
    const slug = credited(path);
    const file = authorFile(slug);
    const byline = page.locator(`.author[data-author="${slug}"]`);
    await expect(byline, path).toHaveCount(1);
    await expect(byline.locator('.avatar img')).toHaveAttribute('src', file.avatar);
    await expect(byline.getByRole('link', { name: file.name, exact: true })).toHaveAttribute('href', `/authors/${slug}/`);
    await expect(byline.getByText(file.subtitle)).toBeVisible();
    await expect(byline.locator('.chip.ai-written')).toHaveText('AI-written');

    // The byline and its label are the credit (the footer note was removed on 2026-10-21, docs/DECISIONS.md), and one
    // disclosure is enough: no "How this was made" line next to the label.
    await expect(page.locator('[data-author-note]')).toHaveCount(0);
    await expect(page.getByText('How this was made')).toHaveCount(0);
  }
});

test("an agent's post leaves no empty gap where the footer note was: every block of the post's column holds something, close to the next", async ({
  page,
}) => {
  for (const path of postPaths.filter((p) => credited(p) !== 'hunter-newton')) {
    await page.goto(path);
    const blocks = await page.evaluate(() => {
      const column = document.querySelector('.post-main') ?? document.querySelector('main .split > div:first-child');
      return [...(column?.children ?? [])]
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.height > 0)
        .map(({ el, box }) => ({
          tag: `${el.tagName.toLowerCase()}.${el.className}`,
          top: box.top + scrollY,
          bottom: box.bottom + scrollY,
          filled: !!el.textContent?.trim() || !!el.querySelector('img, svg, iframe, video, button'),
        }));
    });
    expect(blocks.length, path).toBeGreaterThan(0);
    for (const b of blocks) expect(b.filled, `${path}: ${b.tag} is empty`).toBe(true);
    // Between two blocks, the column's own spacing (a few spacing steps), never a hole where a block used to be.
    for (let i = 1; i < blocks.length; i++) expect(blocks[i].top - blocks[i - 1].bottom, `${path}: gap before ${blocks[i].tag}`).toBeLessThanOrEqual(80);
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

test('the AI-written label is on a post exactly when its author is an agent, and no post has a footer note (every post in dist/)', () => {
  for (const path of postPaths) {
    const html = read(path);
    expect(html.includes('data-author-note'), path).toBe(false);
    expect(html.includes('ai-written'), path).toBe(isAgentSlug(credited(path)));
  }
});

test("structured data names the author: a Person for Hunter's posts, an Organization for an agent's", async ({ page }) => {
  for (const path of postPaths) {
    await page.goto(path);
    const ld = await jsonLd(page);
    const kinds = ['BlogPosting', 'NewsArticle', 'VideoObject', 'SoftwareApplication', 'SoftwareSourceCode'];
    const main = ld.find((d) => [d['@type']].flat().some((t) => kinds.includes(t)));
    expect(main, path).toBeTruthy();
    const slug = credited(path);
    if (isAgentSlug(slug)) {
      const file = authorFile(slug);
      expect(main.author, path).toEqual({ '@type': 'Organization', name: file.name, description: file.subtitle, url: `${site.url}/authors/${slug}/` });
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
  // People first, then agents, alphabetical inside each (sortAuthors in src/lib/authors.ts).
  const agentNames = [...new Set(agentPosts.map(credited))].map((slug) => authorFile(slug).name).sort((a, b) => a.localeCompare(b));
  await expect(filter.getByRole('button')).toHaveText(['All', site.author.name, ...agentNames]);
  const visible = () => page.locator('[data-items] [data-item]:not([hidden])');
  const total = postPaths.length;
  await expect(visible()).toHaveCount(firstPage);

  await filter.getByRole('button', { name: 'R7' }).click();
  await expect(filter.getByRole('button', { name: 'R7' })).toHaveAttribute('aria-pressed', 'true');
  await expect(visible()).toHaveCount(r7Posts.length);
  expect(await visible().evaluateAll((els) => els.map((e) => e.dataset.author))).toEqual(Array(r7Posts.length).fill('r7'));
  await expect(page.locator('[data-count]')).toHaveText(`${r7Posts.length} of ${total} posts`);
  expect(page.url()).toContain('author=r7');

  await filter.getByRole('button', { name: site.author.name }).click();
  await expect(visible()).toHaveCount(personPosts.length);
  expect(await visible().evaluateAll((els) => els.map((e) => e.dataset.author))).toEqual(Array(personPosts.length).fill('hunter-newton'));

  await filter.getByRole('button', { name: 'All' }).click();
  await expect(visible()).toHaveCount(firstPage);
  expect(page.url()).not.toContain('author=');
});

test('the filter is read from the address, and works together with the kind filter', async ({ page }) => {
  await page.goto('/latest/?author=r7');
  await expect(page.locator('[data-filter="author"] button[aria-pressed="true"]')).toHaveText('R7');
  await expect(page.locator('[data-items] [data-item]:not([hidden])')).toHaveCount(r7Posts.length);

  await page.goto('/latest/?author=r7&kind=vlog');
  const vlogs = r7Posts.filter((p) => p.startsWith('/vlogs/')).length;
  await expect(page.locator('[data-items] [data-item]:not([hidden])')).toHaveCount(vlogs);

  await page.goto('/latest/?author=nobody');
  await expect(page.locator('[data-filter="author"] button[aria-pressed="true"]')).toHaveText('All');
});

test('without JavaScript the toolbar is hidden and every card on the page is listed, like the other filters', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/latest/');
  await expect(page.locator('.toolbar')).toBeHidden();
  await expect(page.locator('[data-items] [data-item]')).toHaveCount(firstPage);
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

// ---- sitemap ----------------------------------------------------------------------------------------------------------

test('the sitemap lists both author pages', async ({ request }) => {
  const xml = await (await request.get('/sitemap-0.xml')).text();
  expect(xml).toContain(`<loc>${site.url}/authors/r7/</loc>`);
  expect(xml).toContain(`<loc>${site.url}/authors/hunter-newton/</loc>`);
  expect(xml).not.toContain('/styleguide/author-empty/');
});

// ---- the writing team --------------------------------------------------------------------------------------------------------

const TEAM = [
  ['pulsar', 'Pulsar', 'Orbit News Agent'],
  ['orion', 'Orion', 'Orbit Games Agent'],
  ['kepler', 'Kepler', 'Orbit Projects Agent'],
  ['hubble', 'Hubble', 'Orbit Video Agent'],
  ['parallax', 'Parallax', 'Orbit Fact-Check Agent'],
];
const hasPosts = (slug) => postPaths.some((p) => credited(p) === slug);

test('the five writing agents are agents with their own avatar, no footer note, and their bio on their page', async ({ page }) => {
  for (const [slug, name, subtitle] of TEAM) {
    const file = authorFile(slug);
    expect(file, slug).toMatchObject({ slug, kind: 'agent', name, subtitle, avatar: `/media/authors/${slug}.png` });
    expect(file.avatarAlt, slug).toBeTruthy();
    expect(file, slug).not.toHaveProperty('note');
    await page.goto(`/authors/${slug}/`);
    const head = page.locator(`[data-author-page="${slug}"]`);
    await expect(head.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(head.getByText(subtitle)).toBeVisible();
    await expect(head.locator('.t-lead')).toHaveText(file.bio);
    await expect(head.locator('.avatar img')).toHaveAttribute('src', `/media/authors/${slug}.png`);
    await expect(head.locator('.avatar img')).toHaveAttribute('alt', file.avatarAlt);
  }
});

test('an author page with no published posts is noindex and out of the sitemap; with posts it is indexed', async ({ request }) => {
  const xml = await (await request.get('/sitemap-0.xml')).text();
  for (const slug of ['hunter-newton', 'r7', ...TEAM.map(([s]) => s)]) {
    const html = read(`/authors/${slug}`);
    const noindex = /<meta name="robots" content="noindex/.test(html);
    expect(noindex, slug).toBe(!hasPosts(slug));
    expect(xml.includes(`<loc>${site.url}/authors/${slug}/</loc>`), slug).toBe(hasPosts(slug));
  }
});

test('Parallax: its page says plainly that it is an AI agent with no posts, without promising any', async ({ page }) => {
  test.skip(hasPosts('parallax'), 'Parallax has a post');
  await page.goto('/authors/parallax/');
  await expect(page.locator('[data-author-page="parallax"] .chip.ai-agent')).toHaveText('AI agent');
  await expect(page.locator('.chip.ai-written')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Parallax is an AI agent and has no posts on this site.' })).toBeVisible();
  await expect(page.getByText('Check back soon.')).toHaveCount(0);
});

for (const [slug] of TEAM.filter(([s]) => s !== 'parallax')) {
  test(`/authors/${slug}/ has no horizontal scroll and no axe violations at 375px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/authors/${slug}/`);
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
}

for (const width of [320, 1280]) {
  test(`/authors/parallax/ has no horizontal scroll and no axe violations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/authors/parallax/');
    expect(await overflowOf(page)).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
}
