// What the listing pages share: the five kinds (their names and the words of their counts), page URLs, and paging. Pure, so it
// runs under Vitest.
import type { CollectionName } from './content';

export const PAGE_SIZE = 12;

export interface KindInfo {
  /** Content collection, and the first segment of the URL. */
  collection: CollectionName;
  /** The nav label. */
  label: string;
  /** Kind icon name. */
  icon: 'news' | 'blog' | 'vlog' | 'project' | 'repo';
  /** Words for "N ___" in the live count. */
  noun: string;
  nounOne: string;
}

// The archives' own words (heading, lead, description, empty state) are their entries in src/content/pages/, edited in /admin.
export const KINDS: KindInfo[] = [
  { collection: 'news', label: 'News', icon: 'news', noun: 'items', nounOne: 'item' },
  { collection: 'blog', label: 'Blog', icon: 'blog', noun: 'posts', nounOne: 'post' },
  { collection: 'vlogs', label: 'Vlogs', icon: 'vlog', noun: 'videos', nounOne: 'video' },
  { collection: 'projects', label: 'Projects', icon: 'project', noun: 'projects', nounOne: 'project' },
  { collection: 'repos', label: 'Repos', icon: 'repo', noun: 'repos', nounOne: 'repo' },
];

export function kindInfo(collection: CollectionName): KindInfo {
  const info = KINDS.find((k) => k.collection === collection);
  if (!info) throw new Error(`Unknown kind: ${collection}`);
  return info;
}

/** `/blog/` for page 1, `/blog/page/2/` after. `base` ends with a slash. */
export function pageUrl(base: string, page: number): string {
  return page <= 1 ? base : `${base}page/${page}/`;
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
  /** Index of the first item of this page in the full list. */
  start: number;
}

export function paginate<T>(all: T[], page: number, size = PAGE_SIZE): Page<T> {
  const pages = pageCount(all.length, size);
  const start = (page - 1) * size;
  return { items: all.slice(start, start + size), page, pages, start };
}

/** Page numbers to link to: first, last, and two either side of the current one; `null` is a gap. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2]);
  const out: (number | null)[] = [];
  let last = 0;
  for (let n = 1; n <= pages; n++) {
    if (!keep.has(n)) continue;
    if (n - last > 1) out.push(null);
    out.push(n);
    last = n;
  }
  return out;
}

/** "1 post", "12 posts". */
export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
