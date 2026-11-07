// Authors, pure (no Astro imports) so it runs under Vitest. The Astro-bound loaders are in authors-queries.ts.
// Two kinds: a person (name, bio and photo come from src/data/site.json, never copied) and an agent (R7: everything is in its file).
import type { Post } from './content';
import type { JsonLd } from './seo';
import { absoluteUrl } from './text';

export type AuthorKind = 'person' | 'agent';

/** Who a post is credited to when it has no `author`. */
export const DEFAULT_AUTHOR = 'hunter-newton';

/** The label on an agent's byline. Words, not colour: brass is the only accent. */
export const AGENT_LABEL = 'AI-written';

/** The label for an agent where nothing it wrote is shown: the Team block, and the page of an agent with no posts. */
export const AGENT_KIND_LABEL = 'AI agent';

/** What `src/content/authors/<slug>.json` holds (the shape of the schema in content.config.ts). */
export interface AuthorData {
  slug: string;
  kind: AuthorKind;
  /** Required for an agent. A person without one is named in site.json. */
  name?: string;
  subtitle?: string;
  /** Required for an agent. A person without one is described in site.json. */
  bio?: string;
  avatar?: string;
  /** What the avatar shows, read where it is drawn large. Absent: the picture is decorative (the name is beside it). */
  avatarAlt?: string;
}

/** `author.*` in src/data/site.json: the source for the person's name, bio and photo. */
export interface SiteAuthor {
  name: string;
  bio: string;
  photo?: string | null;
}

export interface Author {
  slug: string;
  kind: AuthorKind;
  name: string;
  subtitle?: string;
  bio: string;
  /** A picture to show: the person's photo, or the agent's mark. Without one the avatar shows initials. */
  avatar?: string;
  avatarAlt?: string;
  /** `/authors/<slug>/` */
  path: string;
}

export const isAgent = (author: Pick<Author, 'kind'>) => author.kind === 'agent';

export const authorPath = (slug: string) => `/authors/${slug}/`;

/** The author as shown: a person's missing name, bio or photo are read from site.json, so nothing is written twice. */
export function resolveAuthor(data: AuthorData, site: SiteAuthor): Author {
  const person = data.kind === 'person';
  const name = data.name ?? (person ? site.name : undefined);
  const bio = data.bio ?? (person ? site.bio : undefined);
  if (!name || !bio) throw new Error(`Author "${data.slug}" needs a name and a bio.`);
  return {
    slug: data.slug,
    kind: data.kind,
    name,
    subtitle: data.subtitle,
    bio,
    avatar: data.avatar ?? (person ? (site.photo ?? undefined) : undefined),
    avatarAlt: data.avatarAlt,
    path: authorPath(data.slug),
  };
}

/** The "How this was made" lines for `aiAssist` (docs/DECISIONS.md §C). */
export const ASSIST_NOTES = {
  edited: 'Written by me and edited with AI help.',
  drafted: 'The first draft was written with AI help.',
} as const;

/**
 * The "How this was made" note, or undefined. An agent's post is already labelled "AI-written" in its byline, so `aiAssist` adds
 * nothing there: one disclosure per page, not two.
 */
export function assistNote(aiAssist: 'none' | 'edited' | 'drafted' | undefined, author: Pick<Author, 'kind'>): string | undefined {
  if (!aiAssist || aiAssist === 'none' || isAgent(author)) return undefined;
  return ASSIST_NOTES[aiAssist];
}

/** The empty state of an author's page: an agent with no posts is said to be one, plainly, with no promise of posts to come. */
export function noPostsText(author: Pick<Author, 'kind' | 'name'>): string {
  return isAgent(author) ? `${author.name} is an AI agent and has no posts on this site.` : `Nothing by ${author.name} is posted yet.`;
}

/** Up to two capital letters, for an avatar with no picture. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0]?.toUpperCase() ?? '')
    .join('');
}

/** The slug a post is credited to. `author` is a reference ({ id }) once Astro has parsed it; absent means the default. */
export function authorSlugOf(post: Pick<Post, 'data'>): string {
  return post.data.author?.id ?? DEFAULT_AUTHOR;
}

export function postsByAuthor<P extends Post>(posts: P[], slug: string): P[] {
  return posts.filter((post) => authorSlugOf(post) === slug);
}

/** Blog posts whose featured image an agent made, by the agent's name (`featuredImageBy: agent`, `featuredImageAgent: <name>`),
 *  in the order given. Shown on that agent's page, e.g. Pictor's images (2026-11-07). */
export function imagesByAgent<P extends Post>(posts: P[], name: string): P[] {
  return posts.filter((post) => {
    const d = post.data as { featuredImage?: unknown; featuredImageBy?: unknown; featuredImageAgent?: unknown };
    return post.collection === 'blog' && !!d.featuredImage && d.featuredImageBy === 'agent'
      && typeof d.featuredImageAgent === 'string' && d.featuredImageAgent.trim() === name;
  });
}

/** Only authors with at least one of `posts`, in the order of `authors`. */
export function authorsWithPosts(authors: Author[], posts: Post[]): Author[] {
  const used = new Set(posts.map(authorSlugOf));
  return authors.filter((author) => used.has(author.slug));
}

/** People first, then agents; alphabetical inside each. The same order everywhere authors are listed. */
export function sortAuthors(authors: Author[]): Author[] {
  return [...authors].sort((a, b) => Number(isAgent(a)) - Number(isAgent(b)) || a.name.localeCompare(b.name));
}

/**
 * Readable build errors for posts that name an author who does not exist. An empty list means every post is fine.
 * Run over every entry (drafts and scheduled posts too), so a typo is caught before the post goes live.
 */
export function unknownAuthorErrors(posts: Post[], known: string[]): string[] {
  return posts
    .filter((post) => !known.includes(authorSlugOf(post)))
    .map(
      (post) =>
        `${post.collection}/${post.id} has author "${authorSlugOf(post)}", but there is no author with that slug. ` +
        `Authors are: ${known.join(', ') || '(none)'}. Fix the "author" field in the post, or add src/content/authors/${authorSlugOf(post)}.json.`,
    );
}

// ---- Structured data -------------------------------------------------------------------------------------------------

/**
 * schema.org author: a Person for a person, an Organization for an agent (an agent is not a person, so it is not marked up as one).
 * `profiles` (the owner's own links, from site.json) go on a person only.
 */
export function authorLd(author: Author, base: string, profiles: string[] = []): JsonLd {
  const url = absoluteUrl(author.path, base);
  if (isAgent(author)) {
    return { '@type': 'Organization', name: author.name, description: author.subtitle, url };
  }
  return {
    '@type': 'Person',
    name: author.name,
    url,
    image: author.avatar ? new URL(author.avatar, base).href : undefined,
    sameAs: profiles,
  };
}

/** The author page's own data: a ProfilePage whose mainEntity is that Person or Organization. */
export function authorProfilePageLd(author: Author, base: string, profiles: string[] = []): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: absoluteUrl(author.path, base),
    name: author.name,
    mainEntity: { ...authorLd(author, base, profiles), ...(isAgent(author) ? {} : { description: author.bio }) },
  };
}
