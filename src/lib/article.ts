// Pure helpers for the article component library (src/components/article/). Unit-tested in article.vitest.ts.

/** Heading text to an id: lowercase words joined with hyphens (what Astro's own heading ids look like). */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

/** Strips tags from rendered HTML to get the plain heading text. */
export function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

let counter = 0;
/** A page-unique id for things that need one (code blocks the copy button points at). */
export function uniqueId(prefix: string): string {
  return `${prefix}-${++counter}`;
}

export type ImageSource = string | { src: string; width?: number; height?: number };

/** Rule 4 in docs/CONTENT_MODEL.md: images come from this site, never another one. */
export function resolveImage(source: ImageSource, where: string): { src: string; width?: number; height?: number } {
  const image = typeof source === 'string' ? { src: source } : source;
  if (/^(https?:)?\/\//i.test(image.src)) {
    throw new Error(`${where}: "${image.src}" loads from another site. Put the file in public/media/ and use that path.`);
  }
  return image;
}

export interface TocItem {
  slug: string;
  text: string;
  children: { slug: string; text: string }[];
}

/** h2 at the top level, h3 nested under the h2 before it; other depths are left out. */
export function tocTree(headings: { depth: number; slug: string; text: string }[], maxDepth: 2 | 3 = 3): TocItem[] {
  const tree: TocItem[] = [];
  for (const h of headings) {
    if (h.depth === 2) tree.push({ slug: h.slug, text: h.text, children: [] });
    else if (h.depth === 3 && maxDepth === 3 && tree.length) tree[tree.length - 1].children.push({ slug: h.slug, text: h.text });
  }
  return tree;
}
