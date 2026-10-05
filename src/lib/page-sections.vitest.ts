import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it, vi } from 'vitest';
import { layoutSections, SECTION_TYPES, sectionSchema, type Section } from './page-sections';

// The real `pages` schema from src/content.config.ts: the two Astro modules it imports only exist inside Astro.
vi.mock('astro:content', async () => {
  const { z } = await import('astro/zod');
  return {
    defineCollection: (c: unknown) => c,
    reference: (collection: string) => z.string().transform((id) => ({ collection, id })),
  };
});
vi.mock('astro/loaders', () => ({ glob: () => ({}) }));

type Parsed = { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } };
async function pageSchema() {
  const { collections } = await import('../content.config');
  // `pages` has no `image()`, so its schema is the Zod object itself, not a function of Astro's context.
  return (collections.pages as unknown as { schema: { safeParse(v: unknown): Parsed } }).schema;
}

const base = { title: 'About', description: 'A line.' };
const parse = async (sections: unknown[], extra: Record<string, unknown> = {}) =>
  (await pageSchema()).safeParse({ ...base, ...extra, sections });
const messages = (r: Parsed) => (r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');

describe('the About page file', () => {
  it('is valid against the pages schema', async () => {
    const { frontmatter } = parseFrontmatter(readFileSync('src/content/pages/about.md', 'utf8'));
    const result = (await pageSchema()).safeParse(frontmatter);
    expect(messages(result)).toBe('');
    expect(result.success).toBe(true);
  });
});

describe('page schema: the page', () => {
  it('needs a title and a description, and knows no other field', async () => {
    const schema = await pageSchema();
    expect(schema.safeParse({ description: 'x', sections: [] }).success).toBe(false);
    expect(schema.safeParse({ title: 'About', sections: [] }).success).toBe(false);
    expect(schema.safeParse({ ...base, sections: [], summary: 'x' }).success).toBe(false);
    expect(schema.safeParse({ ...base }).success, 'sections may be left out').toBe(true);
  });

  it('limits seoTitle like every other collection, and leaves it optional', async () => {
    expect((await parse([], { seoTitle: 'Short' })).success).toBe(true);
    expect((await parse([], { seoTitle: 'x'.repeat(50) })).success).toBe(false);
  });
});

describe('page schema: images', () => {
  const picture = { type: 'image', image: '/media/a.jpg' };

  it('needs alt text, and an empty alt only on a block marked decorative', async () => {
    const missing = await parse([{ ...picture }]);
    expect(missing.success).toBe(false);
    expect(messages(missing)).toMatch(/sections\.0\.alt: this image needs alt text/);
    expect((await parse([{ ...picture, alt: '   ' }])).success, 'blank alt').toBe(false);
    expect((await parse([{ ...picture, alt: 'A desk with a laptop' }])).success).toBe(true);
    expect((await parse([{ ...picture, alt: '', decorative: true }])).success).toBe(true);
  });

  it('holds for the portrait too', async () => {
    const portrait = { type: 'portrait', image: '/media/a.jpg', text: 'Hello' };
    expect((await parse([portrait])).success).toBe(false);
    expect((await parse([{ ...portrait, alt: 'Me, smiling' }])).success).toBe(true);
    expect((await parse([{ ...portrait, decorative: true }])).success).toBe(true);
  });

  it('only takes pictures from this site', async () => {
    for (const image of ['https://example.com/a.jpg', '//example.com/a.jpg', 'a.jpg', 'javascript:alert(1)']) {
      expect((await parse([{ ...picture, image, alt: 'x' }])).success, image).toBe(false);
    }
  });
});

describe('page schema: addresses', () => {
  const good = ['https://example.com', 'https://example.com/a?b=1#c', '/subscribe/', '/'];
  const bad = ['http://example.com', '//example.com', 'example.com', 'javascript:alert(1)', 'mailto:a@b.co', 'data:text/html,x', ''];

  it('are https or site-relative, in a button', async () => {
    for (const url of good) expect((await parse([{ type: 'button', label: 'Go', url }])).success, url).toBe(true);
    for (const url of bad) expect((await parse([{ type: 'button', label: 'Go', url }])).success, url).toBe(false);
  });

  it('are https or site-relative, in a links list, with a readable message', async () => {
    for (const url of good) expect((await parse([{ type: 'links', items: [{ label: 'A', url }] }])).success, url).toBe(true);
    const result = await parse([{ type: 'links', items: [{ label: 'A', url: 'http://example.com' }] }]);
    expect(result.success).toBe(false);
    expect(messages(result)).toMatch(/sections\.0\.items\.0\.url: use a full https:\/\/ address/);
  });
});

describe('page schema: the other blocks', () => {
  it('reads a heading level written as 2, "3" or left out, and refuses 1 and 4', async () => {
    const level = async (l: unknown) => {
      const r = await parse([{ type: 'heading', text: 'T', ...(l === undefined ? {} : { level: l }) }]);
      return r.success;
    };
    expect(await level(2)).toBe(true);
    expect(await level('3')).toBe(true);
    expect(await level(undefined)).toBe(true);
    expect(await level(1)).toBe(false);
    expect(await level(4)).toBe(false);
  });

  it('refuses an unknown block type, an unknown field and an empty text', async () => {
    expect((await parse([{ type: 'video', id: 'x' }])).success).toBe(false);
    expect((await parse([{ type: 'text', text: 'x', extra: 1 }])).success).toBe(false);
    expect((await parse([{ type: 'text', text: '' }])).success).toBe(false);
    expect((await parse([{ type: 'links', items: [] }])).success, 'a links list needs a link').toBe(false);
  });

  it('accepts one of every block, with the optional parts left out or empty', async () => {
    const all = [
      { type: 'heading', level: 2, text: 'H' },
      { type: 'text', text: 'T' },
      { type: 'image', image: '/media/a.jpg', alt: 'A', caption: '', width: 'wide' },
      { type: 'portrait', image: '/media/a.jpg', alt: 'A', side: 'right', text: 'T' },
      { type: 'quote', text: 'Q', attribution: '' },
      { type: 'callout', kind: 'warn', title: '', text: 'C' },
      { type: 'links', items: [{ label: 'L', url: '/x/', note: '' }] },
      { type: 'button', label: 'B', url: 'https://example.com' },
      { type: 'divider', style: 'dots' },
    ];
    const result = await parse(all);
    expect(messages(result)).toBe('');
    expect(all.map((b) => b.type)).toEqual([...SECTION_TYPES]);
  });

  it('has one schema per block type', () => {
    expect(sectionSchema.options.length).toBe(SECTION_TYPES.length);
  });
});

describe('layoutSections', () => {
  const heading = (text: string): Section => ({ type: 'heading', level: 2, text });
  const text = (t: string): Section => ({ type: 'text', text: t });
  const portrait = (side: 'left' | 'right' = 'left'): Section => ({
    type: 'portrait',
    image: '/media/a.jpg',
    alt: 'A',
    decorative: false,
    side,
    text: 'beside',
  });
  const image = (width: 'narrow' | 'wide' | 'full'): Section => ({
    type: 'image',
    image: '/media/b.jpg',
    alt: 'B',
    decorative: false,
    width,
  });
  const divider: Section = { type: 'divider', style: 'rule' };
  const types = (blocks: Section[]) => blocks.map((b) => b.type).join(',');
  const shape = (rows: ReturnType<typeof layoutSections>) =>
    rows.map((r) =>
      r.kind === 'split'
        ? `split(${r.lead?.text ?? ''}|${types(r.blocks)})`
        : r.kind === 'picture'
          ? `picture(${r.block.width})`
          : `prose(${types(r.blocks)})`,
    );

  it('keeps the About page as it was: one portrait row holding both sections', () => {
    const rows = layoutSections([heading('Hunter Newton'), portrait(), heading('R7'), text('p1')]);
    expect(shape(rows)).toEqual(['split(Hunter Newton|heading,text)']);
  });

  it('puts the heading above a portrait beside it, and not a heading further up', () => {
    expect(shape(layoutSections([heading('Intro'), text('t'), heading('Me'), portrait()]))).toEqual([
      'prose(heading,text)',
      'split(Me|)',
    ]);
  });

  it('draws plain text as one reading column', () => {
    expect(shape(layoutSections([heading('A'), text('t'), text('u')]))).toEqual(['prose(heading,text,text)']);
    expect(shape(layoutSections([]))).toEqual([]);
  });

  it('drops the row a lone heading would leave behind when a portrait takes it', () => {
    expect(shape(layoutSections([heading('Me'), portrait()]))).toEqual(['split(Me|)']);
  });

  it('ends a portrait row at a divider, a wide or full image, or another portrait', () => {
    expect(shape(layoutSections([portrait(), text('a'), divider, text('b')]))).toEqual(['split(|text)', 'prose(divider,text)']);
    expect(shape(layoutSections([portrait(), text('a'), image('wide'), text('b')]))).toEqual([
      'split(|text)',
      'picture(wide)',
      'prose(text)',
    ]);
    expect(shape(layoutSections([portrait(), text('a'), image('full')]))).toEqual(['split(|text)', 'picture(full)']);
    expect(shape(layoutSections([portrait(), text('a'), portrait('right'), text('b')]))).toEqual([
      'split(|text)',
      'split(|text)',
    ]);
  });

  it('keeps a narrow image in the column and a wide one out of it', () => {
    expect(shape(layoutSections([text('a'), image('narrow'), text('b')]))).toEqual(['prose(text,image,text)']);
    expect(shape(layoutSections([text('a'), image('wide'), text('b')]))).toEqual([
      'prose(text)',
      'picture(wide)',
      'prose(text)',
    ]);
  });

  it('follows the order of the list when blocks are moved', () => {
    const a = [heading('Me'), portrait(), heading('Agent'), text('x')];
    const moved = [heading('Agent'), text('x'), heading('Me'), portrait()];
    expect(shape(layoutSections(a))).toEqual(['split(Me|heading,text)']);
    expect(shape(layoutSections(moved))).toEqual(['prose(heading,text)', 'split(Me|)']);
  });

  it('does not change the list it is given', () => {
    const list = [heading('Me'), portrait(), text('x')];
    const copy = structuredClone(list);
    layoutSections(list);
    expect(list).toEqual(copy);
  });
});
