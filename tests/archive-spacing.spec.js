import { test, expect } from '@playwright/test';

// A listing page with blocks below the list (e.g. /projects/ and its "Behind Orbit Royale" section): the last row of cards keeps
// clear of the rule over those blocks (ArchivePage.astro puts its end spacer before them). Fixed 2026-11-07: the status chips under
// the project cards touched that rule.

test('the cards on /projects/ keep clear of the ruled section below them', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/projects/', { waitUntil: 'networkidle' });
  const gap = await page.evaluate(() => {
    const cards = [...(document.querySelector('.grid-cards')?.querySelectorAll(':scope > .card') ?? [])];
    if (!cards.length) return null;
    const bottom = Math.max(...cards.map((c) => c.getBoundingClientRect().bottom));
    const rule = [...document.querySelectorAll('section.section.ruled')].map((s) => s.getBoundingClientRect().top).filter((t) => t >= bottom - 1).sort((a, b) => a - b)[0];
    return rule === undefined ? null : rule - bottom;
  });
  test.skip(gap === null, 'no block below the list');
  expect(gap).toBeGreaterThanOrEqual(24);
});
