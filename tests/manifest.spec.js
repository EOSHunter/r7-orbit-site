import { test, expect } from '@playwright/test';

// The web app manifest is linked by src/scripts/site.js a second after load, not from the HTML: linked from the head, Chrome
// fetches it and its 192 px icon during the first paint, which counts against the LCP budget (docs/DECISIONS.md, "LCP on the
// author pages and long posts"). Once it is linked, the page has the same <link rel="manifest"> as before.

test('the manifest is not in the HTML and is linked about a second after load', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  expect(html).not.toMatch(/<link[^>]*rel="manifest"/);

  await page.goto('/', { waitUntil: 'load' });
  const link = page.locator('head link[rel="manifest"]');
  await expect(link, 'not linked at load').toHaveCount(0);
  const loaded = Date.now();
  await expect(link).toHaveAttribute('href', '/site.webmanifest', { timeout: 5000 });
  expect(Date.now() - loaded, 'linked after a pause, not at once').toBeGreaterThan(300);
  await expect(link).toHaveCount(1);

  const manifest = await request.get('/site.webmanifest');
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).icons.length).toBeGreaterThan(0);
});
