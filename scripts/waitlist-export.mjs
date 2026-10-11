// npm run waitlist:export [-- --local] [-- --out <file>]: the waitlist as a CSV file (email, created_at, source), oldest first.
// Reads the D1 database through wrangler (`wrangler d1 execute WAITLIST_DB --json`, with scripts/wrangler.waitlist.toml for the
// binding): from your Cloudflare account by default (run `npx wrangler login` once), or the local copy `wrangler pages dev` uses
// with --local. Writes waitlist.csv at the repository root unless --out says otherwise; git ignores waitlist.csv. Keep the file
// off shared drives and out of the repository: it is a list of people's addresses. docs/WAITLIST.md, step 8.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const QUERY = 'SELECT email, created_at, source FROM waitlist ORDER BY created_at';
export const COLUMNS = ['email', 'created_at', 'source'];

/** The wrangler command (arguments after `npx`) that reads the list. */
export function wranglerArgs({ local = false } = {}) {
  return [
    '--yes',
    'wrangler@4',
    'd1',
    'execute',
    'WAITLIST_DB',
    local ? '--local' : '--remote',
    '-c',
    'scripts/wrangler.waitlist.toml',
    ...(local ? ['--persist-to', '.wrangler/state'] : []),
    '--json',
    '--command',
    QUERY,
  ];
}

/** The rows from wrangler's --json output (`[{ results: [...], success }]`). Throws, saying what came back, when it is not that. */
export function rowsFromWrangler(output) {
  const start = output.indexOf('[');
  let parsed;
  try {
    parsed = JSON.parse(output.slice(start));
  } catch {
    throw new Error(`wrangler did not answer with JSON:\n${output.trim().slice(0, 600)}`);
  }
  if (!Array.isArray(parsed) || parsed.some((r) => !r || r.success === false || !Array.isArray(r.results))) {
    throw new Error(`wrangler answered with an error:\n${JSON.stringify(parsed, null, 2).slice(0, 600)}`);
  }
  return parsed.flatMap((r) => r.results);
}

/**
 * One CSV cell (RFC 4180). A cell that a spreadsheet would run as a formula (it starts with =, +, -, @, a tab or a return) gets a
 * leading apostrophe, so opening the file cannot run anything: an address may legally start with + or -.
 */
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The CSV file: a header row, then one row per address, CRLF line ends (what spreadsheets expect). */
export function toCsv(rows) {
  return [COLUMNS, ...rows.map((row) => COLUMNS.map((c) => row[c]))].map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function parseArgs(argv) {
  const local = argv.includes('--local');
  const at = argv.indexOf('--out');
  const out = resolve(root, at >= 0 && argv[at + 1] ? argv[at + 1] : 'waitlist.csv');
  return { local, out };
}

function run(argv) {
  const { local, out } = parseArgs(argv);
  const args = wranglerArgs({ local });
  // npx is a .cmd file on Windows, which Node only starts through a shell; the query is the one argument with spaces.
  const windows = process.platform === 'win32';
  const result = spawnSync('npx', windows ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, {
    cwd: root,
    encoding: 'utf8',
    shell: windows,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `wrangler stopped (exit ${result.status}).${local ? '' : ' Signed in? Run `npx wrangler login` first.'}\n${(result.stderr || result.stdout || '').trim().slice(0, 1200)}`,
    );
  }
  const rows = rowsFromWrangler(result.stdout);
  writeFileSync(out, toCsv(rows), 'utf8');
  console.log(`${rows.length} ${rows.length === 1 ? 'address' : 'addresses'} written to ${out} (${local ? 'local' : 'Cloudflare'} database).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
