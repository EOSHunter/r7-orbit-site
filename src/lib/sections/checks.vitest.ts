import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { authorProblem, frameSrcOrigins, gameProblem, latestProblems, onceProblems, whereOf, type Known } from './checks';
import { headingsInHtml, headingsOfMarkdown, SlugBook, withHeadingIds } from './headings';
import { prepareSections } from './prepare';
import type { Section } from './schema';
import { sectionsSchema } from './schema';

const known: Known = { tags: ['ai-agents', 'git'], authors: ['hunter-newton', 'r7'] };

describe('whereOf', () => {
  it('names the file and the block the way the editor counts: from 1, with the block\'s label', () => {
    expect(whereOf('about.md', 0, 'Heading')).toBe('about.md, block 1 (Heading)');
    expect(whereOf('about.md', 3, 'Latest posts')).toBe('about.md, block 4 (Latest posts)');
  });
});

describe('latestProblems: what a Latest posts block may point at', () => {
  it('accepts a tag and an author that exist, and no filter at all', () => {
    expect(latestProblems({ kinds: [] }, known)).toEqual([]);
    expect(latestProblems({ kinds: ['blog'], tag: 'git', author: 'r7' }, known)).toEqual([]);
  });

  it('names an unknown tag, with the tags in use', () => {
    expect(latestProblems({ kinds: [], tag: 'nope' }, known)).toEqual(['no post has the tag "nope". Tags in use: ai-agents, git.']);
  });

  it('names an unknown author, with the authors there are', () => {
    expect(latestProblems({ kinds: [], author: 'someone' }, known)).toEqual(['there is no author "someone". Authors are: hunter-newton, r7.']);
  });

  it('names an unknown kind (the schema refuses one first; this is the second line of defence)', () => {
    expect(latestProblems({ kinds: ['podcast'] }, known)[0]).toMatch(/no kind "podcast"\. The kinds are: news, blog, vlog, project, repo/);
  });

  it('reports each problem, and copes with a site that has no tags yet', () => {
    expect(latestProblems({ kinds: [], tag: 'a', author: 'b' }, { tags: [], authors: [] })).toEqual([
      'no post has the tag "a". Tags in use: (none yet).',
      'there is no author "b". Authors are: (none yet).',
    ]);
  });
});

describe('authorProblem', () => {
  it('passes a real author and names the real ones when it is not', () => {
    expect(authorProblem('r7', known)).toBeUndefined();
    expect(authorProblem('ghost', known)).toBe('there is no author "ghost". Authors are: hunter-newton, r7.');
  });
});

describe('the frame-src rule for a game', () => {
  const headers = readFileSync('public/_headers', 'utf8');

  it('reads the hosts public/_headers lets the site frame', () => {
    expect(frameSrcOrigins(headers)).toEqual(['https://vesper.r7orbit.io']);
    expect(frameSrcOrigins('/*\n  X: y\n')).toEqual([]);
  });

  it('accepts an embedded game on an allowed host, and any link-mode game (it is only a button)', () => {
    const allowed = ['https://vesper.r7orbit.io'];
    expect(gameProblem({ playUrl: 'https://vesper.r7orbit.io/play/', playMode: 'embed' }, allowed)).toBeUndefined();
    expect(gameProblem({ playUrl: 'https://elsewhere.test/', playMode: 'link' }, allowed)).toBeUndefined();
  });

  it('refuses an embedded game on a host that is not allowed, saying where to add it and the other way out', () => {
    const message = gameProblem({ playUrl: 'https://elsewhere.test/g', playMode: 'embed' }, ['https://vesper.r7orbit.io']);
    expect(message).toMatch(/https:\/\/elsewhere\.test is not in frame-src in public\/_headers/);
    expect(message).toMatch(/Link/);
    expect(gameProblem({ playUrl: 'https://vesper.r7orbit.io.evil.test/', playMode: 'embed' }, ['https://vesper.r7orbit.io'])).toBeDefined();
  });
});

describe('page headings', () => {
  it('hands out ids that are unique on the page', () => {
    const book = new SlugBook();
    expect([book.next('Notes'), book.next('Notes'), book.next('Notes'), book.next('Other things!')]).toEqual(['notes', 'notes-1', 'notes-2', 'other-things']);
  });

  it('reads the h2 and h3 of sanitised HTML and gives them ids, in order', () => {
    const html = '<p>x</p><h2>One <em>two</em></h2><h3>Three</h3><h4>no</h4>';
    expect(headingsInHtml(html)).toEqual([
      { depth: 2, text: 'One two' },
      { depth: 3, text: 'Three' },
    ]);
    expect(withHeadingIds(html, ['one-two', 'three'])).toBe('<p>x</p><h2 id="one-two">One <em>two</em></h2><h3 id="three">Three</h3><h4>no</h4>');
  });

  it('reads ## and ### from Markdown for the preview, outside code fences', () => {
    expect(headingsOfMarkdown('## A [link](/x/)\n\ntext\n\n```\n## not\n```\n\n### B **bold**\n#### no')).toEqual([
      { depth: 2, text: 'A link' },
      { depth: 3, text: 'B bold' },
    ]);
  });
});

