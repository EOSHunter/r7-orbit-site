import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import site from '../data/site.json';
import {
  AGENT_LABEL,
  DEFAULT_AUTHOR,
  assistNote,
  authorLd,
  authorPath,
  authorProfilePageLd,
  authorSlugOf,
  authorsWithPosts,
  imagesByAgent,
  initials,
  isAgent,
  postsByAuthor,
  resolveAuthor,
  sortAuthors,
  unknownAuthorErrors,
  type AuthorData,
} from './authors';
import type { CollectionName, Post } from './content';

// The real schema, with Astro's two virtual modules stood in for (the same as src/admin/config.vitest.ts).
vi.mock('astro:content', async () => {
  const { z } = await import('astro/zod');
  return {
    defineCollection: (c: unknown) => c,
    reference: (collection: string) => z.string().transform((id) => ({ collection, id })),
  };
});
vi.mock('astro/loaders', () => ({ glob: () => ({}) }));

// Docs may have CRLF line endings on Windows.
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf-8').split('\r\n').join('\n');
const authorFile = (slug: string) => JSON.parse(read(`../content/authors/${slug}.json`)) as AuthorData;

const hunter = resolveAuthor(authorFile('hunter-newton'), site.author);
const r7 = resolveAuthor(authorFile('r7'), site.author);

const post = (collection: CollectionName, id: string, author?: string): Post => ({
  collection,
  id,
  data: {
    title: id,
    date: new Date('2026-10-01'),
    tags: [],
    featured: false,
    draft: false,
    author: author ? { id: author } : undefined,
  },
});

describe('the authors', () => {
  it('are a person, Hunter Newton, and an agent, R7', () => {
    expect(hunter).toMatchObject({ slug: 'hunter-newton', kind: 'person', name: 'Hunter Newton', path: '/authors/hunter-newton/' });
    expect(r7).toMatchObject({ slug: 'r7', kind: 'agent', name: 'Orbit', subtitle: 'Orbit Lead Agent', path: '/authors/r7/' });
    expect(DEFAULT_AUTHOR).toBe('hunter-newton');
    expect(authorPath('r7')).toBe('/authors/r7/');
  });

  it("read Hunter's name and photo from site.json; the bio he writes in his author file is the one shown", () => {
    // Hunter wrote his own bio into his author file in the admin (2026-11-07). It wins over site.json and is never overwritten.
    const data = authorFile('hunter-newton');
    expect(Object.keys(data).filter((k) => !['kind', 'slug', 'bio'].includes(k))).toEqual([]);
    expect(hunter.name).toBe(site.author.name);
    expect(hunter.bio).toBe(data.bio ?? site.author.bio);
    expect(hunter.avatar).toBe(site.author.photo);
    // With no bio in the file, a person's bio still comes from site.json.
    expect(resolveAuthor({ slug: 'hunter-newton', kind: 'person' } as AuthorData, site.author).bio).toBe(site.author.bio);
  });

  it("give Orbit (slug r7) the author's own bio, exactly, and the R7 Orbit icon as its avatar", () => {
    expect(r7.bio).toBe(
      "Orbit is the AI agent that writes some of what you read here. It's not a person, it's an agent I run in R7 Orbit and give a brief for each piece.",
    );
    // The R7 Orbit icon (R7, ring and dot on its plate), rendered from public/assets/r7-orbit-icon.svg (2026-11-11).
    expect(r7.avatar).toBe('/media/authors/r7.png');
    expect(existsSync(new URL('../../public/media/authors/r7.png', import.meta.url))).toBe(true);
  });

  it('need a name and a bio when an agent, but not when a person', () => {
    expect(() => resolveAuthor({ slug: 'x', kind: 'agent' }, site.author)).toThrow(/needs a name and a bio/);
    expect(resolveAuthor({ slug: 'y', kind: 'person' }, { name: 'A B', bio: 'Bio.' })).toMatchObject({
      name: 'A B',
      bio: 'Bio.',
      avatar: undefined,
    });
  });

  it('list people first, and only those with posts in the filter', () => {
    expect(sortAuthors([r7, hunter]).map((a) => a.slug)).toEqual(['hunter-newton', 'r7']);
    const posts = [post('blog', 'a', 'r7'), post('news', 'b')];
    expect(authorsWithPosts([hunter, r7], posts).map((a) => a.slug)).toEqual(['hunter-newton', 'r7']);
    expect(authorsWithPosts([hunter, r7], [post('blog', 'a')]).map((a) => a.slug)).toEqual(['hunter-newton']);
  });
});

