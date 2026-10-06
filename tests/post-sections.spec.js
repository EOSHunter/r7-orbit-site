import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as pagefind from 'pagefind';
import { assertWellFormed } from '../src/lib/xml-check.ts';
import { watchPage } from './helpers.js';

// Posts written as sections (docs/SECTIONS.md "Posts"). The tests' fixtures, one post per kind in tests/fixtures/posts/<kind>/, go
// through the real schema, loaders and page components and are drawn at /styleguide/posts/<kind>/ (noindex, unlinked), with their feed
// at /styleguide/posts/rss.xml. The same pages are in tests/routes.js, so smoke, axe, budgets, audit and keyboard run over them too;
// this file checks what is specific to a sections body: the blocks are drawn, the page keeps its chrome, the contents list, reading
// time, JSON-LD and feed come from the blocks, the layout holds at 320, 375 and 1280px, and the text is searchable.

const { url: SITE_URL } = JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8'));
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const YT_PAGE = '<!doctype html><title>Video</title><p>video</p>';

/** Each fixture: its page, a word only its sections hold (for search), and what the page must still show around the blocks. */
const FIXTURES = {
  blog: {
    word: 'quasarbloom',
    jsonLd: 'BlogPosting',
    chrome: ['nav.breadcrumb', 'header.post-head .byline', '.share', 'aside.author-note', '.post-nav-wrap'],
  },
  news: {
    word: 'nebulawren',
    jsonLd: 'NewsArticle',
    chrome: ['nav.breadcrumb', 'header.post-head .byline', 'aside.source-box', '.source-take', '.share', 'aside.author-note'],
  },
  vlogs: {
    word: 'cometlark',
    jsonLd: 'VideoObject',
    chrome: ['nav.breadcrumb', 'header.post-head', '.yt .player', 'section[aria-labelledby="notes-h"]', 'details.disclosure', 'aside.sticky .facts', 'aside.author-note'],
  },
  projects: {
    word: 'pulsarfinch',
    jsonLd: 'SoftwareApplication',
    chrome: ['nav.breadcrumb', 'header.project-head', '#play .play-section', 'section[aria-labelledby="changelog-h"]', 'aside.sticky .facts', '[data-more-games]', 'aside.author-note'],
  },
  repos: {
    word: 'magnetarvole',
    jsonLd: 'SoftwareSourceCode',
    chrome: ['nav.breadcrumb', 'header.repo-head', 'aside.sticky .facts', 'aside.author-note'],
  },
};
const KINDS = Object.keys(FIXTURES);
const pathOf = (kind) => `/styleguide/posts/${kind}/`;

/** The JSON-LD nodes of the page, parsed (a parse error fails the test). */
async function jsonLd(page) {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : (data['@graph'] ?? [data]);
  });
}

