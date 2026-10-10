// The waitlist for R7 Orbit (the desktop app): the rules the form, the pages and the Pages Functions share. Pure and dependency
// free (no Astro, no Zod), because functions/api/*.ts bundles it for Cloudflare as well as the site and Vitest reading it.
// What the site shows and when: docs/CONTENT_MODEL.md "Site settings" (`waitlist`); the server: src/lib/waitlist-api.ts;
// setting it up: docs/DEPLOY_CLOUDFLARE.md section 10.

/** Where a signup came from, stored with the address: the home hero, a blog or vlog post's band, or anywhere else. */
export const WAITLIST_SOURCES = ['hero', 'blog', 'vlog', 'other'] as const;
export type WaitlistSource = (typeof WAITLIST_SOURCES)[number];

export const isWaitlistSource = (value: unknown): value is WaitlistSource =>
  typeof value === 'string' && (WAITLIST_SOURCES as readonly string[]).includes(value);

/** The source a post's band sends: blog and vlog by name, every other kind as `other`. */
export function sourceForKind(kind: string): WaitlistSource {
  if (kind === 'blog') return 'blog';
  if (kind === 'vlog' || kind === 'vlogs') return 'vlog';
  return 'other';
}

/** The honeypot: a text box people never see or fill in. A request with it filled gets the normal answer and is not stored. */
export const HONEYPOT_FIELD = 'company';
/** The name Turnstile gives the token's hidden input; the endpoints also accept `turnstile`. */
export const TURNSTILE_FIELD = 'cf-turnstile-response';

/** Where the browser loads Turnstile from, on the first interaction with a form (never with the page). */
export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/**
 * Cloudflare's published Turnstile test keys (developers.cloudflare.com/turnstile/troubleshooting/testing/). The site key always
 * passes and is visible; the secret accepts any token. Used by `astro dev` and WAITLIST_PREVIEW=1 builds only: never in the settings.
 */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

/** A Turnstile site key as Cloudflare issues them: a digit, "x", then letters, digits, "_" or "-". */
export const SITE_KEY_PATTERN = /^\dx[A-Za-z0-9_-]{16,64}$/;
/** Test keys start with 1x, 2x or 3x; real ones with 0x. */
export const isTestSiteKey = (key: string) => /^[1-3]x/.test(key.trim());

export const EMAIL_MAX = 254;
const LOCAL_MAX = 64;
// Plain addresses only: letters, digits and . _ % + - before the @ (no quotes, no leading, trailing or doubled dots), then a
// domain of at least two labels with a letter TLD (or an IDN one in its xn-- form). No IP literals, no comments.
const LOCAL = /^[a-z0-9_%+-]+(?:\.[a-z0-9_%+-]+)*$/;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** The address as stored (trimmed, lowercased), or undefined when it is not one this list accepts. */
export function normaliseEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const email = value.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX) return undefined;
  const at = email.lastIndexOf('@');
  if (at < 1 || at !== email.indexOf('@')) return undefined;
  const local = email.slice(0, at);
  const labels = email.slice(at + 1).split('.');
  if (local.length > LOCAL_MAX || !LOCAL.test(local)) return undefined;
  if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) return undefined;
  if (!TLD.test(labels.at(-1)!)) return undefined;
  return email;
}

/** The `waitlist` group of the site settings, as far as these rules need it. */
export interface WaitlistSwitch {
  enabled: boolean;
  turnstileSiteKey: string;
}

export interface WaitlistBuild {
  /** `astro dev`. */
  dev: boolean;
  /** WAITLIST_PREVIEW=1 at build time (the tests and Lighthouse; never a production build). */
  preview: boolean;
}

export type WaitlistState =
  | { show: false }
  | {
      show: true;
      siteKey: string;
      /** Why a form is drawn that the live site would not show: `dev` puts a visible note beside it. */
      note?: 'dev';
    };

/**
 * Whether the forms are drawn, and with which Turnstile key. On the live site: only when the waitlist is on AND has a site key;
 * otherwise nothing is drawn and nothing loads. `astro dev` always draws them (with the test key and a note when the live site
 * would not), and a WAITLIST_PREVIEW=1 build always draws them with the test key.
 */
export function waitlistState(settings: WaitlistSwitch, build: WaitlistBuild): WaitlistState {
  const key = settings.turnstileSiteKey.trim();
  const live = settings.enabled && key !== '';
  if (build.preview) return { show: true, siteKey: TURNSTILE_TEST_SITE_KEY };
  if (build.dev)
    return live ? { show: true, siteKey: key } : { show: true, siteKey: TURNSTILE_TEST_SITE_KEY, note: 'dev' };
  return live ? { show: true, siteKey: key } : { show: false };
}

/** The address of the page where a reader takes their address off the list. Built only while the forms are shown. */
export const REMOVE_PATH = '/waitlist/remove/';
export const API_JOIN = '/api/waitlist';
export const API_REMOVE = '/api/waitlist-remove';
