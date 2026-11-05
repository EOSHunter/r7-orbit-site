// Pure helpers over content entries: no Astro imports, so they run under Vitest.
// The Astro-bound loaders are in content-queries.ts.
import type { Section } from './sections';
import { hasSections, sectionsToText } from './sections-to-content';

export type CollectionName = 'news' | 'blog' | 'vlogs' | 'projects' | 'repos';

/** The fields the helpers read. Every collection's `data` satisfies this. */
export interface PostData {
  title: string;
  date: Date;
  updated?: Date;
  tags: string[];
  featured: boolean;
  draft: boolean;
  readTime?: number;
  /** Reference to src/content/authors; absent means the default author (lib/authors.ts). */
  author?: { id: string };
  series?: string;
  seriesOrder?: number;
  /** The body written as blocks (docs/SECTIONS.md). When it holds any, the Markdown body is empty (`bodyConflict`). */
  sections?: readonly Section[];
}

export interface Post<D extends PostData = PostData> {
  collection: CollectionName;
  id: string;
  data: D;
  body?: string;
}

export interface PublishOptions {
  now?: Date;
  /** Dev server: drafts and scheduled posts are shown so they can be previewed. */
  includeUnpublished?: boolean;
}

export const WORDS_PER_MINUTE = 220;

export function postUrl(post: Pick<Post, 'collection' | 'id'>): string {
  return `/${post.collection}/${post.id}/`;
}

export function isDraft(post: Post): boolean {
  return post.data.draft;
}

/** Future-dated: hidden until the day arrives. Dates are calendar days in UTC, like the rest of the site. */
export function isScheduled(post: Post, now: Date = new Date()): boolean {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return post.data.date.getTime() > today;
}

export function isPublished(
  post: Post,
  { now = new Date(), includeUnpublished = false }: PublishOptions = {},
): boolean {
  if (includeUnpublished) return true;
  return !isDraft(post) && !isScheduled(post, now);
}

/** Draft wins over scheduled. Only meaningful in dev, where unpublished posts are shown; production builds drop them. */
export type PublishState = 'published' | 'draft' | 'scheduled';

export function publishState(post: Post, now: Date = new Date()): PublishState {
  if (isDraft(post)) return 'draft';
  return isScheduled(post, now) ? 'scheduled' : 'published';
}

/** Badge text for the dev preview: "Draft", "Scheduled for Oct 12, 2026", or undefined for a published post. */
export function previewLabel(post: Post, now: Date = new Date()): string | undefined {
  const state = publishState(post, now);
  if (state === 'draft') return 'Draft';
  if (state === 'scheduled') {
    const date = post.data.date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return `Scheduled for ${date}`;
  }
  return undefined;
}

export function filterPublished<P extends Post>(posts: P[], options?: PublishOptions): P[] {
  return posts.filter((post) => isPublished(post, options));
}

/** Newest first; ties broken by id so the order is stable between builds. */
export function sortByDateDesc<P extends Post>(posts: P[]): P[] {
  return [...posts].sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}

