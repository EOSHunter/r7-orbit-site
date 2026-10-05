import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const { url: SITE_URL } = JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8'));

// Feeds, robots and sitemap: reachable, well-formed enough, and consistent with each other.
const feeds = ['/rss.xml', '/news/rss.xml', '/blog/rss.xml', '/vlogs/rss.xml', '/projects/rss.xml', '/repos/rss.xml'];

for (const path of feeds) {
  test(`feed ${path}`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/xml/);
    const xml = await res.text();
    expect(xml).toMatch(/^<\?xml[^>]*\?>\s*<rss version="2\.0"/);
    expect(xml).toContain(`<atom:link href="${SITE_URL}${path}" rel="self"`);
    // A kind with nothing published has a valid feed with no items (and so no build date).
    const items = xml.match(/<item>/g)?.length ?? 0;
    expect(items, 'every item is closed').toBe(xml.match(/<\/item>/g)?.length ?? 0);
    if (items > 0) expect(xml).toContain('<lastBuildDate>');
    expect(xml, 'no * title markers').not.toMatch(/<title>[^<]*\*/);
    for (const guid of xml.match(/<guid isPermaLink="true">[^<]+<\/guid>/g) ?? []) {
      expect(guid).toMatch(/https:\/\/[^<]+\/<\/guid>$/);
    }
  });
}

test('robots.txt points at the sitemap', async ({ request }) => {
  const text = await (await request.get('/robots.txt')).text();
  expect(text).toMatch(/User-agent: \*/);
  expect(text).toContain(`Sitemap: ${SITE_URL}/sitemap-index.xml`);
});

test('sitemap lists pages, not noindex pages', async ({ request }) => {
  const index = await (await request.get('/sitemap-index.xml')).text();
  expect(index).toContain('/sitemap-0.xml');
  const xml = await (await request.get('/sitemap-0.xml')).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length, 'the home page and the static pages at least').toBeGreaterThanOrEqual(4);
  for (const loc of locs) {
    expect(loc.startsWith(`${SITE_URL}/`), loc).toBe(true);
    expect(loc).toMatch(/\/$/);
    expect(loc).not.toMatch(/styleguide|404|search/);
  }
  expect(new Set(locs).size, 'no duplicates').toBe(locs.length);
});

// A page that says noindex (an archive or /tags/ with nothing to list) must not be in the sitemap.
test('sitemap lists no page that is noindex', async ({ request }) => {
  const xml = await (await request.get('/sitemap-0.xml')).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const path of paths) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
  }
});
