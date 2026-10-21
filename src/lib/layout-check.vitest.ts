import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  altProblem,
  bodyItems,
  checkLayout,
  countSentences,
  DEFAULT_HYPE,
  formatReport,
  isTitleCase,
  jsxAttributes,
  kindOf,
  parseHypeList,
  RULES,
} from './layout-check.mjs';

const fixture = (name: string) =>
  readFileSync(new URL(`../../tests/fixtures/layout-check/${name}`, import.meta.url), 'utf8');
const rules = (result: { findings: { rule: string }[] }) => result.findings.map((f) => f.rule);
const post = (frontMatter: string, body = '') => `---\n${frontMatter.trim()}\n---\n${body}`;
// A front matter that passes every front-matter rule, for tests about the body.
const FM = `title: A plain title\ndate: 2026-01-01\nsummary: A short summary that says what the reader gets.\ncover: /media/news/x.jpg\ncoverAlt: A dark board with three lit lanterns in one corner`;

describe('the fixtures (also the before and after of docs/WRITING_GUIDE.md)', () => {
  it('finds the wall of text and everything wrong with it', () => {
    const result = checkLayout(fixture('wall-of-text.mdx'), { path: 'tests/fixtures/layout-check/wall-of-text.mdx' });
    expect(result.kind).toBe('blog');
    expect(rules(result)).toEqual([
      'no-hero',
      'title-case',
      'wall-of-text',
      'long-paragraph',
      'hype',
      'exclamation',
      'vague-link',
    ]);
    expect(result.findings.find((f) => f.rule === 'wall-of-text')).toMatchObject({ line: 9 });
    expect(result.score).toBeLessThan(70);
  });

  it('finds nothing in the same article laid out with the blocks', () => {
    const result = checkLayout(fixture('well-laid-out.mdx'), { path: 'well-laid-out.mdx', kind: 'blog' });
    expect(result.findings).toEqual([]);
    expect(result.score).toBe(100);
    expect(result.words).toBeGreaterThan(300);
  });

  it('reads a sections body: a long text block is a wall, with file lines', () => {
    const result = checkLayout(fixture('sections-wall.md'), { path: 'tests/fixtures/layout-check/sections-wall.md' });
    expect(result.kind).toBe('news');
    expect(result.sections).toBe(true);
    expect(rules(result)).toEqual(['no-hero', 'title-case', 'news-sources', 'wall-of-text', 'alt-poor', 'title-case']);
    expect(result.findings.find((f) => f.rule === 'news-sources')).toMatchObject({ line: 10 });
    expect(result.findings.find((f) => f.rule === 'alt-poor')).toMatchObject({ line: 24 });
    expect(result.findings.filter((f) => f.rule === 'title-case')[1]).toMatchObject({ line: 27 });
  });

  it('finds nothing in a news item laid out as sections', () => {
    const result = checkLayout(fixture('sections-good.md'), { path: 'tests/fixtures/layout-check/sections-good.md' });
    expect(result.findings).toEqual([]);
  });
});

describe('density', () => {
  const para = (n: number) => 'One idea in a short sentence. Another short sentence follows it.\n\n'.repeat(n);
  it('allows four paragraphs in a row, not five', () => {
    expect(rules(checkLayout(post(FM, para(4)), { kind: 'news' }))).not.toContain('wall-of-text');
    expect(rules(checkLayout(post(FM, para(5)), { kind: 'news' }))).toContain('wall-of-text');
  });

  it('breaks the run on a heading, a list, a quote, a callout, code or a component', () => {
    for (const between of [
      '## A heading',
      '- a list item',
      '> a quote',
      '> [!NOTE]\n> A note.',
      '```js\nx\n```',
      '<Divider />',
      '![A lit board of tiles](/media/x.jpg)',
    ]) {
      expect(
        rules(checkLayout(post(FM, `${para(3)}${between}\n\n${para(3)}`), { kind: 'news' })),
        between,
      ).not.toContain('wall-of-text');
    }
  });

  it('flags a run over 250 words even in few paragraphs', () => {
    const long = `${'word '.repeat(130)}end.\n\n${'word '.repeat(130)}end.\n`;
    expect(rules(checkLayout(post(FM, long), { kind: 'news' }))).toContain('wall-of-text');
  });

  it('counts sentences, not abbreviations or decimals', () => {
    expect(countSentences('One. Two! Three? Four.')).toBe(4);
    expect(countSentences('It ran 1.5 times faster, e.g. on Linux. Then it stopped.')).toBe(2);
    expect(countSentences('')).toBe(0);
  });

  it('wants a picture after 600 words, and a contents list for a long post with 3 ## outside the blog', () => {
    const long = ['## One', '## Two', '## Three']
      .map((h) => `${h}\n\n${'Some words in a sentence here. '.repeat(40)}\n\n- a list\n`)
      .join('\n');
    const news = rules(checkLayout(post(FM, long), { kind: 'news' }));
    expect(news).toContain('no-picture');
    expect(news).toContain('no-contents');
    expect(rules(checkLayout(post(FM, long), { kind: 'blog' }))).not.toContain('no-contents');
    expect(rules(checkLayout(post(`${FM}\ntoc: false`, long), { kind: 'blog' }))).toContain('no-contents');
    expect(rules(checkLayout(post(FM, long), { kind: 'vlog' }))).not.toContain('no-picture');
  });

  it('rations callouts and pull quotes, and a pull quote must repeat the text', () => {
    const body =
      'A line worth repeating here.\n\n<Pullquote>A line worth repeating</Pullquote>\n\n<Callout>One.</Callout>\n\n<Callout type="tip">Two.</Callout>\n';
    const found = rules(checkLayout(post(FM, body), { kind: 'blog' }));
    expect(found).toContain('too-many-callouts');
    expect(found).not.toContain('pullquote-echo');
    expect(
      rules(checkLayout(post(FM, 'Some text.\n\n<Pullquote>Words nobody wrote above</Pullquote>\n'), { kind: 'blog' })),
    ).toContain('pullquote-echo');
  });
});

