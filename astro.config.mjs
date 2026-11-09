import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import site from './src/data/site.json' with { type: 'json' };
import remarkCallouts from './src/lib/markdown/remark-callouts.mjs';
import remarkFigures from './src/lib/markdown/remark-figures.mjs';
import remarkNewsBlocks from './src/lib/markdown/remark-news-blocks.mjs';
import remarkImageAlt from './src/lib/markdown/remark-image-alt.mjs';
import { rehypeBodyHeadings, rehypeCodeBlocks, rehypeHeadingAnchors, rehypeNoHotlinks } from './src/lib/markdown/rehype-site.mjs';
import { siteCodeTransformer } from './src/lib/markdown/shiki-transformer.mjs';
import { decapUploadsByPath } from './src/admin/decap-patch.mjs';

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
    // The prefetch fetches that one file, so the game must be all in it: a chunk it imports (three.js split out and shared
    // with another page's game, say) would only load on the first interaction. Stop the build rather than ship that.
    generateBundle(_options, bundle) {
      if (!build || this.environment?.name !== 'client') return;
      const entry = RUNNER_ENTRY.replaceAll('\\', '/');
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || chunk.facadeModuleId?.replaceAll('\\', '/') !== entry) continue;
        if (chunk.imports.length) {
          this.error(
            `The runner's chunk ${chunk.fileName} imports ${chunk.imports.join(', ')}; the 404 page's prefetch needs it whole`,
          );
        }
      }
    },
  };
}

// The pages and public files of this checkout, for the Site settings editor (src/admin/settings.ts): it names a nav or footer link
// to a page that does not exist before saving, as the build does (siteFiles in src/lib/site-routes.ts lists them the same way).
function siteFilesModule() {
  const id = 'virtual:site-files';
  const resolved = '\u0000' + id;
  const filesUnder = (dir) => {
    try {
      return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(dir, join(entry.parentPath, entry.name)).replaceAll('\\', '/'));
    } catch {
      return [];
    }
  };
  return {
    name: 'site-files',
    resolveId: (source) => (source === id ? resolved : null),
    load(source) {
      if (source !== resolved) return null;
      const root = fileURLToPath(new URL('.', import.meta.url));
      const files = { pages: filesUnder(join(root, 'src/pages')), publicFiles: filesUnder(join(root, 'public')).map((f) => `/${f}`) };
      return `export default ${JSON.stringify(files)};`;
    },
  };
}

// R7: Ascent has its own copy of three.js (docs/DECISIONS.md, "R7: Ascent, phase 2"). Two games importing `three` by the
// same name would have it split into a chunk they share, which the runner's prefetch above would not fetch. So every import
// of `three` from src/game/ascent/ resolves to three's ES sources (three/src/Three.js, which the runner never loads), and
// each three/examples module Ascent imports (GLTFLoader and what it imports) is loaded as a copy of its own, marked with a
// query, whose `three` resolves the same way. The runner's chunk stays what it was; a visitor who plays both games
// downloads three.js twice.
const ASCENT_DIR = fileURLToPath(new URL('./src/game/ascent/', import.meta.url)).replaceAll('\\', '/');
const THREE_SRC = fileURLToPath(new URL('./node_modules/three/src/Three.js', import.meta.url)).replaceAll('\\', '/');
const ASCENT_COPY = '?ascent-three';
function ascentOwnThree() {
  return {
    name: 'ascent-own-three',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const copy = importer.endsWith(ASCENT_COPY);
      const from = importer.replaceAll('\\', '/').replace(ASCENT_COPY, '');
      if (!copy && !from.startsWith(ASCENT_DIR)) return null;
      if (source === 'three') return THREE_SRC;
      if (!copy && !/^three\/(examples|addons)\//.test(source)) return null;
      const resolved = await this.resolve(source, from, { ...options, skipSelf: true });
      if (!resolved || resolved.external) return resolved;
      return /\/node_modules\/three\/examples\//.test(resolved.id.replaceAll('\\', '/'))
        ? resolved.id + ASCENT_COPY
        : resolved;
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
      remarkPlugins: [remarkImageAlt, remarkNewsBlocks, remarkCallouts, remarkFigures],
      rehypePlugins: [rehypeHeadingIds, rehypeBodyHeadings, rehypeHeadingAnchors, rehypeCodeBlocks, rehypeNoHotlinks],
    }),
  },
  // No modulepreload helper: it is an extra request on every page, and search.js is the only dynamic import.
  // decapUploadsByPath: /admin commits every upload of an edit, even two of the same picture (src/admin/decap-patch.mjs).
  vite: {
    build: { modulePreload: false, assetsInlineLimit: 16384 },
    plugins: [runnerChunkUrl(), ascentOwnThree(), decapUploadsByPath(), siteFilesModule()],
    optimizeDeps: { rolldownOptions: { plugins: [decapUploadsByPath()] } },
  },
  devToolbar: { enabled: false },
});
