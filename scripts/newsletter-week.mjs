// Lists what went up on the site in a date range, as Markdown links, for Mercury's weekly newsletter issue
// (.claude/skills/add-content/agents/mercury.md, docs/NEWSLETTER.md). Reads the posts' front matter only; the site is not built.
//
//   npm run newsletter:week                      the last 7 days, today included (UTC)
//   npm run newsletter:week -- 2026-11-03 2026-11-09   from and to, both included
//
// A post is listed when it is not a draft and its date is in the range (a future date is not published yet, so it is left out).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { NEWSLETTER_KINDS, weekItems } from '../src/lib/newsletter-week.mjs';

const SITE = 'https://r7orbit.io';
const day = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const [from = day(new Date(today.getTime() - 6 * 864e5)), to = day(today)] = process.argv.slice(2);
for (const value of [from, to]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    console.error(`"${value}" is not a date: use YYYY-MM-DD, e.g. npm run newsletter:week -- 2026-11-03 2026-11-09`);
    process.exit(1);
  }
}

const posts = [];
for (const kind of NEWSLETTER_KINDS) {
  const dir = join('src', 'content', kind.collection);
  for (const file of await readdir(dir).catch(() => [])) {
    if (!/\.mdx?$/.test(file)) continue;
    const text = await readFile(join(dir, file), 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) continue;
    posts.push({ collection: kind.collection, id: file.replace(/\.mdx?$/, ''), data: parse(match[1]) ?? {} });
  }
}

console.log(weekItems(posts, { from, to, today: day(today), site: SITE }));
