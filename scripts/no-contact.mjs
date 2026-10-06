// After the build: stops if a public page of dist/ holds a mailto: link or an email address. The author has no public email
// (docs/DECISIONS.md). The editor (/admin/) and the tests' fixtures (/styleguide/) are not looked at. Rule: src/lib/no-contact.mjs.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contactProblems, isPublicFile } from '../src/lib/no-contact.mjs';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

/** Every problem in dist/, as "file: what". */
export async function findContactProblems() {
  const found = [];
  for (const file of await walk(dist)) {
    const name = relative(dist, file).split(sep).join('/');
    if (!isPublicFile(name)) continue;
    for (const problem of contactProblems(await readFile(file, 'utf8'))) found.push(`${name}: ${problem}`);
  }
  return found;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const found = await findContactProblems();
  if (found.length) {
    console.error(`The built site shows a way to contact the author, and it must not:\n${found.map((f) => `  - ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log('No mailto: link or email address in the public pages.');
}
