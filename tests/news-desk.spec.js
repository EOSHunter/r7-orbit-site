import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The home page's news desk (NewsDeskBlock.astro) and the news cards' pictures (NewsCard.astro), 2026-11-09: news gets its own
// section (a lead story beside the wire), the feed below it leaves news out, and each news card shows the item's official image
// (credited), its big number, or the topic's signal, with the topic's label on all three.

test('the home page has a news desk: the newest item as the lead, the next ones on the wire, and a link to all news', async ({ page }) => {
  await page.goto('/news/');
  const newest = await page.locator('main a.card[href^="/news/"]').evaluateAll((cards) => cards.map((c) => c.getAttribute('href')));
  await page.goto('/');
  const desk = page.locator('section.news-desk');
  await expect(desk).toHaveCount(1);
  await expect(desk.locator('a.desk-lead')).toHaveAttribute('href', newest[0]);
  const wire = await desk.locator('.desk-wire-list a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(wire).toEqual(newest.slice(1, 1 + wire.length));
  expect(wire.length).toBeGreaterThan(1);
  await expect(desk.locator('.desk-wire-list time').first()).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  await expect(desk.locator('a.more-link')).toHaveAttribute('href', '/news/');
});

test('the feed under the desk shows no news, so the build log is not pushed off the page', async ({ page }) => {
  await page.goto('/');
  const feed = page.locator('section#latest');
  await expect(feed.locator('a.card')).not.toHaveCount(0);
  await expect(feed.locator('a.card[href^="/news/"]')).toHaveCount(0);
});

test('every news card labels its topic; an official image is credited, a big number shows its figure', async ({ page }) => {
  await page.goto('/news/');
  const cards = await page.locator('main a.card[href^="/news/"]').evaluateAll((all) =>
    all.map((c) => ({
      href: c.getAttribute('href'),
      label: !!c.querySelector('.news-kicker, .news-stat-kicker'),
      image: !!c.querySelector('.card-media img'),
      credit: c.querySelector('.news-credit')?.textContent?.trim() ?? '',
      stat: c.querySelector('.news-stat-value')?.textContent?.trim() ?? '',
      signal: !!c.querySelector('.news-signal'),
    })),
  );
  expect(cards.length).toBeGreaterThan(2);
  for (const c of cards) {
    expect(c.label, `${c.href}: topic label`).toBe(true);
    expect([c.image, Boolean(c.stat), c.signal].filter(Boolean), `${c.href}: one picture`).toHaveLength(1);
    if (c.image) expect(c.credit, `${c.href}: credit`).toMatch(/^Image: \S/);
  }
  // The point of the change: not every card is the brass signal.
  expect(cards.some((c) => c.image) || cards.some((c) => c.stat)).toBe(true);
});

for (const width of [375, 1280]) {
  test(`the news desk fits at ${width}px and passes axe`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator('section.news-desk').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).include('section.news-desk').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
}
