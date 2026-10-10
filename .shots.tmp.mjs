// Temporary: element screenshots of a page. node .shots.tmp.mjs <url> <out-prefix> <width> <height> <selector[@index]>...
import { chromium } from '@playwright/test';
const [, , url, prefix, w = '1280', h = '900', ...sels] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(url, { waitUntil: 'networkidle' });
for (let y = 0; y < (await p.evaluate(() => document.body.scrollHeight)); y += 700) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(40); }
await p.evaluate(async () => { await Promise.race([Promise.all([...document.images].map((i) => i.decode().catch(() => {}))), new Promise((r) => setTimeout(r, 4000))]); });
await p.addStyleTag({ content: '.site-header { position: static !important; } .reading-progress { display: none !important; }' });
await p.waitForTimeout(300);
let n = 0;
for (const sel of sels) {
  const [s, idx] = sel.split('@');
  const el = p.locator(s).nth(+(idx ?? 0));
  await el.scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  await el.screenshot({ path: `${prefix}-${n++}.png` });
}
if (errs.length) console.log('CONSOLE ERRORS', errs);
await b.close();
