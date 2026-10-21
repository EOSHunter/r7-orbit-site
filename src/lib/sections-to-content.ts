// A post (or page) written as sections, read for everything that is not the page itself (docs/SECTIONS.md "Posts"). One pure
// projection, so the reading time, the blog's contents list and the admin preview all read a sections body the same way:
//   - sectionsToText      plain text: the words a reader reads, for the reading time (src/lib/content.ts)
//   - sectionsHeadings    the h2 and h3 with their anchors: the blog's contents list (ArticlePage), the ids the page gives its headings
//                         (src/lib/sections/prepare.ts), the Table of contents block and the admin previews
// What each block contributes is in BLOCKS below, typed `{ [type]: … }`, so a block added to the library without a line here does
// not compile. Pure, no Astro: read by the build, the admin bundle and Vitest (sections-to-content.vitest.ts covers every block).
import {
  definitionOf,
  describeShape,
  headingPlainText,
  headingsOfMarkdown,
  SlugBook,
  type FieldInfo,
  type PageHeading,
  type Section,
  type SectionOf,
  type SectionType,
} from './sections';

/** True when a post's body is its sections (a non-empty list). An absent or empty list means the Markdown body is the body. */
export const hasSections = (data: { sections?: readonly unknown[] }): boolean => (data.sections?.length ?? 0) > 0;

// ---- Markdown <-> plain text --------------------------------------------------------------------------------------------

/**
 * The words of a piece of Markdown, without its marks: code blocks, pictures and tags left out, a link by its text. Paragraphs stay
 * apart (a blank line between them). The same words `countWords` counts in a Markdown body, so a post reads as long either way.
 */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/gm, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^(?:[ \t]{0,3}(?:#{1,6}|>|[-*+]|\d{1,9}[.)])(?=[ \t]|$)[ \t]*)+/gm, '')
    .replace(/[*_~`]+/g, '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

// ---- What each block contributes ----------------------------------------------------------------------------------------

interface Projection<K extends SectionType> {
  /** The block's words as a reader reads them, one string per paragraph-ish piece. Code, alt text and site chrome are not counted. */
  text: (block: SectionOf<K>) => string[];
}

const nothing = { text: () => [] };

const BLOCKS: { [K in SectionType]: Projection<K> } = {
  heading: { text: (d) => [headingPlainText(d.text)] },
  lead: { text: (d) => [markdownToText(d.text)] },
  text: { text: (d) => [markdownToText(d.text)] },
  quote: { text: (d) => [markdownToText(d.text), d.attribution ?? ''] },
  // It repeats a line of the text above (screen readers skip it too), so it is not counted.
  pullquote: nothing,
  callout: { text: (d) => [d.title ?? '', markdownToText(d.text)] },
  // Code is not prose: a Markdown body's code blocks are not counted either.
  code: nothing,
  image: { text: (d) => [d.caption ?? ''] },
  'image-row': { text: (d) => [...d.images.map((i) => i.caption ?? ''), d.caption ?? ''] },
  gallery: { text: (d) => d.shots.map((s) => s.caption ?? '') },
  portrait: { text: (d) => [markdownToText(d.text)] },
  video: { text: (d) => [d.caption ?? ''] },
  game: { text: (d) => [d.playNote ?? ''] },
  columns: { text: (d) => [markdownToText(d.left), markdownToText(d.right)] },
  divider: nothing,
  spacer: nothing,
  links: { text: (d) => d.items.flatMap((i) => [i.label, i.note ?? '']) },
  button: { text: (d) => [d.label] },
  // A contents list of the page's own headings.
  toc: nothing,
  stats: nothing,
  // Built from the site at build time (other posts, an author's bio): not this post's words.
  latest: nothing,
  // The home page's rows: made from the posts when the site is built; nothing of their own to read.
  feed: nothing,
  pinned: nothing,
  apps: nothing,
  author: nothing,
  // The names and bios are the authors list's, not this post's words; only a title or a short bio typed in the block are.
  team: { text: (d) => d.members.flatMap((m) => [m.title, m.blurb ?? '']) },
  // The waitlist's words are Site settings', not this post's.
  waitlist: nothing,
};

const projectionOf = <K extends SectionType>(block: SectionOf<K>) => BLOCKS[block.type as K] as Projection<K>;

/** The words of a sections body, one paragraph per piece (a blank line between), in page order. */
export function sectionsToText(sections: readonly Section[]): string {
  return sections
    .flatMap((block) => projectionOf(block).text(block))
    .map((piece) => piece.trim())
    .filter(Boolean)
    .join('\n\n');
}

// ---- Headings -----------------------------------------------------------------------------------------------------------

/** A heading of a sections body, with where it comes from: block `index` (from 0) and, for a heading inside a Markdown box, its field. */
export interface SectionHeading extends PageHeading {
  index: number;
  /** The Markdown box it is in; undefined for a Heading block. */
  field?: string;
}

const markdownFields = new Map<string, FieldInfo[]>();
/** The top-level Markdown boxes of a block type (a Text block's `text`, Two columns' `left` and `right`), from the schema. */
function markdownFieldsOf(type: string): FieldInfo[] {
  let fields = markdownFields.get(type);
  if (!fields) {
    const definition = definitionOf(type);
    fields = definition ? describeShape(definition.schema.shape).filter((f) => f.format === 'markdown') : [];
    markdownFields.set(type, fields);
  }
  return fields;
}

/**
 * Every h2 and h3 of a sections body, in page order, with an anchor that is unique on the page: the Heading blocks, and the `##` and
 * `###` written inside Markdown boxes. The page gives its headings these ids (prepare.ts), so the contents list and the page agree.
 */
export function sectionsHeadings(sections: readonly Section[]): SectionHeading[] {
  const slugs = new SlugBook();
  const out: SectionHeading[] = [];
  sections.forEach((block, index) => {
    if (block.type === 'heading') {
      const text = headingPlainText(block.text);
      out.push({ depth: block.level as 2 | 3, text, slug: slugs.next(text), index });
    }
    for (const field of markdownFieldsOf(block.type)) {
      const value = (block as unknown as Record<string, unknown>)[field.name];
      if (typeof value !== 'string') continue;
      for (const h of headingsOfMarkdown(value)) out.push({ depth: h.depth, text: h.text, slug: slugs.next(h.text), index, field: field.name });
    }
  });
  return out;
}
