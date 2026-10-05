import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { looseSections, markdownHtml, previewProblems, problemsHtml, sectionsHtml } from './sections-html';

const resolve = (path: string) => `blob:${path}`;
const css = ['src/styles/sections.css', 'src/styles/site.css', 'src/styles/article.css', 'src/styles/design-system/components.css']
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const about = parseFrontmatter(readFileSync('src/content/pages/about.md', 'utf8')).frontmatter.sections;

describe('markdownHtml', () => {
  it('reads headings, paragraphs, lists and inline marks', () => {
    expect(markdownHtml('## Title\n\nOne **two** *three* `four`.\n\n- a\n- b')).toBe(
      '<h2>Title</h2><p>One <strong>two</strong> <em>three</em> <code>four</code>.</p><ul><li>a</li><li>b</li></ul>',
    );
  });

  it('escapes what it is given, and does not make a link of a script address', () => {
    const html = markdownHtml('<b onclick="x()">hi</b> [x](javascript:alert(1))');
    expect(html).not.toMatch(/<b|javascript/);
    expect(html).toContain('&lt;b');
  });
});

describe('headings', () => {
  it('set one *phrase* in italic brass, as a title does, and escape everything else', () => {
    const html = sectionsHtml([{ type: 'heading', level: 2, text: 'How I *work* <b>' }, { type: 'heading', level: 3, text: 'No marks' }], resolve);
    expect(html).toContain('<h2>How I <em>work</em> &lt;b&gt;</h2>');
    expect(html).toContain('<h3>No marks</h3>');
  });

  it('does the same for the heading beside a portrait', () => {
    const html = sectionsHtml(
      [
        { type: 'heading', level: 2, text: 'Hunter *Newton*' },
        { type: 'portrait', image: '/media/a.jpg', alt: 'A', text: 'Beside.' },
      ],
      resolve,
    );
    expect(html).toContain('<div class="prose"><h2>Hunter <em>Newton</em></h2>');
  });

  it('leaves **bold** as bold: only a heading phrase is brass', () => {
    expect(markdownHtml('Some **bold** words')).toBe('<p>Some <strong>bold</strong> words</p>');
  });
});

describe('previewProblems', () => {
  it('flags a picture with no alt text unless it is decorative, naming the block', () => {
    const blocks = [
      { type: 'heading', text: 'H' },
      { type: 'image', image: '/media/a.jpg', alt: '' },
      { type: 'image', image: '/media/a.jpg', alt: '', decorative: true },
      { type: 'portrait', image: '/media/a.jpg', alt: ' ', text: 'T' },
      { type: 'image', image: '/media/a.jpg', alt: 'Described' },
    ];
    expect(previewProblems(blocks)).toEqual([
      'Block 2 (Image) needs alt text: describe the picture, or turn on "Decorative image".',
      'Block 4 (Portrait and text) needs alt text: describe the picture, or turn on "Decorative image".',
    ]);
    expect(problemsHtml(previewProblems(blocks))).toContain('Fix before saving.');
  });

  it('says nothing for the About page as it is', () => {
    expect(previewProblems(about)).toEqual([]);
    expect(problemsHtml([])).toBe('');
  });
});

