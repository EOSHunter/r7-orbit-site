// Editor blocks for the admin: one per component in src/components/article/. Each block is a Decap "editor component":
// a form in the editor, and a pair of functions that write the block into the post body as MDX (`toBlock`) and read it
// back (`pattern` + `fromBlock`). The MDX has no `import` line: `articleComponents` (src/components/article/mdx.ts) supplies the components.
//
// The props written here are the contract with the components. If a component's props change, change them here and in
// the test next to this file (blocks.vitest.ts), and nowhere else. Props are documented in docs/ARTICLE_COMPONENTS.md.
//
// Decap rules for patterns (decap-cms-widget-markdown): anchored at the start, no `m` flag, and the match must end at
// the end of the block, so each pattern stops at its closing `/>` or `</Tag>`.
import type { BlockEditorComponentOptions, EditorComponentField } from 'decap-cms-core';
import { bridgeGetAsset } from './asset-bridge';
import type { ArticleComponentName } from '../lib/article-component-names';
import { IMAGE_LIBRARY } from '../lib/media-rules.mjs';
import {
  calloutHtml,
  agentCardsHtml,
  dividerHtml,
  figureHtml,
  imageRowHtml,
  orbitDiagramHtml,
  pullquoteHtml,
  quoteHtml,
  statDialHtml,
  twoColumnHtml,
  videoHtml,
  type GetAsset,
  type ResolveAsset,
} from './preview-html';

export type BlockData = Record<string, unknown>;

// ---- MDX attribute helpers ----------------------------------------------------------------------------------------

