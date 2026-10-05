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

/** The h2 and h3 of a Markdown source (`##` and `###` outside code fences): good enough for the preview's list. */
export function headingsOfMarkdown(markdown: string): { depth: 2 | 3; text: string }[] {
  const found: { depth: 2 | 3; text: string }[] = [];
  let fence: string | undefined;
  for (const line of markdown.split('\n')) {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker) {
      fence = fence === marker ? undefined : (fence ?? marker);
      continue;
    }
    if (fence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      found.push({
        depth: match[1].length as 2 | 3,
        text: match[2].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim(),
      });
    }
  }
  return found;
}
