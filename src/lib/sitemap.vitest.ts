import { describe, expect, it } from 'vitest';
import { assertWellFormed } from './xml-check';
import {
  buildRobots,
  buildSitemapIndex,
  buildUrlset,
  collectSitemapEntries,
  isExcluded,
  pagePathFromFile,
  sourceIsNoindex,
} from './sitemap';
import type { CollectionName, Post } from './content';

const post = (collection: CollectionName, id: string, date: string, tags: string[] = [], updated?: string): Post => ({
  collection,
  id,
  data: {
    title: id,
    date: new Date(date),
    updated: updated ? new Date(updated) : undefined,
    tags,
    featured: false,
    draft: false,
  },
});

describe('pagePathFromFile', () => {
  it('maps page files to paths and skips dynamic routes', () => {
    expect(pagePathFromFile('/src/pages/index.astro')).toBe('/');
    expect(pagePathFromFile('/src/pages/about.astro')).toBe('/about/');
    expect(pagePathFromFile('/src/pages/blog/index.astro')).toBe('/blog/');
    expect(pagePathFromFile('/src/pages/blog/[slug].astro')).toBeUndefined();
    expect(pagePathFromFile('/src/pages/styleguide/specimen.astro')).toBe('/styleguide/specimen/');
  });
});

describe('noindex detection', () => {
  it('finds the bare and braced prop, not the word in prose', () => {
    expect(sourceIsNoindex('<BaseLayout\n  title="x"\n  noindex\n>')).toBe(true);
    expect(sourceIsNoindex('<BaseLayout noindex={true} title="x">')).toBe(true);
    expect(sourceIsNoindex('<BaseLayout noindex={false} title="x">')).toBe(false);
    expect(sourceIsNoindex('<p>this page is not noindex ever</p>')).toBe(false);
  });
  it('excludes the 404, search and styleguide trees', () => {
    expect(isExcluded('/404/')).toBe(true);
    expect(isExcluded('/search/')).toBe(true);
    expect(isExcluded('/styleguide/specimen/')).toBe(true);
    expect(isExcluded('/blog/')).toBe(false);
  });
});

describe('collectSitemapEntries', () => {
  const posts = [
    post('blog', 'a', '2026-10-01', ['evals', 'git'], '2026-10-05'),
    post('blog', 'b', '2026-09-01', ['evals']),
    post('news', 'n', '2026-09-15'),
  ];
  const entries = collectSitemapEntries(['/', '/about/', '/styleguide/', '/404/', '/search/'], posts);
  const paths = entries.map((e) => e.path);

  it('includes pages, archives of kinds that have posts, posts, and tags with 2+ posts', () => {
    expect(paths).toEqual(
      expect.arrayContaining(['/', '/about/', '/blog/', '/news/', '/blog/a/', '/news/n/', '/tags/', '/tags/evals/']),
    );
    expect(paths).not.toContain('/vlogs/');
    expect(paths).not.toContain('/tags/git/');
  });
  it('leaves out excluded pages', () => {
    expect(paths.some((p) => /styleguide|404|search/.test(p))).toBe(false);
  });
  it('uses updated over date for lastmod and has no duplicates', () => {
    expect(entries.find((e) => e.path === '/blog/a/')?.lastmod).toEqual(new Date('2026-10-05'));
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('XML output', () => {
  it('builds a well-formed urlset with absolute URLs and ISO lastmod', () => {
    const xml = buildUrlset(
      [{ path: '/blog/a/', lastmod: new Date('2026-10-05') }, { path: '/' }],
      'https://example.com',
    );
    assertWellFormed(xml);
    expect(xml).toContain('<loc>https://example.com/blog/a/</loc><lastmod>2026-10-05</lastmod>');
    expect(xml).toContain('<loc>https://example.com/</loc></url>');
  });
  it('builds a well-formed sitemap index', () => {
    const xml = buildSitemapIndex(['/sitemap-0.xml'], 'https://example.com');
    assertWellFormed(xml);
    expect(xml).toContain('<sitemapindex');
    expect(xml).toContain('<loc>https://example.com/sitemap-0.xml</loc>');
  });
  it('points robots.txt at the sitemap index and allows crawling', () => {
    expect(buildRobots('https://example.com')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap-index.xml\n',
    );
  });
});
