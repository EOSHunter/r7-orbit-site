import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it, vi } from 'vitest';
import { collections as adminCollections } from '../admin/config';
import { pagesCollection } from '../admin/pages';
import { IMAGE_ALT_PAIRS, isBlank, missingAltMessage, normaliseFrontMatter, optionalKeys } from './front-matter';

// Front matter as the admin writes it (docs/CONTENT_MODEL.md "Empty fields"). The production build once stopped on a post saved in
// the admin because the schema did not read an empty or missing value the way the author meant it. These tests run the real schemas
// of src/content.config.ts over front matter shaped like Decap's: every optional field of the admin's form written empty ('' for a
// box, [] for a list, false for a switch). The fields come from the admin config itself, so a field added to the form is covered
// here without editing this file. The two Astro modules content.config.ts imports are stood in for, as in src/admin/config.vitest.ts.
vi.mock('astro:content', async () => {
  const { z } = await import('astro/zod');
  return {
    defineCollection: (c: unknown) => c,
    reference: (collection: string) => z.string().transform((id) => ({ collection, id })),
  };
});
vi.mock('astro/loaders', () => ({ glob: () => ({}) }));

interface Issue {
  path: PropertyKey[];
  message: string;
}
interface Parsed {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { issues: Issue[] };
}
interface Schema {
  safeParse(value: unknown): Parsed;
}

async function schemaOf(name: string): Promise<Schema> {
  const { z } = await import('astro/zod');
  const { collections } = await import('../content.config');
  const c = collections[name as keyof typeof collections] as unknown as { schema: Schema | ((ctx: { image: () => unknown }) => Schema) };
  // `image()` is Astro's own helper (it resolves the file); a string stands in for it.
  return typeof c.schema === 'function' ? c.schema({ image: () => z.string() }) : c.schema;
}

const KINDS = ['news', 'blog', 'vlogs', 'projects', 'repos'] as const;
type Kind = (typeof KINDS)[number];

/** What each kind needs on top of title, date and summary. A vlog's YouTube id is optional in the form (it or a video address). */
const REQUIRED: Record<Kind, Record<string, unknown>> = {
  news: { sourceUrl: 'https://example.com/', sourceName: 'Example' },
  blog: {},
  vlogs: { youtubeId: 'dQw4w9WgXcQ', duration: '3:32' },
  projects: { status: 'building' },
  repos: { repo: 'owner/name' },
};
const post = (kind: Kind, extra: Record<string, unknown> = {}) => ({
  title: 'A post',
  date: '2026-10-01',
  summary: 'A summary.',
  ...REQUIRED[kind],
  ...extra,
});

interface AdminField {
  name: string;
  widget?: string;
  required?: boolean;
  multiple?: boolean;
}

/** What Decap writes for an optional field the author left empty or cleared. */
function emptyValue(field: AdminField): unknown {
  if (field.widget === 'list' || (field.widget === 'select' && field.multiple)) return [];
  if (field.widget === 'boolean') return false;
  return '';
}

/** Every optional top-level field of an admin form, written empty. `body` is the Markdown under the front matter, not a field. */
function emptyOptionalFields(fields: readonly unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields as AdminField[]) {
    if (f.name === 'body' || f.required !== false || f.widget === 'object' || f.widget === 'hidden') continue;
    out[f.name] = emptyValue(f);
  }
  return out;
}

const adminFields = (name: string) => (adminCollections.find((c) => c.name === name)?.fields ?? []) as readonly unknown[];

