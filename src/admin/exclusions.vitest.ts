import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildRobots, collectSitemapEntries } from '../lib/sitemap';

// The admin must stay out of every index. These are the pieces that do it; tests/admin.spec.js checks the built site.

describe('admin is kept out of indexes', () => {
  it('is not in the sitemap even when it is among the static pages', () => {
    const paths = collectSitemapEntries(['/', '/about/', '/admin/'], []).map((e) => e.path);
    expect(paths).not.toContain('/admin/');
  });

  it('is disallowed in robots.txt', () => {
    expect(buildRobots('https://example.com')).toContain('Disallow: /admin/');
  });

  it('is not matched by the search index glob', () => {
    const yml = readFileSync('pagefind.yml', 'utf8');
    const glob = /^glob:\s*"?([^"\n]+)"?/m.exec(yml)?.[1] ?? '';
    const kinds = /\{([^}]+)\}/.exec(glob)?.[1].split(',') ?? [];
    expect(kinds.length).toBeGreaterThan(0);
    expect(kinds).not.toContain('admin');
  });

  it('is sent noindex and uncached by the host headers', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    expect(headers).toMatch(/^\/admin\/\*\s*\n(?:\s+.+\n)*?\s+X-Robots-Tag:\s*noindex/m);
    expect(headers).toMatch(/Cache-Control:\s*no-store/);
  });

  it('is noindex in its own HTML', () => {
    expect(readFileSync('src/pages/admin/index.astro', 'utf8')).toContain(
      '<meta name="robots" content="noindex, nofollow" />',
    );
  });
});
