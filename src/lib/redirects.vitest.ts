import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public/_redirects', () => {
  const rules = readFileSync('public/_redirects', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/));

  it('has only "from to status" lines with local or https targets and a 301/302', () => {
    for (const [from, to, status, ...rest] of rules) {
      expect(rest).toEqual([]);
      expect(from.startsWith('/')).toBe(true);
      expect(to.startsWith('/') || to.startsWith('https://')).toBe(true);
      expect(['301', '302']).toContain(status);
    }
  });
  it('never redirects a path to itself or chains into another redirect', () => {
    const from = new Set(rules.map((r) => r[0]));
    for (const [f, t] of rules) {
      expect(t).not.toBe(f);
      expect(from.has(t)).toBe(false);
    }
  });
});
