import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blocks } from './blocks';
import { globalStyleOf, spriteOf } from './preview-assets';
import {
  blocksHtml,
  calloutHtml,
  dividerHtml,
  figureHtml,
  headingsOf,
  imageRowHtml,
  inlineMarkdown,
  pullquoteHtml,
  quoteHtml,
  twoColumnHtml,
  videoHtml,
} from './preview-html';

const same = (path: string) => path;
const read = (path: string) => readFileSync(path, 'utf8');
const classesIn = (html: string) => [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));

describe('inline Markdown in block text', () => {
  it('formats the common cases and escapes everything else', () => {
    expect(inlineMarkdown('a **b** and *c* and `d`')).toBe('a <strong>b</strong> and <em>c</em> and <code>d</code>');
    expect(inlineMarkdown('[site](https://example.com/a?x=1&y=2)')).toBe(
      '<a href="https://example.com/a?x=1&amp;y=2">site</a>',
    );
    expect(inlineMarkdown('<script>alert(1)</script> & "q"')).toBe('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;');
  });

  it('leaves code spans alone and ignores an unclosed backtick', () => {
    expect(inlineMarkdown('`**not bold**`')).toBe('<code>**not bold**</code>');
    expect(inlineMarkdown('one ` tick')).toBe('one ` tick');
  });

  it('shows a link with an unsafe address as plain text', () => {
    expect(inlineMarkdown('[go](javascript:alert)')).toBe('go');
  });

  it('splits text into paragraphs and lists', () => {
    expect(blocksHtml('One\ntwo\n\n- a\n- b\n\n1. x\n2. y')).toBe(
      '<p>One two</p><ul><li>a</li><li>b</li></ul><ol><li>x</li><li>y</li></ol>',
    );
    expect(blocksHtml('')).toBe('');
  });
});

