// The "Pages" collection of /admin: today only the About page (src/content/pages/about.md). Its fields mirror the `pages`
// schema in src/content.config.ts and the block schemas in src/lib/page-sections.ts, and pages.vitest.ts reads those to keep
// the two in step: change the names together. Kept in its own file, away from config.ts, which holds the post collections.
//
// The page is a list of typed blocks the author adds, removes and drags into order. Decap's `list` widget with `types` writes
// each block as `- type: <name>` followed by its fields, which is the shape the schema reads.
import type { CmsCollection, CmsField } from 'decap-cms-core';
import site from '../data/site.json';
import { seoTitleMax } from '../lib/seo';

const field = (f: Record<string, unknown>) => f as unknown as CmsField;

// The same rules as the checks in src/lib/page-sections.ts (LINK_PATTERN), as [regex, message] pairs for Decap's `pattern`.
const LINK_PATTERN: [string, string] = [
  '^(https://\\S+|/(?!/)\\S*)$',
  'A full address starting with https://, or a page on this site starting with a single /, e.g. /subscribe/',
];
const SEO_TITLE_MAX = seoTitleMax(site.name);

const linkField = (name: string, label: string, hint: string) =>
  field({ name, label, widget: 'string', pattern: LINK_PATTERN, hint });

/** An image, its alt text and the "decorative" switch: the build stops on a picture with neither alt text nor the switch. */
const pictureFields = (what: string): CmsField[] => [
  field({
    name: 'image',
    label: 'Image',
    widget: 'image',
    choose_url: false,
    hint: `${what} Your own image, not stock. Choose a file or upload one.`,
  }),
  field({
    name: 'alt',
    label: 'Alt text',
    widget: 'string',
    required: false,
    default: '',
    hint: 'Needed unless the image is decorative (the preview warns you, and the build stops without it). Describe the image in one plain sentence, for someone who cannot see it.',
  }),
  field({
    name: 'decorative',
    label: 'Decorative image',
    widget: 'boolean',
    required: false,
    default: false,
    hint: 'Turn on only if the picture is purely ornamental and says nothing. Then alt text is left empty.',
  }),
];

const MARKDOWN_BUTTONS = ['bold', 'italic', 'code', 'link', 'bulleted-list', 'numbered-list'];

const markdownText = (hint: string) =>
  field({
    name: 'text',
    label: 'Text',
    widget: 'markdown',
    modes: ['rich_text', 'raw'],
    buttons: MARKDOWN_BUTTONS,
    editor_components: [],
    hint,
  });