describe('sectionsHtml', () => {
  it('draws the About page like the site: one portrait row holding both sections, level, in order', () => {
    const html = sectionsHtml(about, resolve);
    expect(html).toMatch(/^<div class="sections"><div class="container wide sec-row"><div class="about-grid" data-side="left">/);
    expect(html).toContain('<div class="portrait"><img src="blob:/media/about/hunter-newton.jpg" alt="Portrait of Hunter Newton" /></div>');
    const order = ['<h2>Hunter Newton</h2>', "I build software", '<h2>R7 · Orbit AI Agent</h2>', "R7 is the AI agent", '<strong>Where it can go wrong:</strong>'];
    const at = order.map((s) => html.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html.match(/class="about-grid"/g)).toHaveLength(1);
  });

  it('follows a re-ordered list', () => {
    const [h1, portrait, h2, text] = about as Record<string, unknown>[];
    const html = sectionsHtml([h2, text, h1, portrait], resolve);
    expect(html.indexOf('R7 · Orbit AI Agent')).toBeLessThan(html.indexOf('Hunter Newton'));
    expect(html).toContain('<div class="container wide sec-row"><div class="prose"><h2>R7 · Orbit AI Agent</h2>');
  });

  it('puts a wide image outside the column and a full image outside the container', () => {
    const wide = sectionsHtml([{ type: 'image', image: '/media/a.jpg', alt: 'A', width: 'wide' }], resolve);
    expect(wide).toContain('<div class="container wide sec-row"><figure class="art-fig" data-align="center"');
    const full = sectionsHtml([{ type: 'image', image: '/media/a.jpg', alt: 'A', width: 'full' }], resolve);
    expect(full).toContain('<div class="sec-row sec-row-full"><figure class="art-fig" data-align="full"');
  });

  it('shows the placeholder for a picture that is not chosen yet, and an empty alt for a decorative one', () => {
    expect(sectionsHtml([{ type: 'image', image: '', alt: '' }], resolve)).toContain('media-ph');
    expect(sectionsHtml([{ type: 'image', image: '/media/a.jpg', alt: 'Ignored', decorative: true }], resolve)).toContain('alt=""');
  });

  it('draws every other block, and escapes their text', () => {
    const html = sectionsHtml(
      [
        { type: 'quote', text: 'A <b>line</b>', attribution: 'Someone' },
        { type: 'callout', kind: 'tip', title: 'Heads up', text: 'Body' },
        { type: 'links', items: [{ label: 'One', url: 'https://example.com', note: 'video' }, { label: 'Two', url: '/subscribe/' }] },
        { type: 'button', label: 'Go', url: 'https://example.com' },
        { type: 'divider', style: 'dots' },
      ],
      resolve,
    );
    expect(html).toContain('class="art-quote"');
    expect(html).not.toContain('<b>line</b>');
    expect(html).toContain('class="callout brass art-callout"');
    expect(html).toContain('<ul class="link-list"><li><a href="https://example.com">One<span class="where">video</span>');
    expect(html).toContain('#i-external');
    expect(html).toContain('#i-arrow');
    expect(html).toContain('<a class="btn solid" href="https://example.com">Go');
    expect(html).toContain('data-variant="dots"');
  });

  it('does not link an address the build would refuse', () => {
    const html = sectionsHtml([{ type: 'button', label: 'Go', url: 'javascript:alert(1)' }], resolve);
    expect(html).toContain('href="#"');
  });

  it('copes with a half-filled form: missing fields, an unknown block, no list at all', () => {
    expect(sectionsHtml(undefined, resolve)).toBe('<div class="sections"></div>');
    expect(() => sectionsHtml([{ type: 'links' }, { type: 'portrait' }, { type: 'nope' }, null], resolve)).not.toThrow();
    expect(looseSections([{ type: 'nope' }])).toEqual([]);
  });

  it('only uses classes the site stylesheets define', () => {
    const html = sectionsHtml(
      [
        ...(about as Record<string, unknown>[]),
        { type: 'image', image: '/media/a.jpg', alt: 'A', width: 'full' },
        { type: 'quote', text: 'Q' },
        { type: 'callout', text: 'C' },
        { type: 'links', items: [{ label: 'L', url: '/x/', note: 'n' }] },
        { type: 'button', label: 'B', url: '/x/' },
        { type: 'divider' },
      ],
      resolve,
    );
    const classes = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(' ')));
    // `sec-button` and `ico` are hooks the markup carries without a rule of their own; `container`, `wide`, `prose`, `btn` and
    // `solid` come from the design system.
    const hooks = new Set(['sec-button', 'ico']);
    for (const name of classes) {
      if (hooks.has(name)) continue;
      expect(css, `.${name} is defined`).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
    }
  });
});
