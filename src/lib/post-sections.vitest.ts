import { describe, expect, it, vi } from 'vitest';
import { bodyConflict, filterPublished, readTime, relatedPosts, WORDS_PER_MINUTE, type Post, type PostData } from './content';
import { sectionsSchema, type Section } from './sections';
import { sectionsToText } from './sections-to-content';
import { bodyAndSectionsProblem, bodyOrSectionsCheck, postBody } from '../admin/post-body';

// Posts written as sections (docs/SECTIONS.md "Posts"): the schema every kind shares, the rule that a post is written one way, and the
// helpers that read a post's body (reading time, publishing). The real schema is loaded, so the two Astro modules it imports are
// stood in for, as in src/admin/config.vitest.ts.
vi.mock('astro:content', async () => {
  const { z } = await import('astro/zod');
  return {
    defineCollection: (c: unknown) => c,
    reference: (collection: string) => z.string().transform((id) => ({ collection, id })),
  };
});
vi.mock('astro/loaders', () => ({ glob: (options: unknown) => ({ options }) }));

interface Zod {
  /** The object of fields, behind the front matter clean-up (a preprocess pipe, src/lib/front-matter.ts). */
  def: { out: { shape: Record<string, unknown> } };
  safeParse(value: unknown): { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } };
}

const KINDS = ['news', 'blog', 'vlogs', 'projects', 'repos'] as const;
const FIXTURE_OF = { news: 'fixtureNews', blog: 'fixtureBlog', vlogs: 'fixtureVlogs', projects: 'fixtureProjects', repos: 'fixtureRepos' };

async function schemas() {
  const { z } = await import('astro/zod');
  const { collections } = await import('../content.config');
  const of = (name: string) =>
    (collections[name as keyof typeof collections] as unknown as { schema: (ctx: { image: () => unknown }) => Zod }).schema({ image: () => z.string() });
  return { of, collections: collections as unknown as Record<string, { loader: { options: { base: string } } }> };
}

/** The least each kind needs, so a test can add `sections` and see only what that changes. */
const MINIMAL: Record<(typeof KINDS)[number], Record<string, unknown>> = {
  news: { sourceUrl: 'https://example.com/', sourceName: 'Example' },
  blog: {},
  vlogs: { youtubeId: 'dQw4w9WgXcQ', duration: '3:32' },
  projects: { status: 'building' },
  repos: { repo: 'owner/name' },
};
const post = (kind: (typeof KINDS)[number], extra: Record<string, unknown> = {}) => ({
  title: 'A post',
  date: '2026-10-01',
  summary: 'A summary.',
  ...MINIMAL[kind],
  ...extra,
});

describe('the schema of every kind takes sections', () => {
  for (const kind of KINDS) {
    it(`${kind}: optional, the shared block list, a bad block named by its number`, async () => {
      const schema = (await schemas()).of(kind);
      expect(schema.safeParse(post(kind)).success, 'without sections').toBe(true);
      expect(schema.safeParse(post(kind, { sections: [] })).success, 'an empty list').toBe(true);
      expect(schema.safeParse(post(kind, { sections: [{ type: 'heading', text: 'Hi', level: 2 }, { type: 'text', text: 'Body.' }] })).success).toBe(true);
      const bad = schema.safeParse(post(kind, { sections: [{ type: 'text', text: 'ok' }, { type: 'image', image: '/media/x.jpg' }] }));
      expect(bad.success).toBe(false);
      expect(bad.error!.issues[0].path).toEqual(['sections', 1, 'alt']);
      expect(bad.error!.issues[0].message).toMatch(/^Block 2 \(Image\): this image needs alt text/);
    });
  }

  it("reads each kind's fixtures from tests/fixtures/posts/<kind>/ with the real kind's schema", async () => {
    const { of, collections } = await schemas();
    for (const kind of KINDS) {
      expect(collections[FIXTURE_OF[kind]].loader.options.base).toBe(`./tests/fixtures/posts/${kind}`);
      expect(collections[kind].loader.options.base).toBe(`./src/content/${kind}`);
      expect(Object.keys(of(FIXTURE_OF[kind]).def.out.shape)).toEqual(Object.keys(of(kind).def.out.shape));
    }
  });
});

describe('a vlog written as sections keeps its transcript in transcriptText', () => {
  const blocks = [{ type: 'text', text: 'Notes.' }];
  it('accepts transcriptText with sections', async () => {
    expect((await schemas()).of('vlogs').safeParse(post('vlogs', { sections: blocks, transcriptText: 'The transcript.' })).success).toBe(true);
  });
  it('refuses transcriptText without sections, and says where a Markdown body keeps its transcript', async () => {
    const result = (await schemas()).of('vlogs').safeParse(post('vlogs', { transcriptText: 'The transcript.' }));
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]).toMatchObject({ path: ['transcriptText'] });
    expect(result.error!.issues[0].message).toMatch(/## Transcript/);
  });
  it('refuses transcript: true with sections (it labels part of a Markdown body)', async () => {
    const result = (await schemas()).of('vlogs').safeParse(post('vlogs', { sections: blocks, transcript: true }));
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]).toMatchObject({ path: ['transcript'] });
  });
});