const issuesOf = (r: Parsed) => (r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`);

describe('admin-shaped front matter builds, for every collection', () => {
  for (const kind of KINDS) {
    it(`${kind}: every optional field of the form written empty is read as not set`, async () => {
      const empty = emptyOptionalFields(adminFields(kind));
      // The form really has the fields this incident was about, so the test cannot pass by testing nothing.
      expect(Object.keys(empty)).toEqual(expect.arrayContaining(['cover', 'coverAlt', 'seoTitle', 'tags']));
      if (kind === 'blog') expect(Object.keys(empty)).toEqual(expect.arrayContaining(['featuredImage', 'featuredImageAlt']));
      // The fields a post needs keep their values (a vlog's YouTube id is optional in the form, but it or a video address is needed).
      const result = (await schemaOf(kind)).safeParse({ ...empty, ...post(kind) });
      expect(issuesOf(result)).toEqual([]);
      for (const key of ['cover', 'coverAlt', 'featuredImage', 'featuredImageAlt', 'seoTitle', 'canonicalUrl', 'aiAssist', 'updated']) {
        expect(result.data?.[key], key).toBeUndefined();
      }
      expect(result.data?.author).toEqual({ collection: 'authors', id: 'hunter-newton' });
    });
  }

  it('authors: a person with every optional field empty', async () => {
    const empty = emptyOptionalFields(adminFields('authors'));
    expect(Object.keys(empty)).toEqual(expect.arrayContaining(['avatar']));
    const result = (await schemaOf('authors')).safeParse({ ...empty, slug: 'someone', kind: 'person' });
    expect(issuesOf(result)).toEqual([]);
    expect(result.data?.avatar).toBeUndefined();
  });

  it('authors: an agent still needs its name and bio (an empty one is missing, with the message)', async () => {
    const result = (await schemaOf('authors')).safeParse({ slug: 'bot', kind: 'agent', name: '', bio: '  ', avatar: '' });
    expect(issuesOf(result)).toEqual([
      'name: name is required for an agent (only a person is read from site.json)',
      'bio: bio is required for an agent (only a person is read from site.json)',
    ]);
  });

  const pageFiles = (pagesCollection as unknown as { files: { name: string; file: string; fields: readonly unknown[] }[] }).files;
  for (const page of pageFiles) {
    it(`pages: ${page.name} (its real file, with every optional field of its form written empty)`, async () => {
      const { frontmatter } = parseFrontmatter(readFileSync(page.file, 'utf8'));
      const result = (await schemaOf('pages')).safeParse({ ...frontmatter, ...emptyOptionalFields(page.fields) });
      expect(issuesOf(result)).toEqual([]);
      if ('seoTitle' in emptyOptionalFields(page.fields)) expect(result.data?.seoTitle).toBeUndefined();
    });
  }
});

describe('pictures and alt text, in every kind of post', () => {
  const pairsOf = (kind: Kind) => IMAGE_ALT_PAIRS.filter(([image]) => image === 'cover' || kind === 'blog');

  for (const kind of KINDS) {
    for (const [image, alt] of pairsOf(kind)) {
      describe(`${kind}: ${image}`, () => {
        const parse = async (extra: Record<string, unknown>) => (await schemaOf(kind)).safeParse(post(kind, extra));
        const path = image === 'featuredImage' ? '../../assets/blog/a.png' : '/media/a.png';

        it('empty or only spaces, with no alt: valid, and not set', async () => {
          for (const value of ['', '   ', null]) {
            const r = await parse({ [image]: value });
            expect(issuesOf(r), JSON.stringify(value)).toEqual([]);
            expect(r.data?.[image]).toBeUndefined();
          }
        });

        it('empty, with an empty or a written alt: the alt is ignored', async () => {
          for (const altValue of ['', 'A description', '  ']) {
            const r = await parse({ [image]: '', [alt]: altValue });
            expect(issuesOf(r)).toEqual([]);
            expect(r.data?.[alt]).toBeUndefined();
          }
        });

        it('an alt without its picture at all: ignored, not an error', async () => {
          const r = await parse({ [alt]: 'Left over' });
          expect(issuesOf(r)).toEqual([]);
          expect(r.data?.[alt]).toBeUndefined();
        });

        it('a real picture with no alt key: fails, with the readable message', async () => {
          for (const altValue of [undefined, null]) {
            const r = await parse({ [image]: path, [alt]: altValue });
            expect(r.success).toBe(false);
            expect(issuesOf(r)).toEqual([`${alt}: ${missingAltMessage(image, alt)}`]);
            expect(missingAltMessage(image, alt)).toBe(`${alt} is required when ${image} is set (use "" only for a decorative image)`);
          }
        });

        it('a real picture with alt "" (or spaces): valid, decorative', async () => {
          for (const altValue of ['', '   ']) {
            const r = await parse({ [image]: path, [alt]: altValue });
            expect(issuesOf(r)).toEqual([]);
            expect(r.data?.[alt]).toBe('');
          }
        });

        it('a real picture with alt text: valid, kept as written', async () => {
          const r = await parse({ [image]: path, [alt]: 'A chart of two bars' });
          expect(issuesOf(r)).toEqual([]);
          expect(r.data?.[image]).toBe(path);
          expect(r.data?.[alt]).toBe('A chart of two bars');
        });
      });
    }
  }

  it('a vlog poster left empty is not set; a real one is kept', async () => {
    const schema = await schemaOf('vlogs');
    expect(schema.safeParse(post('vlogs', { poster: ' ' })).data?.poster).toBeUndefined();
    expect(schema.safeParse(post('vlogs', { poster: '/media/vlogs/p.jpg' })).data?.poster).toBe('/media/vlogs/p.jpg');
  });

  it('a required field left empty keeps its own error (only optional fields are dropped)', async () => {
    const r = (await schemaOf('blog')).safeParse(post('blog', { title: '' }));
    expect(r.success).toBe(false);
    expect(issuesOf(r).map((i) => i.split(':')[0])).toEqual(['title']);
  });

  it('a misspelt field is still refused (.strict() runs after the clean-up)', async () => {
    const r = (await schemaOf('news')).safeParse(post('news', { featuredImageAlt: 'news has no featured image' }));
    expect(r.success).toBe(false);
  });
});

describe('optional pictures inside sections', () => {
  it('a video or game poster of only spaces is no poster', async () => {
    const { sectionsSchema } = await import('./sections');
    const parsed = sectionsSchema.safeParse([{ type: 'video', youtubeId: 'dQw4w9WgXcQ', title: 'A video', poster: '   ' }]);
    expect(parsed.success).toBe(true);
    expect((parsed.data as { poster?: string }[])[0].poster || undefined).toBeUndefined();
  });
});

describe('normaliseFrontMatter', () => {
  it('drops blank optional fields and leaves required ones, lists and switches alone', async () => {
    const { z } = await import('astro/zod');
    const shape = { title: z.string(), note: z.string().optional(), tags: z.array(z.string()).default([]), on: z.boolean().default(false) };
    expect([...optionalKeys(shape)].sort()).toEqual(['note', 'on', 'tags']);
    expect(normaliseFrontMatter(shape)({ title: '', note: ' ', tags: [], on: false })).toEqual({ title: '', tags: [], on: false });
  });

  it('isBlank: null and spaces, never 0, false or a list', () => {
    expect([null, '', ' \t\n'].every(isBlank)).toBe(true);
    expect([0, false, [], 'x', undefined].some(isBlank)).toBe(false);
  });
});

describe('every real content file parses (what the build reads)', () => {
  it('posts, pages and authors in src/content', async () => {
    const problems: string[] = [];
    for (const name of [...KINDS, 'pages', 'authors']) {
      const dir = `src/content/${name}`;
      if (!existsSync(dir)) continue; // a kind may have no posts yet: its folder does not exist
      const files = readdirSync(dir).filter((f) => /\.(mdx?|json)$/.test(f));
      const schema = await schemaOf(name);
      for (const file of files) {
        const text = readFileSync(`${dir}/${file}`, 'utf8');
        const data = file.endsWith('.json') ? JSON.parse(text) : parseFrontmatter(text).frontmatter;
        for (const issue of issuesOf(schema.safeParse(data))) problems.push(`${dir}/${file}: ${issue}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