// One attribute: `name="plain"`, `name={"json string"}`, `name={[json array]}` or `name={true}`, all on a single line.
const ATTR = String.raw`\s+[A-Za-z][\w-]*=(?:"[^"\n]*"|\{"(?:[^"\\\n]|\\.)*"\}|\{\[[^\n]*\]\}|\{true\})`;
const ATTRS = String.raw`((?:${ATTR})*)\s*`;
const ATTR_PARTS = /([A-Za-z][\w-]*)=(?:"([^"\n]*)"|\{("(?:[^"\\\n]|\\.)*")\}|\{(\[[^\n]*\])\}|\{(true)\})/g;

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** ` name="value"`, or ` name={"value"}` when the value holds a character JSX would read differently. '' when empty. */
export function stringAttr(name: string, value: unknown): string {
  const s = text(value)
    .trim()
    .replace(/\s*\n\s*/g, ' ');
  if (!s) return '';
  return /^[^"\\{}<>&]*$/.test(s) ? ` ${name}="${s}"` : ` ${name}={${JSON.stringify(s)}}`;
}

/** Like `stringAttr`, but nothing when the value is the component's own default. */
export function optionAttr(name: string, value: unknown, fallback: string): string {
  return text(value) === fallback ? '' : stringAttr(name, value);
}

/** ` name={true}` when the box is ticked, nothing otherwise. */
export function flagAttr(name: string, value: unknown): string {
  return value === true ? ` ${name}={true}` : '';
}

/** ` name={[...]}` with the list as one line of JSON (which is valid JavaScript, so valid in MDX). */
export function jsonAttr(name: string, value: unknown): string {
  return Array.isArray(value) && value.length ? ` ${name}={${JSON.stringify(value)}}` : '';
}

/** The attributes of a matched tag, as an object. Unknown or malformed text is skipped rather than thrown on. */
export function parseAttrs(source: string): BlockData {
  const out: BlockData = {};
  for (const [, name, plain, quoted, array, yes] of source.matchAll(ATTR_PARTS)) {
    try {
      out[name] = yes ? true : (plain ?? JSON.parse((quoted ?? array) as string));
    } catch {
      /* leave it out */
    }
  }
  return out;
}

const selfClosing = (tag: ArticleComponentName) => new RegExp(String.raw`^<${tag}${ATTRS}/>`);
const withChildren = (tag: ArticleComponentName) => new RegExp(String.raw`^<${tag}${ATTRS}>\n+([\s\S]*?)\n+</${tag}>`);

const tag = (name: ArticleComponentName, attrs: string[]) => `<${name}${attrs.join('')} />`;
const wrap = (name: ArticleComponentName, attrs: string[], body: unknown) =>
  `<${name}${attrs.join('')}>\n\n${text(body).trim()}\n\n</${name}>`;

// What Decap passes to `toPreview` besides the block's data: `getAsset` turns an uploaded-but-unsaved image path into a
// URL the preview can show, and `fields` is the block's field list (an Immutable List, hence the loose type).
interface FieldList {
  find(match: (f: { get(key: string): unknown }) => boolean): { get(key: string): unknown } | undefined;
}
type Preview = (d: BlockData, getAsset?: GetAsset, fields?: FieldList) => string;
// Decap's typings say `toPreview` takes only the data, but it also passes `getAsset` and `fields` (see
// decap-cms-widget-markdown/src/serializers/remarkRehypeShortcodes.js).
const preview = (fn: Preview) => fn as unknown as BlockEditorComponentOptions['toPreview'];

/** Resolves image paths through Decap, so an image that is chosen but not yet saved still shows. Falls back to the path. */
function assetResolver(getAsset: GetAsset | undefined, field: unknown): ResolveAsset {
  return (path) => {
    try {
      return String((getAsset && bridgeGetAsset(getAsset))?.(path, field) ?? '') || path;
    } catch {
      return path;
    }
  };
}
const fieldNamed = (fields: FieldList | undefined, name: string) => fields?.find((f) => f.get('name') === name);

/** "https://youtu.be/ID", "https://www.youtube.com/watch?v=ID", ".../embed/ID", ".../shorts/ID", ".../live/ID" or a bare id -> the
 *  11-character id. Anything else is kept as typed, and the save check names it (videoProblems in src/admin/content-check.ts). */
export function youtubeIdFrom(input: unknown): string {
  const s = text(input).trim();
  const match = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(s);
  return match ? match[1] : s;
}

// ---- Fields -------------------------------------------------------------------------------------------------------

const field = (f: Record<string, unknown>) => f as unknown as EditorComponentField;
const altField = field({
  name: 'alt',
  label: 'Alt text',
  widget: 'string',
  hint: 'Required. One plain sentence saying what the picture shows, for someone who cannot see it. Not "image of".',
});
const captionField = field({
  name: 'caption',
  label: 'Caption',
  widget: 'string',
  required: false,
  hint: 'Optional. Shown under the picture.',
});
const decorativeField = field({
  name: 'decorative',
  label: 'Decoration only (no alt text needed)',
  widget: 'boolean',
  required: false,
  default: false,
  hint: 'Tick only if the picture adds nothing for someone who cannot see it, like a divider flourish.',
});

// ---- Blocks -------------------------------------------------------------------------------------------------------

// The blog's "Image" block. It writes the Figure component, so the picture is optimised, captioned and placed.
const figure: BlockEditorComponentOptions = {
  id: 'Figure',
  label: 'Image',
  fields: [
    field({ name: 'src', label: 'Image', widget: 'image', choose_url: false, media_library: IMAGE_LIBRARY }),
    altField,
    captionField,
    decorativeField,
    field({
      name: 'align',
      label: 'Placement',
      widget: 'select',
      options: ['center', 'left', 'right', 'full'],
      default: 'center',
      hint: 'Left and right float beside the text on wide screens; full fills the column edge to edge.',
    }),
    field({ name: 'size', label: 'Size', widget: 'select', options: ['lg', 'md', 'sm'], default: 'lg' }),
  ],
  pattern: selfClosing('Figure'),
  fromBlock: (m) => parseAttrs(m[1]),
  toBlock: (d: BlockData) =>
    tag('Figure', [
      stringAttr('src', d.src),
      d.decorative === true ? '' : stringAttr('alt', d.alt),
      flagAttr('decorative', d.decorative),
      stringAttr('caption', d.caption),
      optionAttr('align', d.align, 'center'),
      optionAttr('size', d.size, 'lg'),
    ]),
  toPreview: preview((d, getAsset, fields) => figureHtml(d, assetResolver(getAsset, fieldNamed(fields, 'src')))),
};

const callout: BlockEditorComponentOptions = {
  id: 'Callout',
  label: 'Callout',
  fields: [
    field({
      name: 'type',
      label: 'Kind',
      widget: 'select',
      options: ['info', 'tip', 'warn'],
      default: 'info',
    }),
    field({ name: 'title', label: 'Title', widget: 'string', required: false }),
    field({ name: 'body', label: 'Text', widget: 'text', hint: 'Markdown is fine.' }),
  ],
  pattern: withChildren('Callout'),
  fromBlock: (m) => ({ ...parseAttrs(m[1]), body: m[2].trim() }),
  toBlock: (d: BlockData) =>
    wrap('Callout', [stringAttr('type', d.type || 'info'), stringAttr('title', d.title)], d.body),
  toPreview: preview((d) => calloutHtml(d)),
};

const quote: BlockEditorComponentOptions = {
  id: 'Quote',
  label: 'Quote',
  fields: [
    field({ name: 'body', label: 'Quote', widget: 'text' }),
    field({ name: 'cite', label: 'Who said it', widget: 'string', required: false }),
    field({ name: 'href', label: 'Source URL', widget: 'string', required: false }),
  ],
  pattern: withChildren('Quote'),
  fromBlock: (m) => ({ ...parseAttrs(m[1]), body: m[2].trim() }),
  toBlock: (d: BlockData) => wrap('Quote', [stringAttr('cite', d.cite), stringAttr('href', d.href)], d.body),
  toPreview: preview((d) => quoteHtml(d)),
};

const imageGallery: BlockEditorComponentOptions = {
  id: 'ImageGallery',
  label: 'Image gallery',
  fields: [
    field({
      name: 'images',
      label: 'Images',
      widget: 'list',
      min: 2,
      max: 3,
      hint: 'Two or three images, side by side.',
      fields: [field({ name: 'src', label: 'Image', widget: 'image', choose_url: false, media_library: IMAGE_LIBRARY }), altField, captionField],
    }),
  ],
  pattern: selfClosing('ImageGallery'),
  fromBlock: (m) => {
    const images = parseAttrs(m[1]).images;
    return { images: Array.isArray(images) ? images : [] };
  },
  toBlock: (d: BlockData) => {
    const images = (Array.isArray(d.images) ? (d.images as BlockData[]) : []).map((i) => ({
      src: text(i.src),
      alt: text(i.alt),
      ...(text(i.caption) ? { caption: text(i.caption) } : {}),
    }));
    return tag('ImageGallery', [jsonAttr('images', images)]);
  },
  toPreview: preview((d, getAsset, fields) => {
    const images = (Array.isArray(d.images) ? d.images : []) as BlockData[];
    const list = fieldNamed(fields, 'images')?.get('fields') as FieldList | undefined;
    return imageRowHtml(images, assetResolver(getAsset, fieldNamed(list, 'src')));
  }),
};

const twoColumn: BlockEditorComponentOptions = {
  id: 'TwoColumn',
  label: 'Two columns',
  fields: [
    field({ name: 'left', label: 'Left column', widget: 'text', hint: 'Markdown is fine.' }),
    field({ name: 'right', label: 'Right column', widget: 'text', hint: 'Markdown is fine.' }),
    field({ name: 'ratio', label: 'Widths', widget: 'select', options: ['1:1', '2:1', '1:2'], default: '1:1' }),
  ],
  // The slot <div>s are unindented with blank lines round the Markdown, as docs/ARTICLE_COMPONENTS.md asks.
  pattern: new RegExp(
    String.raw`^<TwoColumn${ATTRS}>\s*<div slot="left">\s*([\s\S]*?)\s*</div>\s*<div slot="right">\s*([\s\S]*?)\s*</div>\s*</TwoColumn>`,
  ),
  fromBlock: (m) => ({ ...parseAttrs(m[1]), left: m[2].trim(), right: m[3].trim() }),
  toBlock: (d: BlockData) =>
    [
      `<TwoColumn${optionAttr('ratio', d.ratio, '1:1')}>`,
      '',
      '<div slot="left">',
      '',
      text(d.left).trim(),
      '',
      '</div>',
      '',
      '<div slot="right">',
      '',
      text(d.right).trim(),
      '',
      '</div>',
      '',
      '</TwoColumn>',
    ].join('\n'),
  toPreview: preview((d) => twoColumnHtml(d)),
};

const videoEmbed: BlockEditorComponentOptions = {
  id: 'VideoEmbed',
  label: 'Video',
  fields: [
    field({
      name: 'id',
      label: 'YouTube link or id',
      widget: 'string',
      hint: 'Paste the video link; only the id is kept.',
    }),
    field({ name: 'title', label: 'Title', widget: 'string', hint: 'Read aloud by screen readers.' }),
    captionField,
  ],
  pattern: selfClosing('VideoEmbed'),
  fromBlock: (m) => parseAttrs(m[1]),
  toBlock: (d: BlockData) =>
    tag('VideoEmbed', [
      stringAttr('id', youtubeIdFrom(d.id)),
      stringAttr('title', d.title),
      stringAttr('caption', d.caption),
    ]),
  toPreview: preview((d) => videoHtml(d)),
};

const divider: BlockEditorComponentOptions = {
  id: 'Divider',
  label: 'Divider',
  fields: [
    field({
      name: 'variant',
      label: 'Style',
      widget: 'select',
      options: ['rule', 'dots', 'orbit'],
      default: 'rule',
      hint: 'orbit: the small ring and dot, for the main breaks of a post.',
    }),
  ],
  pattern: selfClosing('Divider'),
  fromBlock: (m) => parseAttrs(m[1]),
  toBlock: (d: BlockData) => tag('Divider', [optionAttr('variant', d.variant, 'rule')]),
  toPreview: preview((d) => dividerHtml(d)),
};

// ---- The brand pieces (docs/IMAGE_STYLE.md section 8.3) ----------------------------------------------------------------

/** The text inside a one-line tag: line breaks become spaces, and the characters MDX would read as markup are dropped. */
const inlineChild = (v: unknown) =>
  text(v)
    .trim()
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[{}<>]/g, '');