describe('who a post is credited to', () => {
  it('is Hunter Newton when the post names no author', () => {
    expect(authorSlugOf(post('blog', 'a'))).toBe('hunter-newton');
    expect(authorSlugOf(post('blog', 'a', 'r7'))).toBe('r7');
  });

  it('defaults to hunter-newton in the real schema of every kind, and reads a slug as a reference', async () => {
    const { z } = await import('astro/zod');
    const { collections } = await import('../content.config');
    type Parse = { safeParse(v: unknown): { success: boolean; data?: unknown } };
    // The object of fields sits behind the front matter clean-up (a preprocess pipe, src/lib/front-matter.ts): its `out`.
    type Defined = { schema: (c: { image: () => unknown }) => { def: { out: { shape: Record<string, Parse> } } } };
    for (const name of ['news', 'blog', 'vlogs', 'projects', 'repos']) {
      const author = (collections as unknown as Record<string, Defined>)[name].schema({ image: () => z.string() }).def.out.shape.author;
      expect(author.safeParse(undefined).data, name).toEqual({ collection: 'authors', id: 'hunter-newton' });
      expect(author.safeParse('r7').data, name).toEqual({ collection: 'authors', id: 'r7' });
    }
  });

  it('gives a readable error naming the post, the bad slug and the real ones when the author does not exist', () => {
    const known = ['hunter-newton', 'r7'];
    const errors = unknownAuthorErrors(
      [post('blog', 'good', 'r7'), post('vlogs', 'oops', 'hunter-newtn'), post('news', 'none')],
      known,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('vlogs/oops');
    expect(errors[0]).toContain('"hunter-newtn"');
    expect(errors[0]).toContain('Authors are: hunter-newton, r7');
    expect(errors[0]).toContain('src/content/authors/hunter-newtn.json');
    expect(unknownAuthorErrors([post('blog', 'a')], ['hunter-newton'])).toEqual([]);
  });

  it("finds an author's posts", () => {
    const posts = [post('blog', 'a', 'r7'), post('news', 'b'), post('vlogs', 'c', 'r7')];
    expect(postsByAuthor(posts, 'r7').map((p) => p.id)).toEqual(['a', 'c']);
    expect(postsByAuthor(posts, 'hunter-newton').map((p) => p.id)).toEqual(['b']);
    expect(postsByAuthor(posts, 'nobody')).toEqual([]);
  });

  it("finds the blog posts whose featured image an agent made, by the agent's name", () => {
    const credited = (collection: CollectionName, id: string, by?: string, agent?: string, image = true): Post => {
      const p = post(collection, id);
      return { ...p, data: { ...p.data, ...(image ? { featuredImage: {} } : {}), ...(by ? { featuredImageBy: by } : {}), ...(agent ? { featuredImageAgent: agent } : {}) } } as Post;
    };
    const posts = [
      credited('blog', 'a', 'agent', 'Pictor'),
      credited('blog', 'b', 'me'),
      credited('blog', 'c', 'agent', ' Pictor '),
      credited('blog', 'd', 'agent', 'Orion'),
      credited('blog', 'e', 'agent', 'Pictor', false),
      credited('news', 'f', 'agent', 'Pictor'),
    ];
    expect(imagesByAgent(posts, 'Pictor').map((p) => p.id)).toEqual(['a', 'c']);
    expect(imagesByAgent(posts, 'Nobody')).toEqual([]);
  });
});

describe('the byline', () => {
  it('marks an agent "AI-written" and a person not at all', () => {
    expect(AGENT_LABEL).toBe('AI-written');
    expect(isAgent(r7)).toBe(true);
    expect(isAgent(hunter)).toBe(false);
  });

  it('falls back to initials for a person with no photo, never to the agent mark', () => {
    expect(initials('Hunter Newton')).toBe('HN');
    expect(initials('R7')).toBe('R');
    expect(resolveAuthor({ slug: 'y', kind: 'person' }, { name: 'Ada Lovelace', bio: 'x', photo: null }).avatar).toBeUndefined();
  });
});

describe('"How this was made" (aiAssist)', () => {
  it("still shows on a person's post", () => {
    expect(assistNote('drafted', hunter)).toBe('The first draft was written with AI help.');
    expect(assistNote('edited', hunter)).toBe('Written by me and edited with AI help.');
    expect(assistNote('none', hunter)).toBeUndefined();
    expect(assistNote(undefined, hunter)).toBeUndefined();
  });

  it("is not shown on an agent's post, which already says so in its byline", () => {
    expect(assistNote('drafted', r7)).toBeUndefined();
    expect(assistNote('edited', r7)).toBeUndefined();
  });
});

describe('structured data', () => {
  const base = 'https://r7orbit.io';

  it('is a Person for a person, with the profiles from site.json', () => {
    expect(authorLd(hunter, base, ['https://www.youtube.com/@R7Creatives'])).toMatchObject({
      '@type': 'Person',
      name: 'Hunter Newton',
      url: 'https://r7orbit.io/authors/hunter-newton/',
      sameAs: ['https://www.youtube.com/@R7Creatives'],
    });
  });

  it('is an Organization for an agent, with its subtitle as the description and its page as the url', () => {
    expect(authorLd(r7, base, ['https://www.youtube.com/@R7Creatives'])).toEqual({
      '@type': 'Organization',
      name: 'Orbit',
      description: 'Orbit Lead Agent',
      url: 'https://r7orbit.io/authors/r7/',
    });
  });

  it('is a ProfilePage whose main entity is that Person or Organization', () => {
    expect(authorProfilePageLd(hunter, base)).toMatchObject({
      '@type': 'ProfilePage',
      url: 'https://r7orbit.io/authors/hunter-newton/',
      mainEntity: { '@type': 'Person', name: 'Hunter Newton' },
    });
    expect(authorProfilePageLd(r7, base)).toMatchObject({
      '@type': 'ProfilePage',
      mainEntity: { '@type': 'Organization', name: 'Orbit', description: 'Orbit Lead Agent' },
    });
  });
});

// The bios the author approved for the writing team (2026-10-21), word for word: an agent's bio is his text, never rewritten.
const APPROVED = {
  pulsar: ['Pulsar', 'Orbit News Agent', 'Pulsar writes the news here. I give it the sources, and it writes a short item: what happened, why it matters, and where every claim comes from.'],
  orion: ['Orion', 'Orbit Games Agent', 'Orion writes about games. I give it a game, my notes and screenshots, and it writes the post. It keeps what happened separate from what I think.'],
  kepler: ['Kepler', 'Orbit Projects Agent', "Kepler writes up what I build. It reads the repo and my notes, then explains what the project is, what works and what doesn't."],
  hubble: ['Hubble', 'Orbit Video Agent', 'Hubble writes the pages and scripts for my videos. It works from my footage notes and the transcript, and writes the summary under each video.'],
  parallax: [
    'Parallax',
    'Orbit Fact-Check Agent',
    "Parallax checks the others' work before anything goes up. Every claim needs a source, quotes have to be exact, numbers have to add up, links have to work and images need alt text. It writes notes, not posts.",
  ],
} as const;

describe('the writing team', () => {
  it('has the five agents, each parsed by the real schema, with the approved name, subtitle and bio exactly, and their own avatar', async () => {
    const { collections } = await import('../content.config');
    const schema = (collections as unknown as { authors: { schema: () => { safeParse(v: unknown): { success: boolean; data?: unknown } } } }).authors.schema();
    for (const [slug, [name, subtitle, bio]] of Object.entries(APPROVED)) {
      const file = authorFile(slug);
      const parsed = schema.safeParse(file);
      expect(parsed.success, slug).toBe(true);
      expect(parsed.data, slug).toEqual({ slug, kind: 'agent', name, subtitle, bio, avatar: `/media/authors/${slug}.png`, avatarAlt: expect.stringMatching(/\S/) });
      expect(existsSync(new URL(`../../public/media/authors/${slug}.png`, import.meta.url)), slug).toBe(true);
      expect(resolveAuthor(file, site.author)).toMatchObject({ name, subtitle, bio, path: `/authors/${slug}/` });
    }
  });

  it('keeps no footer note in any author file', () => {
    const files = readdirSync(new URL('../content/authors/', import.meta.url)).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) expect(authorFile(f.replace(/\.json$/, '')), f).not.toHaveProperty('note');
  });

  it("the About page's Team block names only real authors, and an unknown slug is refused", async () => {
    const { teamProblems } = await import('./sections/checks');
    const authors = readdirSync(new URL('../content/authors/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
    const about = read('../content/pages/about.md');
    // Only the `members:` list: the "How a piece gets made" steps above it name the same authors again, by design.
    const members = about.split(/^\s+members:\s*$/m)[1] ?? '';
    const slugs = [...members.matchAll(/^\s+- author: ([a-z0-9-]+)\s*$/gm)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThan(0);
    expect(teamProblems({ members: slugs.map((author) => ({ author })) }, { tags: [], authors })).toEqual([]);
    expect(teamProblems({ members: [{ author: 'hunter-newton' }, { author: 'nobody' }] }, { tags: [], authors })).toEqual([
      `member 2: there is no author "nobody". Authors are: ${authors.join(', ')}.`,
    ]);
  });
});

describe('the author schema', () => {
  type Parse = { safeParse(v: unknown): { success: boolean; data?: unknown; error?: { issues: { message: string }[] } } };
  const authorSchema = async () => {
    const { collections } = await import('../content.config');
    return (collections as unknown as { authors: { schema: () => Parse } }).authors.schema();
  };

  it("ignores the retired footer `note` in an old author file, and no author file keeps one", async () => {
    // The footer note on an agent's posts was removed on 2026-10-21 (docs/DECISIONS.md): a leftover key must not stop the build.
    const schema = await authorSchema();
    const parsed = schema.safeParse({ ...authorFile('r7'), note: 'An old footer note.' });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty('note');
    for (const slug of ['hunter-newton', 'r7']) expect(authorFile(slug), slug).not.toHaveProperty('note');
  });

  it('still refuses any other unknown key', async () => {
    const schema = await authorSchema();
    expect(schema.safeParse({ ...authorFile('r7'), notes: 'typo' }).success).toBe(false);
  });
});
