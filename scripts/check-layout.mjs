// The layout check (docs/WRITING_GUIDE.md "The layout check"): says where a post reads as a wall of text or breaks a writing rule,
// with the line and a one-line fix. Report only: it changes nothing, and it is not part of `npm run build`, CI or Cloudflare.
//
//   npm run check:layout                          every post in src/content/ (news, blog, vlogs, projects, repos)
//   npm run check:layout -- src/content/blog/x.mdx   one file, or a folder (its .md and .mdx files)
//   npm run check:layout -- <path> --strict       exit 1 when there is any warning
//   npm run check:layout -- <path> --json         the findings as JSON
//
// Rules and numbers: src/lib/layout-check.mjs. The words to avoid are read from docs/VOICE_AND_COPY.md.
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLayout, formatReport, parseHypeList } from '../src/lib/layout-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POST_FOLDERS = ['news', 'blog', 'vlogs', 'projects', 'repos'].map((kind) => join(root, 'src', 'content', kind));

async function filesIn(path) {
  const info = await stat(path);
  if (info.isFile()) return [path];
  const out = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) out.push(...(await filesIn(child)));
    else if (/\.mdx?$/.test(entry.name)) out.push(child);
  }
  return out.sort();
}

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const json = args.includes('--json');
// Git Bash turns a leading /src/... into C:/Program Files/Git/src/...: take the path back.
const targets = args.filter((a) => !a.startsWith('--')).map((a) => a.replace(/^[A-Za-z]:\/Program Files\/Git\//, ''));

const files = [];
for (const target of targets.length ? targets.map((t) => resolve(t)) : POST_FOLDERS) {
  try {
    files.push(...(await filesIn(target)));
  } catch {
    if (targets.length) {
      console.error(`check:layout: no such file or folder: ${relative(root, target) || target}`);
      process.exit(2);
    }
  }
}

const hype = parseHypeList(await readFile(join(root, 'docs', 'VOICE_AND_COPY.md'), 'utf8').catch(() => ''));
const results = [];
for (const file of files) {
  const path = relative(root, file).split(sep).join('/');
  results.push(checkLayout(await readFile(file, 'utf8'), { path, hype }));
}

console.log(json ? JSON.stringify(results, null, 2) : formatReport(results, { strict }));
process.exit(strict && results.some((r) => r.findings.length) ? 1 : 0);
