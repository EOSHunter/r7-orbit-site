import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import routes from './routes.js';
import { themes, viewports, setTheme } from './helpers.js';

// WCAG 2.2 AA. Every violation fails the test; none are waived.
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const route of routes) {
  for (const theme of themes) {
    for (const vp of viewports) {
      test(`axe ${route.path} [${theme}, ${vp.name}px]`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setTheme(context, theme);
        await page.goto(route.path, { waitUntil: 'networkidle' });

        const { violations } = await new AxeBuilder({ page }).withTags(tags).analyze();
        const summary = violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
        }));
        expect(summary, 'axe violations').toEqual([]);
      });
    }
  }
}
