// The single list of routes every quality check runs against (Playwright smoke + axe + budgets, Lighthouse CI).
// Other tasks extend it: add one entry per page type as the page lands.
//
//   path     URL path with trailing slash
//   noindex  page is deliberately noindex (skips the Lighthouse SEO category; robots meta is expected)
//   status   expected HTTP status (default 200; the 404 page uses 404)
//   lighthouse  URL Lighthouse audits instead of path (it refuses non-200 pages; preview serves /404.html with 200)
//
// To try a route without editing this file: EXTRA_ROUTES="/some/path/,/other/" npm test

/** @typedef {{ path: string, noindex?: boolean, status?: number, lighthouse?: string }} Route */

/** @type {Route[]} */
const routes = [
  { path: '/' },
  { path: '/latest/' },
  { path: '/news/' },
  { path: '/news/2026-10-03-open-weights-model-lands/' },
  { path: '/blog/' },
  { path: '/blog/why-every-agent-gets-its-own-room/' },
  { path: '/blog/a-featured-image-on-a-post/' }, // .md with a featured image
  { path: '/blog/an-article-built-from-components/' }, // .mdx with a featured image and every article block
  { path: '/vlogs/' },
  { path: '/vlogs/i-built-a-game-with-a-team-of-ai-agents/' },
  { path: '/projects/' },
  { path: '/projects/r7-orbit/' },
  { path: '/repos/' },
  { path: '/repos/example-repo/' },
  { path: '/tags/' },
  { path: '/tags/ai-agents/' },
  { path: '/about/' },
  { path: '/subscribe/' },
  { path: '/privacy/' },
  // Any unknown path: `astro preview` serves dist/404.html with HTTP 404.
  { path: '/no-such-page/', status: 404, noindex: true, lighthouse: '/404.html' },
  { path: '/styleguide/', noindex: true },
  { path: '/styleguide/specimen/', noindex: true },
  { path: '/styleguide/article-components/', noindex: true },
  { path: '/styleguide/playable/', noindex: true }, // fixture for tests/playable.spec.js: a playable project with a fake play URL
];

const extra = (process.env.EXTRA_ROUTES ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((path) => ({ path }));

export default [...routes, ...extra];
