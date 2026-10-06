// The parts of every page that the site settings (src/data/site.json) draw: the <head>, the header and the footer, as text,
// for tests/site-settings.spec.js. tests/fixtures/site-chrome.txt holds them as they were before the settings became editable
// in /admin, so moving a value into the settings file (or editing code around it) cannot change a word, link or order unnoticed.
//
// Three things are normalised because they change without anyone editing a setting: the hashed names of built files
// (/_astro/x.Ab12Cd.js), the year in the footer, and how the CSS is delivered (Vite inlines a small stylesheet or links it, and
// re-splits them when a page is added), so <style> blocks and stylesheet links are left out.
//
// When the author changes a setting (or a page's own title or description) on purpose, the fixture is out of date. Rewrite it from
// a fresh build with:  npm run build && UPDATE_SITE_CHROME=1 npx playwright test site-settings

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The pages compared: one of each kind of page that exists whatever is published, plus the posts published when this was made. */
export const CHROME_PAGES = [
  '/',
  '/latest/',
  '/news/',
  '/blog/',
  '/vlogs/',
  '/projects/',
  '/repos/',
  '/games/',
  '/tags/',
  '/about/',
  '/privacy/',
  '/search/',
  '/authors/hunter-newton/',
  '/404.html',
  '/blog/test/',
  '/vlogs/building-a-browser-game-with-ai-agents-in-r7-orbit/',
  '/projects/vesper-drift/',
];

const between = (html, open, close) => {
  const start = html.indexOf(open);
  if (start < 0) return '';
  const end = html.indexOf(close, start);
  return end < 0 ? '' : html.slice(start, end + close.length);
};

/** One tag per line, so a difference reads as the line that changed. */
const lines = (fragment) =>
  fragment
    .replace(/<style(\s[^>]*)?>[\s\S]*?<\/style>/g, '')
    .replace(/<link rel="stylesheet"[^>]*>/g, '')
    .replace(/\/_astro\/[\w.-]+/g, '/_astro/*')
    .replace(/&copy; \d{4}|© \d{4}/g, '© YEAR')
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** The head, header and footer of one built page (`path` as in CHROME_PAGES), as lines. */
export function chromeOf(dist, path) {
  const file = path.endsWith('.html') ? join(dist, path) : join(dist, path, 'index.html');
  const html = readFileSync(file, 'utf8');
  return [
    `== ${path} head`,
    ...lines(between(html, '<head>', '</head>')),
    `== ${path} header`,
    ...lines(between(html, '<header class="site-header">', '</header>')),
    `== ${path} footer`,
    ...lines(between(html, '<footer class="site-footer">', '</footer>')),
  ];
}

/** Every page in CHROME_PAGES, as the text the fixture holds. */
export function chromeText(dist) {
  return `${CHROME_PAGES.flatMap((path) => chromeOf(dist, path)).join('\n')}\n`;
}