for (const kind of KINDS) {
  const fixture = FIXTURES[kind];
  const path = pathOf(kind);

  test.describe(`${kind} written as sections`, () => {
    test('draws the blocks in place of the Markdown body, and keeps the page around them', async ({ page, baseURL }) => {
      await page.route(/youtube/, (route) => route.fulfill({ contentType: 'text/html', body: YT_PAGE }));
      const problems = watchPage(page, baseURL);
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      const body = page.locator('main .sections[data-layout="column"]');
      await expect(body).toHaveCount(1);
      await expect(body).toContainText(fixture.word);
      // No second, Markdown-rendered body.
      await expect(page.locator('main .prose:not(.sections .prose):not(.inner)')).toHaveCount(0);
      for (const selector of fixture.chrome) await expect(page.locator(`main ${selector}`).first(), selector).toBeAttached();
      expect(problems).toEqual([]);
    });

    test('has valid JSON-LD of its kind', async ({ page }) => {
      await page.goto(path);
      const nodes = await jsonLd(page);
      const main = nodes.find((n) => [n['@type']].flat().includes(fixture.jsonLd));
      expect(main, `a ${fixture.jsonLd}`).toBeTruthy();
      for (const n of nodes) expect(n['@type']).toBeTruthy();
      expect(JSON.stringify(nodes)).not.toMatch(/\*/);
    });

    for (const width of [320, 375, 1280]) {
      test(`no axe violations and nothing past the edge at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path, { waitUntil: 'networkidle' });
        const wide = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          view: document.documentElement.clientWidth,
          over: [...document.querySelectorAll('main .sections *')]
            .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !el.closest('pre, .codeblock'))
            .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
            .slice(0, 5),
        }));
        expect(wide.over, 'blocks past the right edge').toEqual([]);
        expect(wide.doc).toBeLessThanOrEqual(wide.view);
        // The blocks stay in the post's column: never wider than it, whatever their kind.
        const column = await page.evaluate(() => {
          const sections = document.querySelector('main .sections');
          const parent = sections.parentElement.getBoundingClientRect();
          return [...sections.children].every((row) => row.getBoundingClientRect().width <= parent.width + 1);
        });
        expect(column, 'every row within the column').toBe(true);
        const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
        expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))).toEqual([]);
      });
    }
  });
}

test.describe('blog post written as sections: the contents list and reading time come from the blocks', () => {
  test('lists the Heading blocks and the ## inside Text blocks, and every link lands on a heading', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(pathOf('blog'));
    const toc = page.locator('aside.toc-aside nav');
    await expect(toc).toBeVisible();
    await expect(toc.locator(':scope > ol > li > a')).toHaveText(['Why the body is a list', 'How the page reads them', 'What a feed gets']);
    await expect(toc.locator('ol ol a')).toHaveText(['A heading inside a text block']);
    for (const href of await toc.locator('a').evaluateAll((links) => links.map((a) => a.getAttribute('href')))) {
      const target = page.locator(`#article ${href}`);
      await expect(target, href).toHaveCount(1);
      expect(['H2', 'H3'], href).toContain(await target.evaluate((el) => el.tagName));
    }
    await toc.getByRole('link', { name: 'What a feed gets' }).click();
    await expect(page).toHaveURL(/#what-a-feed-gets$/);
    // The same list, folded, on a phone.
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(page.locator('details.toc-inline summary')).toBeVisible();
  });

  test('says the same reading time in the head, the byline and the JSON-LD, counted from the blocks', async ({ page }) => {
    await page.goto(pathOf('blog'));
    // The fixture's blocks hold about 380 words: two minutes at 220 a minute. Its body under the front matter is empty.
    await expect(page.locator('header.post-head .eyebrow')).toContainText('2 min read');
    await expect(page.locator('header.post-head .byline')).toContainText('2 min read');
    const post = (await jsonLd(page)).find((n) => n['@type'] === 'BlogPosting');
    expect(post.timeRequired).toBe('PT2M');
    expect(post.description).toBe('Fixture for the tests, not part of the site. A blog post whose body is a list of blocks instead of Markdown.');
  });
});

test('a vlog written as sections shows its transcriptText folded under the notes', async ({ page }) => {
  await page.goto(pathOf('vlogs'));
  const transcript = page.locator('section[aria-labelledby="transcript-h"] details.disclosure');
  await expect(transcript.locator('summary')).toHaveText('Show the transcript');
  await expect(transcript.locator('.inner')).toBeHidden();
  await transcript.locator('summary').click();
  await expect(transcript.locator('.inner')).toContainText('written in its own field');
});

test('a repo written as sections with readme: local shows the blocks instead of the README', async ({ page }) => {
  await page.goto(pathOf('repos'));
  await expect(page.locator('main #readme-h')).toHaveCount(0);
  await expect(page.locator('main section[aria-label="Notes"] .sections')).toContainText('readme: local');
});

test('the feed of the fixtures carries each post’s blocks, with every address absolute', async ({ request }) => {
  const res = await request.get('/styleguide/posts/rss.xml');
  expect(res.status()).toBe(200);
  const xml = await res.text();
  assertWellFormed(xml);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  expect(items).toHaveLength(KINDS.length);
  const item = (kind) => items.find((i) => i.includes(`<link>${SITE_URL}${pathOf(kind)}</link>`));
  const content = (kind) => /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/.exec(item(kind))?.[1] ?? '';
  for (const kind of KINDS) {
    expect(item(kind), kind).toBeTruthy();
    expect(content(kind), `${kind}: the blocks' text`).toContain(FIXTURES[kind].word);
    expect(content(kind), `${kind}: no relative address`).not.toMatch(/(href|src)="\/(?!\/)/);
  }
  const blog = content('blog');
  expect(blog).toContain('<h2>Why the body is a <em>list</em></h2>');
  expect(blog).toContain('<h3>A heading inside a text block</h3>');
  expect(blog).toContain(`<img src="${SITE_URL}/og-default.png" alt="The brand image of the site, used as a fixture picture" />`);
  expect(blog).toContain(`<a href="${SITE_URL}/about/">About</a>`);
  expect(blog).toContain('<pre><code>npm run build\nnpm test\n</code></pre>');
  expect(blog).not.toMatch(/class=|<button|<form|<script/);
  expect(content('news')).toMatch(/^<p>Source: <a href="https:\/\/example\.com\/fixture-source\/">Example source<\/a><\/p>/);
  expect(content('vlogs')).toMatch(/<p><a href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ">Watch the video<\/a><\/p>$/);
});

test('the fixtures are not part of the site: no archive, feed or sitemap lists them', async ({ request }) => {
  for (const path of ['/rss.xml', '/blog/rss.xml', '/news/rss.xml', '/sitemap-0.xml', '/latest/', '/blog/', '/news/']) {
    const text = await (await request.get(path)).text();
    expect(text, path).not.toMatch(/styleguide\/posts|written as \*?sections/);
  }
});

// Pagefind indexes the built pages (pagefind.yml: the five kinds' post pages, the text inside <main>). The fixtures are not in the site's
// index, so they are indexed here the same way, with the same settings, into a separate index that the real search page then uses.
test.describe('search', () => {
  let dir;
  test.beforeAll(async () => {
    const config = readFileSync(new URL('../pagefind.yml', import.meta.url), 'utf8');
    const excludeSelectors = [...config.matchAll(/^\s+-\s+"([^"]+)"/gm)].map((m) => m[1]);
    const rootSelector = /^root_selector:\s*(\S+)/m.exec(config)[1];
    const forceLanguage = /^force_language:\s*(\S+)/m.exec(config)[1];
    const { index } = await pagefind.createIndex({ rootSelector, excludeSelectors, forceLanguage });
    for (const kind of KINDS) {
      const content = readFileSync(new URL(`../dist${pathOf(kind)}index.html`, import.meta.url), 'utf8');
      // The address a real post of this kind would have, so a result reads as that kind.
      await index.addHTMLFile({ url: `/${kind}/sections-fixture/`, content });
    }
    dir = mkdtempSync(join(tmpdir(), 'r7-pagefind-'));
    await index.writeFiles({ outputPath: dir });
    await pagefind.close();
  });
  test.afterAll(() => dir && rmSync(dir, { recursive: true, force: true }));

  for (const kind of KINDS) {
    test(`finds the ${kind} fixture by a word only its sections hold`, async ({ page }) => {
      await page.route('**/pagefind/**', (route) => {
        const file = normalize(join(dir, decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/pagefind\//, ''))));
        if (!file.startsWith(dir) || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
        const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
        return route.fulfill({ body: readFileSync(file), contentType: type });
      });
      // The search script must be listening before the word is typed (the full suite runs many pages at once).
      await page.goto('/search/', { waitUntil: 'networkidle' });
      const input = page.locator('[data-search-page] [data-search-input]');
      const results = page.locator('[data-search-page] [data-search-results] a');
      await expect(async () => {
        await input.fill('');
        await input.fill(FIXTURES[kind].word);
        await expect(results).toHaveCount(1, { timeout: 3000 });
      }).toPass({ timeout: 20_000 });
      await expect(results.first()).toHaveAttribute('href', `/${kind}/sections-fixture/`);
    });
  }
});
