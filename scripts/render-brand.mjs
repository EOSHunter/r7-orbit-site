// Renders a picture source from brand/source/<name>.html to brand/social/<name>.png at the page's own size (its .canvas), with
// the site's tokens, fonts and logo files. Uses Playwright's Chromium (already a dev dependency); nothing is fetched from the web.
//
//   node scripts/render-brand.mjs og-newsletter
//
// The sources were written for the original kit's folders (../../design-system/), so the requests are answered from where those
// files live in this repo: tokens from src/styles/design-system/, the marks from public/assets/, the fonts from public/fonts/.
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/render-brand.mjs <name>   (a file brand/source/<name>.html)');
  process.exit(1);
}
const root = resolve(import.meta.dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

/** The file in this repo that answers a request for `path` on the stand-in origin. */
function fileFor(path) {
  if (path.startsWith('/design-system/assets/')) return join(root, 'public/assets', path.slice('/design-system/assets/'.length));
  if (path.startsWith('/design-system/')) return join(root, 'src/styles/design-system', path.slice('/design-system/'.length));
  if (path.startsWith('/fonts/')) return join(root, 'public/fonts', path.slice('/fonts/'.length));
  if (path.startsWith('/brand/')) return join(root, path);
  return null;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  const file = url.hostname === 'brand.test' ? fileFor(decodeURIComponent(url.pathname)) : null;
  if (!file) return route.abort();
  try {
    await route.fulfill({ body: await readFile(file), contentType: TYPES[extname(file)] ?? 'application/octet-stream' });
  } catch {
    await route.fulfill({ status: 404, body: '' });
  }
});
await page.goto(`http://brand.test/brand/source/${name}.html`);
await page.evaluate(() => document.fonts.ready);
const out = join(root, 'brand/social', `${name}.png`);
await page.locator('.canvas').screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out}`);