describe('block previews use the components\' own markup', () => {
  it('writes each block with the elements, classes and data attributes of its component', () => {
    expect(figureHtml({ src: '/media/a.jpg', alt: 'A', caption: 'Cap', align: 'left', size: 'md' }, same)).toBe(
      '<figure class="art-fig" data-align="left" data-size="md"><img class="art-img" src="/media/a.jpg" alt="A" /><figcaption>Cap</figcaption></figure>',
    );
    expect(calloutHtml({ type: 'tip', body: 'Hi' })).toBe(
      '<div class="callout brass art-callout" role="note" data-type="tip"><p class="art-callout-title"><strong>Tip.</strong></p><div class="art-callout-body"><p>Hi</p></div></div>',
    );
    expect(calloutHtml({ type: 'warn', title: 'Careful', body: 'x' })).toContain('callout bad art-callout');
    expect(calloutHtml({ type: 'warn', title: 'Careful', body: 'x' })).toContain('<strong>Careful.</strong>');
    expect(quoteHtml({ body: 'Q', cite: 'Me', href: 'https://example.com' })).toBe(
      '<figure class="art-quote"><blockquote><p>Q</p></blockquote><figcaption><a href="https://example.com">Me</a></figcaption></figure>',
    );
    expect(imageRowHtml([{ src: '/a.jpg', alt: 'A' }, { src: '/b.jpg', alt: 'B', caption: 'Bee' }], same)).toContain(
      '<figure class="art-row" data-count="2"><div class="art-row-grid"><figure class="art-fig">',
    );
    expect(twoColumnHtml({ left: 'L', right: 'R', ratio: '2:1' })).toBe(
      '<div class="art-cols" data-ratio="2:1"><div class="art-col"><p>L</p></div><div class="art-col"><p>R</p></div></div>',
    );
    expect(dividerHtml({ variant: 'dots' })).toContain('art-divider" role="separator" data-variant="dots"');
    expect(dividerHtml({})).toBe('<hr class="art-divider" data-variant="rule" />');
    expect(dividerHtml({ variant: 'orbit' })).toContain('<div class="art-divider" role="separator" data-variant="orbit">');
    expect(pullquoteHtml({ body: 'One screen.', cite: 'R7' })).toBe(
      '<aside class="art-pullquote" aria-hidden="true"><p>One screen.</p><p class="art-pullquote-cite">R7</p></aside>',
    );
  });

  it('rings the chosen words of a pull quote, and says so when they are not in it', () => {
    expect(pullquoteHtml({ body: 'Basically mission control.', ring: 'mission control' })).toContain('<span class="art-ring">mission control');
    expect(pullquoteHtml({ body: 'Basically mission control.', ring: 'ground control' })).toContain('Ring words not found');
  });

  it('shows the placeholder plate when there is no image yet', () => {
    expect(figureHtml({ alt: 'A' }, same)).toContain('<div class="media"><div class="media-ph">');
  });

  it('puts alt text, captions and titles in as text, never as markup', () => {
    const html = figureHtml({ src: '/a.jpg', alt: '"><img src=x>', caption: '<b>x</b>' }, same);
    expect(html).not.toContain('<b>');
    expect(html).not.toMatch(/<img src=x/);
    expect(videoHtml({ title: '<i>Hi</i>' })).not.toContain('<i>');
  });

  it('draws the video as the click-to-load plate: nothing is requested from YouTube', () => {
    const html = videoHtml({ id: 'dQw4w9WgXcQ', title: 'T', caption: 'C' });
    expect(html).not.toMatch(/youtube|ytimg|iframe/i);
    expect(html).toContain('<div class="yt"><div class="player">');
    expect(html).not.toContain('<use');
  });

  it('warns under a picture that has no alt text, but not under a described or decorative one', () => {
    expect(figureHtml({ src: '/a.jpg', alt: '' }, same)).toContain('admin-alt-warning');
    expect(figureHtml({ src: '/a.jpg', alt: 'A chart' }, same)).not.toContain('admin-alt-warning');
    expect(figureHtml({ src: '/a.jpg', decorative: true }, same)).not.toContain('admin-alt-warning');
    expect(figureHtml({ alt: '' }, same)).not.toContain('admin-alt-warning'); // no picture yet
    expect(imageRowHtml([{ src: '/a.jpg', alt: '' }, { src: '/b.jpg', alt: 'B' }], same)).toContain('admin-alt-warning');
  });

  it('only uses classes and attributes that the real components still have', () => {
    const sources: Record<string, string> = {
      Figure: read('src/components/article/Figure.astro'),
      ArticleImage: read('src/components/article/ArticleImage.astro'),
      Callout: read('src/components/article/Callout.astro'),
      Quote: read('src/components/article/Quote.astro'),
      ImageRow: read('src/components/article/ImageRow.astro'),
      TwoColumn: read('src/components/article/TwoColumn.astro'),
      Divider: read('src/components/article/Divider.astro'),
      Pullquote: read('src/components/article/Pullquote.astro'),
      brand: read('src/lib/article-brand.ts'),
      VideoEmbed: read('src/components/article/VideoEmbed.astro'),
      YouTubeFacade: read('src/components/YouTubeFacade.astro'),
      MediaPlaceholder: read('src/components/MediaPlaceholder.astro'),
      Icon: read('src/components/Icon.astro'),
    };
    const all = Object.values(sources).join('\n');
    const html = [
      figureHtml({ src: '/a.jpg', alt: 'A', caption: 'C' }, same),
      figureHtml({ alt: 'A' }, same),
      calloutHtml({ type: 'info', body: 'x' }),
      calloutHtml({ type: 'tip', body: 'x' }),
      calloutHtml({ type: 'warn', body: 'x' }),
      quoteHtml({ body: 'x', cite: 'y' }),
      imageRowHtml([{ src: '/a.jpg', alt: 'A', caption: 'C' }, { alt: 'B' }], same),
      twoColumnHtml({ left: 'L', right: 'R' }),
      dividerHtml({ variant: 'dots' }),
      dividerHtml({ variant: 'rule' }),
      dividerHtml({ variant: 'orbit' }),
      pullquoteHtml({ body: 'One screen.', cite: 'R7', ring: 'One' }),
      videoHtml({ title: 'T', caption: 'C' }),
    ].join('');
    // `admin-*` classes exist only in the preview (preview.css), not in a component.
    for (const cls of [...new Set(classesIn(html))].filter((c) => !c.startsWith('admin-'))) {
      expect(all, `class "${cls}"`).toMatch(new RegExp(String.raw`(?<![\w-])${cls}(?![\w-])`));
    }
    for (const attr of ['data-align', 'data-size', 'data-type', 'data-count', 'data-ratio', 'data-variant', 'role="note"', 'role="separator"']) {
      expect(all, attr).toContain(attr);
    }
  });

  it('is what each block returns from toPreview, given Decap\'s getAsset and field list', () => {
    const figure = blocks.find((b) => b.id === 'Figure');
    // Decap's field list is an Immutable List of Maps; this has the two methods the block reads.
    const fields = { find: (match: (f: { get(k: string): unknown }) => boolean) => [{ get: () => 'src' }].find(match) };
    const asked: unknown[] = [];
    const getAsset = (path: string, field: unknown) => {
      asked.push([path, field]);
      return { toString: () => 'blob:http://localhost/1' };
    };
    const html = (figure?.toPreview as unknown as (d: object, g: unknown, f: unknown) => string)(
      { src: '/media/a.jpg', alt: 'A' },
      getAsset,
      fields,
    );
    expect(html).toContain('src="blob:http://localhost/1"');
    expect(asked[0]).toEqual(['/media/a.jpg', expect.anything()]);
    // Without a resolvable asset the path itself is used (served from public/).
    const fallback = (figure?.toPreview as unknown as (d: object) => string)({ src: '/media/a.jpg', alt: 'A' });
    expect(fallback).toContain('src="/media/a.jpg"');
  });
});

describe('headings for the contents list', () => {
  it('lists H2 and H3 with unique slugs, and ignores code fences and H1/H4', () => {
    const body = ['# Not me', '## First *one*', '### Sub [link](https://x.y)', '```', '## in code', '```', '## First one', '#### deep'].join('\n');
    expect(headingsOf(body)).toEqual([
      { depth: 2, slug: 'first-one', text: 'First one' },
      { depth: 3, slug: 'sub-link', text: 'Sub link' },
      { depth: 2, slug: 'first-one-1', text: 'First one' },
    ]);
  });
});

describe('what the preview takes from the site\'s components', () => {
  it('reads the hero\'s global style block, which is what puts the headline over the image', () => {
    const css = globalStyleOf(read('src/components/ArticleHero.astro'));
    expect(css).toContain('.article-hero-shade');
    expect(css).toContain('.article-hero-img');
    expect(css).not.toContain('<style');
  });

  it('reads the icon sprite, including the symbols the preview header uses', () => {
    const sprite = spriteOf(read('src/components/IconSprite.astro'));
    expect(sprite.startsWith('<svg')).toBe(true);
    expect(sprite.endsWith('</svg>')).toBe(true);
    for (const id of ['i-blog', 'i-calendar', 'i-clock']) expect(sprite).toContain(`id="${id}"`);
  });

  it('gives nothing when the source has no such block', () => {
    expect(globalStyleOf('<div></div>')).toBe('');
    expect(spriteOf('---\n---\n<p></p>')).toBe('');
  });
});
