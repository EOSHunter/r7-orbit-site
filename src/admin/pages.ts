// The "Pages" collection of /admin: the About page (src/content/pages/about.md), then the home page and the listing pages (their files
// are src/admin/site-page-files.ts, kept apart), then subscribe, privacy, 404 and search. About's page fields mirror the `pages` schema in
// src/content.config.ts (pages.vitest.ts reads that to keep the two in step: change the names together). Its `sections` list is the shared
// block library, generated from the block definitions in src/lib/sections/ (sections-config.ts), so no block or block field is
// written here. Kept in its own file, away from config.ts, which holds the post collections.
import type { CmsCollection, CmsField } from 'decap-cms-core';
import site from '../data/site.json';
import { seoTitleMax } from '../lib/seo';
import { sectionsField } from './sections-config';
import { sitePageFiles } from './site-page-files';

const field = (f: Record<string, unknown>) => f as unknown as CmsField;

const SEO_TITLE_MAX = seoTitleMax(site.name);

const aboutFields: CmsField[] = [
  field({
    name: 'title',
    label: 'Page heading',
    widget: 'string',
    pattern: ['^.{1,90}$', 'Required, 90 characters at most'],
    hint: 'The big heading at the top of the page, e.g. About. Put one phrase in *asterisks* for the italic brass accent.',
  }),
  field({
    name: 'seoTitle',
    label: 'Browser title',
    widget: 'string',
    required: false,
    pattern: [`^.{1,${SEO_TITLE_MAX}}$`, `${SEO_TITLE_MAX} characters at most`],
    hint: `Optional. Shorter title for browser tabs and search results. Max ${SEO_TITLE_MAX} characters.`,
  }),
  field({
    name: 'description',
    label: 'Description for search results',
    widget: 'text',
    pattern: ['^.{1,180}$', 'Required, 180 characters at most'],
    hint: 'One or two sentences shown under the page title in search results and when the page is shared. Around 155 characters reads best. It is not shown on the page itself.',
  }),
  sectionsField(),
];

// ---- Subscribe, Privacy, 404 and Search ------------------------------------------------------------------------------------
// Pages with a fixed frame around their words (src/lib/page-copy.ts): the blocks are the words; the eyebrow, the newsletter form,
// the search box and the 404 orbit stay in code. Same four fields as About, under the same names (the one `pages` schema), with
// hints that say where each block lands on that page. Settings tokens such as {author.email} are filled from the site settings.

const TOKENS_HINT =
  'Write {site.name}, {author.email}, {links.rss} or {newsletter.provider} to print that site setting: it changes when the setting does.';

/** The page fields of a fixed-frame page: About's, with hints for this page. */
const framedPageFields = ({ title, seoTitle, sections }: { title: string; seoTitle: string; sections: string }): CmsField[] => [
  field({ ...(aboutFields[0] as object), hint: `${title} Put one phrase in *asterisks* for the italic brass accent.` }),
  field({ ...(aboutFields[1] as object), hint: `${seoTitle} Max ${SEO_TITLE_MAX} characters.` }),
  field({ ...(aboutFields[2] as object), hint: `${(aboutFields[2] as { hint: string }).hint} ${TOKENS_HINT}` }),
  sectionsField({ hint: `${sections} ${TOKENS_HINT} Check the preview on the right.` }),
];

const framedPageFiles = [
  {
    name: 'subscribe',
    label: 'Subscribe page',
    file: 'src/content/pages/subscribe.md',
    fields: framedPageFields({
      title: 'The big heading of /subscribe/.',
      seoTitle: 'The name in browser tabs and search results, e.g. Subscribe.',
      sections:
        'Where the blocks go: a Lead paragraph at the top sits under the heading. The blocks after it sit in the box beside the sign-up form, up to the "Newsletter sign-up" block, which marks where the box ends (its own heading and text are not used on this page; the form is always there). The blocks after it sit under the box, Text set as small print.',
    }),
  },
  {
    name: 'privacy',
    label: 'Privacy page',
    file: 'src/content/pages/privacy.md',
    fields: framedPageFields({
      title: 'The big heading of /privacy/.',
      seoTitle: 'The name in browser tabs and search results, e.g. Privacy.',
      sections:
        'Where the blocks go: a Lead paragraph at the top sits under the heading; the rest is the policy, one column of text. A Text block at the very end is set as small print (the "Last updated" line: change its date when you change the policy). A Text block that starts with the line {if newsletter connected} is shown only once the newsletter is connected in the site settings, and one that starts with {if newsletter not connected} only until then.',
    }),
  },
  {
    name: '404',
    label: 'Page not found (404)',
    file: 'src/content/pages/404.md',
    fields: framedPageFields({
      title: 'The big heading shown for an address that does not exist.',
      seoTitle: 'The name in the browser tab, e.g. Page not found.',
      sections:
        'Where the blocks go: a Lead paragraph sits under the heading; any other block follows it, above the search box. The orbit, the search box and the two buttons are fixed. This page is never in search results.',
    }),
  },
  {
    name: 'search',
    label: 'Search page',
    file: 'src/content/pages/search.md',
    fields: framedPageFields({
      title: 'The big heading of /search/.',
      seoTitle: 'The name in the browser tab, e.g. Search.',
      sections:
        'Shown only to readers whose browser has JavaScript turned off (search needs it), above the list of kinds. The search box itself is fixed. This page is never in search results.',
    }),
  },
].map((file) => ({ ...file, format: 'frontmatter', editor: { preview: true } }));

/** The preview template names of the fixed-frame pages (Decap names a file collection's template after the file). */
export const FRAMED_PAGES = framedPageFiles.map((f) => f.name);

// ---- The collection ------------------------------------------------------------------------------------------------------

export const pagesCollection = {
  name: 'pages',
  label: 'Pages',
  label_singular: 'Page',
  description:
    'Pages made of blocks you can add, remove and re-order: About, the home page, the words of the archives, the Games page and the Tags page, and the words of Subscribe, Privacy, the 404 page and Search.',
  delete: false,
  // Uploads for pages go to public/media/about/, written as /media/about/x.jpg (the same pair as mediaFolders('about') in
  // config.ts, which imports this file, so it is spelled out here). docs/IMAGES.md.
  media_folder: '/public/media/about',
  public_folder: '/media/about',
  files: [
    {
      name: 'about',
      label: 'About page',
      file: 'src/content/pages/about.md',
      format: 'frontmatter',
      // The preview pane draws the page with the site's own styles (src/admin/about-preview.ts, registered under this name).
      editor: { preview: true },
      fields: aboutFields,
    },
    // The home page, the archives, Latest, Games and Tags (src/admin/site-page-files.ts).
    ...sitePageFiles,
    ...framedPageFiles,
  ],
} as unknown as CmsCollection;

export const pageCollections: CmsCollection[] = [pagesCollection];
