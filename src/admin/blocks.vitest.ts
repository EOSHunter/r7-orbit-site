import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARTICLE_COMPONENT_NAMES } from '../lib/article-component-names';
import { blocks, jsonAttr, markdownImage, parseAttrs, stringAttr, youtubeIdFrom, type BlockData } from './blocks';

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
    ['Divider', { variant: 'orbit' }],
    ['Pullquote', { body: 'Basically mission control for your AI coders.', cite: 'R7', ring: 'mission control' }],
    [
      'AgentCards',
      {
        cards: [
          { task: 'Add a dark mode', agent: 'Quasar', tool: 'Claude', model: 'Sonnet 5.5', effort: 'Medium', state: 'finished', report: 'I fixed `dayOf` in "src/streak.js" {x}.' },
          { task: 'Npm start', agent: 'Laika', tool: 'PowerShell', state: 'interrupted', note: 'Orbit closed while this ran.' },
        ],
        caption: 'From the video.',
      },
    ],
    [
      'OrbitDiagram',
      {
        hub: 'lumen',
        meta: 'main · 9 agents',
        agents: [
          { agent: 'Quasar', task: 'Add a dark mode', tool: 'Claude', state: 'finished' },
          { agent: 'Atlas', task: 'Fix the timezone bug in…', tool: 'Claude', state: 'working' },
        ],
        caption: 'The canvas.',
      },
    ],
    ['StatDial', { value: '17', unit: 's', caption: 'In the video, that agent finished in 17 seconds.', source: 'From the video' }],
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
    for (const id of ['Callout', 'Quote', 'Figure', 'VideoEmbed', 'ImageGallery', 'TwoColumn', 'Divider', 'Pullquote', 'AgentCards', 'OrbitDiagram', 'StatDial']) {
      const { match } = roundTrip(id, {});
      expect(match, id).not.toBeNull();
    }
  });

  it('writes the brand blocks as the components expect them', () => {
    expect(byId('Pullquote').toBlock({ body: 'One\nscreen {now}', ring: 'One screen' })).toBe('<Pullquote ring="One screen">One screen now</Pullquote>');
    expect(byId('AgentCards').toBlock({ cards: [{ task: 'T', agent: 'A', tool: '', model: ' ' }] })).toBe('<AgentCards cards={[{"task":"T","agent":"A"}]} />');
    expect(byId('StatDial').toBlock({ value: '18', unit: 'commits', caption: 'Eighteen.' })).toBe('<StatDial value="18" unit="commits" caption="Eighteen." />');
    expect(byId('Divider').toBlock({ variant: 'orbit' })).toBe('<Divider variant="orbit" />');
  });

  it('reads the brand blocks exactly as they are written in the post', () => {
    // Line endings as Decap sees them (the file may be checked out with CRLF on Windows).
    const post = readFileSync('src/content/blog/so-youve-got-an-ai-that-writes-code-cool-what-if-you-had-ten.mdx', 'utf8').replace(/\r\n/g, '\n');
    for (const id of ['AgentCards', 'OrbitDiagram', 'StatDial', 'Pullquote']) {
      const block = byId(id);
      const starts = [...post.matchAll(new RegExp(String.raw`^<${id}\b`, 'gm'))].map((m) => m.index ?? 0);
      expect(starts.length, id).toBeGreaterThan(0);
      for (const at of starts) {
        const match = block.pattern.exec(post.slice(at));
        expect(match, `${id} at ${at}`).not.toBeNull();
        // Writing what was read gives back the same text: an edit in the admin leaves the block as it was.
        expect(block.toBlock(block.fromBlock(match as RegExpMatchArray) as BlockData), id).toBe(match?.[0]);
      }
    }
  });

  it('does not run on to a second block of the same kind', () => {
    const block = byId('Callout');
    const one = block.toBlock({ type: 'info', body: 'One' });
    const two = block.toBlock({ type: 'tip', body: 'Two' });
    expect(block.pattern.exec(`${one}\n\n${two}`)?.[0]).toBe(one);
  });
});

const fieldNames = (block: { fields?: unknown[] }) => (block.fields ?? []).map((f) => (f as { name: string }).name);

describe('the Image blocks', () => {
  it('labels the Figure block "Image" and offers image, alt, caption, decoration, placement and size', () => {
    const figure = byId('Figure');
    expect(figure.label).toBe('Image');
    expect(fieldNames(figure)).toEqual(['src', 'alt', 'caption', 'decorative', 'align', 'size']);
  });

  it('writes a decorative Figure without alt text, and reads it back', () => {
    const { written, read } = roundTrip('Figure', { src: '/src/assets/blog/a.jpg', decorative: true, alt: 'ignored' });
    expect(written).toBe('<Figure src="/src/assets/blog/a.jpg" decorative={true} />');
    expect(read).toEqual({ src: '/src/assets/blog/a.jpg', decorative: true });
  });

  it('replaces the built-in Markdown image block (same id) with one that asks for alt text and a caption', () => {
    expect(markdownImage.id).toBe('image');
    expect(fieldNames(markdownImage)).toEqual(['image', 'alt', 'caption', 'decorative']);
  });

  const md = (data: BlockData) => {
    const written = markdownImage.toBlock(data);
    const match = markdownImage.pattern.exec(`${written}\n\nText after.`);
    return { written, match, read: match ? (markdownImage.fromBlock(match) as BlockData) : undefined };
  };

  it('writes ![alt](src) and an italic caption line, and reads them back', () => {
    const { written, match, read } = md({ image: '/media/news/a.jpg', alt: 'A chart', caption: 'Figure 1', decorative: false });
    expect(written).toBe('![A chart](/media/news/a.jpg)\n*Figure 1*');
    expect(match?.[0]).toBe(written);
    expect(read).toEqual({ image: '/media/news/a.jpg', alt: 'A chart', caption: 'Figure 1', decorative: false });
  });

  it('writes a picture with no caption as one line', () => {
    expect(md({ image: '/media/a.jpg', alt: 'A' }).written).toBe('![A](/media/a.jpg)');
  });

  it('marks a decorative picture with the title the build understands', () => {
    const { written, read } = md({ image: '/media/a.jpg', decorative: true });
    expect(written).toBe('![](/media/a.jpg "decorative")');
    expect(read).toMatchObject({ decorative: true, alt: '' });
  });

  it('keeps square brackets, asterisks and line breaks from breaking the Markdown', () => {
    expect(md({ image: '/media/a.jpg', alt: 'A [chart]\nof *x*', caption: 'It *is*\nfine' }).written).toBe(
      '![A chart of *x*](/media/a.jpg)\n*It is fine*',
    );
  });

  it('reads a block inserted with empty fields, and a plain image the editor already holds', () => {
    expect(md({}).match).not.toBeNull();
    expect(markdownImage.pattern.exec('![Old](/media/a.jpg "A title")')?.[0]).toBe('![Old](/media/a.jpg "A title")');
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
