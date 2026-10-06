import { test, expect } from '@playwright/test';

// /admin is the content manager: reachable by URL only, never indexed, never listed. (Its editor needs a GitHub sign-in or
// the local proxy, so what runs here is the login screen. tests/headers.spec.js covers the admin under its CSP.)

test('admin page is noindex, shows the GitHub login and makes no third-party request on load', async ({ page }) => {
  const external = [];
  page.on('request', (req) => {
    if (!req.url().startsWith('http://127.0.0.1')) external.push(req.url());
  });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  const res = await page.goto('/admin/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.getByRole('button', { name: /login with github/i })).toBeVisible();
  expect(external, 'no third-party requests').toEqual([]);
  expect(errors).toEqual([]);
});

test('the site never links to the admin', async ({ page }) => {
  for (const path of ['/', '/about/', '/blog/']) {
    await page.goto(path);
    await expect(page.locator('a[href^="/admin"]'), path).toHaveCount(0);
  }
});

test('admin stays out of robots and the sitemap', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/^Disallow: \/admin\/$/m);

  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).not.toMatch(/\/admin\//);
});
