// The build's own content rules, run in the editor when Save is pressed. A post, page or author the build would stop on is not
// saved, and the author is told what to fix. Deploys failed again and again because a rule lived only in the build (a series
// without its part number, a block picture without alt text, a vlog without a video, a stray "{" in a blog post): rather than copy
// each rule into the form, this runs the very schemas the build reads the files with (src/lib/content-schemas.ts), and parses a
// blog post's body as MDX with the parser the build uses. Pure apart from the Decap handler at the end: Vitest runs it.
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { z } from 'astro/zod';
import { authorSchema, pageSchema, POST_KINDS, postSchemas, type PostKind } from '../lib/content-schemas';
import { contactProblems as contactRule } from '../lib/no-contact.mjs';

type Data = Record<string, unknown>;

// What the editor has for Astro's two helpers: a picture is its path, an author is its slug (checked against the list below).
const editorSchemas = postSchemas({ reference: () => z.string(), image: () => z.string() });

/** The labels of a collection's fields, so a message names the box the author sees ("Part number in the series", not seriesOrder). */
export type FieldLabels = Record<string, string>;

const describe = (issue: z.core.$ZodIssue, labels: FieldLabels) => {
  const [first, ...rest] = issue.path.map(String);
  const where = first === undefined ? '' : `${labels[first] ?? first}${rest.length ? ` › ${rest.join(' › ')}` : ''}: `;
  return `${where}${issue.message}`;
};

/** The problems the schema of `collection` finds in the data the editor is about to save. Empty when the build would read it. */
export function schemaProblems(collection: string, data: Data, labels: FieldLabels = {}): string[] {
  const { body: _body, ...frontMatter } = data;
  void _body;
  const schema = (POST_KINDS as readonly string[]).includes(collection)
    ? editorSchemas[collection as PostKind]
    : collection === 'pages'
      ? pageSchema
      : collection === 'authors'
        ? authorSchema
        : undefined;
  if (!schema) return [];
  const result = schema.safeParse(frontMatter);
  return result.success ? [] : result.error.issues.map((issue) => describe(issue, labels));
}

/** A post credited to an author the site does not have stops the build (unknownAuthorErrors in src/lib/authors.ts). */
export function authorProblems(collection: string, data: Data, authors: string[]): string[] {
  if (!(POST_KINDS as readonly string[]).includes(collection)) return [];
  const author = typeof data.author === 'string' && data.author.trim() ? data.author.trim() : undefined;
  return author && !authors.includes(author) ? [`Author: there is no author "${author}". Choose one from the list.`] : [];
}

/**
 * A blog post's body is MDX: a "{", a "<" or an autolink the rich text editor writes as typed is code to MDX, and the build stops
 * ("Could not parse expression with acorn"). Parsed here with remark-mdx, the parser @astrojs/mdx uses, before the post is saved.
 */
export function mdxProblems(collection: string, data: Data): string[] {
  if (collection !== 'blog' || typeof data.body !== 'string' || !data.body.trim()) return [];
  try {
    unified().use(remarkParse).use(remarkMdx).parse(data.body);
    return [];
  } catch (error) {
    const e = error as { reason?: string; message?: string; line?: number; place?: { line?: number } };
    const line = e.line ?? e.place?.line;
    const reason = String(e.reason ?? e.message ?? error).replace(/\s*\(see https?:\S+\)\.?$/, '');
    return [
      `Body${line ? `, line ${line}` : ''}: ${reason}. In a blog post a "{" or "<" in the text is read as code: ` +
        'write it inside backticks (`like {this}`), or reword it; a link whose text is its own address should get words instead.',
    ];
  }
}

/** A Video block in a blog body needs an 11-character YouTube id (YouTubeFacade stops the build on anything else, e.g. a Vimeo link). */
export function videoProblems(collection: string, data: Data): string[] {
  if (collection !== 'blog' || typeof data.body !== 'string') return [];
  return [...data.body.matchAll(/<VideoEmbed\b[^>]*?\bid="([^"]*)"/g)]
    .filter((m) => !/^[\w-]{11}$/.test(m[1]))
    .map((m) => `Video block: "${m[1]}" is not a YouTube video the site can show. Paste the video's YouTube link (youtu.be/… or youtube.com/watch?v=…).`);
}

/** An author's file is named after its slug, and posts name the author by it: an existing author's slug cannot change. */
export function authorSlugProblems(collection: string, data: Data, { slug, isNew }: { slug?: string; isNew?: boolean }): string[] {
  if (collection !== 'authors' || isNew || !slug) return [];
  return data.slug === slug
    ? []
    : [`Slug: this author is "${slug}", and posts are credited to it by that name, so it cannot change. Put the old slug back; to rename the author, change the Name.`];
}

/** Email-shaped text on a public page stops the build (scripts/no-contact.mjs: the site publishes no contact details). */
export function contactProblems(data: Data): string[] {
  const found = contactRule(JSON.stringify(data)) as string[];
  return found.length
    ? [`This would publish ${found.join(' and ')}, and the site never shows a way to email its author. Remove it (a git command can use the https:// address instead).`]
    : [];
}

/** Everything the build would stop on in this entry, as sentences. */
export function contentProblems(collection: string, data: Data, { labels = {}, authors = [] }: { labels?: FieldLabels; authors?: string[] } = {}): string[] {
  return [
    ...schemaProblems(collection, data, labels),
    ...authorProblems(collection, data, authors),
    ...mdxProblems(collection, data),
    ...videoProblems(collection, data),
    ...contactProblems(data),
  ];
}

interface Entry {
  get(key: string): unknown;
}

/** The Decap `preSave` handler: throws one message listing every problem, or lets the save go ahead. */
export function contentSaveCheck({ labelsOf, authors }: { labelsOf: (collection: string) => FieldLabels; authors: string[] }) {
  return ({ entry }: { entry: Entry }): undefined => {
    const collection = String(entry.get('collection') ?? '');
    const data = (entry.get('data') as { toJS?: () => Data } | undefined)?.toJS?.() ?? {};
    const problems = [
      ...contentProblems(collection, data, { labels: labelsOf(collection), authors }),
      ...authorSlugProblems(collection, data, { slug: String(entry.get('slug') ?? ''), isNew: Boolean(entry.get('newRecord')) }),
    ];
    if (problems.length) throw new Error(`Not saved: the site would not build with this. ${problems.join(' · ')}`);
    return undefined;
  };
}
