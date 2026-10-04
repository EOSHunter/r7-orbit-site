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
import type { ArticleComponentName } from '../lib/article-component-names';
import {
  calloutHtml,
  dividerHtml,
  figureHtml,
  imageRowHtml,
  quoteHtml,
  twoColumnHtml,
  videoHtml,
  type GetAsset,
  type ResolveAsset,
} from './preview-html';

export type BlockData = Record<string, unknown>;

// ---- MDX attribute helpers ----------------------------------------------------------------------------------------

// One attribute: `name="plain"`, `name={"json string"}` or `name={[json array]}`, all on a single line.
const ATTR = String.raw`\s+[A-Za-z][\w-]*=(?:"[^"\n]*"|\{"(?:[^"\\\n]|\\.)*"\}|\{\[[^\n]*\]\})`;
const ATTRS = String.raw`((?:${ATTR})*)\s*`;
const ATTR_PARTS = /([A-Za-z][\w-]*)=(?:"([^"\n]*)"|\{("(?:[^"\\\n]|\\.)*")\}|\{(\[[^\n]*\])\})/g;

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

/** ` name={[...]}` with the list as one line of JSON (which is valid JavaScript, so valid in MDX). */
export function jsonAttr(name: string, value: unknown): string {
  return Array.isArray(value) && value.length ? ` ${name}={${JSON.stringify(value)}}` : '';
}

/** The attributes of a matched tag, as an object. Unknown or malformed text is skipped rather than thrown on. */
export function parseAttrs(source: string): BlockData {
  const out: BlockData = {};
  for (const [, name, plain, quoted, array] of source.matchAll(ATTR_PARTS)) {
    try {
      out[name] = plain ?? JSON.parse((quoted ?? array) as string);
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
      return String(getAsset?.(path, field) ?? '') || path;
    } catch {
      return path;
    }
  };
}
const fieldNamed = (fields: FieldList | undefined, name: string) => fields?.find((f) => f.get('name') === name);

/** "https://youtu.be/ID", "https://www.youtube.com/watch?v=ID", ".../embed/ID" or a bare id -> the 11-character id. */
export function youtubeIdFrom(input: unknown): string {
  const s = text(input).trim();
  const match = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/.exec(s);
  return match ? match[1] : s;
}

// ---- Fields -------------------------------------------------------------------------------------------------------

const field = (f: Record<string, unknown>) => f as unknown as EditorComponentField;
const altField = field({
  name: 'alt',
  label: 'Alt text',
  widget: 'string',
  hint: 'Describe the image for someone who cannot see it.',
});
const captionField = field({ name: 'caption', label: 'Caption', widget: 'string', required: false });

// ---- Blocks -------------------------------------------------------------------------------------------------------

const figure: BlockEditorComponentOptions = {
  id: 'Figure',
  label: 'Figure',
  fields: [
    field({ name: 'src', label: 'Image', widget: 'image', choose_url: false }),
    altField,
    captionField,
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
      stringAttr('alt', d.alt),
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
      fields: [field({ name: 'src', label: 'Image', widget: 'image', choose_url: false }), altField, captionField],
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
  fields: [field({ name: 'variant', label: 'Style', widget: 'select', options: ['rule', 'dots'], default: 'rule' })],
  pattern: selfClosing('Divider'),
  fromBlock: (m) => parseAttrs(m[1]),
  toBlock: (d: BlockData) => tag('Divider', [optionAttr('variant', d.variant, 'rule')]),
  toPreview: preview((d) => dividerHtml(d)),
};

export const blocks: BlockEditorComponentOptions[] = [
  figure,
  callout,
  quote,
  imageGallery,
  twoColumn,
  videoEmbed,
  divider,
];
