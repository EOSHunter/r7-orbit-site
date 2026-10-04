import { test, expect } from '@playwright/test';
import routes from './routes.js';

// Keyboard: the skip link is first and works; every focus stop shows a visible indicator and is on screen.
for (const route of routes) {
  test(`keyboard ${route.path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(route.path, { waitUntil: 'networkidle' });

    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => document.activeElement?.getAttribute('href'));
    expect(first, 'skip link is the first focus stop').toBe('#main');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => location.hash)).toBe('#main');

    const stops = await page.evaluate(async () => {
      const out = [];
      const tabbables = document.querySelectorAll(
        'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      ).length;
      return { tabbables, out };
    });
    const bad = [];
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    for (let i = 0; i < Math.min(stops.tabbables + 2, 80); i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        const shadow = cs.boxShadow !== 'none';
        return {
          tag: el.outerHTML.slice(0, 70),
          indicator: outline || shadow,
          visible: r.width > 0 && r.height > 0,
        };
      });
      if (!info || info.tag.startsWith('<iframe')) continue; // the styleguide's frames hold the specimen route, tested on its own
      if (!info.visible) bad.push(`not visible: ${info.tag}`);
      else if (!info.indicator) bad.push(`no focus indicator: ${info.tag}`);
    }
    expect(bad).toEqual([]);
  });
}

// Reduced motion: nothing keeps animating or transitions in.
for (const route of routes) {
  test(`reduced motion ${route.path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route.path, { waitUntil: 'networkidle' });
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === 'running' &&
            (a.effect?.getTiming().iterations === Infinity || Number(a.effect?.getTiming().duration) > 200),
        )
        .map((a) => a.effect?.target?.className ?? a.constructor.name),
    );
    expect(running, 'long or infinite animations while reduced motion is on').toEqual([]);
  });
}
