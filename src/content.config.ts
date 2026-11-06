import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { authorSchema, pageSchema, postSchemas, type PostKind } from './lib/content-schemas';

// Schema from docs/CONTENT_MODEL.md. The schemas themselves are in src/lib/content-schemas.ts, so the editor runs the same rules
// when Save is pressed (src/admin/content-check.ts); this file says where each collection's files are and hands the schemas
// Astro's `image()` and `reference()`.

const post = (kind: PostKind, base = `./src/content/${kind}`) =>
  defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base }),
    schema: ({ image }) => postSchemas({ reference, image })[kind],
  });

// Pages made of blocks (docs/CONTENT_MODEL.md "Pages"): About, the home page, the archives, the Apps hub and the tag index.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/pages' }),
  schema: pageSchema,
});

// The people and agents a post can be credited to (docs/CONTENT_MODEL.md "Authors").
const authors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/authors' }),
  schema: () => authorSchema,
});

const posts = {
  news: post('news'),
  blog: post('blog'),
  vlogs: post('vlogs'),
  projects: post('projects'),
  repos: post('repos'),
};

// The tests' fixtures: one post per kind written as sections, in tests/fixtures/posts/<kind>/, read through the same schema as the
// real kind and drawn by the same page components at /styleguide/posts/<kind>/ (noindex, unlinked, like the rest of the styleguide).
// Only getFixturePosts() reads them (src/lib/content-queries.ts): never an archive, the sitemap or search.
export const collections = {
  authors,
  ...posts,
  fixtureNews: post('news', './tests/fixtures/posts/news'),
  fixtureBlog: post('blog', './tests/fixtures/posts/blog'),
  fixtureVlogs: post('vlogs', './tests/fixtures/posts/vlogs'),
  fixtureProjects: post('projects', './tests/fixtures/posts/projects'),
  fixtureRepos: post('repos', './tests/fixtures/posts/repos'),
  pages,
};
