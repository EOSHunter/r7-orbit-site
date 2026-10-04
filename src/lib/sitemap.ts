// Sitemap, robots.txt and the list of indexable URLs, pure. The Astro-bound endpoints are in src/pages/.
import { escapeXml } from './feed';
import { absoluteUrl, isoDate } from './text';
import { postUrl, tagsWithPages, type CollectionName, type Post } from './content';

export interface SitemapEntry {
  /** Path, e.g. `/blog/`. */
  path: string;
  lastmod?: Date;
}

/** Pages that never go in the sitemap, whatever their source says: not content, or deliberately unindexed. */
export const EXCLUDED_PATHS = ['/404/', '/search/', '/styleguide/', '/admin/'];

export function isExcluded(path: string): boolean {
  return EXCLUDED_PATHS.some((p) => path === p || path.startsWith(p));
}

/** `src/pages/about.astro` -> `/about/`; `src/pages/blog/index.astro` -> `/blog/`. Dynamic routes return undefined. */
export function pagePathFromFile(file: string): string | undefined {
  const rel = file.replace(/^.*\/src\/pages\//, '').replace(/\.astro$/, '');
  if (rel.includes('[')) return undefined;
  const path = rel === 'index' ? '' : rel.replace(/\/index$/, '');
  return path ? `/${path}/` : '/';
}

/** True when a page's source asks for noindex through BaseLayout's `noindex` prop (bare or `={true}`). */
export function sourceIsNoindex(source: string): boolean {
  return /^\s*noindex\s*$/m.test(source) || /\bnoindex\s*=\s*\{\s*true\s*\}/.test(source);
}

const KINDS: CollectionName[] = ['news', 'blog', 'vlogs', 'projects', 'repos'];

const newest = (posts: Post[]) =>
  posts.reduce<Date | undefined>((acc, p) => {
    const d = p.data.updated ?? p.data.date;
    return !acc || d > acc ? d : acc;
  }, undefined);

/**
 * Every indexable URL: the static pages found in src/pages (minus noindex ones), the archive for each kind that has
 * posts, `/tags/` and each tag with two or more posts, and every published post. `posts` must already exclude drafts
 * and future-dated posts.
 */
export function collectSitemapEntries(staticPaths: string[], posts: Post[]): SitemapEntry[] {
  const entries = new Map<string, SitemapEntry>();
  const add = (path: string, lastmod?: Date) => {
    if (isExcluded(path)) return;
    entries.set(path, { path, lastmod: lastmod ?? entries.get(path)?.lastmod });
  };

  for (const path of staticPaths) add(path);
  add('/', newest(posts));
  for (const kind of KINDS) {
    const ofKind = posts.filter((p) => p.collection === kind);
    if (ofKind.length) add(`/${kind}/`, newest(ofKind));
  }
  const tags = tagsWithPages(posts);
  if (tags.length) add('/tags/', newest(posts));
  for (const tag of tags) add(`/tags/${tag}/`, newest(posts.filter((p) => p.data.tags.includes(tag))));
  for (const post of posts) add(postUrl(post), post.data.updated ?? post.data.date);

  return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function buildUrlset(entries: SitemapEntry[], base: string): string {
  const urls = entries.map((e) => {
    const lastmod = e.lastmod ? `<lastmod>${isoDate(e.lastmod)}</lastmod>` : '';
    return `<url><loc>${escapeXml(absoluteUrl(e.path, base))}</loc>${lastmod}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export function buildSitemapIndex(sitemapPaths: string[], base: string, lastmod?: Date): string {
  const items = sitemapPaths.map((p) => {
    const mod = lastmod ? `<lastmod>${isoDate(lastmod)}</lastmod>` : '';
    return `<sitemap><loc>${escapeXml(new URL(p, base).href)}</loc>${mod}</sitemap>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</sitemapindex>\n`;
}

export function buildRobots(base: string): string {
  return `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${new URL('/sitemap-index.xml', base).href}\n`;
}
