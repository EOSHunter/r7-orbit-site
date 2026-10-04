import { test, expect } from '@playwright/test';

// /admin is the content manager: reachable by URL only, never indexed, never listed. (Its editor needs a sign-in or the
// local proxy, so what runs here is what a production build does without PUBLIC_CMS_AUTH_URL: say so, and stay quiet.)

test('admin page is noindex and says sign-in is not set up', async ({ page }) => {
  const external = [];
  page.on('request', (req) => {
    if (!req.url().startsWith('http://127.0.0.1')) external.push(req.url());
  });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  const res = await page.goto('/admin/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('#admin-unconfigured')).toBeVisible();
  expect(external, 'no third-party requests').toEqual([]);
  expect(errors).toEqual([]);
});

test('the site never links to the admin', async ({ page }) => {
  for (const path of ['/', '/about/', '/blog/']) {
    await page.goto(path);
    await expect(page.locator('a[href^="/admin"]'), path).toHaveCount(0);
  }
});

test('admin stays out of robots, sitemap and feeds', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/^Disallow: \/admin\/$/m);

  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).not.toMatch(/\/admin\//);

  for (const path of ['/rss.xml', '/blog/rss.xml', '/news/rss.xml']) {
    expect(await (await request.get(path)).text(), path).not.toMatch(/\/admin\//);
  }
});
