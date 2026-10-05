import { test, expect } from '@playwright/test';
import { heroPaths as POSTS } from './routes.js';

// Text over a featured image. axe cannot judge text on a photo, so this measures it: for every text run in the hero it takes
// the brightest pixel behind it (the worst case for light text, with the scrim on) and checks WCAG AA (4.5:1, or 3:1 for
// large text). It checks the images the published posts actually use: publish a bright photo and it will say so.
// The posts are found in dist/ (see routes.js): the ones that have a featured image. With none published it skips.

const WIDTHS = [320, 768, 1280];

test.describe('hero text contrast', () => {
  test.skip(POSTS.length === 0, 'no published post has a featured image');
  for (const path of POSTS) {
    for (const width of WIDTHS) {
      test(`${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path, { waitUntil: 'networkidle' });
        const hero = page.locator('.article-hero');
        await expect(hero).toHaveCount(1);
        await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));

        // Where each run of text is, and its colour, before the text is hidden.
        const runs = await page.evaluate(() => {
          const box = document.querySelector('.article-hero').getBoundingClientRect();
          const out = [];
          const walker = document.createTreeWalker(document.querySelector('.article-hero-body'), NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent.trim()) continue;
            const el = node.parentElement;
            const style = getComputedStyle(el);
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const r of range.getClientRects()) {
              if (r.width < 1 || r.height < 1) continue;
              out.push({
                text: node.textContent.trim().slice(0, 40),
                x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height,
                color: style.color,
                size: parseFloat(style.fontSize),
                bold: Number(style.fontWeight) >= 700,
              });
            }
          }
          return out;
        });
        expect(runs.length, 'text in the hero').toBeGreaterThan(5);

        await page.addStyleTag({ content: '.article-hero-body { visibility: hidden !important; }' });
        const shot = (await hero.screenshot({ animations: 'disabled' })).toString('base64');

        const failures = await page.evaluate(async ({ shot, runs }) => {
          const img = new Image();
          img.src = `data:image/png;base64,${shot}`;
          await img.decode();
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
          const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          const bad = [];
          for (const run of runs) {
            const x = Math.max(0, Math.floor(run.x)), y = Math.max(0, Math.floor(run.y));
            const w = Math.min(img.width - x, Math.ceil(run.w)), h = Math.min(img.height - y, Math.ceil(run.h));
            const px = ctx.getImageData(x, y, w, h).data;
            let bright = 0;
            for (let i = 0; i < px.length; i += 4) bright = Math.max(bright, lum(px[i], px[i + 1], px[i + 2]));
            const [r, g, b] = run.color.match(/[\d.]+/g).map(Number);
            const text = lum(r, g, b);
            const ratio = (Math.max(text, bright) + 0.05) / (Math.min(text, bright) + 0.05);
            const large = run.size >= 24 || (run.size >= 18.66 && run.bold);
            if (ratio < (large ? 3 : 4.5)) bad.push(`"${run.text}" ${ratio.toFixed(2)}:1 (${run.size}px, ${run.color})`);
          }
          return bad;
        }, { shot, runs });

        expect(failures, 'text below AA over the hero image').toEqual([]);
      });
    }
  }
});
