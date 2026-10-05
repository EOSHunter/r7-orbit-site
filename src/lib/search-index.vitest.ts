import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// scripts/search-index.mjs runs after `astro build`. On a site with no posts Pagefind fails, which used to fail the build.
describe('search index with no posts', () => {
  it('passes and leaves an empty search that the search script can load', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'r7-search-'));
    try {
      const run = spawnSync(process.execPath, [join(process.cwd(), 'scripts', 'search-index.mjs')], { cwd, encoding: 'utf8' });
      expect(run.status, run.stderr).toBe(0);
      const stub = join(cwd, 'dist', 'pagefind', 'pagefind.js');
      expect(existsSync(stub)).toBe(true);
      // src/scripts/search.js calls options() once, then debouncedSearch() and reads `results`.
      const source = readFileSync(stub, 'utf8');
      expect(source).toContain('export async function options');
      expect(source).toContain('export async function debouncedSearch');
      expect(source).toContain('results: []');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
