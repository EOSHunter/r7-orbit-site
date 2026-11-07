import { readdirSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// A vlog's card shows its cover (the post's picture, with its hover clip); the player on the vlog's page shows its poster
// (a frame of the video). Decided 2026-11-07, when the vlogs got studio images: before, cards showed the poster first.
const dir = new URL('../src/content/vlogs/', import.meta.url);
const field = (text, key) => text.match(new RegExp(String.raw`^${key}:\s*(\S+)`, 'm'))?.[1]?.replace(/^["']|["']$/g, '');
const vlogs = readdirSync(dir)
  .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
  .map((f) => ({ slug: f.replace(/\.mdx?$/, ''), text: readFileSync(new URL(f, dir), 'utf8') }))
  .filter((v) => !/^draft:\s*true/m.test(v.text))
  .map((v) => ({ ...v, cover: field(v.text, 'cover'), poster: field(v.text, 'poster') }))
  .filter((v) => v.cover && v.poster && v.cover !== v.poster);

test('a vlog card shows the cover, and the player on its page shows the poster', async ({ page }) => {
  test.skip(!vlogs.length, 'no published vlog with both a cover and a different poster');
  for (const v of vlogs) {
    await page.goto('/vlogs/');
    const card = page.locator(`a.card[href="/vlogs/${v.slug}/"]`).first();
    await expect(card.locator('.card-media img').first(), `${v.slug}: card picture`).toHaveAttribute('src', v.cover);
    await page.goto(`/vlogs/${v.slug}/`);
    await expect(page.locator('.yt-poster').first(), `${v.slug}: player poster`).toHaveAttribute('src', v.poster);
  }
});
