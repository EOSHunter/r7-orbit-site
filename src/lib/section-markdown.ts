// Markdown for the text boxes of a page block (Text, Portrait, Quote, Callout), rendered at build time. Build-time only.
// Straight quotes stay straight (no smartypants): what the author types is what the page shows. The result is sanitised, so a
// pasted <script> or an onclick never reaches the page, whatever the Markdown holds.
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import sanitizeHtml from 'sanitize-html';

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

const ALLOWED = {
  allowedTags: ['p', 'br', 'strong', 'em', 'del', 'code', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['https', 'mailto'],
  allowProtocolRelative: false,
} satisfies sanitizeHtml.IOptions;

export async function renderSectionMarkdown(markdown: string): Promise<string> {
  if (!markdown.trim()) return '';
  processor ??= createMarkdownProcessor({ smartypants: false, gfm: true });
  const { code } = await (await processor).render(markdown);
  return sanitizeHtml(code, ALLOWED);
}

/** What a feed item's HTML may hold: the Markdown a post renders to, pictures and figures; no classes, styles or scripts. */
export const FEED_HTML = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption', 'details', 'summary']),
  allowedAttributes: { a: ['href'], img: ['src', 'alt', 'width', 'height'], th: ['align'], td: ['align'] },
} satisfies sanitizeHtml.IOptions;

let feedProcessor: ReturnType<typeof createMarkdownProcessor> | undefined;

/**
 * A post's sections as a feed reader gets them: their Markdown (sectionsToMarkdown in sections-to-content.ts) as sanitised HTML, code
 * without colours (a reader has none of the site's styles). Addresses stay as written; the feed makes them absolute.
 */
export async function renderFeedMarkdown(markdown: string): Promise<string> {
  if (!markdown.trim()) return '';
  feedProcessor ??= createMarkdownProcessor({ smartypants: false, gfm: true, syntaxHighlight: false });
  const { code } = await (await feedProcessor).render(markdown);
  return sanitizeHtml(code, FEED_HTML);
}

/** One paragraph's worth of Markdown as inline HTML (no wrapping `<p>`): for a lead paragraph, which the page sets in its own `<p>`. */
export async function renderInlineMarkdown(markdown: string): Promise<string> {
  const html = (await renderSectionMarkdown(markdown)).trim();
  const one = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return one && !one[1].includes('</p>') ? one[1] : html.replace(/<\/?p>/g, ' ').trim();
}
