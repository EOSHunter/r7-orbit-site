// The site settings (src/data/site.json): their schema, and the rules a schema cannot hold. Pure (no Astro, no file system), so it
// runs in the build, in the /admin bundle and under Vitest. src/data/site.ts parses the file with `siteSchema` when it is first
// imported, so a bad edit in /admin fails the build with a message that names the field. Whether a link goes to a page that
// exists needs the list of pages, which only the build has: that is `siteLinkProblems` (called by src/lib/site-routes.ts).
//
// The admin form for these settings is src/admin/settings.ts; settings.vitest.ts keeps the two in step.
import { z } from 'astro/zod';
import { ICON_NAMES } from '../components/icons';
import { NEWSLETTER_PATH, newsletterSchema, newsletterState, type NewsletterSettings } from './newsletter';
import { isTestSiteKey, SITE_KEY_PATTERN } from './waitlist';

/** The profile links, in the order the admin shows them. Empty means "I have none": no icon, no link, no JSON-LD `sameAs`. */
export const SOCIAL_KEYS = ['github', 'youtube'] as const;

export const HTTPS_PATTERN = /^https:\/\/[^\s/]+\.[^\s]+$/;
/** A page or file of this site: starts with one "/", no spaces, e.g. /blog/, /#latest. */
export const SITE_PATH_PATTERN = /^\/(?!\/)\S*$/;

const httpsUrl = z.string().regex(HTTPS_PATTERN, 'use a full address that starts with https://');
/** Empty, or an https address. */
const optionalHttps = z.union([z.literal(''), httpsUrl], {
  error: 'leave it empty, or use a full address that starts with https://',
});
const sitePath = z
  .string()
  .regex(SITE_PATH_PATTERN, 'use a path on this site that starts with /, e.g. /og-default.png');
/** Where a nav or footer link goes: a page of this site (/blog/) or another site (https://…). */
const linkHref = z.union([sitePath, httpsUrl], {
  error: 'use a page of this site that starts with / (e.g. /blog/), or a full address that starts with https://',
});
/** An optional field the editor may save as "" or null once it has been touched and cleared: read both as absent. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());
const label = z.string().trim().min(1, 'is required').max(30, 'is too long: 30 characters at most');
const icon = z.enum(ICON_NAMES, { error: `use one of the site's icons: ${ICON_NAMES.join(', ')}` });

/** One line of the waitlist's words: required, plain text. */
const words = (max: number) =>
  z.string().trim().min(1, 'is required').max(max, `is too long: ${max} characters at most`);

/**
 * The waitlist for R7 Orbit (src/lib/waitlist.ts, docs/CONTENT_MODEL.md "Site settings"). Off by default: while `enabled` is off or
 * the site key is empty, no form is drawn anywhere and nothing loads. The secret key is never here: it is a Cloudflare secret.
 */
export const waitlistSchema = z
  .object({
    enabled: z.boolean().default(false),
    turnstileSiteKey: z
      .string()
      .trim()
      .refine((key) => key === '' || SITE_KEY_PATTERN.test(key), {
        message: 'leave it empty, or paste the site key Cloudflare shows for the Turnstile widget (it starts with 0x)',
      })
      .refine((key) => !isTestSiteKey(key), {
        message:
          "this is one of Cloudflare's test keys: paste the site key of your own Turnstile widget (it starts with 0x)",
      }),
    heading: words(80),
    text: words(300),
    buttonLabel: words(40),
    emailLabel: words(40),
    successMessage: words(200),
    errorMessage: words(200),
    removeLinkLabel: words(40),
    removeHeading: words(80),
    removeButtonLabel: words(40),
    removeSuccessMessage: words(200),
    noscriptMessage: words(200),
  })
  .strict();

const navItem = z
  .object({
    label,
    href: linkHref,
    /** Also listed in the footer, before the footer links, with `icon`. */
    footer: optional(z.boolean()),
    icon: optional(icon),
  })
  .strict();

const footerLink = z
  .object({
    label,
    icon,
    /** A page of this site or another site. Leave empty when `social` is set. */
    href: optional(linkHref),
    /** Use one of the profile links instead of an address: it is left out while that link is empty. */
    social: optional(z.enum(SOCIAL_KEYS)),
  })
  .strict();

