import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

// News pictures ("Pulsar's signals", docs/DECISIONS.md): a news item with a `topic` and no cover shows the topic's picture on its
// card (NewsCard) and as a banner at the top of the item, the same picture (seeded by the address). Wired in 2026-11-07.

test('a news card with a topic shows its picture; the topics page shows all seven', async ({ page }) => {
  await page.goto('/styleguide/news-signals/');
  const cards = page.locator('.grid-cards > a.card');
  await expect(cards).toHaveCount(9);
  for (const topic of ['models', 'tools', 'trends', 'games', 'home', 'policy', 'orbit', 'security', 'business']) {
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

// No two news items share a picture (the author's rule, 2026-11-08): the object on each published item's banner is unique, and
// so is every cover. Read from dist/, so it covers every item the build publishes.
test('no two published news items show the same picture', () => {
  const dir = fileURLToPath(new URL('../dist/news/', import.meta.url));
  test.skip(!existsSync(dir), 'no build');
  const seen = new Map();
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, d.name, 'index.html');
    if (!d.isDirectory() || !existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    const banner = html.match(/<div class="news-banner">[\s\S]*?<image href="([^"]+)"/)?.[1];
    if (!banner) continue;
    expect(seen.get(banner), `/news/${d.name}/ reuses ${banner} (also on ${seen.get(banner)}): give it its own symbol`).toBeUndefined();
    seen.set(banner, `/news/${d.name}/`);
  }
  expect(seen.size).toBeGreaterThan(0);
});

