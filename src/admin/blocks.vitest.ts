import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARTICLE_COMPONENT_NAMES } from '../lib/article-component-names';
import { blocks, jsonAttr, parseAttrs, stringAttr, youtubeIdFrom, type BlockData } from './blocks';

const byId = (id: string) => {
  const block = blocks.find((b) => b.id === id);
  if (!block) throw new Error(`no block ${id}`);
  return block;
};

/** Write a block, then read it back the way Decap does (pattern + fromBlock) on a document with text after it. */
function roundTrip(id: string, data: BlockData) {
  const block = byId(id);
  const written = block.toBlock(data);
  const match = block.pattern.exec(`${written}\n\nText after the block.`);
  return { written, match, read: match ? (block.fromBlock(match) as BlockData) : undefined };
}

describe('blocks', () => {
  it('offers exactly the listed article components, once each', () => {
    expect(blocks.map((b) => b.id).sort()).toEqual([...ARTICLE_COMPONENT_NAMES].sort());
  });

  it('only writes tags that the MDX components map knows, so a post never fails on a missing component', () => {
    // Read as text: importing the map would load .astro files, which Vitest cannot.
    const map = readFileSync('src/components/article/mdx.ts', 'utf8').split('export const articleComponents')[1];
    for (const b of blocks) expect(map, b.id).toMatch(new RegExp(String.raw`\b${b.id}\b`));
  });

  it('never uses the multiline flag, and anchors every pattern at the start (Decap requires both)', () => {
    for (const b of blocks) {
      expect(b.pattern.flags, b.id).not.toContain('m');
      expect(b.pattern.source.startsWith('^'), b.id).toBe(true);
    }
  });

  const cases: [string, BlockData][] = [
    ['Figure', { src: '/media/a.jpg', alt: 'A chart', caption: 'Figure 1', align: 'left', size: 'md' }],
    ['Callout', { type: 'warn', title: 'Careful', body: 'Two lines.\n\nWith **markdown** and `code`.' }],
    ['Quote', { body: 'A quote.', cite: 'Someone', href: 'https://example.com/q' }],
    [
      'ImageGallery',
      {
        images: [
          { src: '/media/a.jpg', alt: 'A' },
          { src: '/media/b.jpg', alt: 'B', caption: 'Bee' },
        ],
      },
    ],
    ['TwoColumn', { left: 'Left **text**', right: 'Right\n\ntext', ratio: '2:1' }],
    ['VideoEmbed', { id: 'dQw4w9WgXcQ', title: 'A video', caption: 'Watch this' }],
    ['Divider', { variant: 'dots' }],
  ];

  it.each(cases)('%s survives write then read', (id, data) => {
    const { written, match, read } = roundTrip(id, data);
    expect(match, written).not.toBeNull();
    expect(match?.[0], 'consumes the block and nothing after it').toBe(written);
    expect(read).toEqual(data);
  });

  it('keeps awkward characters in attributes intact', () => {
    const alt = 'He said "hi" & <b>left</b> {now} \\ done';
    const { read } = roundTrip('Figure', { src: '/media/a.jpg', alt, caption: "It's fine" });
    expect(read).toEqual({ src: '/media/a.jpg', alt, caption: "It's fine" });
  });

  it('omits empty optional attributes and values equal to the component default', () => {
    expect(byId('Figure').toBlock({ src: 'a.jpg', alt: 'x', caption: '', align: 'center', size: 'lg' })).toBe(
      '<Figure src="a.jpg" alt="x" />',
    );
    expect(byId('Callout').toBlock({ body: 'Hi' })).toBe('<Callout type="info">\n\nHi\n\n</Callout>');
    expect(byId('Divider').toBlock({ variant: 'rule' })).toBe('<Divider />');
    expect(byId('TwoColumn').toBlock({ left: 'L', right: 'R', ratio: '1:1' })).toMatch(/^<TwoColumn>\n/);
  });

  it('writes the TwoColumn slots as docs/ARTICLE_COMPONENTS.md asks: unindented, blank lines round the Markdown', () => {
    expect(byId('TwoColumn').toBlock({ left: 'L', right: 'R' })).toBe(
      '<TwoColumn>\n\n<div slot="left">\n\nL\n\n</div>\n\n<div slot="right">\n\nR\n\n</div>\n\n</TwoColumn>',
    );
  });

  it('reads a block that was just inserted with empty fields (Decap does this on insert)', () => {
    for (const id of ['Callout', 'Quote', 'Figure', 'VideoEmbed', 'ImageGallery', 'TwoColumn', 'Divider']) {
      const { match } = roundTrip(id, {});
      expect(match, id).not.toBeNull();
    }
  });

  it('does not run on to a second block of the same kind', () => {
    const block = byId('Callout');
    const one = block.toBlock({ type: 'info', body: 'One' });
    const two = block.toBlock({ type: 'tip', body: 'Two' });
    expect(block.pattern.exec(`${one}\n\n${two}`)?.[0]).toBe(one);
  });
});

describe('attribute helpers', () => {
  it('writes plain values as strings and anything risky as a JS string', () => {
    expect(stringAttr('a', 'plain')).toBe(' a="plain"');
    expect(stringAttr('a', 'say "x"')).toBe(' a={"say \\"x\\""}');
    expect(stringAttr('a', '  ')).toBe('');
    expect(stringAttr('a', 'two\nlines')).toBe(' a="two lines"');
    expect(jsonAttr('a', [])).toBe('');
  });
  it('parses what it writes and skips what it cannot read', () => {
    expect(parseAttrs(' a="x" b={"y \\"z\\""} c={[{"k":1}]}')).toEqual({ a: 'x', b: 'y "z"', c: [{ k: 1 }] });
    expect(parseAttrs(' a={[nope]}')).toEqual({});
  });
  it('finds the YouTube id in a link or accepts a bare id', () => {
    for (const url of [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'dQw4w9WgXcQ',
    ]) {
      expect(youtubeIdFrom(url)).toBe('dQw4w9WgXcQ');
    }
  });
});
