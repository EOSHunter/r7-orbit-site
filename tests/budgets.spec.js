import { test, expect } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import routes from './routes.js';

// docs/PROJECT_BRIEF.md §9: < 50 kB gzipped JavaScript, < 40 kB gzipped CSS per page.
// Measured here (not by Lighthouse) because `astro preview` does not compress, so transfer sizes would be raw.
const JS_BUDGET = 50 * 1000;
const CSS_BUDGET = 40 * 1000;

const gz = (text) => gzipSync(text, { level: 9 }).length;

for (const route of routes) {
  test(`budgets ${route.path}`, async ({ page }) => {
    const sizes = { script: 0, stylesheet: 0 };
    const pending = [];
    page.on('response', (res) => {
      const type = res.request().resourceType();
      if ((type === 'script' || type === 'stylesheet') && res.status() < 300) {
        pending.push(res.body().then((b) => (sizes[type] += gzipSync(b, { level: 9 }).length)));
      }
    });
    await page.goto(route.path, { waitUntil: 'networkidle' });
    await Promise.all(pending);

    // Inline <style> and <script> count too.
    const inline = await page.evaluate(() => ({
      css: [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join(''),
      js: [...document.querySelectorAll('script:not([src])')].map((s) => s.textContent ?? '').join(''),
    }));
    const js = sizes.script + gz(inline.js);
    const css = sizes.stylesheet + gz(inline.css);
    test.info().annotations.push({ type: 'size', description: `js ${js} B, css ${css} B (gzipped)` });
    expect(js, 'gzipped JS bytes').toBeLessThan(JS_BUDGET);
    expect(css, 'gzipped CSS bytes').toBeLessThan(CSS_BUDGET);
  });
}
