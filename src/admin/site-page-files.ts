// The home page, the archives, Latest, the Apps page and the Tags page as files of the "Pages" collection (src/admin/pages.ts adds
// them after About). Their fields mirror `sitePageFields` and the page shapes in src/lib/site-pages.ts (site-page-files.vitest.ts
// reads both to keep them in step); their block lists are the shared library (`sectionsField`), so no block is written here.
// Each file's preview is page-previews.ts, registered in main.ts under the file's `name`.
import type { CmsField } from 'decap-cms-core';
import site from '../data/site.json';
import { seoTitleMax } from '../lib/seo';
import { BUTTON_PATTERN, SITE_PAGES, type SitePage } from '../lib/site-pages';
import { sectionsField } from './sections-config';

const field = (f: Record<string, unknown>) => f as unknown as CmsField;

const SEO_TITLE_MAX = seoTitleMax(site.name);

/** A one-line box: required (the page needs it) or not, at most `max` characters. */
const line = (name: string, label: string, max: number, hint: string, required = true) =>
  field({
    name,
    label,
    widget: 'string',
    ...(required ? {} : { required: false }),
    pattern: [`^.{1,${max}}$`, required ? `Required, ${max} characters at most` : `${max} characters at most`],
    hint,
  });

/** A box of a few lines (one paragraph, no Markdown). */
const paragraph = (name: string, label: string, max: number, hint: string, required = true) =>
  field({
    name,
    label,
    widget: 'text',
    ...(required ? {} : { required: false }),
    pattern: [`^[\\s\\S]{1,${max}}$`, required ? `Required, ${max} characters at most` : `${max} characters at most`],
    hint,
  });

const seoTitle = (example: string) =>
  line(
    'seoTitle',
    'Browser title',
    SEO_TITLE_MAX,
    `Shown in browser tabs and search results, followed by "· ${site.name}". Today "${example}". Max ${SEO_TITLE_MAX} characters. Leave it empty to use the page heading.`,
    false,
  );

const description = () =>
  paragraph(
    'description',
    'Description for search results',
    180,
    'One or two sentences shown under the page title in search results and when the page is shared. Around 155 characters reads best. It is not shown on the page itself. {site.description} prints the description from Site settings.',
  );

const homeFields: CmsField[] = [
  line('eyebrow', 'Eyebrow', 80, 'Optional. The small brass line over the headline. Today {site.tagline}: the tagline from Site settings, so it changes with it.', false),
  line(
    'title',
    'Headline',
    90,
    'The big heading of the home page (its h1). Put one phrase in *asterisks* for the italic brass accent. The browser tab of the home page reads the site name and tagline (site settings), not this.',
  ),
  paragraph('lead', 'Lead paragraph', 300, 'Optional. The sentence or two under the headline. Today {site.description}: the description from Site settings.', false),
  field({
    name: 'buttons',
    label: 'Buttons',
    label_singular: 'button',
    widget: 'list',
    required: false,
    max: 2,
    summary: '{{fields.label}}',
    hint: 'Up to two buttons under the lead. The first is solid, the second outlined.',
    fields: [
      line('label', 'Button text', 40, 'Short, e.g. "Read more".'),
      field({
        name: 'url',
        label: 'Address',
        widget: 'string',
        pattern: [BUTTON_PATTERN.source, 'Use https://…, a page of this site such as /latest/, or #latest for a part of this page'],
        hint: '#latest goes to the Latest feed below; /latest/ or https://… go to a page.',
      }),
    ],
  }),
  field({
    name: 'waitlist',
    label: 'Waitlist form',
    widget: 'boolean',
    required: false,
    default: false,
    hint: 'On: the waitlist form for R7 Orbit sits under the lead and the buttons. It only shows while the waitlist is on in Site settings > Waitlist, and its words are set there.',
  }),
  description(),
  sectionsField({
    label: 'Rows below the hero',
    hint: 'The home page under the hero, top to bottom: the pinned post, the latest feed, the rows of projects, apps and repos, or any other block. Drag a row by its handle to move it, open it with the arrow to edit it, and use the cross to remove it.',
  }),
];

/** The words of a listing page: its head, the blocks around the list, and the empty state. `extra` are the Apps page's own. */
function listingFields(page: SitePage, nothing: string, extra: CmsField[] = []): CmsField[] {
  return [
    line('title', 'Page heading', 90, 'The big heading at the top of the page. Put one phrase in *asterisks* for the italic brass accent.'),
    seoTitle(page.label),
    description(),
    paragraph('lead', 'Lead paragraph', 300, 'The sentence or two under the heading.'),
    sectionsField({
      name: 'introSections',
      label: 'Sections above the list',
      hint: `Optional blocks between the lead and the ${nothing}, e.g. a note or a pinned link. Most pages leave this empty. Every numbered page of the list repeats them.`,
    }),
    line('emptyHeading', 'When there is nothing to list: heading', 100, `Shown instead of the ${nothing} while there is none.`),
    paragraph('emptyText', 'When there is nothing to list: text', 300, 'A sentence under that heading.'),
    ...extra,
    sectionsField({
      name: 'outroSections',
      label: 'Sections below the list',
      hint: `Optional blocks after the ${nothing}. Most pages leave this empty.`,
    }),
  ];
}

const appsExtra: CmsField[] = [
  line('emptyLinkLabel', 'When there is nothing to list: button', 40, 'The button under that text. It goes to the projects.'),
  line('soonEyebrow', 'Beside a single app: eyebrow', 40, 'With exactly one app, a card beside it keeps the row from looking unfinished. This is its small line.'),
  line('soonTitle', 'Beside a single app: heading', 80, 'The heading of that card.'),
  paragraph('soonText', 'Beside a single app: text', 300, 'The sentence of that card.'),
];

/** What each listing calls the thing it lists, for the hints. */
const NOTHING: Record<string, string> = { tags: 'tags', apps: 'apps' };

function fieldsOf(page: SitePage): CmsField[] {
  if (page.shape === 'home') return homeFields;
  return listingFields(page, NOTHING[page.id] ?? 'posts', page.shape === 'apps' ? appsExtra : []);
}

/** The file entries, in the editor's order (after About). */
export const sitePageFiles = SITE_PAGES.map((page) => ({
  name: page.admin.name,
  label: page.admin.label,
  file: `src/content/pages/${page.id}.md`,
  format: 'frontmatter',
  // The preview pane draws the page with the site's own styles (src/admin/page-previews.ts, registered under this name).
  editor: { preview: true },
  fields: fieldsOf(page),
}));
