// Saves the above-the-fold screenshots listed in docs/screenshots/README.md: node tests/screenshots.mjs
// Needs `npm run build` and a running preview (`npm run preview -- --port 4399`), or set BASE.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import routes from './routes.js';

const base = process.env.BASE ?? 'http://127.0.0.1:4399';
const out = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
mkdirSync(out, { recursive: true });

const name = (p) => (p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '-').replace('no-such-page', '404'));
const full = new Set(['/', '/blog/why-every-agent-gets-its-own-room/']); // every width; the rest at 375 and 1280
const browser = await chromium.launch();
for (const route of routes) {
  const widths = full.has(route.path) ? [320, 375, 768, 1024, 1280, 1480] : [375, 1280];
  for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.addInitScript((t) => localStorage.setItem('r7-theme', t), theme);
    const page = await context.newPage();
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 812 : 800 });
      await page.goto(base + route.path, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${out}${name(route.path)}-${theme}-${width}.png` });
    }
    await context.close();
  }
}
await browser.close();
