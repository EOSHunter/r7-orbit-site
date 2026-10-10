import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openAdmin } from './admin-mock.js';

// The brand blocks of an article (agent cards, orbit diagram, stat dial, the ringed pull quote, the orbit divider) in the real
// editor, under its Content-Security-Policy, with GitHub stood in for (tests/admin-mock.js): the lines exactly as they are in the
// published post read back as editor blocks, not as raw text, and the live preview draws them with the components' own markup
// (src/lib/article-brand.ts). docs/ARTICLE_COMPONENTS.md, docs/IMAGE_STYLE.md section 8.3.

const POST = 'src/content/blog/so-youve-got-an-ai-that-writes-code-cool-what-if-you-had-ten.mdx';
const BRAND = /^<(?:(?:AgentCards|OrbitDiagram|StatDial|Pullquote)\b|Divider variant="orbit")/;
const lines = readFileSync(POST, 'utf8')
  .split(/\r?\n/)
  .filter((line) => BRAND.test(line));

test('the post\'s brand blocks open as editor blocks, and the preview draws them', async ({ page }) => {
  expect(lines.length, 'brand blocks in the post').toBeGreaterThanOrEqual(5);
  await page.setViewportSize({ width: 1400, height: 1800 });
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/blog/new'));
  await page.getByLabel('Title').first().fill('Brand blocks');
  await page.getByLabel('Summary').first().fill('One line about it.');

  // Paste the post's own lines into the Body as Markdown, then back to rich text: Decap reads each through its block's pattern.
  // Decap's mode switch has no accessible name of its own, so it is found inside the Body field.
  const body = page.locator('[aria-label="markdown field"]').filter({ hasText: 'Body' });
  await body.getByRole('switch').click();
  await body.getByRole('textbox').fill(lines.join('\n\n'));
  await body.getByRole('switch').click();

  for (const label of ['Agent cards', 'Orbit diagram', 'Stat dial', 'Pull quote', 'Divider']) {
    await expect(page.getByText(label, { exact: true }).first(), label).toBeVisible({ timeout: 15_000 });
  }

  const frame = page.locator('iframe').first().contentFrame();
  const cards = lines.filter((l) => l.startsWith('<AgentCards')).map((l) => JSON.parse(/cards=\{(\[.*?\])\}/.exec(l)[1]).length);
  await expect(frame.locator('.art-agent')).toHaveCount(cards.reduce((a, b) => a + b, 0), { timeout: 15_000 });
  await expect(frame.locator('.art-orbit-agent')).toHaveCount(8);
  await expect(frame.locator('.art-orbit-name')).toHaveText('lumen');
  await expect(frame.locator('.art-stat-value').first()).toHaveText('17s');
  await expect(frame.locator('.art-ring')).toHaveText('mission control');
  await expect(frame.locator('.art-divider[data-variant="orbit"] svg')).toHaveCount(1);
  // What an agent reported keeps its code spans.
  await expect(frame.locator('.art-agent-report code').first()).toBeVisible();

  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
});
