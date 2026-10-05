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