const pullquote: BlockEditorComponentOptions = {
  id: 'Pullquote',
  label: 'Pull quote',
  fields: [
    field({
      name: 'body',
      label: 'Quote',
      widget: 'string',
      hint: 'A line that is already in the post, set large. Screen readers skip it, because it repeats the text.',
    }),
    field({ name: 'cite', label: 'Who said it', widget: 'string', required: false }),
    field({
      name: 'ring',
      label: 'Ring round these words',
      widget: 'string',
      required: false,
      hint: 'Optional. One to three words of the quote, copied exactly, get the brand ring. Once a post at most.',
    }),
  ],
  pattern: new RegExp(String.raw`^<Pullquote${ATTRS}>([^\n]*?)</Pullquote>`),
  fromBlock: (m) => ({ ...parseAttrs(m[1]), body: m[2].trim() }),
  toBlock: (d: BlockData) => `<Pullquote${stringAttr('cite', d.cite)}${stringAttr('ring', d.ring)}>${inlineChild(d.body)}</Pullquote>`,
  toPreview: preview((d) => pullquoteHtml(d)),
};

const stateField = field({
  name: 'state',
  label: 'State',
  widget: 'select',
  options: [
    { label: 'Finished', value: 'finished' },
    { label: 'Working', value: 'working' },
    { label: 'Needs you', value: 'needs' },
    { label: 'Interrupted', value: 'interrupted' },
  ],
  default: 'finished',
});
const agentField = field({ name: 'agent', label: 'Agent', widget: 'string', hint: 'The name on the card: Quasar, Atlas...' });
const taskField = field({ name: 'task', label: 'Task', widget: 'string', hint: 'The title on the card, as the app shows it.' });
const toolField = field({ name: 'tool', label: 'Runs on', widget: 'string', required: false, default: 'Claude', hint: 'Claude, Codex, PowerShell...' });

