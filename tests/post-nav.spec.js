import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The foot of a post: "Keep reading" (RelatedPosts) and Older / Newer (PrevNext) show the picture each post's card shows
// (toCard in src/lib/post-cards.ts). Found on Nov 9, 2026: related news cards drew the empty plate, because the related list built
// its own cards and left out a news item's picture (its topic or symbol).

/** A news item with an older and a newer neighbour and at least one news item among its related cards. */
async function newsItemWithNeighbours(page) {
  await page.goto('/news/');
  const hrefs = await page
    .locator('main a[href^="/news/"]')
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href')))].filter((h) => /^\/news\/(?!page\/)[^/]+\/$/.test(h)));
  for (const href of hrefs) {
    await page.goto(href);
    if ((await page.locator('.post-nav a').count()) === 2 && (await page.locator('.related a[href^="/news/"]').count()) > 0) return href;
  }
  throw new Error('no news item has both neighbours and a related news item: this test needs at least three related news items');
}

test('related news cards show the news picture, never the empty plate', async ({ page }) => {
  await page.goto(await newsItemWithNeighbours(page));
  const cards = await page.locator('.related .card').evaluateAll((all) =>
    all.map((c) => ({ href: (c.matches('a[href]') ? c : c.querySelector('a[href]'))?.getAttribute('href') ?? '', signal: !!c.querySelector('.news-signal'), plate: !!c.querySelector('.media-ph') })),
  );
  const news = cards.filter((c) => c.href.startsWith('/news/'));
  expect(news.length, 'related cards of a news item include news').toBeGreaterThan(0);
  for (const c of news) expect(c, c.href).toEqual({ href: c.href, signal: true, plate: false });
});

for (const width of [375, 1280]) {
  test(`older and newer each show a square thumbnail beside the title at ${width}px, newer mirrored`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(await newsItemWithNeighbours(page));
    const links = page.locator('.post-nav a');
    await expect(links).toHaveCount(2);
    for (const rel of ['prev', 'next']) {
      const link = page.locator(`.post-nav a[rel="${rel}"]`);
      const thumb = link.locator('.post-thumb');
      await expect(thumb).toHaveCount(1);
      await expect(thumb.locator('.news-signal')).toHaveCount(1);
      await expect(thumb.locator('.media-ph')).toHaveCount(0);
      const t = await thumb.boundingBox();
      const text = await link.locator('.post-nav-text').boundingBox();
      expect(Math.abs(t.width - t.height), 'square').toBeLessThan(1.5);
      if (rel === 'prev') expect(t.x + t.width, 'older: picture on the left').toBeLessThanOrEqual(text.x + 1);
      else expect(t.x, 'newer: picture on the right').toBeGreaterThanOrEqual(text.x + text.width - 1);
      await expect(link.locator('time.post-nav-date')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('a news item whose neighbour is also a related card has unique ids and passes axe', async ({ page }) => {
  await page.goto(await newsItemWithNeighbours(page));
  const ids = await page.locator('[id]').evaluateAll((els) => els.map((e) => e.id));
  expect(ids.filter((id, i) => ids.indexOf(id) !== i), 'ids used twice').toEqual([]);
  const results = await new AxeBuilder({ page }).include('.related').include('.post-nav').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
});
