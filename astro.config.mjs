import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import site from './src/data/site.json' with { type: 'json' };
import remarkCallouts from './src/lib/markdown/remark-callouts.mjs';
import remarkFigures from './src/lib/markdown/remark-figures.mjs';
import remarkImageAlt from './src/lib/markdown/remark-image-alt.mjs';
import { rehypeBodyHeadings, rehypeCodeBlocks, rehypeHeadingAnchors, rehypeNoHotlinks } from './src/lib/markdown/rehype-site.mjs';
import { siteCodeTransformer } from './src/lib/markdown/shiki-transformer.mjs';

// The 404 page's game is a lazy chunk (docs/RUNNER.md, "On the 404 page"). The page may prefetch it before anyone asks, and a
// hashed file name is only known once the build has named the chunk, so this virtual module hands the page its final URL
// (Rollup's own file URL for an emitted chunk: the same chunk the page's import() loads, not a second copy). In `astro dev`
// there is no chunk, and the module says so with null: the page then skips the prefetch.
const RUNNER_ENTRY = fileURLToPath(new URL('./src/game/runner/index.ts', import.meta.url));
function runnerChunkUrl() {
  const id = 'virtual:runner-chunk-url';
  const resolved = '\u0000' + id;
  let build = false;
  return {
    name: 'runner-chunk-url',
    configResolved(config) {
      build = config.command === 'build';
    },
    resolveId(source) {
      return source === id ? resolved : null;
    },
    load(source) {
      if (source !== resolved) return null;
      if (!build || this.environment?.name !== 'client') return 'export default null;';
      const ref = this.emitFile({ type: 'chunk', id: RUNNER_ENTRY });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
  };
}

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
      remarkPlugins: [remarkImageAlt, remarkCallouts, remarkFigures],
      rehypePlugins: [rehypeHeadingIds, rehypeBodyHeadings, rehypeHeadingAnchors, rehypeCodeBlocks, rehypeNoHotlinks],
    }),
  },
  // No modulepreload helper: it is an extra request on every page, and search.js is the only dynamic import.
  vite: { build: { modulePreload: false, assetsInlineLimit: 16384 }, plugins: [runnerChunkUrl()] },
  devToolbar: { enabled: false },
});
