// The content a wording fixture was captured from. The wording fixtures (tests/fixtures/site-chrome.txt, about-text.txt and
// pages/*) hold a page's words line for line, so a word cannot change by accident: in code, or while copy moves into a file.
// But the words are the author's, edited in /admin: the editor opens a pull request, and CI must not fail it because
// a fixture still holds last week's tagline.
//
// So each fixture records a digest of the files its words come from (`inputs: sha256:…`, its first line or key):
//   - the same files: the page must match the fixture word for word, as before;
//   - other files (the author has edited them since): the test checks the page against those files instead (the title, the
//     description, the heading; the nav and footer for the chrome), notes that the fixture is out of date, and says how to
//     refresh it. Refresh it in the next code change, and read its diff: that is when a word changed by code shows.
//
// Line ends are normalised before hashing, so a Windows checkout and CI's Linux one agree.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillTokens, pageSettingsOf } from '../src/lib/page-copy.ts';
import { parseSite } from '../src/lib/site-settings.ts';
import { plainTitle } from '../src/lib/text.ts';
import { parseFrontmatter } from '@astrojs/markdown-remark';

const root = fileURLToPath(new URL('../', import.meta.url));

/** Every file under each path (a file or a folder, relative to the repository root), sorted. */
function filesOf(paths) {
  const out = [];
  const walk = (abs) => {
    if (statSync(abs).isDirectory()) for (const name of readdirSync(abs)) walk(join(abs, name));
    else out.push(abs);
  };
  for (const path of paths) walk(join(root, path));
  return out.map((abs) => relative(root, abs).replaceAll('\\', '/')).sort();
}

/** The digest of the files a fixture's words come from. */
export function inputsDigest(paths) {
  const hash = createHash('sha256');
  for (const file of filesOf(paths)) {
    hash.update(`${file}\n`);
    hash.update(readFileSync(join(root, file), 'utf8').replaceAll('\r\n', '\n'));
    hash.update('\n\0\n');
  }
  return `sha256:${hash.digest('hex').slice(0, 16)}`;
}

const INPUTS_LINE = /^inputs: (\S+)$/;

/** A text fixture: its `inputs:` first line (if any) and its lines. Splits on CRLF too, for a checkout that converted them. */
export function readTextFixture(url) {
  const lines = readFileSync(url, 'utf8').trimEnd().split(/\r?\n/);
  const inputs = lines[0]?.match(INPUTS_LINE)?.[1];
  return { inputs, lines: inputs ? lines.slice(1) : lines };
}

/** A text fixture's file content, with its `inputs:` line first. */
export const textFixture = (inputs, lines) => `inputs: ${inputs}\n${lines.join('\n')}\n`;

/** How to say, in a test's notes, that a fixture is out of date. */
export const staleNote = (fixture, refresh) =>
  `The content ${fixture} was captured from has been edited since (in /admin), so the page was checked against the content ` +
  `files instead of word for word. Refresh the fixture and read its diff: ${refresh}`;

/** The site settings, read the way the build reads them. */
export function siteSettings() {
  return parseSite(JSON.parse(readFileSync(join(root, 'src/data/site.json'), 'utf8')));
}

/** A page's front matter (src/content/pages/<id>.md), with the settings tokens filled the way the build fills them. */
export function pageCopy(id) {
  const site = siteSettings();
  const file = `src/content/pages/${id}.md`;
  const data = parseFrontmatter(readFileSync(join(root, file), 'utf8')).frontmatter;
  const settings = pageSettingsOf(site);
  const fill = (value) => (typeof value === 'string' ? fillTokens(value, settings, file) : value);
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, fill(value)]));
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * The words of a page that its content file says it has, checked in a page's text lines (tests/page-text.js, tests/about-text.js:
 * `title: …`, `description: …`, then `h1…: …` and so on). Returns the problems found, empty when the page shows its file's words.
 * `home` is the home page, whose browser title is the site's name and tagline rather than its own.
 */
export function contentTextProblems(lines, id, { home = false } = {}) {
  const site = siteSettings();
  const copy = pageCopy(id);
  const problems = [];
  const value = (prefix) => lines.find((l) => l.startsWith(prefix))?.slice(prefix.length);
  const title = value('title: ') ?? '';
  const name = home ? site.name : plainTitle(clean(copy.seoTitle ?? copy.title));
  if (!title.includes(name)) problems.push(`the browser title "${title}" does not hold "${name}"`);
  if (!title.includes(site.name)) problems.push(`the browser title "${title}" does not hold the site name "${site.name}"`);
  if (value('description: ') !== clean(copy.description))
    problems.push(`the description is "${value('description: ')}", the file says "${clean(copy.description)}"`);
  const h1 = lines.find((l) => /^h1(\.[\w-]+)*: /.test(l))?.replace(/^h1(\.[\w-]+)*: /, '');
  if (h1 !== plainTitle(clean(copy.title))) problems.push(`the h1 is "${h1}", the file says "${plainTitle(clean(copy.title))}"`);
  for (const key of ['eyebrow', 'lead']) {
    if (!copy[key]) continue;
    if (!lines.some((l) => l.endsWith(`: ${clean(copy[key])}`))) problems.push(`the ${key} "${clean(copy[key])}" is not on the page`);
  }
  for (const button of copy.buttons ?? []) {
    if (!lines.some((l) => /^a(\.[\w-]+)*\.btn(\.[\w-]+)*: /.test(l) && l.endsWith(`: ${clean(button.label)}`)))
      problems.push(`the button "${clean(button.label)}" is not on the page`);
  }
  return problems;
}
