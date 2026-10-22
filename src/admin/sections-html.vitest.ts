import { readFileSync } from 'node:fs';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import { definitions } from '../lib/sections';
import { looseSections, markdownHtml, previewProblems, problemsHtml, sectionsHtml } from './sections-html';

const resolve = (path: string) => `blob:${path}`;
const css = [
  'src/styles/sections.css',
  'src/styles/site.css',
  'src/styles/article.css',
  'src/styles/markdown.css',
  'src/styles/design-system/components.css',
  'src/admin/preview.css',
]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

// A fixed copy of the About page's portrait layout, so the tests do not change when the page is edited in the admin.
const about = parseFrontmatter(readFileSync('src/admin/fixtures/about-sections.md', 'utf8')).frontmatter.sections;
const example = (id: string) => ({ type: id, ...definitions.find((d) => d.id === id)!.example });
const html = (blocks: unknown[], authors: Parameters<typeof sectionsHtml>[2] = []) => sectionsHtml(blocks, resolve, authors);

describe('markdownHtml', () => {
  it('reads headings, paragraphs, lists and inline marks', () => {
    expect(markdownHtml('## Title\n\nOne **two** *three* `four`.\n\n- a\n- b')).toBe(
      '<h2>Title</h2><p>One <strong>two</strong> <em>three</em> <code>four</code>.</p><ul><li>a</li><li>b</li></ul>',
    );
  });

  it('escapes what it is given, and does not make a link of a script address', () => {
    const out = markdownHtml('<b onclick="x()">hi</b> [x](javascript:alert(1))');
    expect(out).not.toMatch(/<b|javascript/);
    expect(out).toContain('&lt;b');
  });
});

describe('headings', () => {
  it('set one *phrase* in italic brass, as a title does, and escape everything else', () => {
    const out = html([{ type: 'heading', level: 2, text: 'How I *work* <b>' }, { type: 'heading', level: 3, text: 'No marks' }]);
    expect(out).toContain('<h2>How I <em>work</em> &lt;b&gt;</h2>');
    expect(out).toContain('<h3>No marks</h3>');
  });

  it('does the same for the heading beside a portrait', () => {
    const out = html([
      { type: 'heading', level: 2, text: 'Hunter *Newton*' },
      { type: 'portrait', image: '/media/a.jpg', alt: 'A', text: 'Beside.' },
    ]);
    expect(out).toContain('<div class="prose"><h2>Hunter <em>Newton</em></h2>');
  });

  it('leaves **bold** as bold: only a heading phrase is brass', () => {
    expect(markdownHtml('Some **bold** words')).toBe('<p>Some <strong>bold</strong> words</p>');
  });
});

describe('previewProblems', () => {
  it('names what the build would stop on, with the block as the editor counts it (from 1) and its label', () => {
    const blocks = [
      { type: 'heading', text: 'H' },
      { type: 'image', image: '/media/a.jpg', alt: '' },
      { type: 'image', image: '/media/a.jpg', alt: '', decorative: true },
      { type: 'portrait', image: '/media/a.jpg', alt: ' ', text: 'T' },
      { type: 'image', image: '/media/a.jpg', alt: 'Described' },
    ];
    expect(previewProblems(blocks)).toEqual([
      'Block 2 (Image) (alt): this image needs alt text: describe it, or tick "Decorative" if it is purely ornamental',
      'Block 4 (Portrait and text) (alt): this image needs alt text: describe it, or tick "Decorative" if it is purely ornamental',
    ]);
    expect(problemsHtml(previewProblems(blocks))).toContain('Fix before saving.');
  });

  it('flags a refused address, a bad video id, a bad tag, a block not filled in and an unknown block', () => {
    const problems = previewProblems([
      { type: 'button', label: 'Go', url: 'http://example.com' },
      { type: 'video', youtubeId: 'https://youtu.be/dQw4w9WgXcQ', title: 'T' },
      { type: 'latest', tag: 'Not A Tag' },
      { type: 'quote' },
      { type: 'carousel' },
    ]).join('\n');
    expect(problems).toMatch(/Block 1 \(Button\) \(url\): "Address": use a full https:\/\/ address/);
    expect(problems).toMatch(/Block 2 \(Video embed\) \(youtubeId\): "YouTube video ID": a YouTube id is exactly 11 characters/);
    expect(problems).toMatch(/Block 3 \(Latest posts\) \(tag\)/);
    expect(problems).toMatch(/Block 4 \(Quote\) \(text\): "Quote" is required/);
    expect(problems).toMatch(/Block 5: unknown block type "carousel"/);
  });

  it('says nothing for the About page as it is, nor for the example of any block', () => {
    expect(previewProblems(about)).toEqual([]);
    for (const d of definitions) expect(previewProblems([{ type: d.id, ...d.example }]), d.id).toEqual([]);
    expect(problemsHtml([])).toBe('');
  });
});

