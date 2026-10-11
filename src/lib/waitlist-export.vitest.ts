import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error a plain .mjs script with no type declarations
import { csvCell, QUERY, rowsFromWrangler, toCsv, wranglerArgs } from '../../scripts/waitlist-export.mjs';

// scripts/waitlist-export.mjs (npm run waitlist:export): the wrangler command it runs, how it reads the answer, and the CSV it writes.

describe('the waitlist export', () => {
  it('reads email, created_at and source, oldest first, through the WAITLIST_DB binding of scripts/wrangler.waitlist.toml', () => {
    expect(QUERY).toBe('SELECT email, created_at, source FROM waitlist ORDER BY created_at');
    expect(wranglerArgs()).toEqual(['--yes', 'wrangler@4', 'd1', 'execute', 'WAITLIST_DB', '--remote', '-c', 'scripts/wrangler.waitlist.toml', '--json', '--command', QUERY]);
    expect(wranglerArgs({ local: true })).toEqual([
      '--yes', 'wrangler@4', 'd1', 'execute', 'WAITLIST_DB', '--local', '-c', 'scripts/wrangler.waitlist.toml', '--persist-to', '.wrangler/state', '--json', '--command', QUERY,
    ]);
    const config = readFileSync('scripts/wrangler.waitlist.toml', 'utf8');
    expect(config).toMatch(/binding = "WAITLIST_DB"/);
    expect(config).toMatch(/database_name = "r7-waitlist"/);
  });

  it('reads the rows out of wrangler\'s JSON, even with a line printed before it, and refuses anything else', () => {
    const answer = [{ results: [{ email: 'a@example.com', created_at: '2026-10-10T17:37:11.176Z', source: 'hero' }], success: true, meta: {} }];
    expect(rowsFromWrangler(JSON.stringify(answer))).toEqual(answer[0].results);
    expect(rowsFromWrangler(`Resource location: local\n${JSON.stringify(answer)}`)).toEqual(answer[0].results);
    expect(rowsFromWrangler('[{"results":[],"success":true}]')).toEqual([]);
    expect(() => rowsFromWrangler('✘ [ERROR] no such table: waitlist')).toThrow(/did not answer with JSON/);
    expect(() => rowsFromWrangler('[{"success":false,"error":"x"}]')).toThrow(/answered with an error/);
  });

  it('writes a header and one CRLF row per address, quoting what needs it and defusing spreadsheet formulas', () => {
    const csv = toCsv([
      { email: 'a@example.com', created_at: '2026-10-10T17:37:11.176Z', source: 'hero' },
      { email: '+tag@example.com', created_at: '2026-10-10T17:38:00.000Z', source: 'vlog' },
    ]);
    expect(csv).toBe(
      'email,created_at,source\r\na@example.com,2026-10-10T17:37:11.176Z,hero\r\n\'+tag@example.com,2026-10-10T17:38:00.000Z,vlog\r\n',
    );
    expect(toCsv([])).toBe('email,created_at,source\r\n');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell(null)).toBe('');
  });

  it('writes to waitlist.csv, which git ignores', () => {
    expect(readFileSync('.gitignore', 'utf8').split(/\r?\n/)).toContain('waitlist.csv');
    expect(readFileSync('scripts/waitlist-export.mjs', 'utf8')).toContain("'waitlist.csv'");
    expect(JSON.parse(readFileSync('package.json', 'utf8')).scripts['waitlist:export']).toBe('node scripts/waitlist-export.mjs');
  });
});
