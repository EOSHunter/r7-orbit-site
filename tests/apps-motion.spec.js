import { test, expect } from '@playwright/test';
import { watchPage } from './helpers.js';

// Apps (phase 3): the posters' orbit beside the Apps heading (AppsOrbit.astro). docs/DECISIONS.md, "Apps (phase 3)".

test('the orbit circles the posters beside the heading, hidden from screen readers, and gives way on a narrow screen', async ({ page, baseURL }) => {
  const problems = watchPage(page, baseURL);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/apps/', { waitUntil: 'networkidle' });
  const orbit = page.locator('.apps-orbit');
  test.skip((await orbit.count()) === 0, 'fewer than two published apps have a poster');

  await expect(orbit).toBeVisible();
  await expect(orbit).toHaveAttribute('aria-hidden', 'true');
  const covers = orbit.locator('.apps-orbit-cover');
  expect(await covers.count()).toBeGreaterThanOrEqual(2);
  expect(await covers.evaluateAll((imgs) => imgs.every((img) => img.getAttribute('alt') === ''))).toBe(true);
  // The posters move: one place now, another a moment later.
  const at = () => covers.first().evaluate((img) => getComputedStyle(img).left);
  const before = await at();
  await expect.poll(at, { timeout: 5000 }).not.toBe(before);

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(orbit).toBeHidden();
  expect(problems).toEqual([]);
});

test('under reduced motion the orbit stands still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/apps/', { waitUntil: 'networkidle' });
  const cover = page.locator('.apps-orbit-cover').first();
  test.skip((await cover.count()) === 0, 'fewer than two published apps have a poster');
  const before = await cover.evaluate((img) => getComputedStyle(img).left);
  await page.waitForTimeout(1500);
  expect(await cover.evaluate((img) => getComputedStyle(img).left)).toBe(before);
});

// A poster at the end of the ring stays inside the page at every width the orbit shows at, through a whole turn.
for (const width of [900, 1024, 1280, 1480]) {
  test(`the orbit never makes the page scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/apps/', { waitUntil: 'networkidle' });
    test.skip((await page.locator('.apps-orbit').count()) === 0, 'fewer than two published apps have a poster');
    const widest = await page.evaluate(async () => {
      const orbit = document.querySelector('.apps-orbit');
      let max = 0;
      for (let turn = 0; turn < 360; turn += 15) {
        orbit.style.setProperty('animation', 'none');
        orbit.style.setProperty('--orbit-turn', `${turn}deg`);
        max = Math.max(max, document.documentElement.scrollWidth);
      }
      return max;
    });
    expect(widest).toBeLessThanOrEqual(width);
  });
}
