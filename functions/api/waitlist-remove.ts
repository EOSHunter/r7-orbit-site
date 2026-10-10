// POST /api/waitlist-remove: a Cloudflare Pages Function, the form on /waitlist/remove/. Everything it does is leaveWaitlist in
// src/lib/waitlist-api.ts; setup is docs/DEPLOY_CLOUDFLARE.md section 10.
import site from '../../src/data/site.json';
import { leaveWaitlist, type WaitlistEnv } from '../../src/lib/waitlist-api';

export const onRequest = (context: { request: Request; env: WaitlistEnv }): Promise<Response> =>
  leaveWaitlist({ request: context.request, env: context.env, siteUrl: site.url, enabled: site.waitlist.enabled });
