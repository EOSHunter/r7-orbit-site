import { describe, expect, it } from 'vitest';
import { definitions, headingsInHtml, headingsOfMarkdown, sectionsSchema, type Section, type SectionType } from './sections';
import { prepareSections } from './sections/prepare';
import { renderSectionMarkdown } from './section-markdown';
import { countWords } from './content';
import {
  hasSections,
  headingBefore,
  markdownToText,
  sectionsHeadings,
  sectionsToText,
} from './sections-to-content';

const parse = (blocks: unknown[]): Section[] => sectionsSchema.parse(blocks);
/** Every block of the library once, from its definition's example (what the fixture page /styleguide/sections/ draws too). */
const example = (type: SectionType): Section => parse([{ type, ...definitions.find((d) => d.id === type)!.example }])[0];

// What each block gives the reading time (text), for the example in its definition. A block added to the library fails the first test
// until it has a line here, so its projection is a decision, not an accident.
const EXPECTED: Record<SectionType, { text: string[] }> = {
  heading: { text: ['A row of text'] },
  lead: { text: ['A lead paragraph sets the scene', 'with bold and a link if needed'] },
  text: { text: ['Plain paragraphs, bold, italic, inline code and a link.', 'a list item', 'A second paragraph'] },
  quote: { text: ['A short quotation, set in the display face.', 'Someone Specific'] },
  post: { text: ['Someone Specific', 'A short post, quoted word for word.', ''] },
  pullquote: { text: [] },
  callout: { text: ['A tip with a title', 'Tips are brass. This one has bold in it.'] },
  code: { text: [] },
  image: { text: ['A narrow image has a caption.'] },
  'image-row': { text: ['The first.', 'The second.', 'A caption for the whole row.'] },
  gallery: { text: ['The first.', 'The second.'] },
  portrait: { text: ['The text beside the picture.'] },
  video: { text: ['Nothing is requested from YouTube until you press play.'] },
  game: { text: ['Best on desktop with a mouse'] },
  columns: { text: ['The left column, twice as wide.', 'The right column, with a list:'] },
  divider: { text: [] },
  spacer: { text: [] },
  links: { text: ['A page on this site', 'Another site, with a note', 'video'] },
  button: { text: ['A button to another site'] },
  toc: { text: [] },
  stats: { text: [] },
  latest: { text: [] },
  feed: { text: [] },
  'news-desk': { text: [] },
  pinned: { text: [] },
  apps: { text: [] },
  author: { text: [] },
  team: { text: ['Director', 'Lead agent', 'A shorter line typed in the block, shown instead of the bio.'] },
  waitlist: { text: [] },
};

describe('sections-to-content: every block', () => {
  it('has a decision for every block of the library', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(definitions.map((d) => d.id).sort());
  });

  for (const { id } of definitions) {
    it(`${id}: its words`, () => {
      const block = example(id);
      const want = EXPECTED[id];
      const text = sectionsToText([block]);
      for (const piece of want.text) expect(text, `text of ${id}`).toContain(piece);
      if (!want.text.length) expect(text, `${id} adds no words`).toBe('');
      // Plain text has no Markdown marks left in it.
      expect(text).not.toMatch(/\*\*|\]\(|^#|^>/m);
    });
  }

  it('does not count the label the page gives a callout without a title', () => {
    const blocks = parse([
      { type: 'callout', kind: 'info', text: 'a' },
      { type: 'callout', kind: 'warn', text: 'b' },
    ]);
    // The label is chrome: only a title the author wrote counts as words.
    expect(sectionsToText(blocks)).toBe('a\n\nb');
  });

  it('keeps the words of the blocks in page order, a blank line apart', () => {
    const blocks = parse([
      { type: 'heading', text: 'One', level: 2 },
      { type: 'text', text: 'Two' },
      { type: 'spacer' },
      { type: 'text', text: 'Three' },
    ]);
    expect(sectionsToText(blocks)).toBe('One\n\nTwo\n\nThree');
    expect(sectionsToText([])).toBe('');
  });

  it('says whether a post is written as sections', () => {
    expect(hasSections({ sections: example('text') ? [example('text')] : [] })).toBe(true);
    expect(hasSections({ sections: [] })).toBe(false);
    expect(hasSections({})).toBe(false);
  });
});

describe('markdownToText', () => {
  it('keeps the words, drops the marks, code blocks, pictures and tags', () => {
    const md = '## Title\n\nSome **bold**, `code` and [a link](/x/).\n\n```js\nconst notCounted = 1;\n```\n\n![alt words](/a.png)\n\n> quoted\n\n- one\n- two\n\n<b>tag</b>';
    expect(markdownToText(md)).toBe('Title\n\nSome bold, code and a link.\n\nquoted\n\none two\n\ntag');
  });

  it('counts the same words as the Markdown body would', () => {
    const md = 'One two three.\n\n## Four five\n\n- six\n- seven\n\n```\nnot counted at all\n```\n\n[eight](/x/) nine.';
    expect(countWords(markdownToText(md))).toBe(countWords(md));
  });
});

