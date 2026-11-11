import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The archive toolbar (ArchiveList.astro), 2026-11-09: a phone opened /latest/ on a screen of switches (sort, kinds, every author,
// every tag) before the first card. Now the search box, a Filters button and the kind switch show; sort, author and tags sit in
// the Filters panel, and what is picked there shows as removable chips (and a count on the button) while the panel is closed.

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const visible = (page) => page.locator('[data-items] [data-item]:not([hidden])');

test('on a phone the first card shows on the first screen; sort, authors and tags wait in the Filters panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/latest/');
  const toggle = page.locator('[data-filters-toggle]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('[data-filters-panel]')).toBeHidden();
  await expect(page.locator('[data-filter="kind"]')).toBeVisible();
  const box = await page.locator('.toolbar').boundingBox();
  expect(box?.height ?? 999, 'toolbar height').toBeLessThan(160);
  const kinds = await page.locator('[data-filter="kind"]').evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(kinds, 'every kind fits without scrolling').toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-filters-panel]')).toBeVisible();
  await expect(page.locator('[data-sort]')).toBeVisible();
  await expect(page.locator('[data-tags-filter]')).toBeVisible();
});

test('picks show as chips and a count on the button; a chip removes its filter; Escape and Done close the panel', async ({
  page,
}) => {
  await page.goto('/latest/');
  const toggle = page.locator('[data-filters-toggle]');
  const badge = page.locator('[data-filters-badge]');
  const chips = page.locator('[data-filters-active] button');
  await expect(badge).toBeHidden();

  await toggle.click();
  await page.locator('[data-sort] button[data-value="oldest"]').click();
  const tag = page.locator('[data-tags-filter] button').first();
  const tagName = (await tag.textContent())?.trim() ?? '';
  await tag.click();
  await expect(badge).toHaveText('2');
  await expect(page.locator('[data-filters-done]')).toHaveText(/^Show \d+ posts?$/);
  // While the panel is open its own switches show the picks, so the chips wait.
  await expect(page.locator('[data-filters-active]')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-filters-panel]')).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(chips).toHaveText(['Oldest first', tagName]);
  expect(page.url()).toContain('sort=oldest');

  await chips.filter({ hasText: tagName }).click();
  await expect(chips).toHaveText(['Oldest first']);
  await expect(badge).toHaveText('1');
  expect(page.url()).not.toContain('tag=');

  await toggle.click();
  await page.locator('[data-filters-done]').click();
  await expect(page.locator('[data-filters-panel]')).toBeHidden();
  await chips.first().click();
  await expect(badge).toBeHidden();
  await expect(page.locator('[data-filters-active]')).toBeHidden();
  await expect(visible(page).first()).toBeVisible();
});

test('a shared address with filters shows them as chips on load', async ({ page }) => {
  await page.goto('/latest/?author=r7&sort=oldest');
  await expect(page.locator('[data-filters-badge]')).toHaveText('2');
  await expect(page.locator('[data-filters-active] button')).toHaveText(['Oldest first', 'Orbit']);
  await expect(page.locator('[data-filters-toggle]')).toHaveAccessibleName('Filters, 2 on');
});

for (const width of [375, 1280]) {
  test(`the toolbar passes axe at ${width}px, with the panel open and closed`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/latest/?author=r7');
    const scan = async () =>
      (await new AxeBuilder({ page }).include('.toolbar').withTags(AXE_TAGS).analyze()).violations.map(
        (v) => `${v.id}: ${v.nodes[0]?.html}`,
      );
    expect(await scan()).toEqual([]);
    await page.locator('[data-filters-toggle]').click();
    expect(await scan()).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
