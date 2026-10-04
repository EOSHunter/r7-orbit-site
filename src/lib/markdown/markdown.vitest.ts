import { rehypeHeadingIds, createMarkdownProcessor } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import remarkCallouts from './remark-callouts.mjs';
import remarkFigures from './remark-figures.mjs';
import { rehypeCodeBlocks, rehypeHeadingAnchors, rehypeNoHotlinks } from './rehype-site.mjs';
import { siteCodeTransformer } from './shiki-transformer.mjs';

async function render(markdown: string): Promise<string> {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkCallouts, remarkFigures],
    rehypePlugins: [rehypeHeadingIds, rehypeHeadingAnchors, rehypeCodeBlocks, rehypeNoHotlinks],
    shikiConfig: { theme: 'css-variables', transformers: [siteCodeTransformer] },
  });
  return (await processor.render(markdown)).code;
}

describe('callouts', () => {
  it('turns NOTE and TIP into brass callouts and WARNING into a bad one', async () => {
    expect(await render('> [!NOTE]\n> Check this.')).toMatch(
      /<div class="callout brass">\s*<p><strong>Note\.<\/strong> Check this\.<\/p>\s*<\/div>/,
    );
    expect(await render('> [!tip]\n> Try this.')).toMatch(/class="callout brass"/);
    expect(await render('> [!WARNING]\n> Careful.')).toMatch(/class="callout bad"/);
  });
  it('leaves an ordinary blockquote alone', async () => {
    const html = await render('> Just a quote.');
    expect(html).toMatch(/<blockquote>/);
    expect(html).not.toMatch(/callout/);
  });
});

describe('pull quotes', () => {
  it('moves a final "— Name" line into a cite', async () => {
    const html = await render('> An agent that can break nothing.\n> — Someone Real');
    expect(html).toMatch(/<blockquote>/);
    expect(html).toMatch(/<cite>Someone Real<\/cite>/);
    expect(html).not.toMatch(/—/);
  });
});

describe('figures', () => {
  it('wraps an image followed by an italic line in figure and figcaption', async () => {
    const html = await render('![A plate](/media/blog/x/plate.png)\n*Three folders, one repo.*');
    expect(html).toMatch(
      /<figure><img [^>]*alt="A plate"[^>]*><figcaption>Three folders, one repo\.<\/figcaption><\/figure>/,
    );
  });
  it('leaves a lone image as a plain image', async () => {
    expect(await render('![A plate](/media/blog/x/plate.png)')).not.toMatch(/<figure>/);
  });
});

describe('headings', () => {
  it('adds an anchor link with an accessible name', async () => {
    const html = await render('## The old fix');
    expect(html).toMatch(
      /<h2 id="the-old-fix" class="has-anchor">The old fix<a class="heading-anchor" href="#the-old-fix" aria-label="Link to this section: The old fix"><\/a><\/h2>/,
    );
  });
});

describe('code blocks', () => {
  it('wraps code in .codeblock with a language label, copy button and token colours from variables', async () => {
    const html = await render('```bash\ngit status\n```');
    expect(html).toMatch(/class="codeblock"/);
    expect(html).toMatch(/<span>bash<\/span>/);
    expect(html).toMatch(/data-copy="#code-\d+"/);
    expect(html).toMatch(/class="code"/);
    expect(html).toMatch(/var\(--astro-code-/);
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
  it('shows a title="…" as the bar label', async () => {
    expect(await render('```ts title="server.ts"\nconst a = 1;\n```')).toMatch(/<span>server\.ts<\/span>/);
  });
  it('marks diff lines', async () => {
    const html = await render('```diff\n+ added\n- removed\n  same\n```');
    expect(html).toMatch(/class="line add"/);
    expect(html).toMatch(/class="line del"/);
  });
});

describe('hot-linked images', () => {
  it('fails the build with a message that says what to do', async () => {
    await expect(render('![x](https://cdn.example.net/a.png)')).rejects.toThrow(/another site/);
  });
  it('allows local images and ordinary external links', async () => {
    expect(await render('![x](/media/a.png) [a link](https://example.com)')).toMatch(/href="https:\/\/example\.com"/);
  });
});
