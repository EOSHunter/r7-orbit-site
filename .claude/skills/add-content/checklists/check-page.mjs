// Checks a built post the way a reader meets it: the page, its archive, /latest/, the sitemap, site search, and two screenshots.
//   npm run build
//   node .claude/skills/add-content/checklists/check-page.mjs blog/my-slug
//   (a leading slash is fine in PowerShell; in Git Bash leave it off) "a phrase from the post" [--absent]
// Serves dist/ itself on a free port and stops only that server. Screenshots go to .cache/add-content/ (git-ignored).
// With --absent it asserts the opposite, for a draft or a future date: none of the above may contain the post.
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { chromium } from '@playwright/test';

const [rawPath, phrase, flag] = process.argv.slice(2);
// Git Bash rewrites a leading /blog/... into C:/Program Files/Git/blog/...: write the address without it, or set MSYS_NO_PATHCONV=1.
const path =
  '/' +
  (rawPath || '')
    .replace(/^[A-Za-z]:\/Program Files\/Git/, '')
    .split('/')
    .filter(Boolean)
    .join('/') +
  '/';
const absent = flag === '--absent';
// A free port: another checkout's server may already hold the usual ones, and it would be serving a different dist/.
const port = await new Promise((resolve) => {
  const probe = createServer().listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});
const base = `http://127.0.0.1:${port}`;
const [kind, slug] = path.split('/').filter(Boolean);
if (!kind || !slug || !phrase) throw new Error('usage: check-page.mjs /<kind>/<slug>/ "phrase" [--absent]');

const server = spawn(
  process.execPath,
  ['node_modules/astro/bin/astro.mjs', 'preview', '--port', String(port), '--host', '127.0.0.1'],
  {
    stdio: 'ignore',
  },
);
const results = [];
const check = (name, ok) => results.push({ name, ok: absent ? !ok : ok });

try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + '/')).ok) break;
    } catch {
      // not up yet: try again
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const html = (p) => fetch(base + p).then((r) => r.text());

  check(`dist${path}index.html exists`, existsSync(`dist${path}index.html`));
  check(`/${kind}/ lists it`, (await html(`/${kind}/`)).includes(path));
  check('/latest/ lists it', (await html('/latest/')).includes(path));
  check('sitemap has it', (await html('/sitemap-0.xml')).includes(path));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${base}/search/?q=${encodeURIComponent(phrase)}`);
  await page.waitForTimeout(2500);
  check(
    'search finds it',
    (
      await page.locator('[data-search-page] [data-search-results], main [data-search-results]').first().innerHTML()
    ).includes(path),
  );

  if (!absent) {
    mkdirSync('.cache/add-content', { recursive: true });
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      check(`no horizontal scroll at ${width}px`, !overflow);
      await page.screenshot({ path: `.cache/add-content/${slug}-${width}.png`, fullPage: true });
    }
    check('no console errors', errors.length === 0);
    if (errors.length) console.log(errors.join('\n'));
  }
  await browser.close();
} finally {
  server.kill();
}

for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${absent ? '(absent) ' : ''}${r.name}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
