// What the listing pages share: the five kinds and their copy, page URLs, and paging. Pure, so it runs under Vitest.
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
  /** h1 with the one italic-brass phrase marked by asterisks. */
  title: string;
  lead: string;
  description: string;
  empty: string;
}

export const KINDS: KindInfo[] = [
  {
    collection: 'news',
    label: 'News',
    icon: 'news',
    noun: 'items',
    nounOne: 'item',
    title: 'News, with my *take* on it',
    lead: 'Short items on what happened in AI and what I would do about it. Each one links to its source.',
    description: 'Short news items on AI, each with a link to the source and my take on what it means.',
    empty: 'No news items yet.',
  },
  {
    collection: 'blog',
    label: 'Blog',
    icon: 'blog',
    noun: 'posts',
    nounOne: 'post',
    title: 'Writing about *building with agents*',
    lead: 'Longer posts about the things I make and how they went. Filter by tag, search the titles, or read from the top.',
    description: 'Longer posts about building with AI agents: what I tried, what happened and what I would do again.',
    empty: 'No posts yet.',
  },
  {
    collection: 'vlogs',
    label: 'Vlogs',
    icon: 'vlog',
    noun: 'videos',
    nounOne: 'video',
    title: 'Videos, with the *notes* underneath',
    lead: 'Builds and walkthroughs on video, each with chapters, links and the notes the video cannot show.',
    description: 'Videos about building with AI, each with chapters, links and written notes.',
    empty: 'No videos yet.',
  },
  {
    collection: 'projects',
    label: 'Projects',
    icon: 'project',
    noun: 'projects',
    nounOne: 'project',
    title: 'Things I am *making*',
    lead: 'What each project is, why I built it, how it works and what I learned.',
    description: 'Projects I am building with AI: what they are, why I built them and what I learned.',
    empty: 'No projects yet.',
  },
  {
    collection: 'repos',
    label: 'Repos',
    icon: 'repo',
    noun: 'repos',
    nounOne: 'repo',
    title: 'Code you can *use*',
    lead: 'Open-source repositories, with stats from GitHub refreshed daily.',
    description: 'Open-source repositories from my work with AI, with stats from GitHub.',
    empty: 'No repos yet.',
  },
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