/** A list item with only the fields that hold something, in a fixed order. */
const picked = (item: unknown, keys: string[]) => {
  const source = (item ?? {}) as BlockData;
  const out: BlockData = {};
  for (const key of keys) if (text(source[key]).trim()) out[key] = text(source[key]).trim();
  return out;
};
const listOf = (v: unknown) => (Array.isArray(v) ? v : []);

const agentCards: BlockEditorComponentOptions = {
  id: 'AgentCards',
  label: 'Agent cards',
  fields: [
    field({
      name: 'cards',
      label: 'Cards',
      widget: 'list',
      min: 1,
      max: 3,
      hint: 'One to three cards from the R7 Orbit canvas, side by side. Copy what the app showed; never write a report for an agent.',
      fields: [
        taskField,
        agentField,
        toolField,
        field({ name: 'model', label: 'Model', widget: 'string', required: false, hint: 'Sonnet 5.5, Opus 5.5...' }),
        field({ name: 'effort', label: 'Effort', widget: 'string', required: false, hint: 'Low, Medium or High, if the card shows it.' }),
        stateField,
        field({ name: 'note', label: 'Note in brass', widget: 'string', required: false, hint: 'The line the app adds when something stopped it.' }),
        field({ name: 'report', label: 'What it reported', widget: 'text', required: false, hint: 'Copied from the card. `code` in backticks shows as code.' }),
      ],
    }),
    field({ name: 'caption', label: 'Caption', widget: 'string', required: false }),
  ],
  pattern: selfClosing('AgentCards'),
  fromBlock: (m) => {
    const read = parseAttrs(m[1]);
    return { ...read, cards: listOf(read.cards) };
  },
  toBlock: (d: BlockData) =>
    tag('AgentCards', [
      jsonAttr('cards', listOf(d.cards).map((c) => picked(c, ['task', 'agent', 'tool', 'model', 'effort', 'state', 'note', 'report']))),
      stringAttr('caption', d.caption),
    ]),
  toPreview: preview((d) => agentCardsHtml(d)),
};

