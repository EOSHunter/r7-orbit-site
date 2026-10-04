// The single list of routes every quality check runs against (Playwright smoke + axe + budgets, Lighthouse CI).
// Other tasks extend it: add one entry per page type as the page lands.
//
//   path     URL path with trailing slash
//   noindex  page is deliberately noindex (skips the Lighthouse SEO category; robots meta is expected)
//   status   expected HTTP status (default 200; the 404 page uses 404)
//
// To try a route without editing this file: EXTRA_ROUTES="/some/path/,/other/" npm test

/** @typedef {{ path: string, noindex?: boolean, status?: number }} Route */

/** @type {Route[]} */
const routes = [{ path: '/' }, { path: '/styleguide/', noindex: true }];

const extra = (process.env.EXTRA_ROUTES ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean)
  .map((path) => ({ path }));

export default [...routes, ...extra];