const sectionTypes = [
  {
    name: 'heading',
    label: 'Heading',
    widget: 'object',
    summary: 'Heading: {{fields.text}}',
    fields: [
      field({ name: 'text', label: 'Heading text', widget: 'string', hint: 'Sentence case, e.g. "How I work".' }),
      field({
        name: 'level',
        label: 'Size',
        widget: 'select',
        options: [
          { label: 'Section heading (larger)', value: 2 },
          { label: 'Sub-heading (smaller)', value: 3 },
        ],
        default: 2,
        hint: 'A heading directly above a "Portrait and text" block sits beside the picture.',
      }),
    ],
  },
  {
    name: 'text',
    label: 'Text',
    widget: 'object',
    summary: "Text: {{fields.text | truncate(48, '…')}}",
    fields: [
      markdownText(
        'Paragraphs, **bold**, *italic*, links and lists. Leave a blank line between paragraphs. Use a Heading block for headings.',
      ),
    ],
  },
  {
    name: 'image',
    label: 'Image',
    widget: 'object',
    summary: 'Image: {{fields.alt}}',
    fields: [
      ...pictureFields('A picture on its own.'),
      field({ name: 'caption', label: 'Caption', widget: 'string', required: false, hint: 'Optional. A line under the picture.' }),
      field({
        name: 'width',
        label: 'Width',
        widget: 'select',
        options: [
          { label: 'Narrow: the width of the text', value: 'narrow' },
          { label: 'Wide: the width of the page', value: 'wide' },
          { label: 'Full: edge to edge of the window', value: 'full' },
        ],
        default: 'narrow',
        hint: 'Narrow sits in line with the text. Wide and Full break out of it and start a new row.',
      }),
    ],
  },
  {
    name: 'portrait',
    label: 'Portrait and text',
    widget: 'object',
    summary: 'Portrait: {{fields.text | truncate(48, \'…\')}}',
    fields: [
      ...pictureFields('A portrait or other upright picture, shown beside the text (above it on a phone).'),
      field({
        name: 'side',
        label: 'Picture on the',
        widget: 'select',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
        default: 'left',
      }),
      markdownText(
        'Shown beside the picture. The blocks after this one (headings, text and so on) stay beside it too, until a Divider, a Wide or Full image, or another Portrait ends the row.',
      ),
    ],
  },
  {
    name: 'quote',
    label: 'Quote',
    widget: 'object',
    summary: "Quote: {{fields.text | truncate(48, '…')}}",
    fields: [
      field({ name: 'text', label: 'Quote', widget: 'text', hint: 'What was said. Markdown is fine.' }),
      field({ name: 'attribution', label: 'Who said it', widget: 'string', required: false }),
    ],
  },
  {
    name: 'callout',
    label: 'Callout',
    widget: 'object',
    summary: 'Callout: {{fields.title}} {{fields.text | truncate(40, \'…\')}}',
    fields: [
      field({
        name: 'kind',
        label: 'Kind',
        widget: 'select',
        options: [
          { label: 'Note', value: 'info' },
          { label: 'Tip (brass)', value: 'tip' },
          { label: 'Warning', value: 'warn' },
        ],
        default: 'info',
      }),
      field({
        name: 'title',
        label: 'Title',
        widget: 'string',
        required: false,
        hint: 'Optional. Without one the box is labelled Note, Tip or Warning.',
      }),
      field({ name: 'text', label: 'Text', widget: 'text', hint: 'Markdown is fine.' }),
    ],
  },
  {
    name: 'links',
    label: 'Links list',
    widget: 'object',
    summary: 'Links list',
    fields: [
      field({
        name: 'items',
        label: 'Links',
        widget: 'list',
        summary: '{{fields.label}}',
        min: 1,
        max: 20,
        hint: 'One row per link, in order.',
        fields: [
          field({ name: 'label', label: 'Label', widget: 'string', hint: 'What the link says, e.g. "My YouTube channel".' }),
          linkField('url', 'Address', 'https://… for another site, or /subscribe/ for a page on this site.'),
          field({
            name: 'note',
            label: 'Note',
            widget: 'string',
            required: false,
            hint: 'Optional. A few words shown at the end of the row, e.g. "video".',
          }),
        ],
      }),
    ],
  },
  {
    name: 'button',
    label: 'Button',
    widget: 'object',
    summary: 'Button: {{fields.label}}',
    fields: [
      field({ name: 'label', label: 'Button text', widget: 'string', hint: 'Short, e.g. "Subscribe".' }),
      linkField('url', 'Address', 'https://… for another site, or /subscribe/ for a page on this site.'),
    ],
  },
  {
    name: 'divider',
    label: 'Divider',
    widget: 'object',
    summary: 'Divider',
    fields: [
      field({
        name: 'style',
        label: 'Style',
        widget: 'select',
        options: [
          { label: 'Hairline', value: 'rule' },
          { label: 'Three dots', value: 'dots' },
        ],
        default: 'rule',
        hint: 'A break between parts of the page.',
      }),
    ],
  },
];

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
  field({
    name: 'sections',
    label: 'Page sections',
    widget: 'list',
    required: false,
    default: [],
    typeKey: 'type',
    label_singular: 'section',
    max: 60,
    // Each block starts as one line (its summary), so the whole page can be seen and dragged into order at a glance.
    collapsed: true,
    hint: 'The page, top to bottom. Use "Add section" to choose a block. Drag a block by its handle to move it, open it with the arrow to edit it, and use the cross to remove it. Check the preview on the right.',
    types: sectionTypes,
  }),
];

export const pagesCollection = {
  name: 'pages',
  label: 'Pages',
  label_singular: 'Page',
  description: 'Pages made of blocks you can add, remove and re-order. Today that is the About page.',
  delete: false,
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
  ],
} as unknown as CmsCollection;

export const pageCollections: CmsCollection[] = [pagesCollection];
