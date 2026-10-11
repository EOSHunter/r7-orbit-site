import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { contentTextProblems, inputsDigest, staleNote } from './fixture-inputs.js';
import { pageText } from './page-text.js';

// The home page, the archives, /latest/, /apps/ and /tags/ are built from src/content/pages/*.md (edited in /admin, "Pages").
// Their wording must not change by accident: tests/fixtures/pages/<name>.json holds the words of each page as it was before it
// became editable (captured from main), line for line, with what comes from the posts masked (tests/page-text.js).
//
// Which parts a page shows still depends on the posts (an empty state, the pinned post, the Apps row), so a fixture also records
// the published posts it was captured with. With the same posts, the whole page must match. With other posts (the author has
// published something since), only the page head is compared, the part every state has, and the test says so.
//
// The words are the author's (the author edits them in /admin), so a fixture also records a digest of the files they come from (the page's
// file and the site settings, tests/fixture-inputs.js). Edited since? Then the page is checked against those files (title,
// description, heading, eyebrow, lead, buttons) instead of word for word, and the test says the fixture is out of date.
//
// Changed a page on purpose, or published posts? Rebuild, then refresh the fixtures and read the diff before committing it:
//   npm run build && UPDATE_PAGE_TEXT=1 npx playwright test page-text

const PAGES = {
  home: '/',
  latest: '/latest/',
  news: '/news/',
  blog: '/blog/',
  vlogs: '/vlogs/',
  projects: '/projects/',
  repos: '/repos/',
  apps: '/apps/',
  tags: '/tags/',
};

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fixtures = fileURLToPath(new URL('./fixtures/pages/', import.meta.url));
const UPDATE = !!process.env.UPDATE_PAGE_TEXT;

/** The published posts, as `kind/slug`: the pages the build wrote (drafts and future-dated posts have none). */
function publishedPosts() {
  return ['news', 'blog', 'vlogs', 'projects', 'repos'].flatMap((kind) => {
    const base = join(dist, kind);
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'page' && existsSync(join(base, e.name, 'index.html')))
      .map((e) => `${kind}/${e.name}`)
      .sort();
  });
}

for (const [name, path] of Object.entries(PAGES)) {
  test(`${path}: the words of the page are the fixture's (${name}.json)`, async ({ page }) => {
    await page.goto(path);
    const { head, lines } = await pageText(page);
    const posts = publishedPosts();
    const file = join(fixtures, `${name}.json`);
    const inputs = inputsDigest(['src/data/site.json', `src/content/pages/${name}.md`]);

    if (UPDATE) {
      mkdirSync(fixtures, { recursive: true });
      writeFileSync(file, `${JSON.stringify({ path, inputs, posts, head, lines }, null, 2)}\n`);
      return;
    }

    const fixture = JSON.parse(readFileSync(file, 'utf8'));
    if (fixture.inputs !== inputs) {
      test.info().annotations.push({
        type: 'note',
        description: staleNote(`tests/fixtures/pages/${name}.json`, 'UPDATE_PAGE_TEXT=1 npx playwright test page-text'),
      });
      expect(contentTextProblems(lines, name, { home: name === 'home' }), 'the words its file holds').toEqual([]);
    } else if (JSON.stringify(fixture.posts) === JSON.stringify(posts)) {
      expect(lines, 'the whole page, word for word').toEqual(fixture.lines);
    } else {
      test.info().annotations.push({
        type: 'note',
        description: `The published posts differ from the fixture's, so only the page head was compared. Refresh: UPDATE_PAGE_TEXT=1 npx playwright test page-text`,
      });
      expect(head, 'the title, description and page head, word for word').toEqual(fixture.head);
    }
  });
}