const orbitDiagram: BlockEditorComponentOptions = {
  id: 'OrbitDiagram',
  label: 'Orbit diagram',
  fields: [
    field({ name: 'hub', label: 'Project in the middle', widget: 'string' }),
    field({ name: 'meta', label: 'Line under it', widget: 'string', required: false, hint: 'For example: main · 9 agents' }),
    field({
      name: 'agents',
      label: 'Agents',
      widget: 'list',
      min: 1,
      max: 8,
      hint: 'Up to eight agents round the project. Real agents and tasks only.',
      fields: [agentField, taskField, toolField, stateField],
    }),
    field({ name: 'caption', label: 'Caption', widget: 'string', required: false }),
  ],
  pattern: selfClosing('OrbitDiagram'),
  fromBlock: (m) => {
    const read = parseAttrs(m[1]);
    return { ...read, agents: listOf(read.agents) };
  },
  toBlock: (d: BlockData) =>
    tag('OrbitDiagram', [
      stringAttr('hub', d.hub),
      stringAttr('meta', d.meta),
      jsonAttr('agents', listOf(d.agents).map((a) => picked(a, ['agent', 'task', 'tool', 'state']))),
      stringAttr('caption', d.caption),
    ]),
  toPreview: preview((d) => orbitDiagramHtml(d)),
};

const statDial: BlockEditorComponentOptions = {
  id: 'StatDial',
  label: 'Stat dial',
  fields: [
    field({ name: 'value', label: 'Number', widget: 'string', hint: 'As it should be printed: 17, 18, 1.25.' }),
    field({ name: 'unit', label: 'Unit', widget: 'string', required: false, hint: 'Short: s, commits.' }),
    field({
      name: 'caption',
      label: 'Caption',
      widget: 'string',
      hint: 'Say the number in words here: it is what a screen reader reads (the dial itself is decoration).',
    }),
    field({ name: 'source', label: 'Source', widget: 'string', required: false, hint: 'Where the number comes from, in small print.' }),
  ],
  pattern: selfClosing('StatDial'),
  fromBlock: (m) => parseAttrs(m[1]),
  toBlock: (d: BlockData) =>
    tag('StatDial', [stringAttr('value', d.value), stringAttr('unit', d.unit), stringAttr('caption', d.caption), stringAttr('source', d.source)]),
  toPreview: preview((d) => statDialHtml(d)),
};

// The "Image" block for the Markdown bodies (news, vlogs, projects, repos), which have no article components. It replaces
// Decap's built-in image block (same id, registered after it), which let the alt text stay empty. Writes `![alt](src)` and,
// when there is a caption, an italic line straight under it, which the site turns into a <figure> with a <figcaption>
// (src/lib/markdown/remark-figures.mjs). A decorative picture is `![](src "decorative")`.
export const markdownImage: BlockEditorComponentOptions = {
  id: 'image',
  label: 'Image',
  fields: [
    field({ name: 'image', label: 'Image', widget: 'image', choose_url: false, media_library: IMAGE_LIBRARY }),
    altField,
    captionField,
    decorativeField,
  ],
  // ![alt](src "title"), then optionally a newline and *caption*. The match must end where the block ends.
  pattern: /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"([^"]*)")?\)(?:\n\*([^\n]+)\*)?/,
  fromBlock: (m) => {
    const decorative = (m[3] ?? '').trim().toLowerCase() === 'decorative';
    return { image: m[2], alt: m[1], decorative, caption: m[4] ?? '' };
  },
  toBlock: (d: BlockData) => {
    const decorative = d.decorative === true;
    // A square bracket or a line break in the alt text would end the Markdown early.
    const alt = decorative ? '' : text(d.alt).trim().replace(/[[\]]/g, '').replace(/\s*\n\s*/g, ' ');
    const caption = text(d.caption).trim().replace(/\s*\n\s*/g, ' ').replace(/\*/g, '');
    const image = `![${alt}](${text(d.image)}${decorative ? ' "decorative"' : ''})`;
    return caption ? `${image}\n*${caption}*` : image;
  },
  toPreview: preview((d, getAsset, fields) =>
    figureHtml(
      { src: d.image, alt: d.decorative === true ? '' : d.alt, caption: d.caption, decorative: d.decorative },
      assetResolver(getAsset, fieldNamed(fields, 'image')),
    ),
  ),
};

export const blocks: BlockEditorComponentOptions[] = [
  figure,
  callout,
  quote,
  imageGallery,
  twoColumn,
  videoEmbed,
  divider,
  pullquote,
  agentCards,
  orbitDiagram,
  statDial,
];
