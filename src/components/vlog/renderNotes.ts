// Renders a vlog's Markdown with the same plugins as astro.config.mjs, so the notes and the transcript can be rendered
// separately (the transcript goes in a <details>). Build-time only.
import { createMarkdownProcessor, rehypeHeadingIds } from '@astrojs/markdown-remark';
import remarkCallouts from '../../lib/markdown/remark-callouts.mjs';
import remarkFigures from '../../lib/markdown/remark-figures.mjs';
import remarkImageAlt from '../../lib/markdown/remark-image-alt.mjs';
import { rehypeCodeBlocks, rehypeHeadingAnchors, rehypeNoHotlinks } from '../../lib/markdown/rehype-site.mjs';
import { siteCodeTransformer } from '../../lib/markdown/shiki-transformer.mjs';

/** Split the body at its `## Transcript` section (up to the next `## ` heading). */
export function splitTranscript(body: string): { notes: string; transcript: string } {
  const lines = body.split('\n');
  const start = lines.findIndex((line) => /^##\s+Transcript\s*$/i.test(line));
  if (start === -1) return { notes: body, transcript: '' };
  let end = lines.findIndex((line, i) => i > start && /^##\s/.test(line));
  if (end === -1) end = lines.length;
  return {
    notes: [...lines.slice(0, start), ...lines.slice(end)].join('\n').trim(),
    transcript: lines
      .slice(start + 1, end)
      .join('\n')
      .trim(),
  };
}

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

export async function renderMarkdown(markdown: string, fileURL?: URL): Promise<string> {
  if (!markdown.trim()) return '';
  processor ??= createMarkdownProcessor({
    // `always`: this renders a piece of a vlog body, so the file path is not known, but the alt rule still holds.
    remarkPlugins: [[remarkImageAlt, { always: true }], remarkCallouts, remarkFigures],
    rehypePlugins: [rehypeHeadingIds, rehypeHeadingAnchors, rehypeCodeBlocks, rehypeNoHotlinks],
    shikiConfig: { theme: 'css-variables', transformers: [siteCodeTransformer] },
  });
  return (await (await processor).render(markdown, fileURL ? { fileURL } : undefined)).code;
}
