// Astro-bound loaders: read the collections, apply the draft / future-date rules, and warn about content problems.
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  contentWarnings,
  filterPublished,
  sortByDateDesc,
  type CollectionName,
  type Post,
  type PostData,
} from './content';
import { getAuthors } from './authors-queries';
import { unknownAuthorErrors } from './authors';
import { selectGames } from './games';

type Entry<C extends CollectionName> = CollectionEntry<C>;
/** A collection entry in the shape the pure helpers take; `entry` is what `render()` needs. */
export type SitePost<C extends CollectionName = CollectionName> = Post<Entry<C>['data'] & PostData> & {
  entry: Entry<C>;
};

const NAMES: CollectionName[] = ['news', 'blog', 'vlogs', 'projects', 'repos'];
let warned = false;

function toPost<C extends CollectionName>(collection: C, entry: Entry<C>): SitePost<C> {
  return { collection, id: entry.id, data: entry.data as Entry<C>['data'] & PostData, body: entry.body, entry };
}

/** Published posts of one kind, newest first. In `astro dev`, drafts and scheduled posts are included. */
export async function getPosts<C extends CollectionName>(collection: C): Promise<SitePost<C>[]> {
  const entries = (await getCollection(collection)) as Entry<C>[];
  const posts = entries.map((entry) => toPost(collection, entry));
  // Every entry, drafts included: a mistyped author is an error now, not the day the post goes live.
  const problems = unknownAuthorErrors(posts, (await getAuthors()).map((a) => a.slug));
  if (problems.length) throw new Error(problems.join('\n'));
  return sortByDateDesc(filterPublished(posts, { includeUnpublished: import.meta.env.DEV }));
}

/** Published posts of every kind, newest first. Warns once per build about content problems. */
export async function getAllPosts(): Promise<SitePost[]> {
  const all = (await Promise.all(NAMES.map((name) => getPosts(name)))).flat() as SitePost[];
  if (!warned) {
    warned = true;
    for (const warning of contentWarnings(all)) console.warn(`[content] ${warning}`);
  }
  return sortByDateDesc(all);
}

/** Published games (projects with a playUrl) in hub order: `order`, then newest. Goes through the same draft / scheduled rules as every list. */
export async function getGames(): Promise<SitePost<'projects'>[]> {
  return selectGames(await getPosts('projects'), { includeUnpublished: import.meta.env.DEV });
}
