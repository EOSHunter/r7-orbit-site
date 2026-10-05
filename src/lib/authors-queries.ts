// Astro-bound loaders for src/content/authors. The rules (resolving a person from site.json, who a post is credited to) are in authors.ts.
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { resolveAuthor, sortAuthors, type Author, type AuthorData } from './authors';

let cached: Promise<Author[]> | undefined;

/** Every author, people first. Fails the build, in words, if a file's `slug` is not its file name. */
export function getAuthors(): Promise<Author[]> {
  cached ??= getCollection('authors').then((entries) =>
    sortAuthors(
      entries.map((entry) => {
        const data = entry.data as AuthorData;
        if (data.slug !== entry.id) {
          throw new Error(`src/content/authors/${entry.id}.json has slug "${data.slug}": the slug must be the file name ("${entry.id}").`);
        }
        return resolveAuthor(data, site.author);
      }),
    ),
  );
  return cached;
}

export async function getAuthorMap(): Promise<Map<string, Author>> {
  return new Map((await getAuthors()).map((author) => [author.slug, author]));
}