const blocks = (list: unknown[]): Section[] => sectionsSchema.parse(list);
const sitePost = (extra: Partial<PostData> = {}, body = ''): Post => ({
  collection: 'blog',
  id: 'a',
  body,
  data: { title: 'A', date: new Date('2026-10-01T00:00:00Z'), tags: [], featured: false, draft: false, ...extra },
});

describe('a post is written one way: sections or a Markdown body', () => {
  const sections = blocks([{ type: 'text', text: 'Hello.' }]);
  it('stops the build on a post with both, naming its file and the two ways out', () => {
    const message = bodyConflict('src/content/blog/a.md', sitePost({ sections }, 'Some Markdown.'));
    expect(message).toMatch(/^src\/content\/blog\/a\.md: this post has both sections and a Markdown body/);
    expect(message).toMatch(/sections: \[\]/);
  });
  it('lets either one through, and an empty sections list or a blank body is neither', () => {
    expect(bodyConflict('a.md', sitePost({ sections }))).toBeUndefined();
    expect(bodyConflict('a.md', sitePost({ sections }, '\n  \n'))).toBeUndefined();
    expect(bodyConflict('a.md', sitePost({ sections: [] }, 'Markdown.'))).toBeUndefined();
    expect(bodyConflict('a.md', sitePost({}, 'Markdown.'))).toBeUndefined();
  });
  it('is refused by the editor too, before it is saved', () => {
    const entry = (data: Record<string, unknown>) => ({ get: (key: string) => (key === 'data' ? { toJS: () => data } : undefined) });
    expect(() => bodyOrSectionsCheck({ entry: entry({ body: 'Text.', sections: [{ type: 'text', text: 'x' }] }) })).toThrow(/^Not saved\. .*Use sections OR the body, not both/);
    expect(bodyOrSectionsCheck({ entry: entry({ body: '', sections: [{ type: 'text', text: 'x' }] }) })).toBeUndefined();
    expect(bodyOrSectionsCheck({ entry: entry({ body: 'Text.', sections: [] }) })).toBeUndefined();
    expect(bodyAndSectionsProblem({ body: 'Text.' })).toBeUndefined();
  });
});

describe('reading time of a post written as sections', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
  it('counts the words of the blocks, not the empty body', () => {
    const long = blocks([{ type: 'heading', text: 'A *heading*', level: 2 }, { type: 'text', text: words(WORDS_PER_MINUTE * 2) }]);
    expect(readTime(sitePost({ sections: long }))).toBe(3);
    expect(readTime(sitePost({ sections: blocks([{ type: 'text', text: 'Short.' }]) }))).toBe(1);
  });
  it('leaves code, alt text and a pull quote out, as a Markdown body does', () => {
    const list = blocks([
      { type: 'text', text: words(WORDS_PER_MINUTE) },
      { type: 'code', code: words(500) },
      { type: 'image', image: '/og-default.png', alt: words(300) },
      { type: 'pullquote', text: 'Repeated words.' },
    ]);
    expect(readTime(sitePost({ sections: list }))).toBe(1);
    expect(sectionsToText(list)).not.toMatch(/Repeated/);
  });
  it('lets a readTime in the front matter win', () => {
    expect(readTime(sitePost({ sections: blocks([{ type: 'text', text: 'x' }]), readTime: 9 }))).toBe(9);
  });
  it('is what the editor preview shows too', () => {
    const data = { sections: [{ type: 'text', text: words(WORDS_PER_MINUTE * 2 + 1) }], body: '' };
    expect(postBody(data).minutes).toBe(3);
    expect(postBody({ ...data, readTime: 4 }).minutes).toBe(4);
  });
});

describe('the publishing rules do not look at the body', () => {
  const NOW = new Date('2026-10-05T12:00:00Z');
  const sections = blocks([{ type: 'text', text: 'Hello.' }]);
  it('keeps a draft or future-dated post written as sections out, like any other', () => {
    const draft = sitePost({ sections, draft: true });
    const scheduled = sitePost({ sections, date: new Date('2026-12-01T00:00:00Z') });
    const live = sitePost({ sections });
    expect(filterPublished([draft, scheduled, live], { now: NOW })).toEqual([live]);
    expect(filterPublished([draft, scheduled], { now: NOW, includeUnpublished: true })).toHaveLength(2);
  });
  it('relates posts by their tags, whatever their body', () => {
    const mine = { ...sitePost({ sections, tags: ['x'] }), id: 'mine' };
    const other = { ...sitePost({ tags: ['x'] }, 'Markdown.'), id: 'other' };
    expect(relatedPosts(mine, [mine, other], 3, NOW)).toEqual([other]);
  });
});
