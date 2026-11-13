// What the site has that a block can point at (the tags posts carry, the authors, the blog's series), read from the content collections once per
// build. Drafts and scheduled posts count: a block naming the tag of a post that goes live next week must not fail today.
import { getCollection } from 'astro:content';
import { getAuthors } from '../authors-queries';
import type { Known } from './checks';

const COLLECTIONS = ['news', 'blog', 'vlogs', 'projects', 'repos'] as const;
let known: Promise<Known> | undefined;

export function loadKnown(): Promise<Known> {
  known ??= (async () => {
    const tags = new Set<string>();
    const series = new Set<string>();
    for (const name of COLLECTIONS) {
      for (const entry of await getCollection(name)) for (const tag of entry.data.tags) tags.add(tag);
    }
    // `series` is the blog's own field; the entry type Astro infers for the collection leaves it out, so it is read as optional.
    for (const entry of await getCollection('blog')) {
      const name = (entry.data as { series?: string }).series;
      if (name) series.add(name);
    }
    return { tags: [...tags].sort(), authors: (await getAuthors()).map((a) => a.slug), series: [...series].sort() };
  })();
  return known;
}
