// The single list of routes every quality check runs against (Playwright smoke + axe + budgets, Lighthouse CI).
// Other tasks extend it: add one entry per page type as the page lands.
//
//   path     URL path with trailing slash
//   noindex  page is deliberately noindex (skips the Lighthouse SEO category; robots meta is expected)
//   status   expected HTTP status (default 200; the 404 page uses 404)
//   lighthouse  URL Lighthouse audits instead of path (it refuses non-200 pages; preview serves /404.html with 200)
//
// To try a route without editing this file: EXTRA_ROUTES="/some/path/,/other/" npm test

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {{ path: string, noindex?: boolean, status?: number, lighthouse?: string }} Route */

// Posts are not listed here: the site's content is whatever the author has published (and may be empty of a kind, or of
// everything), so the post and tag pages are found in dist/ after the build. The archives, /latest/ and /tags/ always exist,
// with their empty states when there is nothing to list.
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const KINDS = ['news', 'blog', 'vlogs', 'projects', 'repos'];
const PER_GROUP = 2; // pages checked per kind (and per tag group), newest slugs first

/** Directory names under dist/<dir>/ that hold an index.html (a post or tag page; `page/` only holds numbered pages). */
function pagesIn(dir) {
  const base = join(dist, dir);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(base, e.name, 'index.html')))
    .map((e) => e.name)
    .sort()
    .reverse();
}

/** Numbered archive pages (`/blog/page/2/`) exist once an archive has more than a page of posts: check the first of each. */
const secondPages = ['latest', ...KINDS].filter((dir) => existsSync(join(dist, dir, 'page', '2', 'index.html')));

/** The post pages checked, per kind: `/blog/some-post/`. Empty when nothing is published. */
const postPaths = (kind) => pagesIn(kind).slice(0, PER_GROUP).map((slug) => `/${kind}/${slug}/`);

/** Blog posts and news items: the pages built from ArticlePage (hero, table of contents, share row, prev/next). */
export const articlePaths = [...postPaths('blog'), ...postPaths('news')];

/** The articles with a featured image (an `.article-hero` behind the headline). */
export const heroPaths = articlePaths.filter((path) =>
  readFileSync(join(dist, path, 'index.html'), 'utf8').includes('class="article-hero"'),
);

/** @type {Route[]} */
const routes = [
  { path: '/' },
  { path: '/latest/' },
  ...KINDS.flatMap((kind) => [{ path: `/${kind}/` }, ...postPaths(kind).map((path) => ({ path }))]),
  ...secondPages.map((dir) => ({ path: `/${dir}/page/2/` })),
  { path: '/games/' }, // noindex while no game is published (empty state); the layout variants are tested on /styleguide/games/
  { path: '/tags/' },
  ...pagesIn('tags').slice(0, PER_GROUP).map((tag) => ({ path: `/tags/${tag}/` })),
  { path: '/about/' },
  { path: '/subscribe/' },
  { path: '/privacy/' },
  // Any unknown path: `astro preview` serves dist/404.html with HTTP 404.
  { path: '/no-such-page/', status: 404, noindex: true, lighthouse: '/404.html' },
  { path: '/styleguide/', noindex: true },
  { path: '/styleguide/specimen/', noindex: true },
  { path: '/styleguide/article-components/', noindex: true },
  { path: '/styleguide/games/', noindex: true }, // fixture for tests/games.spec.js: the games hub with 0, 1, 2 and 5 games
  { path: '/styleguide/playable/', noindex: true }, // fixture for tests/playable.spec.js: a playable project with a fake play URL
];

const extra = (process.env.EXTRA_ROUTES ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((path) => ({ path }));

export default [...routes, ...extra];
