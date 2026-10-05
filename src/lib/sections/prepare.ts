// What a page of blocks needs read or rendered before it is drawn, done once up front (build time only): the Markdown of every
// Markdown box as sanitised HTML, the size of every picture (so the page reserves its space: no layout shift), and, when the page
// has a table of contents, an anchor on every heading. Which boxes are Markdown and which are pictures is read from the schema
// (describe.ts), so a new block with a Markdown box or a picture needs nothing added here. Every failure names the file and block.
import { renderInlineMarkdown, renderSectionMarkdown } from '../section-markdown';
import { imageSize, type ImageSize } from '../section-images';
import { definitionOf, SECTION_LABELS } from './definitions';
import { describeShape, valuesWhere } from './describe';
import { whereOf } from './checks';
import { headingPlainText, headingsInHtml, SlugBook, withHeadingIds, type PageHeading } from './headings';
import type { Section } from './schema';

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
  /** The anchor of a heading block, when the page has a table of contents. */
  headingId?: string;
  /** Every heading on the page, in order, with anchors (empty unless the page has a table of contents). */
  headings: PageHeading[];
}

const fieldsOf = (type: string) => {
  const definition = definitionOf(type);
  if (!definition) throw new Error(`Unknown block type "${type}".`);
  return describeShape(definition.schema.shape);
};

/** Reads and renders everything the blocks need, and gives each its context. Throws a readable error naming the block. */
export async function prepareSections(sections: readonly Section[], source: string): Promise<Map<Section, BlockContext>> {
  const contexts = new Map<Section, BlockContext>();
  const headings: PageHeading[] = [];
  const hasToc = sections.some((s) => s.type === 'toc');
  const slugs = new SlugBook();

  for (const [index, section] of sections.entries()) {
    const where = whereOf(source, index, SECTION_LABELS[section.type]);
    const fields = fieldsOf(section.type);
    const data = section as unknown as Record<string, unknown>;
    const html: Record<string, string> = {};
    const sizes = new Map<string, ImageSize>();
    const ctx: BlockContext = { where, index, source, html, sizes, headings };
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

    if (!hasToc) continue;
    // Headings in page order: a heading block, then the ## and ### inside the block's Markdown boxes.
    if (section.type === 'heading') {
      const text = headingPlainText(section.text);
      const slug = slugs.next(text);
      ctx.headingId = slug;
      headings.push({ depth: section.level as 2 | 3, slug, text });
    }
    for (const [name, rendered] of Object.entries(html)) {
      if (fields.find((f) => f.name === name)?.format !== 'markdown') continue;
      const found = headingsInHtml(rendered);
      if (!found.length) continue;
      const ids = found.map((h) => slugs.next(h.text));
      html[name] = withHeadingIds(rendered, ids);
      found.forEach((h, i) => headings.push({ depth: h.depth, slug: ids[i], text: h.text }));
    }
  }
  return contexts;
}
