import { site } from '../data/site';
import { getAllPosts } from '../lib/content-queries';
import { xmlResponse } from '../lib/feed-queries';
import { buildUrlset, collectSitemapEntries, pagePathFromFile, sourceIsNoindex } from '../lib/sitemap';

// Static pages are read from src/pages: dynamic routes ([slug]) are covered by the posts, and any page whose source
// sets `noindex` is left out, so a new unindexed page needs no change here.
const sources = import.meta.glob('/src/pages/**/*.astro', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export async function GET() {
  const staticPaths = Object.entries(sources)
    .filter(([, source]) => !sourceIsNoindex(source))
    .map(([file]) => pagePathFromFile(file))
    .filter((path): path is string => !!path);
  const entries = collectSitemapEntries(staticPaths, await getAllPosts());
  return xmlResponse(buildUrlset(entries, site.url));
}
