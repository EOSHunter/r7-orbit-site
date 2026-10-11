// Whether this build draws the waitlist forms, from the site settings and the build (src/lib/waitlist.ts has the rule). Build
// time only: it reads process.env, so only pages and components import it.
//
// WAITLIST_PREVIEW=1 forces the forms on with Cloudflare's test key, for the tests and Lighthouse runs. It must never reach a
// production build: on Cloudflare Pages (CF_PAGES=1) it stops the build instead.
import { site } from '../data/site';
import { WAITLIST_KEY_MISSING, waitlistKeyMissing, waitlistState, type WaitlistState } from './waitlist';

const preview = process.env.WAITLIST_PREVIEW === '1';
if (preview && process.env.CF_PAGES === '1') {
  throw new Error(
    'WAITLIST_PREVIEW=1 is set in the Cloudflare Pages build. It puts the waitlist on every page with a test key that accepts anyone: it is for local tests only. Remove the variable from the Pages project (Settings > Variables and Secrets) and turn the waitlist on in /admin, Site settings > Waitlist.',
  );
}

export const waitlist: WaitlistState = waitlistState(site.waitlist, { dev: import.meta.env.DEV, preview });

// "Enabled" with no site key builds a site with no form: say so in the build log (the editor no longer saves it, but the file may
// already hold it, or be edited by hand).
if (!preview && waitlistKeyMissing(site.waitlist)) console.warn(`[waitlist] ${WAITLIST_KEY_MISSING}`);