/** Words in the prose of a Markdown body: code blocks, HTML tags and link/image syntax are not counted. */
export function countWords(markdown: string): number {
  const text = markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/(```|~~~)[\s\S]*?\1/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** The words of a post's body: its sections as plain text (sections-to-content.ts) when it is written as sections, else its Markdown. */
export function bodyWords(post: Pick<Post, 'body' | 'data'>): number {
  return hasSections(post.data) ? countWords(sectionsToText(post.data.sections ?? [])) : countWords(post.body ?? '');
}

/** Reading time in whole minutes, rounded up, at least 1. A `readTime` in the frontmatter wins. */
export function readTime(post: Pick<Post, 'body' | 'data'>): number {
  if (post.data.readTime) return post.data.readTime;
  return Math.max(1, Math.ceil(bodyWords(post) / WORDS_PER_MINUTE));
}

/**
 * A post is written one way: as `sections` (blocks in the front matter) or as a Markdown body under the front matter, never both
 * (docs/CONTENT_MODEL.md "Body: Markdown or sections"). The message for a post that has both, naming its file; undefined when it is fine.
 * An empty `sections: []` (what the editor writes for a post without blocks) is not sections.
 */
export function bodyConflict(file: string, post: Pick<Post, 'body' | 'data'>): string | undefined {
  if (!hasSections(post.data) || !post.body?.trim()) return undefined;
  return (
    `${file}: this post has both sections and a Markdown body. A post is written one way or the other: ` +
    'to keep the sections, delete the text under the front matter (in the editor: empty the Body box); ' +
    'to keep the Markdown, remove the sections (sections: []).'
  );
}

export interface TagCount {
  tag: string;
  count: number;
}

/** Tag and count, most used first, then alphabetical. */
export function tagCounts(posts: Post[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of new Set(post.data.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** A tag page `/tags/<tag>/` exists once a tag has two or more posts. */
export function tagsWithPages(posts: Post[]): string[] {
  return tagCounts(posts)
    .filter((t) => t.count >= 2)
    .map((t) => t.tag);
}

export function postsWithTag<P extends Post>(posts: P[], tag: string): P[] {
  return sortByDateDesc(posts.filter((post) => post.data.tags.includes(tag)));
}

const samePost = (a: Post, b: Post) => a.collection === b.collection && a.id === b.id;

/**
 * Posts that share tags with `post`: most shared tags first, then newest, then id (so the order is stable).
 * Drafts and future-dated posts are never returned. A post with no shared tag is never related, so the list can be empty.
 */
export function relatedPosts<P extends Post>(post: Post, candidates: P[], limit = 3, now: Date = new Date()): P[] {
  const mine = new Set(post.data.tags);
  return filterPublished(candidates, { now })
    .filter((c) => !samePost(c, post))
    .map((c) => ({ c, shared: new Set(c.data.tags.filter((t) => mine.has(t))).size }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) => b.shared - a.shared || b.c.data.date.getTime() - a.c.data.date.getTime() || a.c.id.localeCompare(b.c.id))
    .slice(0, limit)
    .map(({ c }) => c);
}

export interface SeriesInfo<P extends Post> {
  name: string;
  /** Every post in the series, in `seriesOrder`. */
  posts: P[];
  /** 1-based position of the current post. */
  position: number;
  prev?: P;
  next?: P;
}

/** The series `post` belongs to, or undefined. Posts with the same `series` value (case-sensitive) link to each other. */
export function seriesFor<P extends Post>(post: Post, candidates: P[]): SeriesInfo<P> | undefined {
  const name = post.data.series;
  if (!name) return undefined;
  const posts = candidates
    .filter((c) => c.data.series === name)
    .sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0) || a.id.localeCompare(b.id));
  const index = posts.findIndex((c) => samePost(c, post));
  if (index === -1) return undefined;
  return { name, posts, position: index + 1, prev: posts[index - 1], next: posts[index + 1] };
}

/** Newer and older neighbours in a date-sorted list (newest first). */
export function adjacentPosts<P extends Post>(post: Post, sorted: P[]): { newer?: P; older?: P } {
  const index = sorted.findIndex((c) => samePost(c, post));
  if (index === -1) return {};
  return { newer: sorted[index - 1], older: sorted[index + 1] };
}

/** The pinned post: the newest featured one. */
export function featuredPost<P extends Post>(posts: P[]): P | undefined {
  return sortByDateDesc(posts.filter((p) => p.data.featured))[0];
}

/** The post a page's Pinned post block shows: the featured one, when the page has the block and more than one post is published
 *  (with one, the block is left out). The page's Latest feed leaves it out, so the same card is not shown twice. */
export function pinnedPost<P extends Post>(posts: P[], pageHasPinned = true): P | undefined {
  return pageHasPinned && posts.length > 1 ? featuredPost(posts) : undefined;
}

/** Problems that should warn, not fail: two featured posts, repeated title + kind, repeated series order. */
export function contentWarnings(posts: Post[]): string[] {
  const warnings: string[] = [];
  const label = (p: Post) => `${p.collection}/${p.id}`;

  const featured = posts.filter((p) => p.data.featured);
  if (featured.length > 1) {
    warnings.push(
      `More than one post is featured (${featured.map(label).join(', ')}). Only the newest is pinned; set featured: false on the others.`,
    );
  }

  const titles = new Map<string, Post>();
  for (const p of posts) {
    const key = `${p.collection}:${p.data.title.trim().toLowerCase()}`;
    const other = titles.get(key);
    if (other) warnings.push(`${label(p)} and ${label(other)} have the same title.`);
    else titles.set(key, p);
  }

  const orders = new Map<string, Post>();
  for (const p of posts) {
    if (!p.data.series) continue;
    const key = `${p.data.series}:${p.data.seriesOrder}`;
    const other = orders.get(key);
    if (other)
      warnings.push(
        `${label(p)} and ${label(other)} are both number ${p.data.seriesOrder} in the series "${p.data.series}".`,
      );
    else orders.set(key, p);
  }
  return warnings;
}
