import { test, expect } from '@playwright/test';

// Feeds, robots and sitemap: reachable, well-formed enough, and consistent with each other.
const feeds = ['/rss.xml', '/news/rss.xml', '/blog/rss.xml', '/vlogs/rss.xml', '/projects/rss.xml', '/repos/rss.xml'];

for (const path of feeds) {
  test(`feed ${path}`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/xml/);
    const xml = await res.text();
    expect(xml).toMatch(/^<\?xml[^>]*\?>\s*<rss version="2\.0"/);
    expect(xml).toContain(`<atom:link href="https://example.com${path}" rel="self"`);
    expect(xml).toContain('<lastBuildDate>');
    expect(xml.match(/<item>/g)?.length ?? 0, 'at least one item').toBeGreaterThan(0);
    expect(xml.match(/<item>/g)?.length).toBe(xml.match(/<\/item>/g)?.length);
    expect(xml, 'no * title markers').not.toMatch(/<title>[^<]*\*/);
    for (const guid of xml.match(/<guid isPermaLink="true">[^<]+<\/guid>/g) ?? []) {
      expect(guid).toMatch(/https:\/\/[^<]+\/<\/guid>$/);
    }
  });
}

test('robots.txt points at the sitemap', async ({ request }) => {
  const text = await (await request.get('/robots.txt')).text();
  expect(text).toMatch(/User-agent: \*/);
  expect(text).toMatch(/Sitemap: https:\/\/[^\s]+\/sitemap-index\.xml/);
});

test('sitemap lists pages, not noindex pages', async ({ request }) => {
  const index = await (await request.get('/sitemap-index.xml')).text();
  expect(index).toContain('/sitemap-0.xml');
  const xml = await (await request.get('/sitemap-0.xml')).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBeGreaterThan(5);
  for (const loc of locs) {
    expect(loc).toMatch(/^https:\/\/[^/]+\/.*\/$|^https:\/\/[^/]+\/$/);
    expect(loc).not.toMatch(/styleguide|404|search/);
  }
  expect(new Set(locs).size, 'no duplicates').toBe(locs.length);
});
