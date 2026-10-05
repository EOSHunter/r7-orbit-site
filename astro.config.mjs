import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import site from './src/data/site.json' with { type: 'json' };
import remarkCallouts from './src/lib/markdown/remark-callouts.mjs';
import remarkFigures from './src/lib/markdown/remark-figures.mjs';
import { rehypeBodyHeadings, rehypeCodeBlocks, rehypeHeadingAnchors, rehypeNoHotlinks } from './src/lib/markdown/rehype-site.mjs';
import { siteCodeTransformer } from './src/lib/markdown/shiki-transformer.mjs';

// Static output: no server runtime. `site` is a placeholder until the domain is chosen (docs/DECISIONS.md §A).
export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // MDX posts can use the article components (src/components/article/). It inherits the markdown config below.
  integrations: [mdx()],
  markdown: {
    // Code colours come from CSS variables mapped to the design tokens in src/styles/markdown.css.
    shikiConfig: { theme: 'css-variables', transformers: [siteCodeTransformer] },
    // Astro 7 defaults to Satteri; the remark/rehype plugins in src/lib/markdown/ need the unified processor.
    processor: unified({
      remarkPlugins: [remarkCallouts, remarkFigures],
      rehypePlugins: [rehypeHeadingIds, rehypeBodyHeadings, rehypeHeadingAnchors, rehypeCodeBlocks, rehypeNoHotlinks],
    }),
  },
  // No modulepreload helper: it is an extra request on every page, and search.js is the only dynamic import.
  vite: { build: { modulePreload: false, assetsInlineLimit: 16384 } },
  devToolbar: { enabled: false },
});
