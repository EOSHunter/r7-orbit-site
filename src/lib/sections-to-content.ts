// A post (or page) written as sections, read for everything that is not the page itself (docs/SECTIONS.md "Posts"). One pure
// projection, so the reading time, the blog's contents list, the feeds and the admin preview all read a sections body the same way:
//   - sectionsToText      plain text: the words a reader reads, for the reading time (src/lib/content.ts)
//   - sectionsHeadings    the h2 and h3 with their anchors: the blog's contents list (ArticlePage), the ids the page gives its headings
//                         (src/lib/sections/prepare.ts), the Table of contents block and the admin previews
//   - sectionsToMarkdown  the body as plain Markdown: what a feed reader gets (src/lib/feed-queries.ts renders it to HTML)
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
import { titleParts } from './text';

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

/** Plain text set in Markdown so it reads as typed, untrimmed: a piece of a longer line (a heading's words around its *phrase*). */
const escapePiece = (s: string): string => s.replace(/\s+/g, ' ').replace(/[\\`*_[\]<>#|~!]/g, '\\$&');

/** Plain text set in Markdown so it reads as typed: no mark in it starts emphasis, a link, a heading or a tag. One line. */
export const escapeMarkdown = (s: string): string => escapePiece(s.trim());

/** An address inside `<…>` (a link destination that may hold brackets and parentheses). */
const destination = (url: string) => `<${url.replace(/</g, '%3C').replace(/>/g, '%3E')}>`;
const mdLink = (label: string, url: string) => `[${escapeMarkdown(label)}](${destination(url)})`;
const mdImage = (src: string, alt: string) => `![${escapeMarkdown(alt)}](${destination(src)})`;
const mdCaption = (caption: string | undefined) => (caption?.trim() ? `*${escapeMarkdown(caption)}*` : '');
/** Every line of a piece of Markdown inside a quote. */
const mdQuote = (markdown: string) =>
  markdown
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
/** A heading's text with its `*phrase*` kept as Markdown emphasis (the same meaning as on the page: italic). */
const mdHeadingText = (source: string) =>
  titleParts(source)
    .map((part) => (part.em ? `*${escapeMarkdown(part.text)}*` : escapePiece(part.text)))
    .join('')
    .trim();
const join = (...parts: (string | undefined | false)[]) => parts.filter((p): p is string => !!p && !!p.trim()).join('\n\n');

/** A picture as Markdown with its caption under it; a decorative one (it says nothing) is left out. */
const mdPicture = (p: { image: string; alt: string; decorative?: boolean; caption?: string }) =>
  p.decorative ? mdCaption(p.caption) : join(mdImage(p.image, p.alt), mdCaption(p.caption));

/** The labels the page gives a callout without a title (the Callout article component). */
const CALLOUT_LABEL = { info: 'Note', tip: 'Tip', warn: 'Warning' } as const;

// ---- What each block contributes ----------------------------------------------------------------------------------------

interface Projection<K extends SectionType> {
  /** The block's words as a reader reads them, one string per paragraph-ish piece. Code, alt text and site chrome are not counted. */
  text: (block: SectionOf<K>) => string[];
  /** The block as Markdown for a feed reader. '' when it means nothing outside the page (a spacer, the latest posts, a sign-up form). */
  markdown: (block: SectionOf<K>) => string;
}

const nothing = { text: () => [], markdown: () => '' };

const BLOCKS: { [K in SectionType]: Projection<K> } = {
  heading: {
    text: (d) => [headingPlainText(d.text)],
    markdown: (d) => `${'#'.repeat(d.level)} ${mdHeadingText(d.text)}`,
  },
  lead: { text: (d) => [markdownToText(d.text)], markdown: (d) => d.text.trim() },
  text: { text: (d) => [markdownToText(d.text)], markdown: (d) => d.text.trim() },
  quote: {
    text: (d) => [markdownToText(d.text), d.attribution ?? ''],
    // A last "— Name" line is how the site's own Markdown marks who said it (docs/CONTENT_MODEL.md "Markdown the site understands").
    markdown: (d) => mdQuote(join(d.text.trim(), d.attribution?.trim() && `— ${escapeMarkdown(d.attribution)}`)),
  },
  // It repeats a line of the text above (screen readers skip it too), so it is neither counted nor repeated in a feed.
  pullquote: nothing,
  callout: {
    text: (d) => [d.title ?? '', markdownToText(d.text)],
    markdown: (d) => mdQuote(join(`**${escapeMarkdown(d.title || CALLOUT_LABEL[d.kind])}.**`, d.text.trim())),
  },
  code: {
    // Code is not prose: a Markdown body's code blocks are not counted either.
    text: () => [],
    markdown: (d) => {
      const longest = Math.max(0, ...[...d.code.matchAll(/`+/g)].map((m) => m[0].length));
      const fence = '`'.repeat(Math.max(3, longest + 1));
      return join(d.title && `*${escapeMarkdown(d.title)}*`, `${fence}${d.lang === 'text' ? '' : d.lang}\n${d.code.replace(/\n+$/, '')}\n${fence}`);
    },
  },
  image: { text: (d) => [d.caption ?? ''], markdown: (d) => mdPicture(d) },
  'image-row': {
    text: (d) => [...d.images.map((i) => i.caption ?? ''), d.caption ?? ''],
    markdown: (d) => join(...d.images.map(mdPicture), mdCaption(d.caption)),
  },
  gallery: {
    text: (d) => d.shots.map((s) => s.caption ?? ''),
    markdown: (d) => join(...d.shots.map((s) => mdPicture({ ...s, decorative: false }))),
  },
  portrait: {
    text: (d) => [markdownToText(d.text)],
    markdown: (d) => join(d.decorative ? '' : mdImage(d.image, d.alt), d.text.trim()),
  },
  video: {
    text: (d) => [d.caption ?? ''],
    markdown: (d) => join(mdLink(`Watch the video: ${d.title}`, `https://www.youtube.com/watch?v=${d.youtubeId}`), mdCaption(d.caption)),
  },
  game: {
    text: (d) => [d.playNote ?? ''],
    markdown: (d) => join(mdLink(`Play ${d.title}`, d.playUrl), d.playNote && escapeMarkdown(d.playNote)),
  },
  columns: {
    text: (d) => [markdownToText(d.left), markdownToText(d.right)],
    markdown: (d) => join(d.left.trim(), d.right.trim()),
  },
  divider: { text: () => [], markdown: () => '---' },
  spacer: nothing,
  links: {
    text: (d) => d.items.flatMap((i) => [i.label, i.note ?? '']),
    markdown: (d) => d.items.map((i) => `- ${mdLink(i.label, i.url)}${i.note?.trim() ? ` (${escapeMarkdown(i.note)})` : ''}`).join('\n'),
  },
  button: { text: (d) => [d.label], markdown: (d) => mdLink(d.label, d.url) },
  // A contents list of the page's own headings: a feed reader has the headings themselves.
  toc: nothing,
  stats: { text: () => [], markdown: (d) => mdLink(`${d.repo} on GitHub`, `https://github.com/${d.repo}`) },
  // Built from the site at build time (other posts, an author's bio, the sign-up form): not this post's words.
  latest: nothing,
  author: nothing,
  newsletter: nothing,
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

/** A sections body as plain Markdown, in page order: what a feed reader gets. Relative addresses stay relative (the feed makes them absolute). */
export function sectionsToMarkdown(sections: readonly Section[]): string {
  const body = sections
    .map((block) => projectionOf(block).markdown(block))
    .filter((md) => md.trim())
    .join('\n\n');
  return body ? `${body}\n` : '';
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