describe('headings and titles', () => {
  it('knows Title Case from sentence case with names', () => {
    expect(isTitleCase('What I Would Tell Someone Trying This')).toBe(true);
    expect(isTitleCase('Dev Tools')).toBe(true);
    expect(isTitleCase('How I built a browser game with *R7 Orbit*')).toBe(false);
    expect(isTitleCase('Claude or Codex? Run both.')).toBe(false);
    expect(isTitleCase('Building Vesper Drift', new Set(['Vesper', 'Drift']))).toBe(false);
  });

  it('learns names from the body, so a name in a heading is not Title Case', () => {
    const body = '## Playing Lantern Tiles\n\nI played Lantern Tiles all weekend.\n';
    expect(rules(checkLayout(post(FM, body), { kind: 'news' }))).not.toContain('title-case');
  });

  it('flags an h1 in the body, a skipped level, two brass phrases and a heading wholly in brass', () => {
    const body = '# A second h1\n\n## A *first* and a *second*\n\n#### Too deep\n\n## *The whole heading in brass*\n';
    const found = rules(checkLayout(post(FM, body), { kind: 'news' }));
    expect(found).toEqual(expect.arrayContaining(['heading-h1', 'heading-skip', 'brass-phrase']));
    expect(found.filter((r) => r === 'brass-phrase')).toHaveLength(2);
  });

  it('checks the summary', () => {
    expect(
      rules(checkLayout(post('title: A title\ncover: /x.jpg\ncoverAlt: A lit board of tiles'), { kind: 'news' })),
    ).toContain('summary');
    expect(rules(checkLayout(post(`title: A title\nsummary: ${'x'.repeat(181)}`), { kind: 'news' }))).toContain(
      'summary',
    );
    expect(rules(checkLayout(post('title: A title\nsummary: A title'), { kind: 'news' }))).toContain('summary');
  });
});

describe('pictures', () => {
  it('judges alt text', () => {
    expect(altProblem('Image of the game')).toMatch(/image of/i);
    expect(altProblem('screenshot-2026-10-03-195701.png')).toMatch(/file name/);
    expect(altProblem('IMG_0001')).toMatch(/file name/);
    expect(altProblem('Screenshot')).toMatch(/too little/);
    expect(altProblem('Screenshot of R7 Orbit with three agent cards around the R7 mark')).toBeUndefined();
  });

  it('wants a hero, unless the front matter says why not', () => {
    expect(rules(checkLayout(post('title: A title\nsummary: A summary of it.'), { kind: 'news' }))).toContain(
      'no-hero',
    );
    const heroless = checkLayout(
      post('title: A title\nsummary: A summary of it.\n# heroless: a two-line correction, no picture fits'),
      { kind: 'news' },
    );
    expect(rules(heroless)).not.toContain('no-hero');
    expect(heroless.notes[0]).toMatch(/a two-line correction/);
    expect(
      rules(checkLayout(post('title: A title\nsummary: A summary of it.\nyoutubeId: abcdefghijk'), { kind: 'vlog' })),
    ).not.toContain('no-hero');
  });

  it('checks the alt text of front matter, Markdown, MDX and section pictures', () => {
    expect(
      rules(checkLayout(post('title: A title\nsummary: A summary.\ncover: /x.jpg\ncoverAlt: ""'), { kind: 'news' })),
    ).toContain('alt-missing');
    expect(rules(checkLayout(post(FM, '![](/media/x.jpg)\n'), { kind: 'news' }))).toContain('alt-missing');
    expect(rules(checkLayout(post(FM, '![](/media/x.jpg "decorative")\n'), { kind: 'news' }))).not.toContain(
      'alt-missing',
    );
    expect(
      rules(checkLayout(post(FM, '<Figure src="/media/x.jpg" alt="picture of a thing" />\n'), { kind: 'blog' })),
    ).toContain('alt-poor');
    const row = `<ImageRow images={[{ src: '/a.jpg', alt: 'A lit board of tiles' }, { src: '/b.jpg', alt: '' }]} />\n`;
    expect(rules(checkLayout(post(FM, row), { kind: 'blog' }))).toContain('alt-missing');
    const sections = `${FM}\nsections:\n  - type: gallery\n    shots:\n      - image: /media/x.jpg\n        alt: x.jpg\n`;
    expect(checkLayout(post(sections), { kind: 'project' }).findings).toContainEqual(
      expect.objectContaining({ rule: 'alt-poor', line: 8 }),
    );
  });

  it('finds the empty placeholder plate and the IMAGE NEEDED marker', () => {
    const body =
      '<Callout type="warn" title="IMAGE NEEDED">A photo of the board.</Callout>\n\n<Figure alt="A lit board of tiles" />\n';
    const found = rules(checkLayout(post(FM, body), { kind: 'blog' }));
    expect(found).toContain('image-needed');
    expect(found).toContain('placeholder-plate');
    expect(found).not.toContain('too-many-callouts');
  });
});

