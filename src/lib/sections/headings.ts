// The headings of a page of blocks, for the Table of contents block: their text, depth and anchor. Pure, no Astro.
// The page reads them from the blocks and the finished HTML of its Markdown boxes; the admin preview, which has no finished HTML,
// reads the Markdown source (`headingsOfMarkdown`).
import { plainText, slugify } from '../article';
import { titleParts } from '../text';

export interface PageHeading {
  depth: 2 | 3;
  slug: string;
  text: string;
}

/** A heading block's text with its `*phrase*` marker taken out: what a reader sees. */
export const headingPlainText = (source: string): string =>
  titleParts(source)
    .map((part) => part.text)
    .join('');

/** Hands out ids that are unique on the page: a second "Notes" becomes "notes-1". */
export class SlugBook {
  private seen = new Map<string, number>();

  next(text: string): string {
    const slug = slugify(text) || 'section';
    const count = this.seen.get(slug) ?? 0;
    this.seen.set(slug, count + 1);
    return count ? `${slug}-${count}` : slug;
  }
}

const HEADING_TAG = /<h([23])>([\s\S]*?)<\/h\1>/g;

/** The h2 and h3 of a piece of sanitised HTML, in order. */
export function headingsInHtml(html: string): { depth: 2 | 3; text: string }[] {
  return [...html.matchAll(HEADING_TAG)].map((m) => ({ depth: Number(m[1]) as 2 | 3, text: plainText(m[2]) }));
}

/** The same HTML with an id on each h2 and h3, taken from `slugs` in order. */
export function withHeadingIds(html: string, slugs: string[]): string {
  let i = 0;
  return html.replace(HEADING_TAG, (_all, level: string, inner: string) => {
    const slug = slugs[i++];
    return slug ? `<h${level} id="${slug}">${inner}</h${level}>` : _all;
  });
}

/** A heading's Markdown as the words a reader sees: links and pictures by their text, no emphasis, code or tag marks. */
const headingWords = (source: string): string =>
  source
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// A line's container marks: a quote's `>` and a list item's `-`, `*`, `+` or `1.` (a heading can sit inside either).
const CONTAINER = /^(?:\s{0,3}(?:>|[-*+]|\d{1,9}[.)])(?:\s+|$))+/;

/**
 * The h2 and h3 of a Markdown source, in order, as the site's Markdown reader finds them: `##` and `###` lines, and a paragraph
 * underlined with `---` (an h2), also inside a quote or a list item; nothing inside a code fence. The build checks that its count
 * matches the rendered HTML (prepare.ts), so a heading this misses is a readable build error, not a dead link in the contents list.
 */
export function headingsOfMarkdown(markdown: string): { depth: 2 | 3; text: string }[] {
  const found: { depth: 2 | 3; text: string }[] = [];
  let fence: { char: string; length: number } | undefined;
  // The paragraph being read, which a `---` line under it turns into a heading. A list item's text cannot be underlined.
  let paragraph: string[] = [];
  let paragraphInList = false;
  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const marks = CONTAINER.exec(raw)?.[0] ?? '';
    const line = raw.slice(marks.length);
    const opener = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (opener && opener[0] === fence.char && opener.length >= fence.length && !line.slice(line.indexOf(opener) + opener.length).trim()) {
        fence = undefined;
      }
      continue;
    }
    if (opener) {
      fence = { char: opener[0], length: opener.length };
      paragraph = [];
      continue;
    }
    const atx = /^\s{0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/.exec(line);
    if (atx) {
      if (atx[1].length === 2 || atx[1].length === 3) found.push({ depth: atx[1].length as 2 | 3, text: headingWords(atx[2] ?? '') });
      paragraph = [];
      continue;
    }
    const underline = /^\s{0,3}(=+|-+)\s*$/.exec(line)?.[1];
    if (underline && paragraph.length && !paragraphInList && !/[-*+]|\d[.)]/.test(marks)) {
      if (underline[0] === '-') found.push({ depth: 2, text: headingWords(paragraph.join(' ')) });
      paragraph = [];
      continue;
    }
    if (!line.trim() || /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      paragraph = [];
      continue;
    }
    if (!paragraph.length) paragraphInList = /[-*+]|\d[.)]/.test(marks);
    paragraph.push(line.trim());
  }
  return found;
}
