// POST /api/waitlist: a Cloudflare Pages Function (Pages builds every file under functions/ into the site's Worker; the Astro
// build does not see this folder). Everything it does is joinWaitlist in src/lib/waitlist-api.ts; setup is
// docs/DEPLOY_CLOUDFLARE.md section 10. The settings are read from the commit being deployed, the same one the pages are built from.
import site from '../../src/data/site.json';
import { joinWaitlist, type WaitlistEnv } from '../../src/lib/waitlist-api';

export const onRequest = (context: { request: Request; env: WaitlistEnv }): Promise<Response> =>
  joinWaitlist({ request: context.request, env: context.env, siteUrl: site.url, enabled: site.waitlist.enabled });
