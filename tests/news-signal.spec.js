import { test, expect } from '@playwright/test';

// News pictures ("Pulsar's signals", docs/DECISIONS.md): a news item with a `topic` and no cover shows the topic's picture on its
// card (NewsCard) and as a banner at the top of the item, the same picture (seeded by the address). Wired in 2026-11-07.

test('a news card with a topic shows its picture; the topics page shows all seven', async ({ page }) => {
  await page.goto('/styleguide/news-signals/');
  const cards = page.locator('.grid-cards > a.card');
  await expect(cards).toHaveCount(7);
  for (const topic of ['models', 'tools', 'trends', 'games', 'home', 'policy', 'orbit']) {
    const card = page.locator(`a.card[href="/news/sample-${topic}/"]`);
    await expect(card.locator('.card-media svg.news-signal image')).toHaveAttribute('href', `/media/news/topics/${topic}.webp`);
  }
  const sprite = await page.request.get('/media/news/topics/models.webp');
  expect(sprite.ok()).toBe(true);
});

test('a news item with a topic opens with the same picture as a banner, above the source box', async ({ page }) => {
  await page.goto('/styleguide/posts/news/');
  const banner = page.locator('.news-banner svg.news-signal-banner');
  await expect(banner).toHaveCount(1);
  await expect(banner.locator('image')).toHaveAttribute('href', '/media/news/topics/models.webp');
  const [b, src] = await Promise.all([page.locator('.news-banner').boundingBox(), page.locator('.source-box').boundingBox()]);
  expect(b.y).toBeLessThan(src.y);
  expect(Math.round(b.width / b.height)).toBe(4);
});
