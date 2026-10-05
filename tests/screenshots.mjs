// Saves the above-the-fold screenshots listed in docs/screenshots/README.md: node tests/screenshots.mjs
// Needs `npm run build` and a running preview (`npm run preview -- --port 4399`), or set BASE.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import routes, { articlePaths, heroPaths } from './routes.js';

const base = process.env.BASE ?? 'http://127.0.0.1:4399';
const out = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
mkdirSync(out, { recursive: true });

const name = (p) =>
  p === '/'
    ? 'home'
    : p
        .replace(/^\/|\/$/g, '')
        .replace(/\//g, '-')
        .replace('no-such-page', '404');
// The posts come from dist/ (routes.js): whatever is published. The first article at every width, the ones with a featured image
// at 320, 768, 1280 and the whole page, the rest at 375 and 1280.
const full = new Set(['/', ...articlePaths.slice(0, 1)]);
const hero = new Set(heroPaths.filter((path) => !full.has(path)));
const browser = await chromium.launch();
for (const route of routes) {
  const widths = full.has(route.path) ? [320, 375, 768, 1024, 1280, 1480] : hero.has(route.path) ? [320, 768, 1280] : [375, 1280];
  {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 800 });
      await page.goto(base + route.path, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${out}${name(route.path)}-${width}.png`, fullPage: hero.has(route.path) });
    }
    await context.close();
  }
}
await browser.close();
