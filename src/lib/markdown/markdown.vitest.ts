import { rehypeHeadingIds, createMarkdownProcessor } from '@astrojs/markdown-remark';
import { describe, expect, it } from 'vitest';
import remarkCallouts from './remark-callouts.mjs';
import remarkFigures from './remark-figures.mjs';
import remarkNewsBlocks from './remark-news-blocks.mjs';
import { rehypeBodyHeadings, rehypeCodeBlocks, rehypeHeadingAnchors, rehypeNoHotlinks } from './rehype-site.mjs';
import { siteCodeTransformer } from './shiki-transformer.mjs';

async function render(markdown: string): Promise<string> {
  const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkNewsBlocks, remarkCallouts, remarkFigures],
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

describe('news blocks', () => {
  it('turns [!NUMBERS] into a row of numbers with labels, and keeps the source line as the caption', async () => {
    const html = await render('> [!NUMBERS]\n> - **1,724** Linux flaws reproduced\n> - **948** with [working exploits](https://example.com/a)\n>\n> Source: [OpenAI](https://openai.com/x)');
    expect(html).toMatch(/^<figure class="key-numbers">\s*<dl class="key-numbers-list">/);
    expect(html).toMatch(/<div class="key-number">\s*<dt>Linux flaws reproduced<\/dt>\s*<dd>1,724<\/dd>\s*<\/div>/);
    expect(html).toContain('<dt>with <a href="https://example.com/a">working exploits</a></dt>');
    expect(html).toMatch(/<figcaption class="key-numbers-source">Source: <a href="https:\/\/openai\.com\/x">OpenAI<\/a><\/figcaption>/);
  });

  it('refuses a [!NUMBERS] line without a bold number, and one number alone', async () => {
    await expect(render('> [!NUMBERS]\n> - 948 exploits\n> - **2** things')).rejects.toThrow(/number in bold/);
    await expect(render('> [!NUMBERS]\n> - **948** exploits')).rejects.toThrow(/two to four/);
  });

  it('draws [!CHART] as a titled table of bars, percentages out of 100, the bold line marked as the story\'s bar', async () => {
    const html = await render('> [!CHART] ExploitGym score\n> - GPT-5.6 Cyber: 32.1%\n> - **GPT-6 Cyber: 48.5%**\n>\n> Source: [OpenAI](https://openai.com/x)');
    expect(html).toMatch(/^<figure class="bar-chart">\s*<figcaption class="bar-chart-title">ExploitGym score<\/figcaption>/);
    expect(html).toContain('<tr><th scope="row">GPT-5.6 Cyber</th><td><span class="bar-track" aria-hidden="true"><span class="bar" style="--bar: 32.1%"></span></span><span class="bar-value">32.1%</span></td></tr>');
    expect(html).toContain('<tr class="is-key"><th scope="row">GPT-6 Cyber</th>');
    expect(html).toContain('style="--bar: 48.5%"');
    expect(html).toMatch(/<p class="bar-chart-source">Source: <a href="https:\/\/openai\.com\/x">OpenAI<\/a><\/p>/);
  });

  it('scales other units to the largest bar, and refuses a chart without a title, a source, or with mixed units', async () => {
    const html = await render('> [!CHART] Cost\n> - A: 2 dollars\n> - B: 8 dollars\n>\n> Source: a test');
    expect(html).toContain('style="--bar: 25%"');
    expect(html).toContain('<span class="bar-value">8 dollars</span>');
    await expect(render('> [!CHART]\n> - A: 1%\n> - B: 2%\n>\n> Source: x')).rejects.toThrow(/give it a title/);
    await expect(render('> [!CHART] T\n> - A: 1%\n> - B: 2%')).rejects.toThrow(/source line/);
    await expect(render('> [!CHART] T\n> - A: 1%\n> - B: 2 ms\n>\n> Source: x')).rejects.toThrow(/same unit/);
    await expect(render('> [!CHART] T\n> - A one\n> - B: 2%\n>\n> Source: x')).rejects.toThrow(/Label: 48\.5%/);
  });

  it('turns the list under ## Sources into source cards, the first marked as the primary source', async () => {
    const html = await render('## Sources\n\n- [GPT-6 Cyber: aligned agents (OpenAI)](https://openai.com/index/x/)\n- [A story](https://www.axios.com/2026/x)');
    expect(html).toContain('<ul class="source-cards">');
    expect(html).toMatch(/<a class="source-card" href="https:\/\/openai\.com\/index\/x\/" rel="noopener"><span class="source-card-mark" aria-hidden="true">O<\/span><span class="source-card-text"><span class="source-card-title">GPT-6 Cyber: aligned agents<\/span><span class="source-card-meta">OpenAI · Primary source<\/span><\/span><svg/);
    expect(html).toContain('<span class="source-card-meta">axios.com</span>');
  });

  it('leaves a Sources list alone when an item is more than one link', async () => {
    const html = await render('## Sources\n\n- [One](https://a.example/) and some words\n- [Two](https://b.example/)');
    expect(html).not.toContain('source-card');
  });

  it('adds a credit to a figure, with or without a caption, and leaves an image with other text alone', async () => {
    expect(await render('![A chart](/media/news/a.webp)\n*The scores.*\nImage: [OpenAI](https://openai.com/x)')).toMatch(
      /<figure><img src="\/media\/news\/a\.webp" alt="A chart"><figcaption>The scores\. <span class="fig-credit">Image: <a href="https:\/\/openai\.com\/x">OpenAI<\/a><\/span><\/figcaption><\/figure>/,
    );
    expect(await render('![A chart](/media/news/a.webp)\nChart: OpenAI')).toContain('<figcaption><span class="fig-credit">Chart: OpenAI</span></figcaption>');
    expect(await render('![A chart](/media/news/a.webp)\n*Caption*')).toContain('<figcaption>Caption</figcaption>');
    expect(await render('![A chart](/media/news/a.webp) and words')).not.toContain('<figure');
  });
});

