// Whether this build draws the newsletter's forms, page and footer link, from the site settings (src/lib/newsletter.ts has the
// rule). Build time only: pages and components import it.
//
// NEWSLETTER_PREVIEW=1 turns it on with a sample username, for the tests and screenshots. It must never reach a production build:
// on Cloudflare Pages (CF_PAGES=1) it stops the build instead.
import { site } from '../data/site';
import {
  NEWSLETTER_USERNAME_MISSING,
  newsletterState,
  newsletterUsernameMissing,
  type NewsletterState,
} from './newsletter';

const preview = process.env.NEWSLETTER_PREVIEW === '1';
if (preview && process.env.CF_PAGES === '1') {
  throw new Error(
    'NEWSLETTER_PREVIEW=1 is set in the Cloudflare Pages build. It puts a sample newsletter form on every page: it is for local tests only. Remove the variable from the Pages project (Settings > Variables and Secrets) and turn the newsletter on in /admin, Site settings > Newsletter.',
  );
}

/** The newsletter settings this build uses: the site settings', or the sample under NEWSLETTER_PREVIEW=1. */
export const newsletterSettings = preview
  ? { ...site.newsletter, enabled: true, username: site.newsletter.username || 'sample' }
  : site.newsletter;

export const newsletter: NewsletterState = newsletterState(newsletterSettings);

if (!preview && newsletterUsernameMissing(site.newsletter)) console.warn(`[newsletter] ${NEWSLETTER_USERNAME_MISSING}`);