const parse = (blocks: unknown[]): Section[] => sectionsSchema.parse(blocks);

describe('prepareSections', () => {
  it('renders every Markdown box (by the schema, not by name) and measures every picture', async () => {
    const sections = parse([
      { type: 'text', text: 'Some **bold** text.' },
      { type: 'lead', text: 'A *lead* with [a link](/x/).' },
      { type: 'columns', left: 'Left', right: '- a\n- b' },
      { type: 'quote', text: 'Said.' },
      { type: 'image-row', images: [{ image: '/media/about/hunter-newton.jpg', alt: 'A' }, { image: '/og-default.png', alt: 'B' }] },
    ]);
    const ctx = await prepareSections(sections, 'about.md');
    expect(ctx.get(sections[0])?.html.text).toBe('<p>Some <strong>bold</strong> text.</p>');
    expect(ctx.get(sections[1])?.html.text).toBe('A <em>lead</em> with <a href="/x/">a link</a>.');
    expect(ctx.get(sections[2])?.html.right).toContain('<ul>');
    expect(ctx.get(sections[3])?.html.text).toBe('<p>Said.</p>');
    const sizes = ctx.get(sections[4])!.sizes;
    expect([...sizes.keys()]).toEqual(['/media/about/hunter-newton.jpg', '/og-default.png']);
    expect(sizes.get('/media/about/hunter-newton.jpg')).toEqual({ width: 800, height: 800 });
  });

  it('gives each block where it is, counted from 1, for its own errors', async () => {
    const sections = parse([{ type: 'divider' }, { type: 'spacer' }]);
    const ctx = await prepareSections(sections, 'about.md');
    expect(ctx.get(sections[1])).toMatchObject({ where: 'about.md, block 2 (Spacer)', index: 1, source: 'about.md' });
  });

  it('names the file and block when a picture is not on the site', async () => {
    const sections = parse([{ type: 'text', text: 'x' }, { type: 'gallery', shots: [{ image: '/media/does-not-exist.jpg', alt: 'A' }] }]);
    await expect(prepareSections(sections, 'about.md')).rejects.toThrow(
      'about.md, block 2 (Lightbox gallery): the picture /media/does-not-exist.jpg is not on this site.',
    );
  });

  it('leaves the page as it is without a table of contents: no ids, no headings', async () => {
    const sections = parse([{ type: 'heading', text: 'Intro' }, { type: 'text', text: '## Inside\n\nx' }]);
    const ctx = await prepareSections(sections, 'about.md');
    expect(ctx.get(sections[0])?.headingId).toBeUndefined();
    expect(ctx.get(sections[1])?.html.text).toBe('<h2>Inside</h2>\n<p>x</p>');
    expect(ctx.get(sections[0])?.headings).toEqual([]);
  });

  it('with a table of contents, anchors every heading (a block, or a ## in a Markdown box) with a unique id, in page order', async () => {
    const sections = parse([
      { type: 'heading', text: 'Notes' },
      { type: 'text', text: '## Notes\n\nx\n\n### Deeper' },
      { type: 'heading', level: 3, text: 'A *brass* one' },
      { type: 'toc' },
    ]);
    const ctx = await prepareSections(sections, 'about.md');
    expect(ctx.get(sections[0])?.headingId).toBe('notes');
    expect(ctx.get(sections[1])?.html.text).toBe('<h2 id="notes-1">Notes</h2>\n<p>x</p>\n<h3 id="deeper">Deeper</h3>');
    expect(ctx.get(sections[3])?.headings).toEqual([
      { depth: 2, slug: 'notes', text: 'Notes' },
      { depth: 2, slug: 'notes-1', text: 'Notes' },
      { depth: 3, slug: 'deeper', text: 'Deeper' },
      { depth: 3, slug: 'a-brass-one', text: 'A brass one' },
    ]);
  });
});

describe('onceProblems', () => {
  it('lets a page hold one Latest feed (it carries the #latest anchor and the kind filter), and names every extra one by its place', () => {
    expect(onceProblems(['heading', 'feed', 'latest', 'latest', 'pinned', 'pinned'])).toEqual([]);
    expect(onceProblems(['feed', 'text', 'feed', 'feed'])).toEqual([
      { index: 2, message: 'a page holds one Latest feed block at most: remove this one, or the other.' },
      { index: 3, message: 'a page holds one Latest feed block at most: remove this one, or the other.' },
    ]);
    expect(onceProblems([undefined, null, 'no-such-block', 'feed'])).toEqual([]);
  });
});