describe('timelines and money charts', () => {
  it('turns [!TIMELINE] into an ordered list of dated steps with its source', async () => {
    const html = await render('> [!TIMELINE]\n> - **Oct 25** The agent first gets in\n> - **Oct 30** It pulls records; [WorkOS](https://w.example/) spots it\n>\n> Source: [WorkOS](https://workos.com/x)');
    expect(html).toMatch(/^<figure class="timeline">\s*<ol class="timeline-steps">/);
    expect(html).toMatch(/<li class="timeline-step"><span class="timeline-date">Oct 25<\/span><span class="timeline-text">The agent first gets in<\/span><\/li>/);
    expect(html).toContain('<span class="timeline-text">It pulls records; <a href="https://w.example/">WorkOS</a> spots it</span>');
    expect(html).toMatch(/<figcaption class="timeline-source">Source: <a href="https:\/\/workos\.com\/x">WorkOS<\/a><\/figcaption>/);
  });

  it('refuses a timeline step without a bold date, one step alone, or no source', async () => {
    await expect(render('> [!TIMELINE]\n> - Oct 25 got in\n> - **Oct 30** out\n>\n> Source: x')).rejects.toThrow(/date in bold/);
    await expect(render('> [!TIMELINE]\n> - **Oct 25** got in\n>\n> Source: x')).rejects.toThrow(/two to eight/);
    await expect(render('> [!TIMELINE]\n> - **Oct 25** got in\n> - **Oct 30** out')).rejects.toThrow(/source line/);
  });

  it('draws money with its currency sign, scaled to the largest bar, and refuses mixing currencies', async () => {
    const html = await render('> [!CHART] Revenue\n> - 2025: $1.38 billion\n> - **2026: $16.96 billion**\n>\n> Source: a filing');
    expect(html).toContain('<span class="bar-value">$1.38 billion</span>');
    expect(html).toContain('style="--bar: 8.1%"');
    expect(html).toContain('style="--bar: 100%"');
    await expect(render('> [!CHART] T\n> - A: $1 billion\n> - B: €2 billion\n>\n> Source: x')).rejects.toThrow(/same unit/);
  });
});
