// Markdown for the text boxes of a page block (Text, Portrait, Quote, Callout), rendered at build time. Build-time only.
// Straight quotes stay straight (no smartypants): what the author types is what the page shows. The result is sanitised, so a
// pasted <script> or an onclick never reaches the page, whatever the Markdown holds.
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import sanitizeHtml from 'sanitize-html';

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

const ALLOWED = {
  allowedTags: ['p', 'br', 'strong', 'em', 'del', 'code', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['https'],
  allowProtocolRelative: false,
} satisfies sanitizeHtml.IOptions;

export async function renderSectionMarkdown(markdown: string): Promise<string> {
  if (!markdown.trim()) return '';
  processor ??= createMarkdownProcessor({ smartypants: false, gfm: true });
  const { code } = await (await processor).render(markdown);
  return sanitizeHtml(code, ALLOWED);
}

/** One paragraph's worth of Markdown as inline HTML (no wrapping `<p>`): for a lead paragraph, which the page sets in its own `<p>`. */
export async function renderInlineMarkdown(markdown: string): Promise<string> {
  const html = (await renderSectionMarkdown(markdown)).trim();
  const one = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return one && !one[1].includes('</p>') ? one[1] : html.replace(/<\/?p>/g, ' ').trim();
}
