// `npm run build` runs this after `astro build`: it builds the search index with Pagefind (see pagefind.yml).
// Pagefind exits with an error when it finds no pages to index, which is the case on a site with no posts yet.
// Then this writes a stub with the same two functions search.js uses, so search says "Nothing found" and the build passes.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const kinds = ['news', 'blog', 'vlogs', 'projects', 'repos'];

// The pages pagefind.yml indexes: {kinds}/*/index.html
const pages = kinds.flatMap((kind) => {
  const dir = join(dist, kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'index.html')),
  );
});

if (pages.length > 0) {
  const run = spawnSync('pagefind', [], { stdio: 'inherit', shell: true });
  process.exit(run.status ?? 1);
}

const out = join(dist, 'pagefind');
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, 'pagefind.js'),
  [
    '// Written by scripts/search-index.mjs: the site has no posts to index yet.',
    'export async function options() {}',
    'export async function debouncedSearch() {',
    '  return { results: [] };',
    '}',
    '',
  ].join('\n'),
);
console.log('No posts to index: wrote an empty search stub to dist/pagefind/.');
