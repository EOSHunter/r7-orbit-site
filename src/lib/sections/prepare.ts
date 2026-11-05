// What a page of blocks needs read or rendered before it is drawn, done once up front (build time only): the Markdown of every
// Markdown box as sanitised HTML, the size of every picture (so the page reserves its space: no layout shift), and, when the page
// has a table of contents (or is a post), an anchor on every heading. Which boxes are Markdown and which are pictures is read from the schema
// (describe.ts), so a new block with a Markdown box or a picture needs nothing added here. Every failure names the file and block.
import { renderInlineMarkdown, renderSectionMarkdown } from '../section-markdown';
import { imageSize, type ImageSize } from '../section-images';
import { definitionOf, SECTION_LABELS } from './definitions';
import { describeShape, valuesWhere } from './describe';
import { whereOf } from './checks';
import { headingsInHtml, withHeadingIds, type PageHeading } from './headings';
import type { Section } from './schema';
import { headingBefore, sectionsHeadings } from '../sections-to-content';

/** What one block's component is given besides the block itself. */
export interface BlockContext {
  /** "about.md, block 3 (Image)": the start of every error about this block. */
  where: string;
  /** The block's place in the list, counted from 0. */
  index: number;
  /** The file or page the list came from. */
  source: string;
  /** The block's Markdown boxes as sanitised HTML, by field name. A lead paragraph's is inline (no `<p>`). */
  html: Record<string, string>;
  /** The size of every picture the block points at, by path. */
  sizes: Map<string, ImageSize>;
  /** The anchor of a heading block, when the page has a table of contents or asked for anchors (`headingIds`). */
  headingId?: string;
  /** Every heading on the page, in order, with anchors (empty unless the page has a table of contents or asked for anchors). */
  headings: PageHeading[];
  /** `page`: rows the width of the window (About). `column`: inside a post's text column, where nothing reaches the window's edges. */
  layout: 'page' | 'column';
  /** An h2 comes before this block on the page (sections-to-content.ts, headingBefore): its own headings are then h3, else h2. */
  afterHeading: boolean;
  /** The page has a Pinned post block: the Latest feed then leaves the pinned post out. */
  hasPinned: boolean;
}

export interface PrepareOptions {
  /** Give every heading an anchor even without a Table of contents block: a post does, for the contents list beside it. */
  headingIds?: boolean;
  layout?: 'page' | 'column';
}

const fieldsOf = (type: string) => {
  const definition = definitionOf(type);
  if (!definition) throw new Error(`Unknown block type "${type}".`);
  return describeShape(definition.schema.shape);
};

/** Reads and renders everything the blocks need, and gives each its context. Throws a readable error naming the block. */
export async function prepareSections(
  sections: readonly Section[],
  source: string,
  { headingIds = false, layout = 'page' }: PrepareOptions = {},
): Promise<Map<Section, BlockContext>> {
  const contexts = new Map<Section, BlockContext>();
  const anchors = headingIds || sections.some((s) => s.type === 'toc');
  // The headings and their anchors come from the one projection the contents lists use (sections-to-content.ts).
  const found = anchors ? sectionsHeadings(sections) : [];
  const headings: PageHeading[] = found.map(({ depth, slug, text }) => ({ depth, slug, text }));
  const hasPinned = sections.some((s) => s.type === 'pinned');

  for (const [index, section] of sections.entries()) {
    const where = whereOf(source, index, SECTION_LABELS[section.type]);
    const fields = fieldsOf(section.type);
    const data = section as unknown as Record<string, unknown>;
    const html: Record<string, string> = {};
    const sizes = new Map<string, ImageSize>();
    const ctx: BlockContext = { where, index, source, html, sizes, headings, layout, afterHeading: headingBefore(sections, index), hasPinned };
    contexts.set(section, ctx);

    try {
      for (const { field, value } of valuesWhere(fields, data, { format: 'markdown' })) html[field.name] = await renderSectionMarkdown(value);
      for (const { field, value } of valuesWhere(fields, data, { format: 'inline' })) html[field.name] = await renderInlineMarkdown(value);
      for (const { value } of valuesWhere(fields, data, { widget: 'image' })) {
        if (!sizes.has(value)) sizes.set(value, await imageSize(value, where));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message.startsWith(where) ? message : `${where}: ${message}`, { cause: error });
    }

    if (!anchors) continue;
    // A heading block's anchor, then the ## and ### inside the block's Markdown boxes, in the order the projection read them.
    const mine = found.filter((h) => h.index === index);
    if (section.type === 'heading') ctx.headingId = mine.find((h) => h.field === undefined)?.slug;
    for (const [name, rendered] of Object.entries(html)) {
      const field = fields.find((f) => f.name === name);
      if (field?.format !== 'markdown') continue;
      const expected = mine.filter((h) => h.field === name);
      const onPage = headingsInHtml(rendered).length;
      if (onPage !== expected.length) {
        throw new Error(
          `${where}: "${field.label}" has ${onPage} heading${onPage === 1 ? '' : 's'} on the page but ${expected.length} could be read for the contents list. ` +
            'Write each heading on a line of its own, starting with ## (or ### for a smaller one), with a blank line before and after it, and no HTML headings.',
        );
      }
      if (onPage) html[name] = withHeadingIds(rendered, expected.map((h) => h.slug));
    }
  }
  return contexts;
}
