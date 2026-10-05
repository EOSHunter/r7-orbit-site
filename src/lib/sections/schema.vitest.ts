import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it, vi } from 'vitest';
import { definitions, describeShape, LINK_PATTERN, sectionSchema, sectionsSchema } from './index';

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
  const { collections } = await import('../../content.config');
  return (collections.pages as unknown as { schema: { safeParse(v: unknown): Parsed } }).schema;
}
const base = { title: 'About', description: 'A line.' };
const parse = async (sections: unknown[], extra: Record<string, unknown> = {}) => (await pageSchema()).safeParse({ ...base, ...extra, sections });
const messages = (r: Parsed) => (r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');

/** One block through the union, as the page schema would. */
const block = (data: Record<string, unknown>) => sectionSchema.safeParse(data);
const ok = (data: Record<string, unknown>) => {
  const r = block(data);
  expect(r.success ? '' : JSON.stringify(r.error.issues), JSON.stringify(data)).toBe('');
};
const bad = (data: Record<string, unknown>, message?: RegExp) => {
  const r = block(data);
  expect(r.success, JSON.stringify(data)).toBe(false);
  if (message) expect((r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')).toMatch(message);
};

const PIC = { image: '/media/a.jpg' };

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

describe('sectionsSchema (what any collection attaches)', () => {
  it('is optional: an absent list is an empty one', () => {
    expect(sectionsSchema.safeParse(undefined)).toMatchObject({ success: true, data: [] });
  });

  it('reads a list of blocks, fills in the defaults, and holds at most 60', () => {
    const r = sectionsSchema.safeParse([{ type: 'heading', text: 'H' }, { type: 'divider' }]);
    expect(r.success && r.data).toEqual([
      { type: 'heading', text: 'H', level: 2 },
      { type: 'divider', style: 'rule' },
    ]);
    expect(sectionsSchema.safeParse(Array.from({ length: 61 }, () => ({ type: 'divider' }))).success).toBe(false);
    expect(sectionsSchema.safeParse(Array.from({ length: 60 }, () => ({ type: 'divider' }))).success).toBe(true);
  });

  it('names a bad block the way the editor counts: "Block 3 (Image)", from 1, with the field in the path', async () => {
    const r = await parse([{ type: 'divider' }, { type: 'heading', text: 'H' }, { type: 'image', ...PIC }]);
    expect(messages(r)).toBe('sections.2.alt: Block 3 (Image): this image needs alt text: describe it, or tick "Decorative" if it is purely ornamental');
  });

  it('says what the real block types are when the type is unknown or missing', async () => {
    const unknown = await parse([{ type: 'carousel' }]);
    expect(messages(unknown)).toMatch(/^sections\.0\.type: Block 1: Unknown block type "carousel"\. The blocks are: heading, lead, text, /);
    expect(messages(await parse([{ text: 'no type' }]))).toMatch(/Unknown block type \(none\)/);
  });

  it('says what is wrong with an address, with the block and field', async () => {
    const r = await parse([{ type: 'button', label: 'Go', url: 'http://example.com' }]);
    expect(messages(r)).toMatch(/sections\.0\.url: Block 1 \(Button\): "Address": use a full https:\/\/ address/);
  });

  it('reports every bad block, not only the first', async () => {
    const r = await parse([
      { type: 'button', label: 'Go', url: 'http://a.test' },
      { type: 'divider' },
      { type: 'latest', count: 99 },
    ]);
    expect(messages(r)).toMatch(/sections\.0\.url[\s\S]*sections\.2\.count: Block 3 \(Latest posts\)/);
  });
});

describe('every block schema', () => {
  it('refuses a field it does not know (a misspelling must not be silently dropped)', () => {
    for (const d of definitions) bad({ type: d.id, ...d.example, extra: 1 }, /Unrecognized key/);
  });

  it('refuses a block with any required field missing, naming the field', () => {
    for (const d of definitions) {
      for (const field of describeShape(d.schema.shape).filter((f) => f.required)) {
        const data = { type: d.id, ...d.example } as Record<string, unknown>;
        delete data[field.name];
        bad(data, new RegExp(field.name));
      }
    }
  });

  it('refuses a required text box left empty', () => {
    for (const d of definitions) {
      for (const field of describeShape(d.schema.shape).filter((f) => f.required && (f.widget === 'string' || f.widget === 'text' || f.widget === 'markdown'))) {
        bad({ type: d.id, ...d.example, [field.name]: '' });
      }
    }
  });

  it('accepts an optional text box left empty (the editor writes an empty box as "")', () => {
    for (const d of definitions) {
      for (const field of describeShape(d.schema.shape).filter((f) => f.optional && (f.widget === 'string' || f.widget === 'text'))) {
        ok({ type: d.id, ...d.example, [field.name]: '' });
      }
    }
  });

  it('refuses a text that is longer than its limit', () => {
    for (const d of definitions) {
      for (const field of describeShape(d.schema.shape).filter((f) => f.max && !f.pattern && (f.widget === 'string' || f.widget === 'text'))) {
        bad({ type: d.id, ...d.example, [field.name]: 'x'.repeat((field.max ?? 0) + 1) }, /too long/);
        ok({ type: d.id, ...d.example, [field.name]: 'x'.repeat(field.max ?? 0) });
      }
    }
  });
});

describe('heading', () => {
  it('reads a level written as 2, "3" or left out, and refuses 1 and 4', () => {
    ok({ type: 'heading', text: 'T', level: 2 });
    ok({ type: 'heading', text: 'T', level: '3' });
    ok({ type: 'heading', text: 'T' });
    bad({ type: 'heading', text: 'T', level: 1 });
    bad({ type: 'heading', text: 'T', level: 4 });
  });
  it('holds 120 characters', () => {
    ok({ type: 'heading', text: 'x'.repeat(120) });
    bad({ type: 'heading', text: 'x'.repeat(121) });
  });
});

describe('lead, text, quote, pullquote, callout', () => {
  it('lead is one short paragraph', () => {
    ok({ type: 'lead', text: 'x'.repeat(400) });
    bad({ type: 'lead', text: 'x'.repeat(401) });
  });
  it('text, quote and callout need their words', () => {
    bad({ type: 'text', text: '' });
    bad({ type: 'quote', text: '' });
    bad({ type: 'callout', text: '' });
    ok({ type: 'quote', text: 'Q', attribution: '' });
  });
  it('callout kinds are info, tip and warn', () => {
    for (const kind of ['info', 'tip', 'warn']) ok({ type: 'callout', kind, text: 'C' });
    bad({ type: 'callout', kind: 'danger', text: 'C' });
    expect(sectionSchema.parse({ type: 'callout', text: 'C' })).toMatchObject({ kind: 'info' });
  });
  it('pullquote holds 200 characters', () => {
    ok({ type: 'pullquote', text: 'x'.repeat(200) });
    bad({ type: 'pullquote', text: 'x'.repeat(201) });
  });
});

describe('code', () => {
  it('needs code, takes a known language (text by default) and an optional title', () => {
    expect(sectionSchema.parse({ type: 'code', code: 'x' })).toMatchObject({ lang: 'text' });
    ok({ type: 'code', code: 'npm run build', lang: 'bash', title: 'Build' });
    bad({ type: 'code', code: 'x', lang: 'klingon' });
    bad({ type: 'code', lang: 'bash' });
  });
});

describe('image, portrait, image row, gallery', () => {
  it('image needs alt text, and an empty alt only on a block marked decorative', () => {
    bad({ type: 'image', ...PIC }, /alt: Block|alt: this image needs alt text/);
    bad({ type: 'image', ...PIC, alt: '   ' });
    ok({ type: 'image', ...PIC, alt: 'A desk with a laptop' });
    ok({ type: 'image', ...PIC, alt: '', decorative: true });
  });
  it('image: width, placement and size are menus with the old defaults', () => {
    expect(sectionSchema.parse({ type: 'image', ...PIC, alt: 'A' })).toMatchObject({ width: 'narrow', align: 'center', size: 'lg', decorative: false });
    for (const width of ['narrow', 'wide', 'full']) ok({ type: 'image', ...PIC, alt: 'A', width });
    bad({ type: 'image', ...PIC, alt: 'A', width: 'huge' });
    bad({ type: 'image', ...PIC, alt: 'A', align: 'middle' });
    bad({ type: 'image', ...PIC, alt: 'A', size: 'xl' });
  });
  it('a picture is a file of this site, never another one', () => {
    for (const image of ['https://example.com/a.jpg', '//example.com/a.jpg', 'a.jpg', 'javascript:alert(1)', '']) {
      bad({ type: 'image', image, alt: 'x' }, /Image/);
      bad({ type: 'portrait', image, alt: 'x', text: 'T' });
    }
    ok({ type: 'image', image: '/src/assets/blog/a.jpg', alt: 'x' });
  });
  it('portrait holds the same rule, a side and text', () => {
    bad({ type: 'portrait', ...PIC, text: 'Hello' });
    ok({ type: 'portrait', ...PIC, alt: 'Me, smiling', text: 'Hello' });
    ok({ type: 'portrait', ...PIC, decorative: true, text: 'Hello', side: 'right' });
    bad({ type: 'portrait', ...PIC, alt: 'x', text: 'Hello', side: 'top' });
    bad({ type: 'portrait', ...PIC, alt: 'x' });
  });
  it('image row takes two or three pictures, each with alt text or decorative', () => {
    const pic = (n: number) => ({ image: `/media/${n}.jpg`, alt: `Picture ${n}` });
    bad({ type: 'image-row', images: [pic(1)] }, /at least 2/);
    ok({ type: 'image-row', images: [pic(1), pic(2)] });
    ok({ type: 'image-row', images: [pic(1), pic(2), pic(3)], caption: 'Row' });
    bad({ type: 'image-row', images: [pic(1), pic(2), pic(3), pic(4)] }, /at most 3/);
    bad({ type: 'image-row', images: [pic(1), { image: '/media/2.jpg' }] }, /images\.1\.alt/);
    ok({ type: 'image-row', images: [pic(1), { image: '/media/2.jpg', decorative: true }] });
    bad({ type: 'image-row', images: [pic(1), { image: 'https://x.test/2.jpg', alt: 'x' }] });
  });
  it('gallery needs at least one picture, each with alt text (it has no decorative switch: the thumbnail is a button named by it)', () => {
    bad({ type: 'gallery', shots: [] });
    ok({ type: 'gallery', shots: [{ image: '/media/a.jpg', alt: 'A' }] });
    bad({ type: 'gallery', shots: [{ image: '/media/a.jpg' }] }, /shots\.0\.alt/);
    bad({ type: 'gallery', shots: [{ image: '/media/a.jpg', alt: '' }] });
    bad({ type: 'gallery', shots: Array.from({ length: 25 }, () => ({ image: '/media/a.jpg', alt: 'A' })) }, /at most 24/);
    bad({ type: 'gallery', shots: [{ image: '/media/a.jpg', alt: 'A', decorative: true }] }, /Unrecognized key/);
  });
});

describe('video and game', () => {
  const video = { type: 'video', youtubeId: 'dQw4w9WgXcQ', title: 'T' };
  it('video takes an 11-character id, not a whole link, and a title', () => {
    ok(video);
    bad({ ...video, youtubeId: 'https://youtu.be/dQw4w9WgXcQ' }, /11 characters/);
    bad({ ...video, youtubeId: 'short' });
    bad({ type: 'video', youtubeId: 'dQw4w9WgXcQ' });
  });
  it('video: poster is a picture of this site; duration and chapters are timestamps', () => {
    ok({ ...video, poster: '/media/p.jpg', duration: '12:48', chapters: [{ t: '0:00', title: 'Start' }] });
    ok({ ...video, poster: '', duration: '', chapters: [] });
    bad({ ...video, poster: 'https://x.test/p.jpg' });
    bad({ ...video, duration: '12' });
    bad({ ...video, chapters: [{ t: '1', title: 'x' }] });
  });
  const game = { type: 'game', title: 'G', playUrl: 'https://play.example.test/g/' };
  it('game needs an https play address, and defaults to embed at 16:9', () => {
    expect(sectionSchema.parse(game)).toMatchObject({ playMode: 'embed', playAspect: '16:9', controls: [], platforms: [] });
    for (const playUrl of ['http://x.test', '//x.test', 'x.test', 'javascript:alert(1)', '', '/relative/']) bad({ ...game, playUrl }, /Play URL/);
  });
  it('game: aspect is width:height, mode embed or link, platforms desktop or mobile, controls need both parts', () => {
    ok({ ...game, playAspect: '4:3', playMode: 'link', platforms: ['desktop', 'mobile'], playNote: 'Note', controls: [{ key: 'W', action: 'Up' }] });
    for (const playAspect of ['16/9', '0:9', 'wide', '16:9; color: red']) bad({ ...game, playAspect });
    bad({ ...game, playMode: 'iframe' });
    bad({ ...game, platforms: ['console'] });
    bad({ ...game, controls: [{ key: '', action: 'Up' }] });
    bad({ ...game, playNote: 'x'.repeat(121) });
  });
});

describe('columns, divider, spacer', () => {
  it('columns need both Markdown columns, with ratio and reverse optional', () => {
    ok({ type: 'columns', left: 'L', right: 'R' });
    expect(sectionSchema.parse({ type: 'columns', left: 'L', right: 'R' })).toMatchObject({ ratio: '1:1', reverse: false });
    bad({ type: 'columns', left: 'L' });
    bad({ type: 'columns', left: 'L', right: 'R', ratio: '3:1' });
  });
  it('divider and spacer have a style and a size with defaults', () => {
    expect(sectionSchema.parse({ type: 'divider' })).toMatchObject({ style: 'rule' });
    bad({ type: 'divider', style: 'wavy' });
    expect(sectionSchema.parse({ type: 'spacer' })).toMatchObject({ size: 'md' });
    bad({ type: 'spacer', size: 'huge' });
  });
});

describe('links and button', () => {
  const good = ['https://example.com', 'https://example.com/a?b=1#c', '/subscribe/', '/'];
  const wrong = ['http://example.com', '//example.com', 'example.com', 'javascript:alert(1)', 'mailto:a@b.co', 'data:text/html,x', ''];
  it('a button address is https or a page on this site, with a readable message', () => {
    for (const url of good) ok({ type: 'button', label: 'Go', url });
    for (const url of wrong) bad({ type: 'button', label: 'Go', url }, /use a full https:\/\/ address/);
    bad({ type: 'button', label: 'x'.repeat(41), url: '/' });
  });
  it('a link in a list is checked the same way, and the list needs a link', () => {
    for (const url of good) ok({ type: 'links', items: [{ label: 'A', url }] });
    for (const url of wrong) bad({ type: 'links', items: [{ label: 'A', url }] }, /items\.0\.url/);
    bad({ type: 'links', items: [] }, /at least one row/);
    ok({ type: 'links', items: [{ label: 'L', url: '/x/', note: '' }] });
  });
  it('shares its pattern with the admin: the schema rule is LINK_PATTERN', () => {
    for (const url of good) expect(LINK_PATTERN.test(url), url).toBe(true);
    for (const url of wrong) expect(LINK_PATTERN.test(url), url).toBe(false);
  });
});

describe('toc, stats, latest, author, newsletter', () => {
  it('toc: an optional title and a depth of 2 or 3 (default 3)', () => {
    expect(sectionSchema.parse({ type: 'toc' })).toMatchObject({ maxDepth: 3 });
    ok({ type: 'toc', title: 'Contents', maxDepth: 2 });
    ok({ type: 'toc', maxDepth: '2' });
    bad({ type: 'toc', maxDepth: 4 });
  });
  it('stats needs owner/name', () => {
    ok({ type: 'stats', repo: 'EOSHunter/r7-orbit-site' });
    for (const repo of ['r7-orbit-site', 'a/b/c', '', 'https://github.com/a/b']) bad({ type: 'stats', repo });
  });
  it('latest filters by kind, tag and author, and shows 1 to 12 (default 3)', () => {
    expect(sectionSchema.parse({ type: 'latest' })).toMatchObject({ kinds: [], count: 3 });
    ok({ type: 'latest', kinds: ['blog', 'vlog'], tag: 'ai-agents', author: 'r7', count: 12, heading: 'Latest' });
    ok({ type: 'latest', tag: '', author: '' });
    bad({ type: 'latest', kinds: ['podcast'] });
    bad({ type: 'latest', tag: 'Not A Tag' }, /lowercase words joined with hyphens/);
    bad({ type: 'latest', author: 'R7!' });
    bad({ type: 'latest', count: 0 }, /at least 1/);
    bad({ type: 'latest', count: 13 }, /at most 12/);
    bad({ type: 'latest', count: 2.5 });
    ok({ type: 'latest', count: '5' });
  });
  it('author needs an author slug', () => {
    ok({ type: 'author', author: 'hunter-newton' });
    bad({ type: 'author' });
    bad({ type: 'author', author: 'Hunter Newton' });
  });
  it('newsletter: a band or a form, with an optional heading and text', () => {
    expect(sectionSchema.parse({ type: 'newsletter' })).toMatchObject({ style: 'band' });
    ok({ type: 'newsletter', style: 'form', heading: 'H', text: 'T' });
    bad({ type: 'newsletter', style: 'popup' });
    bad({ type: 'newsletter', text: 'x'.repeat(221) });
  });
});
