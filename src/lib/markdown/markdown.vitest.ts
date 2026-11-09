import { rehypeHeadingIds, createMarkdownProcessor } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import remarkCallouts from './remark-callouts.mjs';
import remarkFigures from './remark-figures.mjs';
import { rehypeBodyHeadings, rehypeCodeBlocks, rehypeHeadingAnchors, rehypeNoHotlinks } from './rehype-site.mjs';
import { siteCodeTransformer } from './shiki-transformer.mjs';

async function render(markdown: string): Promise<string> {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkCallouts, remarkFigures],
    rehypePlugins: [rehypeHeadingIds, rehypeBodyHeadings, rehypeHeadingAnchors, rehypeCodeBlocks, rehypeNoHotlinks],
    shikiConfig: { theme: 'css-variables', transformers: [siteCodeTransformer] },
  });
  return (await processor.render(markdown)).code;
}

describe('headings in the body', () => {
  it('turns a # heading into an h2, so the page title stays the only h1', async () => {
    const html = await render('# A title in the body\n\n## A section\n\nText.');
    expect(html).not.toMatch(/<h1/);
    expect(html).toMatch(/<h2 id="a-title-in-the-body"[^>]*>A title in the body/);
    expect(html).toMatch(/<h2 id="a-section"/);
    expect(html).toMatch(/class="[^"]*has-anchor/); // the new h2 gets an anchor like the rest
  });
});

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

describe('post cards', () => {
  const post = [
    '> [!POST] Addy Osmani · @addyosmani · X · Anthropic · 2026-11-04 · https://x.com/addyosmani/status/2117848568535106001',
    '> You can name a game to describe what you want.',
    '>',
    '> A second paragraph with [a link](https://example.com/).',
  ].join('\n');

  it('turns [!POST] into a figure with the head, the text in a blockquote and the foot', async () => {
    const html = await render(post);
    expect(html).toMatch(/^<figure class="post-card">\s*<figcaption class="post-card-head">/);
    expect(html).toContain('<span class="post-card-avatar" aria-hidden="true">AO</span>');
    expect(html).toContain('<span class="post-card-name">Addy Osmani</span>');
    expect(html).toContain('<span class="post-card-meta">@addyosmani · Anthropic</span>');
    expect(html).toContain('<span class="post-card-platform">Post on X</span>');
    expect(html).toMatch(/<blockquote class="post-card-text" cite="https:\/\/x\.com\/addyosmani\/status\/2117848568535106001">\s*<p>You can name a game to describe what you want\.<\/p>/);
    expect(html).toContain('<a href="https://example.com/">a link</a>');
    expect(html).toMatch(/<p class="post-card-foot"><time datetime="2026-11-04">Nov 4, 2026<\/time><a class="post-card-link" href="https:\/\/x\.com\/addyosmani\/status\/2117848568535106001" rel="noopener">View the post on X<\/a><\/p>\s*<\/figure>$/);
    expect(html).not.toContain('[!POST]');
  });

  it('draws a blockquote inside the card as the quoted post, with its [!QUOTED] line as the label', async () => {
    const html = await render(`${post}\n>\n> > [!QUOTED] Quoted reply · 2026-10-30\n> > We added two sentences.`);
    expect(html).toMatch(/<div class="post-card-quoted">\s*<p class="post-card-quoted-label">Quoted reply · <time datetime="2026-10-30">Oct 30, 2026<\/time><\/p>\s*<p>We added two sentences\.<\/p>\s*<\/div>\s*<\/blockquote>/);
  });

  it('labels a quoted post "Quoted post" when it has no [!QUOTED] line, and leaves the foot out with no date or address', async () => {
    const html = await render('> [!POST] Someone · Bluesky\n> Text.\n>\n> > Inner text.');
    expect(html).toContain('<p class="post-card-quoted-label">Quoted post</p>');
    expect(html).not.toContain('post-card-foot');
    expect(html).not.toContain('cite=');
  });

  it('escapes what the header says', async () => {
    const html = await render('> [!POST] A <b>name</b> · X\n> Text.');
    expect(html).not.toContain('<b>');
  });

  it('fails the build, with a reason, on a card without a platform, with a bad date or address, or without text', async () => {
    await expect(render('> [!POST] Only A Name\n> Text.')).rejects.toThrow(/needs the platform/);
    await expect(render('> [!POST] Name · X · 2026-13-04\n> Text.')).rejects.toThrow(/must be written 2026-11-04/);
    await expect(render('> [!POST] Name · X · http://example.com/\n> Text.')).rejects.toThrow(/https:\/\//);
    await expect(render('> [!POST] Name · X')).rejects.toThrow(/text is missing/);
  });

  it('leaves other callouts and pull quotes alone', async () => {
    expect(await render('> [!NOTE]\n> Check this.')).toContain('class="callout brass"');
    expect(await render('> Words.\n> — Someone')).toContain('<cite>Someone</cite>');
  });
});