describe('words, links and what the site forbids', () => {
  it('reads the words to avoid from docs/VOICE_AND_COPY.md', () => {
    const doc = readFileSync(new URL('../../docs/VOICE_AND_COPY.md', import.meta.url), 'utf8');
    expect(parseHypeList(doc)).toEqual(DEFAULT_HYPE);
    expect(parseHypeList('no list here')).toEqual(DEFAULT_HYPE);
  });

  it('finds a word to avoid in its forms, and AI-powered', () => {
    for (const sentence of [
      'It unlocks a lot.',
      'We are leveraging it.',
      'It works seamlessly.',
      "Let's dive in.",
      'An AI-powered tool.',
    ]) {
      expect(rules(checkLayout(post(FM, `${sentence}\n`), { kind: 'news' })), sentence).toContain('hype');
    }
    expect(rules(checkLayout(post(FM, 'A locked door, a calm leverless room.\n'), { kind: 'news' }))).not.toContain(
      'hype',
    );
  });

  it('finds contact details, a newsletter or RSS, anywhere', () => {
    for (const text of [
      'Write to someone@example.com.',
      'Join the newsletter.',
      'The RSS feed is at /rss.xml.',
      '[Email](mailto:x)',
    ]) {
      expect(rules(checkLayout(post(FM, `${text}\n`), { kind: 'news' })), text).toContain('contact');
    }
  });

  it('finds vague links, raw buttons and template placeholders, not code', () => {
    const body =
      '[here](https://example.com) and [](https://example.com)\n\n<a class="btn solid lg" href="/x/">Play</a>\n\nTODO: the second paragraph.\n\n```html\n<button>in code</button>\n```\n';
    const found = rules(checkLayout(post(FM, body), { kind: 'news' }));
    expect(found.filter((r) => r === 'vague-link')).toHaveLength(2);
    expect(found.filter((r) => r === 'raw-html')).toHaveLength(1);
    expect(found).toContain('placeholder');
  });
});

describe('reading a file', () => {
  it('reads MDX attributes, with braces and quotes inside', () => {
    expect(jsxAttributes('<Figure src="/a.jpg" alt=\'A "quoted" alt\' decorative size={"md"} />')).toEqual({
      src: '/a.jpg',
      alt: 'A "quoted" alt',
      decorative: true,
      size: 'md',
    });
    const items = bodyItems('<AgentCards cards={[{"task":"a > b","report":"x"}]} caption="c" />\n\nAfter.\n');
    expect(items.map((i: { type: string }) => i.type)).toEqual(['visual', 'para']);
  });

  it('knows the kind from the folder, else from the fields', () => {
    expect(kindOf('src/content/vlogs/x.md')).toBe('vlog');
    expect(kindOf('tests/fixtures/posts/projects/x.md')).toBe('project');
    expect(kindOf('elsewhere/x.md', { sourceUrl: 'https://x' })).toBe('news');
    expect(kindOf('elsewhere/x.mdx')).toBe('blog');
  });

  it('writes a report with the line, the rule and one fix per rule', () => {
    const result = checkLayout(fixture('wall-of-text.mdx'), { path: 'wall-of-text.mdx', kind: 'blog' });
    const report = formatReport([result]);
    expect(report).toMatch(/wall-of-text\.mdx\s+\(blog, \d+ words\)\s+score \d+\/100/);
    expect(report).toMatch(/ {5}9 {2}wall-of-text/);
    expect(report).toContain(`fix: ${RULES['wall-of-text'].fix}`);
    expect(report).toMatch(/Checked 1 file: 0 clean, 7 warnings/);
    expect(report).toMatch(/exit code is 0/);
  });
});