describe('sectionsHtml', () => {
  it('draws the About page like the site: one portrait row holding both sections, level, in order', () => {
    const out = html(about as unknown[]);
    expect(out).toMatch(/^<div class="sections"><div class="container wide sec-row"><div class="about-grid" data-side="left">/);
    expect(out).toContain('<div class="portrait"><img src="blob:/media/about/hunter-newton.jpg" alt="Portrait of Hunter Newton" /></div>');
    const order = ['<h2>Hunter Newton · R7 Orbit Creator</h2>', 'I build software', '<h2>R7 · Orbit AI Agent</h2>', 'R7 is the AI agent', '<strong>Where it can go wrong:</strong>'];
    const at = order.map((s) => out.indexOf(s));
    expect(at.every((i) => i >= 0), JSON.stringify(at)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(out.match(/class="about-grid"/g), 'one row for each portrait').toHaveLength(2);
  });

  it('follows a re-ordered list', () => {
    const [h1, first, second] = about as Record<string, unknown>[];
    const out = html([second, h1, first]);
    expect(out.indexOf('R7 is the AI agent')).toBeLessThan(out.indexOf('Hunter Newton'));
    expect(out.match(/class="about-grid"/g)).toHaveLength(2);
  });

  it('puts a wide image outside the column and a full image outside the container', () => {
    const wide = html([{ type: 'image', image: '/media/a.jpg', alt: 'A', width: 'wide' }]);
    expect(wide).toContain('<div class="container wide sec-row"><figure class="art-fig" data-align="center"');
    const full = html([{ type: 'image', image: '/media/a.jpg', alt: 'A', width: 'full' }]);
    expect(full).toContain('<div class="sec-row sec-row-full"><figure class="art-fig" data-align="full"');
  });

  it('shows the placeholder for a picture that is not chosen yet, and an empty alt for a decorative one', () => {
    expect(html([{ type: 'image', image: '', alt: '' }])).toContain('media-ph');
    const decorative = html([{ type: 'image', image: '/media/a.jpg', alt: 'Ignored', decorative: true }]);
    expect(decorative).toContain('alt=""');
    expect(decorative).not.toContain('admin-alt-warning');
  });

  it('draws the blocks the About page already had, and escapes their text', () => {
    const out = html([
      { type: 'quote', text: 'A <b>line</b>', attribution: 'Someone' },
      { type: 'callout', kind: 'tip', title: 'Heads up', text: 'Body' },
      { type: 'links', items: [{ label: 'One', url: 'https://example.com', note: 'video' }, { label: 'Two', url: '/about/' }] },
      { type: 'button', label: 'Go', url: 'https://example.com' },
      { type: 'divider', style: 'dots' },
    ]);
    expect(out).toContain('class="art-quote"');
    expect(out).not.toContain('<b>line</b>');
    expect(out).toContain('class="callout brass art-callout"');
    expect(out).toContain('<ul class="link-list"><li><a href="https://example.com">One<span class="where">video</span>');
    expect(out).toContain('#i-external');
    expect(out).toContain('#i-arrow');
    expect(out).toContain('<a class="btn solid" href="https://example.com">Go');
    expect(out).toContain('data-variant="dots"');
  });

  it('opens a button in a new tab only when the block asks', () => {
    expect(html([{ type: 'button', label: 'Play', url: 'https://example.com', newTab: true }])).toContain(
      '<a class="btn solid" href="https://example.com" target="_blank" rel="noopener">Play',
    );
    expect(html([{ type: 'button', label: 'Go', url: 'https://example.com' }])).not.toContain('target=');
  });

  it('does not link an address the build would refuse', () => {
    expect(html([{ type: 'button', label: 'Go', url: 'javascript:alert(1)' }])).toContain('href="#"');
    expect(html([{ type: 'game', title: 'G', playUrl: 'javascript:alert(1)', playMode: 'link' }])).toContain('href="#"');
  });

  it('copes with a half-filled form: missing fields, an unknown block, no list at all', () => {
    expect(sectionsHtml(undefined, resolve)).toBe('<div class="sections"></div>');
    expect(() => html([{ type: 'links' }, { type: 'portrait' }, { type: 'nope' }, null])).not.toThrow();
    expect(looseSections([{ type: 'nope' }])).toEqual([]);
  });

  it('makes every field whole for the preview: defaults filled in, wrong types replaced', () => {
    const [heading, image, game, latest] = looseSections([
      { type: 'heading', level: '3' },
      { type: 'image', width: 'huge', decorative: 'yes' },
      { type: 'game', platforms: ['desktop', 'console'], controls: [{ key: 'W' }] },
      { type: 'latest', count: '5', kinds: 'blog' },
    ]) as unknown as Record<string, unknown>[];
    expect(heading).toMatchObject({ level: 3, text: '' });
    expect(image).toMatchObject({ width: 'narrow', decorative: false, align: 'center', size: 'lg', image: '' });
    expect(game).toMatchObject({ platforms: ['desktop'], controls: [{ key: 'W', action: '' }], playAspect: '16:9', playMode: 'embed' });
    expect(latest).toMatchObject({ count: 5, kinds: [] });
  });
});

describe('each block of the library', () => {
  it('lead: the Paragraph article component, set as the lead', () => {
    expect(html([example('lead')])).toContain('<p class="art-p art-lead">A lead paragraph sets the scene');
  });

  it('pullquote: the aside between two hairlines, with its credit', () => {
    expect(html([example('pullquote')])).toContain(
      '<aside class="art-pullquote"><p>One good line, pulled out and set large.</p><p class="art-pullquote-cite">From the text above</p></aside>',
    );
  });

  it('code: the bar with the title (or the language) and the code as text, with a note that it is not coloured', () => {
    const out = html([example('code')]);
    expect(out).toContain('<div class="codeblock art-code"><div class="codeblock-bar"><span>Build the site</span>');
    expect(out).toContain('<code>npm install\nnpm run build</code>');
    expect(out).toContain('Preview: The preview shows the code without syntax colours');
    expect(html([{ type: 'code', code: '<script>x</script>', lang: 'js' }])).not.toContain('<script>');
    expect(html([{ type: 'code', code: 'x', lang: 'js' }])).toContain('<span>js</span>');
  });

  it('image: the Figure markup with the placement and size of a narrow picture, ignored for a wide one', () => {
    expect(html([{ type: 'image', image: '/a.jpg', alt: 'A', align: 'left', size: 'sm' }])).toContain('data-align="left" data-size="sm"');
    expect(html([{ type: 'image', image: '/a.jpg', alt: 'A', width: 'wide', align: 'left', size: 'sm' }])).toContain('data-align="center" data-size="lg"');
  });

  it('image row: two or three figures in the row grid, a caption for the row, and a warning for a missing alt text', () => {
    const out = html([example('image-row')]);
    expect(out).toContain('<figure class="art-row" data-count="2"><div class="art-row-grid"><figure class="art-fig">');
    expect(out).toContain('<figcaption class="art-row-caption">A caption for the whole row.</figcaption>');
    expect(html([{ type: 'image-row', images: [{ image: '/a.jpg' }, { image: '/b.jpg', alt: 'B' }] }])).toContain('admin-alt-warning');
    expect(html([{ type: 'image-row', images: [{ image: '/a.jpg', decorative: true }, { image: '/b.jpg', alt: 'B' }] }])).not.toContain('admin-alt-warning');
  });

  it('gallery: thumbnails as buttons named by their alt text, in a wide row, with a note that the full-size window is not drawn', () => {
    const out = html([example('gallery')]);
    expect(out).toContain('<div class="container wide sec-row"><div class="gallery-wrap"><div class="gallery"><figure><button class="shot"');
    expect(out).toContain('aria-label="Enlarge: A portrait, in the gallery"');
    expect(out).toContain('Preview: The thumbnails are drawn');
  });

  it('video: the click-to-load plate with the title, nothing from YouTube', () => {
    const out = html([example('video')]);
    expect(out).toContain('aria-label="Play video: A fixture video"');
    expect(out).not.toMatch(/youtube\.com|youtube-nocookie|ytimg|<iframe/i);
  });

  it('game: the Play button on the stage (embed) or a plain link (link), with the aspect, note, platforms and controls', () => {
    const embed = html([example('game')]);
    expect(embed).toContain('<section class="block play-section"><div class="play-stage" style="--play-aspect: 4 / 3">');
    expect(embed).toContain('Play Vesper Drift</button>');
    expect(embed).toContain('<p class="play-note">Best on desktop with a mouse</p>');
    expect(embed).toContain('<span class="chip mono">Desktop</span>');
    expect(embed).toContain('<dt><kbd>W / Up arrow</kbd></dt><dd>Thrust</dd>');
    expect(embed).not.toContain('<iframe');
    const link = html([{ ...example('game'), playMode: 'link' }]);
    expect(link).toContain('<div class="cluster play-bar"><a class="btn solid" href="https://vesper.r7orbit.io/"');
    expect(link).not.toContain('play-stage');
  });

  it('columns: two prose columns in the chosen ratio, reversed when asked', () => {
    const out = html([example('columns')]);
    expect(out).toContain('<div class="art-cols" data-ratio="2:1"><div class="art-col prose"><p>The <strong>left</strong> column');
    expect(out).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(html([{ type: 'columns', left: 'a', right: 'b', reverse: true }])).toContain('data-reverse="true"');
  });

  it('spacer: empty space, hidden from assistive technology', () => {
    expect(html([example('spacer')])).toContain('<div class="sec-spacer" data-size="md" aria-hidden="true"></div>');
  });

  it('toc: the page\'s headings (blocks and ## in text) as the bordered list, in order, with anchors that match the page', () => {
    const out = html([
      { type: 'heading', level: 2, text: 'Intro' },
      { type: 'text', text: '## Notes\n\nx\n\n### Deeper' },
      { type: 'heading', level: 2, text: 'Notes' },
      { type: 'toc', title: 'Contents', maxDepth: 3 },
    ]);
    expect(out).toContain('<nav class="art-toc" aria-label="Contents"><p class="eyebrow">Contents</p><ol>');
    expect(out).toContain('<li><a href="#intro">Intro</a></li>');
    expect(out).toContain('<li><a href="#notes">Notes</a><ol><li><a href="#deeper">Deeper</a></li></ol></li>');
    expect(out).toContain('<li><a href="#notes-1">Notes</a></li>');
    expect(html([{ type: 'heading', level: 3, text: 'Sub' }, { type: 'heading', text: 'Top' }, { type: 'toc', maxDepth: 2 }])).not.toContain('#sub');
    expect(html([{ type: 'toc' }])).toContain('No headings yet');
  });

  it('stats and latest: a stand-in that says what the site will fetch', () => {
    expect(html([example('stats')])).toContain('EOSHunter/r7-orbit-site: stars, forks and the last update are fetched when the site is built');
    const latest = html([{ ...example('latest'), kinds: ['blog', 'vlog'], tag: 'ai-agents', author: 'r7', count: 4 }]);
    expect(latest).toContain('<h2 class="section-title">The <em>latest</em> posts</h2>');
    expect(latest).toContain('Latest posts: 4 newest · blog, vlog · tagged ai-agents · by r7.');
    expect(latest).toContain('Preview: The posts are chosen when the site is built');
  });

  it('author: the box from the authors list, the AI-written label for an agent, a prompt when none is chosen', () => {
    const authors = [
      { slug: 'hunter-newton', name: 'Hunter Newton', bio: 'Builds things.', agent: false },
      { slug: 'r7', name: 'R7', bio: 'An agent.', agent: true, subtitle: 'Orbit AI Agent' },
    ];
    const person = html([{ type: 'author', author: 'hunter-newton' }], authors);
    expect(person).toContain('<span class="avatar initials" aria-hidden="true"><span>HN</span></span>');
    expect(person).toContain('<p>Builds things.</p>');
    expect(person).not.toContain('ai-written');
    const agent = html([{ type: 'author', author: 'r7' }], authors);
    expect(agent).toContain('class="chip ai-written"');
    expect(agent).toContain('<span class="author-sub">Orbit AI Agent</span>');
    expect(html([{ type: 'author', author: '' }], authors)).toContain('Choose an author.');
    expect(html([{ type: 'author', author: 'ghost' }], authors)).toContain('No author "ghost".');
  });

  it('puts a block that leaves the column in a row of its own, ending a picture-beside-text row', () => {
    const out = html([
      { type: 'portrait', image: '/a.jpg', alt: 'A', text: 'Beside' },
      { type: 'text', text: 'Also beside' },
      { ...example('gallery') },
      { type: 'text', text: 'Back in the column' },
    ]);
    expect(out.match(/class="about-grid"/g)).toHaveLength(1);
    expect(out.indexOf('Also beside')).toBeLessThan(out.indexOf('gallery-wrap'));
    expect(out).toMatch(/gallery-wrap[\s\S]*<div class="container wide sec-row"><div class="prose"><p>Back in the column/);
  });

  it('escapes the author\'s text everywhere: nothing typed in a box becomes markup', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const out = html(
      definitions.map((d) => {
        const data: Record<string, unknown> = { type: d.id, ...d.example };
        for (const key of ['text', 'title', 'caption', 'heading', 'label', 'attribution', 'code', 'left', 'right', 'playNote']) {
          if (typeof data[key] === 'string') data[key] = evil;
        }
        return data;
      }),
    );
    expect(out).not.toMatch(/<img src=x/);
  });
});