describe('sectionsHeadings', () => {
  it('reads Heading blocks and the ## and ### inside Markdown boxes, in page order, with unique anchors', () => {
    const blocks = parse([
      { type: 'heading', text: 'Why *blocks*', level: 2 },
      { type: 'text', text: 'Intro.\n\n### A sub-heading\n\nMore.\n\n## Notes' },
      { type: 'heading', text: 'Notes', level: 3 },
      { type: 'columns', left: '## Left side', right: 'No heading.' },
      { type: 'callout', text: '## Not a box the reader opens' },
      { type: 'portrait', image: '/media/about/hunter-newton.jpg', alt: 'x', text: '## Beside the picture' },
    ]);
    expect(sectionsHeadings(blocks)).toEqual([
      { depth: 2, text: 'Why blocks', slug: 'why-blocks', index: 0 },
      { depth: 3, text: 'A sub-heading', slug: 'a-sub-heading', index: 1, field: 'text' },
      { depth: 2, text: 'Notes', slug: 'notes', index: 1, field: 'text' },
      { depth: 3, text: 'Notes', slug: 'notes-1', index: 2 },
      { depth: 2, text: 'Left side', slug: 'left-side', index: 3, field: 'left' },
      { depth: 2, text: 'Not a box the reader opens', slug: 'not-a-box-the-reader-opens', index: 4, field: 'text' },
      { depth: 2, text: 'Beside the picture', slug: 'beside-the-picture', index: 5, field: 'text' },
    ]);
  });

  it('is empty for a body with no headings', () => {
    expect(sectionsHeadings(parse([{ type: 'text', text: 'Just text.' }]))).toEqual([]);
  });
});

describe('headingBefore (the Team block names its members h2 or h3 by it)', () => {
  const team = { type: 'team', members: [{ author: 'r7', title: 'Lead agent' }] };
  it('is false for the first block and for blocks with only h3 or no heading above them', () => {
    expect(headingBefore(parse([team]), 0)).toBe(false);
    expect(headingBefore(parse([{ type: 'text', text: 'Intro.\n\n### Small' }, { type: 'heading', text: 'Sub', level: 3 }, team]), 2)).toBe(false);
  });
  it('is true under a Heading block or a ## in a Markdown box, and only for blocks after it', () => {
    expect(headingBefore(parse([{ type: 'heading', text: 'Meet the team', level: 2 }, team]), 1)).toBe(true);
    expect(headingBefore(parse([{ type: 'text', text: 'Intro.\n\n## The team' }, team]), 1)).toBe(true);
    expect(headingBefore(parse([team, { type: 'heading', text: 'After', level: 2 }]), 0)).toBe(false);
  });
});

describe('headingsOfMarkdown agrees with the rendered page', () => {
  // What the page renders is the truth (prepare.ts stops the build if the two disagree); each of these must find the same headings.
  const cases = [
    '## Plain\n\ntext',
    'Underlined\n---\n\ntext',
    'Two lines\nof a heading\n---',
    '> ## In a quote\n> text',
    '- item\n\n  ## In a list item',
    '- item\n---',
    'Paragraph\n\n---\n\nAfter a rule',
    '```\n## in code\n```\n\n~~~md\n## also code\n~~~\n\n### After the code',
    '#### Too deep\n\n# Too high\n\n## Fine ##',
    '## A [link](/x/) and `code` and **bold**',
    '    ## indented code, not a heading',
  ];
  for (const md of cases) {
    it(JSON.stringify(md), async () => {
      const html = await renderSectionMarkdown(md);
      expect(headingsOfMarkdown(md).map((h) => h.depth)).toEqual(headingsInHtml(html).map((h) => h.depth));
      expect(headingsOfMarkdown(md).map((h) => h.text)).toEqual(headingsInHtml(html).map((h) => h.text));
    });
  }
});

describe('the page and the projection agree', () => {
  it('gives the page headings the anchors the contents list links to', async () => {
    const blocks = parse([
      { type: 'heading', text: 'First *one*', level: 2 },
      { type: 'text', text: '## Second\n\nText.\n\n### Third' },
      { type: 'heading', text: 'Second', level: 2 },
    ]);
    const contexts = await prepareSections(blocks, 'post.md', { headingIds: true });
    const expected = sectionsHeadings(blocks);
    expect(contexts.get(blocks[0])!.headingId).toBe('first-one');
    expect(contexts.get(blocks[1])!.html.text).toContain('<h2 id="second">Second</h2>');
    expect(contexts.get(blocks[1])!.html.text).toContain('<h3 id="third">Third</h3>');
    expect(contexts.get(blocks[2])!.headingId).toBe('second-1');
    expect(contexts.get(blocks[0])!.headings).toEqual(expected.map(({ depth, slug, text }) => ({ depth, slug, text })));
  });

  it('gives no ids to a page without a contents list that did not ask for them (About is unchanged)', async () => {
    const blocks = parse([{ type: 'heading', text: 'Hello', level: 2 }, { type: 'text', text: '## Inside' }]);
    const contexts = await prepareSections(blocks, 'about.md');
    expect(contexts.get(blocks[0])!.headingId).toBeUndefined();
    expect(contexts.get(blocks[1])!.html.text).toBe('<h2>Inside</h2>');
  });

  it('stops the build, naming the block, when a heading on the page cannot be read for the contents list', async () => {
    const blocks = parse([{ type: 'text', text: 'Fine.\n\n<h2>Raw HTML heading</h2>' }]);
    await expect(prepareSections(blocks, 'blog/x.md', { headingIds: true })).rejects.toThrow(/blog\/x\.md, block 1 \(Text\): "Text" has 1 heading on the page but 0 could be read/);
  });
});
