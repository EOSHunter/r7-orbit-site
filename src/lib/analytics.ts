// Cloudflare Web Analytics: counts page views and visits without cookies or local storage (docs/DECISIONS.md, the author's
// call on 2026-11-16). BaseLayout adds the beacon only to production builds on Cloudflare Pages (the `main` branch), so local
// builds, branch previews and the test runs stay free of third-party requests and don't count as visits. Pages marked
// noindex (the styleguide) never get it, and /admin/ doesn't use BaseLayout, so the editor isn't tracked either.
//
// The token is public by design: it is the site's ID in the dashboard and appears in every page's HTML.
export const CLOUDFLARE_ANALYTICS_TOKEN = '7ca150097f6d472d8d6a31f9b92c12e0';
export const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/** The beacon's settings for this page, or undefined when this build or page must not load it. */
export function analyticsBeacon(env: Record<string, string | undefined>, noindex: boolean): string | undefined {
  if (noindex || env.CF_PAGES !== '1' || env.CF_PAGES_BRANCH !== 'main') return undefined;
  return JSON.stringify({ token: CLOUDFLARE_ANALYTICS_TOKEN });
}