describe('the preview\'s markup against the site\'s stylesheets', () => {
  it('only uses classes the site stylesheets define, for every block', () => {
    const everything = html(
      [...(about as unknown[]), ...definitions.map((d) => ({ type: d.id, ...d.example })), { type: 'image', image: '/a.jpg', alt: 'A', width: 'full' }],
      [{ slug: 'hunter-newton', name: 'Hunter Newton', bio: 'B', agent: true }],
    );
    const classes = new Set([...everything.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(' ')));
    // Hooks the markup carries without a rule of their own (or that the design system styles through an element selector).
    const hooks = new Set(['art-p', 'gallery-wrap', 'sec-button', 'ico', 'latest-posts', 'sec-row-band', 'lang', 'mono', 'cluster', 'where', 'team-card', 'team-label']);
    for (const name of classes) {
      if (hooks.has(name)) continue;
      expect(css, `.${name} is defined`).toMatch(new RegExp(`\\.${name}(?![\\w-])`));
    }
  });

  it('uses the wrapper class the real component has, for the blocks that have one of their own', () => {
    const sources: Record<string, string> = {
      'gallery-wrap': readFileSync('src/components/Gallery.astro', 'utf8'),
      'play-stage': readFileSync('src/components/PlayPanel.astro', 'utf8'),
      'author-note': readFileSync('src/components/AuthorBox.astro', 'utf8'),
      stats: readFileSync('src/components/StatsRow.astro', 'utf8'),
      'art-toc': readFileSync('src/components/article/Toc.astro', 'utf8'),
      'art-pullquote': readFileSync('src/components/article/Pullquote.astro', 'utf8'),
      'sec-spacer': readFileSync('src/components/sections/SpacerBlock.astro', 'utf8'),
      'latest-posts': readFileSync('src/components/sections/LatestBlock.astro', 'utf8'),
      'team-grid': readFileSync('src/components/sections/TeamBlock.astro', 'utf8'),
    };
    for (const [name, source] of Object.entries(sources)) expect(source, name).toContain(name);
  });
});