export const siteSchema = z
  .object({
    name: z.string().trim().min(1).max(30, 'is too long: 30 characters at most (it is added to every browser title)'),
    tagline: z.string().trim().min(1).max(90),
    description: z.string().trim().min(1).max(180),
    /** Not in the admin: the canonical address of every page (docs/DEPLOY_CLOUDFLARE.md). */
    url: httpsUrl,
    defaultOgImage: sitePath,
    defaultOgImageAlt: z.string().trim().min(1),
    author: z
      .object({
        name: z.string().trim().min(1),
        bio: z.string().trim().min(1),
        photo: z.union([z.literal(''), sitePath]),
      })
      .strict(),
    links: z.object({ github: optionalHttps, youtube: optionalHttps }).strict(),
    nav: z.array(navItem).min(1, 'needs at least one link'),
    footer: z
      .object({
        /** The line under the mark in the footer. Empty: the site description. */
        text: z.string().trim().max(180, 'is too long: 180 characters at most').default(''),
        links: z.array(footerLink),
        note: z.string().trim(),
      })
      .strict(),
    waitlist: waitlistSchema,
    newsletter: newsletterSchema,
  })
  .strict()
  .superRefine((site, ctx) => {
    for (const issue of siteLinkIssues(site)) ctx.addIssue({ code: 'custom', ...issue });
  });

export type SiteSettings = z.infer<typeof siteSchema>;

export interface SiteLinkIssue {
  path: (string | number)[];
  message: string;
}

/**
 * The rules about the nav and footer links that span more than one field, so no field's own pattern can check them. The build
 * stops on any of them (`siteSchema`), and the Site settings editor runs this same function when Save is pressed
 * (siteLinksError in src/admin/settings.ts), so a save cannot write a file that fails to deploy (one did on 2026-10-21: two
 * footer links to the same address).
 */
export function siteLinkIssues(site: Pick<SiteSettings, 'nav' | 'footer' | 'links'>): SiteLinkIssue[] {
  const issues: SiteLinkIssue[] = [];
  for (const [index, item] of site.nav.entries()) {
    if (item.footer && !item.icon) {
      issues.push({ path: ['nav', index, 'icon'], message: `"${item.label}" is shown in the footer, so it needs an icon` });
    }
  }
  for (const [index, link] of site.footer.links.entries()) {
    if (Boolean(link.href) === Boolean(link.social)) {
      issues.push({
        path: ['footer', 'links', index],
        message: `"${link.label}" needs either an address or a profile link, not ${link.href ? 'both' : 'neither'}`,
      });
    }
  }
  const dupes = (hrefs: string[]) => [...new Set(hrefs.filter((h, i) => hrefs.indexOf(h) !== i))];
  for (const href of dupes(site.nav.map((i) => i.href))) {
    issues.push({ path: ['nav'], message: `two nav links go to ${href}: each page is in the nav once` });
  }
  for (const href of dupes(footerLinks(site).map((l) => l.href))) {
    issues.push({ path: ['footer', 'links'], message: `two footer links go to ${href}: each address is in the footer once` });
  }
  return issues;
}
export type NavItem = SiteSettings['nav'][number];

/** Reads site.json, or throws one message listing every problem with the field it is in. */
export function parseSite(data: unknown, file = 'src/data/site.json'): SiteSettings {
  const result = siteSchema.safeParse(data);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.') || '(file)'}: ${issue.message}`);
  throw new Error(
    `${file} (Site settings in /admin) has ${problems.length === 1 ? 'a problem' : 'problems'}:\n${problems.join('\n')}`,
  );
}

export interface FooterLink {
  label: string;
  href: string;
  icon: (typeof ICON_NAMES)[number];
  /** Another site: gets rel="noopener". */
  external: boolean;
}

/** The settings the footer's links are drawn from. `newsletter` is optional so callers that only check links can leave it out. */
type FooterSource = Pick<SiteSettings, 'nav' | 'footer' | 'links'> & { newsletter?: Pick<NewsletterSettings, 'enabled' | 'username'> };

/**
 * The footer's Follow links in order: Newsletter (while the newsletter is on), the nav items marked "show in footer", then the
 * footer links. A link to a profile that is empty is left out, so an empty setting never shows an icon that goes nowhere.
 */
export function footerLinks(site: FooterSource): FooterLink[] {
  const rows = [
    ...(newsletterState(site.newsletter).show ? [{ label: 'Newsletter', href: NEWSLETTER_PATH, icon: 'mail' as const }] : []),
    ...site.nav
      .filter((item) => item.footer)
      .map((item) => ({ label: item.label, href: item.href, icon: item.icon ?? 'link' })),
    ...site.footer.links.map((link) => ({
      label: link.label,
      href: (link.social ? site.links[link.social] : link.href) ?? '',
      icon: link.icon,
    })),
  ];
  return rows.filter((row) => row.href.trim()).map((row) => ({ ...row, external: row.href.startsWith('https://') }));
}

/** The archives of posts, in the order the footer's Read column lists them when the nav has them. */
export const READ_HREFS = ['/latest/', '/news/', '/blog/', '/vlogs/', '/projects/', '/repos/'];

