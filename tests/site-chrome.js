// The parts of every page that the site settings (src/data/site.json) draw: the <head>, the header and the footer, as text,
// for tests/site-settings.spec.js. tests/fixtures/site-chrome.txt holds them as they were before the settings became editable
// in /admin, so moving a value into the settings file (or editing code around it) cannot change a word, link or order unnoticed.
//
// Three things are normalised because they change without anyone editing a setting: the hashed names of built files
// (/_astro/x.Ab12Cd.js), the year in the footer, and how the CSS is delivered (Vite inlines a small stylesheet or links it, and
// re-splits them when a page is added), so <style> blocks and stylesheet links are left out.
//
// The first line of the fixture is the digest of the content it was captured from (the settings and src/content/, where the pages'
// titles and descriptions are: tests/fixture-inputs.js). When the author has changed a setting or a page in /admin since, the
// fixture is out of date: the test then checks each page against the settings instead (`chromeProblems`: the nav, the footer, the
// site name) and says so. Rewrite it from a fresh build, and read its diff, with:
//   npm run build && UPDATE_SITE_CHROME=1 npx playwright test site-settings

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { footerLinks } from '../src/lib/site-settings.ts';
import { inputsDigest, siteSettings, textFixture } from './fixture-inputs.js';

/** The files the head, header and footer of the pages are drawn from. */
export const CHROME_INPUTS = ['src/data/site.json', 'src/content/'];

/** The pages compared: one of each kind of page that exists whatever is published, plus the posts published when this was made. */
export const CHROME_PAGES = [
  '/',
  '/latest/',
  '/news/',
  '/blog/',
  '/vlogs/',
  '/projects/',
  '/repos/',
  '/apps/',
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

const fileOf = (dist, path) => (path.endsWith('.html') ? join(dist, path) : join(dist, path, 'index.html'));

/** Whether the build has the page (a post in CHROME_PAGES may since have been unpublished). */
export const builtPage = (dist, path) => existsSync(fileOf(dist, path));

/** The head, header and footer of one built page (`path` as in CHROME_PAGES), as lines. */
export function chromeOf(dist, path) {
  const file = fileOf(dist, path);
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

/** Every page in CHROME_PAGES, as the text the fixture holds: the digest of its inputs first. */
export function chromeText(dist) {
  return textFixture(
    inputsDigest(CHROME_INPUTS),
    CHROME_PAGES.filter((path) => builtPage(dist, path)).flatMap((path) => chromeOf(dist, path)),
  );
}

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/**
 * What the settings say the head, header and footer of a page hold, checked in its chrome (`chromeOf`): the nav links in order,
 * at most one of them current; the footer links in order and the footer note; the site name in the title and og:site_name.
 * For when the fixture is out of date. Returns the problems found.
 */
export function chromeProblems(dist, path) {
  const site = siteSettings();
  const html = chromeOf(dist, path).join('\n');
  const part = (open, close) => {
    const start = html.indexOf(open);
    return start < 0 ? '' : html.slice(start, html.indexOf(close, start));
  };
  const problems = [];
  const same = (what, found, expected) => {
    if (JSON.stringify(found) !== JSON.stringify(expected))
      problems.push(`${what}: ${JSON.stringify(found)}, the settings say ${JSON.stringify(expected)}`);
  };

  const nav = [...part('<nav class="site-nav"', '</nav>').matchAll(/<a href="([^"]*)"( aria-current="page")?>([^<]*)<\/a>/g)];
  same('the nav', nav.map((m) => [decode(m[3]), decode(m[1])]), site.nav.map((i) => [i.label, i.href]));
  if (nav.filter((m) => m[2]).length > 1) problems.push('more than one nav link is marked as the current page');

  const footer = [...part('<nav aria-label="Footer">', '</nav>').matchAll(/<a href="([^"]*)"[^>]*>(?:[^<]|<(?!\/a>))*?([^>]*)<\/a>/g)];
  same('the footer links', footer.map((m) => [decode(m[2]), decode(m[1])]), footerLinks(site).map((l) => [l.label, l.href]));
  if (!html.includes(`<span>${site.footer.note}</span>`)) problems.push(`the footer note "${site.footer.note}" is missing`);

  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  if (!title.includes(site.name)) problems.push(`the title "${title}" does not hold the site name "${site.name}"`);
  same('og:site_name', decode(html.match(/<meta property="og:site_name" content="([^"]*)">/)?.[1] ?? ''), site.name);
  return problems;
}
