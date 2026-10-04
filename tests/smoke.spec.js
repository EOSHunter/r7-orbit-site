import { test, expect } from '@playwright/test';
import routes from './routes.js';
import { viewports, watchPage } from './helpers.js';

for (const route of routes) {
  for (const vp of viewports) {
    test(`smoke ${route.path} [${vp.name}px]`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const problems = watchPage(page, baseURL);

      const response = await page.goto(route.path, { waitUntil: 'networkidle' });
      expect(response?.status(), 'HTTP status').toBe(route.status ?? 200);

      await expect(page.locator('h1'), 'exactly one h1').toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('lang', /.+/);

      const title = (await page.title()).trim();
      expect(title.length, 'title present').toBeGreaterThan(0);
      expect(title.length, 'title ≤ 60 characters').toBeLessThanOrEqual(60);

      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect((description ?? '').trim().length, 'meta description present').toBeGreaterThan(0);
      expect((description ?? '').length, 'meta description ≤ 155 characters').toBeLessThanOrEqual(155);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, 'absolute canonical').toMatch(/^https?:\/\//);

      if (route.noindex) {
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      }

      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        view: document.documentElement.clientWidth,
      }));
      expect(overflow.doc, 'no horizontal scroll').toBeLessThanOrEqual(overflow.view);

      // The browser logs the 404 document itself as a console error; asset 404s are still caught by watchPage.
      const real =
        route.status === 404
          ? problems.filter((m) => !m.startsWith('console error: Failed to load resource'))
          : problems;
      expect(real, 'console / network problems').toEqual([]);
    });
  }
}
