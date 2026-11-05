// The home page, the archives (/latest/ and one per kind), the Apps hub and the tag index as entries of the `pages` collection
// (src/content/pages/<id>.md, edited in /admin, "Pages"; docs/CONTENT_MODEL.md "Pages"). Pure, no Astro: read by
// src/content.config.ts (the fields), the pages (via site-pages-queries.ts), the admin (src/admin/site-pages.ts) and Vitest.
//
// Each page holds its own words. What is made from the posts stays in code: the listing, its filters, pagination and counts, the
// apps grid, the tag chips. The home page is a hero (fields) and a list of blocks (`sections`, the shared library, docs/SECTIONS.md);
// a listing page is a page head (fields), optional blocks above and below the listing (`introSections`, `outroSections`) and the
// words of its empty state.
import { z } from 'astro/zod';
import { sectionsSchema } from './sections';

/** Where a hero button may point: another site (https), a page of this site (/…), or a part of the home page (#latest). */
export const BUTTON_PATTERN = /^(https:\/\/\S+|\/(?!\/)\S*|#[A-Za-z][\w-]*)$/;
export const BUTTON_MESSAGE = 'use a full https:// address, a page on this site that starts with a single / (e.g. /about/), or # and the name of a part of the page (e.g. #latest)';

/** The page fields beyond the ones every page has (title, seoTitle, description, sections). All optional here: which page needs
 *  which is `SITE_PAGES` below, checked by `pageProblems` when the page is built. An optional box left empty arrives as ''. */
export const sitePageFields = {
  /** Home hero: the small line over the headline. */
  eyebrow: z.string().max(80, 'eyebrow is too long: at most 80 characters').optional(),
  /** The paragraph under the headline (home hero, and every listing page). */
  lead: z.string().max(300, 'lead is too long: at most 300 characters').optional(),
  /** Home hero: up to two buttons, the first solid. */
  buttons: z
    .array(
      z
        .object({
          label: z.string().min(1, 'a button needs its text').max(40, 'a button\'s text is at most 40 characters'),
          url: z.string().regex(BUTTON_PATTERN, `a button's address: ${BUTTON_MESSAGE}`),
        })
        .strict(),
    )
    .max(2, 'the hero holds two buttons at most')
    .optional(),
  /** Home hero: the waitlist form under the lead and buttons. Drawn only while the waitlist is on in the site settings
   *  (src/lib/waitlist.ts); its words are the settings' too. */
  waitlist: z.boolean().optional(),
  /** Home hero: a moving background behind it (src/scripts/hero-fx.ts). `galaxy`: a slow starfield in ivory and brass;
   *  `none` or left out: the dot grid alone. */
  background: z.enum(['galaxy', 'none']).optional(),
  /** Listing pages: blocks above the listing, and below it. */
  introSections: sectionsSchema,
  outroSections: sectionsSchema,
  /** Listing pages: what is said when there is nothing to list. */
  emptyHeading: z.string().max(100, 'emptyHeading is too long: at most 100 characters').optional(),
  emptyText: z.string().max(300, 'emptyText is too long: at most 300 characters').optional(),
  /** Apps hub: the empty state's button (to /projects/), and the card shown beside a single app. */
  emptyLinkLabel: z.string().max(40, 'emptyLinkLabel is too long: at most 40 characters').optional(),
  soonEyebrow: z.string().max(40, 'soonEyebrow is too long: at most 40 characters').optional(),
  soonTitle: z.string().max(80, 'soonTitle is too long: at most 80 characters').optional(),
  soonText: z.string().max(300, 'soonText is too long: at most 300 characters').optional(),
};

export type SitePageField = keyof typeof sitePageFields | 'title' | 'seoTitle' | 'description' | 'sections';

/** The shapes a page can have. Each says which fields it needs and which it draws (a field it does not draw is an error, not
 *  silently ignored: the same reason the schema is strict). */
export type PageShape = 'home' | 'listing' | 'apps';

const SHAPES: Record<PageShape, { required: SitePageField[]; optional: SitePageField[] }> = {
  home: { required: ['title', 'description'], optional: ['eyebrow', 'lead', 'buttons', 'waitlist', 'background', 'sections'] },
  listing: { required: ['title', 'description', 'lead', 'emptyHeading', 'emptyText'], optional: ['seoTitle', 'introSections', 'outroSections'] },
  apps: {
    required: ['title', 'description', 'lead', 'emptyHeading', 'emptyText', 'emptyLinkLabel', 'soonEyebrow', 'soonTitle', 'soonText'],
    optional: ['seoTitle', 'introSections', 'outroSections'],
  },
};

/** What a field is, in the words a build error uses. */
const WHAT: Record<SitePageField, string> = {
  title: 'the page heading',
  seoTitle: 'the browser title',
  description: 'the description for search results',
  sections: 'the page sections',
  eyebrow: 'the small line over the headline',
  lead: 'the paragraph under the heading',
  buttons: 'the hero buttons',
  waitlist: 'the waitlist form in the hero',
  background: 'the moving background behind the hero',
  introSections: 'the sections above the list',
  outroSections: 'the sections below the list',
  emptyHeading: 'the heading shown when there is nothing to list',
  emptyText: 'the text shown when there is nothing to list',
  emptyLinkLabel: 'the button of the empty state',
  soonEyebrow: 'the eyebrow of the "more apps coming" card',
  soonTitle: 'the heading of the "more apps coming" card',
  soonText: 'the text of the "more apps coming" card',
};

export interface SitePage {
  /** The entry's id: the file src/content/pages/<id>.md. */
  id: string;
  /** Where the page is. */
  path: string;
  shape: PageShape;
  /** The name of the page in code: the nav label, the eyebrow over the heading, the structured data and the breadcrumb (not the
   *  author's text: it is the site's navigation, edited with it). Empty for the home page. */
  label: string;
  /** The icon beside the label in the eyebrow, if any. */
  icon?: 'news' | 'blog' | 'vlog' | 'project' | 'repo' | 'play';
  /** The name of the page in the editor's list, and the file's name there (src/admin/site-pages.ts). A file's preview template
   *  is named after it, so it must not be the name of another collection's template (`blog` is the blog post preview). */
  admin: { name: string; label: string };
}

/** Every page this module knows, in the editor's order. The About page is the block library's (src/pages/about.astro). */
export const SITE_PAGES: SitePage[] = [
  { id: 'home', path: '/', shape: 'home', label: '', admin: { name: 'home', label: 'Home page' } },
  { id: 'latest', path: '/latest/', shape: 'listing', label: 'Latest', admin: { name: 'latest', label: 'Latest (every post)' } },
  { id: 'news', path: '/news/', shape: 'listing', label: 'News', icon: 'news', admin: { name: 'news-archive', label: 'News archive' } },
  { id: 'blog', path: '/blog/', shape: 'listing', label: 'Blog', icon: 'blog', admin: { name: 'blog-archive', label: 'Blog archive' } },
  { id: 'vlogs', path: '/vlogs/', shape: 'listing', label: 'Vlogs', icon: 'vlog', admin: { name: 'vlogs-archive', label: 'Vlogs archive' } },
  { id: 'projects', path: '/projects/', shape: 'listing', label: 'Projects', icon: 'project', admin: { name: 'projects-archive', label: 'Projects archive' } },
  { id: 'repos', path: '/repos/', shape: 'listing', label: 'Repos', icon: 'repo', admin: { name: 'repos-archive', label: 'Repos archive' } },
  { id: 'apps', path: '/apps/', shape: 'apps', label: 'Apps', icon: 'play', admin: { name: 'apps', label: 'Apps page' } },
  { id: 'tags', path: '/tags/', shape: 'listing', label: 'Tags', admin: { name: 'tags', label: 'Tags page' } },
];

export const sitePage = (id: string): SitePage => {
  const page = SITE_PAGES.find((p) => p.id === id);
  if (!page) throw new Error(`There is no site page "${id}". The pages are: ${SITE_PAGES.map((p) => p.id).join(', ')}.`);
  return page;
};

/** The fields a page of this shape needs, and the ones it may have. */
export const fieldsOf = (shape: PageShape) => SHAPES[shape];

/** Filled in: not empty, not an empty list, and not a switch left off. */
const isSet = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== false && !(typeof value === 'string' && !value.trim()) && !(Array.isArray(value) && value.length === 0);

/**
 * What is wrong with a page's entry for its shape: a field it needs that is missing or empty, and a field it does not draw that is
 * filled in. Each message starts with the file. Empty when all is well.
 */
export function pageProblems(page: Pick<SitePage, 'id' | 'shape'>, data: Record<string, unknown>): string[] {
  const { required, optional } = SHAPES[page.shape];
  const file = `src/content/pages/${page.id}.md`;
  const problems: string[] = [];
  for (const field of required) {
    if (!isSet(data[field])) problems.push(`${file}: "${field}" is missing (${WHAT[field]}).`);
  }
  for (const [field, value] of Object.entries(data)) {
    if (!(field in WHAT) || required.includes(field as SitePageField) || optional.includes(field as SitePageField)) continue;
    if (isSet(value)) problems.push(`${file}: "${field}" (${WHAT[field as SitePageField]}) is not used on this page: remove it.`);
  }
  return problems;
}
