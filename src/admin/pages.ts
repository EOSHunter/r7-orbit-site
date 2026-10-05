// The "Pages" collection of /admin: the About page (src/content/pages/about.md), then the home page and the listing pages (their files
// are src/admin/site-page-files.ts, kept apart). About's page fields mirror the `pages` schema in
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

export const pagesCollection = {
  name: 'pages',
  label: 'Pages',
  label_singular: 'Page',
  description: 'Pages made of blocks you can add, remove and re-order: the About page, the home page, and the words of the archives, the Games page and the Tags page.',
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
  ],
} as unknown as CmsCollection;

export const pageCollections: CmsCollection[] = [pagesCollection];