export interface FooterColumns {
  /** Where the posts are: Latest, then the nav's archives (News is always there). */
  read: { label: string; href: string }[];
  /** The rest of the site: the nav's other pages, Apps, the agents on About, and Search. */
  site: { label: string; href: string }[];
}

/**
 * The footer's two page columns, from the nav (Site settings), so renaming or reordering a nav link changes the footer too.
 * Read: Latest, then the nav items that are archives, in nav order, with News added after Latest when the nav leaves it out.
 * Site: every other nav item of this site, Apps (the header reaches it through its Play button) before About, "The agents"
 * after About (the team on the About page), and Search last.
 * A nav item marked "Also in the footer" is in the Follow column (footerLinks) instead, so no link is in the footer twice.
 */
export function footerColumns(nav: Pick<NavItem, 'label' | 'href' | 'footer'>[]): FooterColumns {
  const own = nav.filter((item) => item.href.startsWith('/') && !item.footer);
  const inNav = (href: string) => nav.some((item) => item.href === href);
  const archives = own.filter((item) => READ_HREFS.includes(item.href));
  const read = [
    { label: 'Latest', href: '/latest/' },
    ...(inNav('/news/') ? [] : [{ label: 'News', href: '/news/' }]),
    ...archives.filter((item) => item.href !== '/latest/'),
  ].map(({ label, href }) => ({ label, href }));
  const pages = own.filter((item) => !READ_HREFS.includes(item.href)).map(({ label, href }) => ({ label, href }));
  const about = pages.findIndex((item) => item.href === '/about/');
  if (!inNav('/apps/')) pages.splice(about < 0 ? pages.length : about, 0, { label: 'Apps', href: '/apps/' });
  const aboutNow = pages.findIndex((item) => item.href === '/about/');
  if (aboutNow >= 0) pages.splice(aboutNow + 1, 0, { label: 'The agents', href: '/about/#the-agents' });
  if (!inNav('/search/')) pages.push({ label: 'Search', href: '/search/' });
  return { read, site: pages };
}

/**
 * Whether a nav item is the section the page is in. Pages say which section they belong to by its address (`current="/blog/"`),
 * never by its label, so renaming "Blog" in /admin keeps the highlight.
 */
export function isCurrent(item: Pick<NavItem, 'href'>, current: string | undefined): boolean {
  return current !== undefined && item.href === current;
}

/** The archives the search page offers when JavaScript is off: these addresses, labelled as the nav labels them, in nav order. */
export const SEARCH_KIND_HREFS = ['/news/', '/blog/', '/vlogs/', '/projects/', '/repos/'];

export function searchKinds(nav: NavItem[]): NavItem[] {
  return nav.filter((item) => SEARCH_KIND_HREFS.includes(item.href));
}

// ---- Links to pages that do not exist -----------------------------------------------------------------------------------

/** The site's routes as patterns, from file names under src/pages (`blog/[slug].astro` -> /blog/<anything>/). */
export function routePatterns(pageFiles: string[]): RegExp[] {
  return pageFiles.map((file) => {
    const parts = file
      .replace(/\\/g, '/')
      .replace(/\.(astro|md|mdx|ts|js|mjs)$/, '')
      .split('/')
      .filter((part) => part !== 'index');
    const endpoint = parts.length > 0 && parts.at(-1)!.includes('.');
    const source = parts
      .map((part) =>
        part.startsWith('[...') ? '.*' : part.startsWith('[') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('/');
    const path = source ? `/${source}${endpoint ? '' : '/'}` : '/';
    return new RegExp(`^${path.replace(/\/\.\*\/$/, '/.*')}$`);
  });
}

export interface SiteFiles {
  /** Files under src/pages, relative to it, e.g. `blog/[slug].astro`. */
  pages: string[];
  /** Files under public, as served, e.g. `/og-default.png`. */
  publicFiles: string[];
}

/** Links and pictures in the settings that go to a page or file this site does not have. Empty when all is well. */
export function siteLinkProblems(site: SiteSettings, files: SiteFiles): string[] {
  const routes = routePatterns(files.pages);
  const published = new Set(files.publicFiles);
  const exists = (href: string) => {
    const path = href.replace(/[?#].*$/, '') || '/';
    return published.has(path) || routes.some((route) => route.test(path));
  };
  const problems: string[] = [];
  const check = (where: string, href: string | undefined) => {
    if (href && href.startsWith('/') && !exists(href))
      problems.push(`${where}: ${href} is not a page or file of this site`);
  };
  site.nav.forEach((item, i) => check(`nav.${i} ("${item.label}")`, item.href));
  site.footer.links.forEach((link, i) => check(`footer.links.${i} ("${link.label}")`, link.href));
  check('defaultOgImage', site.defaultOgImage);
  check('author.photo', site.author.photo);
  return problems;
}
