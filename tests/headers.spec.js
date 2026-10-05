import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// public/_headers is read by Cloudflare Pages, not by `astro preview`. So this file reads it the way Pages does (every block
// whose path matches applies, and a header set by two blocks is sent with both values joined) and checks it:
//   - what each kind of path gets;
//   - that the admin still starts and works with its Content-Security-Policy on, which is the one header that can break a page.

const rules = [];
for (const line of readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  if (/^\S/.test(line)) rules.push({ pattern: line.trim(), headers: [] });
  else {
    const at = line.indexOf(':');
    rules.at(-1).headers.push([line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim()]);
  }
}

const matches = (pattern, path) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(.*)')}$`).test(path);

/** The headers Pages would send for a path, as { name: value }. */
function headersFor(path) {
  const out = {};
  for (const rule of rules.filter((r) => matches(r.pattern, path))) {
    for (const [name, value] of rule.headers) out[name] = out[name] ? `${out[name]}, ${value}` : value;
  }
  return out;
}

test('every page gets the baseline security headers, and no header is set twice', () => {
  for (const path of ['/', '/blog/', '/admin/', '/_astro/x.js']) {
    const h = headersFor(path);
    expect(h['x-content-type-options'], path).toBe('nosniff');
    expect(h['x-frame-options'], path).toBe('SAMEORIGIN');
    expect(h['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
  }
  for (const rule of rules) {
    const names = rule.headers.map(([n]) => n);
    expect(new Set(names).size, `${rule.pattern} repeats a header`).toBe(names.length);
  }
  // Two blocks setting the same header would send both values joined with a comma.
  for (const path of ['/', '/admin/', '/_astro/x.js', '/fonts/x.woff2']) {
    for (const [name, value] of Object.entries(headersFor(path))) {
      expect(value, `${path} ${name}`).not.toMatch(/, (default-src|public|nosniff)/);
    }
  }
});

test('project pages may frame the play origin and nothing else; no other page gets a policy of its own', () => {
  const csp = headersFor('/projects/vesper-drift/')['content-security-policy'];
  expect(csp).toBe('frame-src https://vesper.r7orbit.io');
  // Not script-src, so nothing about scripts is loosened.
  expect(csp).not.toMatch(/script-src|default-src|\*/);
  for (const path of ['/', '/vlogs/x/', '/blog/x/', '/repos/x/']) {
    expect(headersFor(path)['content-security-policy'], path).toBeUndefined();
  }
  // The admin keeps its own policy, unjoined with this one (it needs frame-src 'self' blob: for the live preview).
  expect(headersFor('/admin/')['content-security-policy']).not.toContain('vesper.r7orbit.io');
});

test('the sign-in popup keeps its link to the admin: no Cross-Origin-Opener-Policy', () => {
  for (const path of ['/', '/admin/']) expect(headersFor(path)['cross-origin-opener-policy'], path).toBeUndefined();
});

test('only the admin is noindex and uncached, and only it has a CSP', () => {
  const admin = headersFor('/admin/');
  expect(admin['x-robots-tag']).toBe('noindex, nofollow');
  expect(admin['cache-control']).toBe('no-store');
  const csp = Object.fromEntries(
    admin['content-security-policy']
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .map(([name, ...sources]) => [name, sources]),
  );
  // Scripts: only the bundled editor, plus eval for Decap's Ajv. Never inline, never another host.
  expect(csp['default-src']).toEqual(["'self'"]);
  expect(csp['script-src']).toEqual(["'self'", "'unsafe-eval'"]);
  expect(csp['frame-ancestors']).toEqual(["'none'"]);
  // Where the editor may send data: itself, its own blob: URLs (uploaded images), GitHub's API and status page. Nothing else.
  expect(csp['connect-src']).toEqual(["'self'", 'blob:', 'https://api.github.com', 'https://www.githubstatus.com']);
  expect(csp['img-src']).toEqual([
    "'self'",
    'data:',
    'blob:',
    'https://avatars.githubusercontent.com',
    'https://raw.githubusercontent.com',
  ]);
  expect(admin['content-security-policy'], 'no wildcard hosts').not.toContain('*');
  for (const path of ['/', '/blog/', '/about/']) {
    const h = headersFor(path);
    expect(h['x-robots-tag'], path).toBeUndefined();
    expect(h['content-security-policy'], path).toBeUndefined();
  }
  expect(headersFor('/_astro/app.abc123.js')['cache-control']).toMatch(/immutable/);
});

// ---- The admin under its CSP ----------------------------------------------------------------------------------------

const GITHUB_API = 'https://api.github.com';
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const GITHUB_STATUS = 'https://www.githubstatus.com';

let nextSha = 1;

/** What GitHub answers to the calls the editor makes to list, read and save entries (just enough for it to carry on). */
function githubApi(method, path) {
  const repo = '/repos/EOSHunter/r7-orbit-site';
  const sha = () => `sha${nextSha++}`;
  if (path === '/user') {
    return { login: 'tester', name: 'Test Author', avatar_url: 'https://avatars.githubusercontent.com/u/1' };
  }
  if (path === repo) {
    return { owner: { login: 'EOSHunter' }, permissions: { pull: true, push: true }, default_branch: 'main' };
  }
  if (path.startsWith(`${repo}/branches/`)) {
    return { name: 'main', commit: { sha: 'abc', commit: { tree: { sha: 'def' } } } };
  }
  if (path.startsWith(`${repo}/git/trees`)) return { sha: sha(), tree: [], truncated: false };
  if (path === `${repo}/git/blobs`) return { sha: sha() };
  if (path === `${repo}/git/commits`) return { sha: sha(), tree: { sha: sha() } };
  if (path === `${repo}/git/refs`) return { ref: 'refs/heads/cms/blog/test' };
  if (path === `${repo}/pulls` && method === 'POST') {
    return {
      number: 7,
      state: 'open',
      title: 'Create Blog post',
      head: { ref: 'cms/blog/test', sha: 'abc', repo: { fork: false } },
      base: { ref: 'main' },
      labels: [],
      user: { login: 'tester' },
    };
  }
  if (/\/issues\/\d+\/labels$/.test(path)) return [{ name: 'decap-cms/draft' }];
  return [];
}

/**
 * Loads /admin/ with the headers from _headers added to the document, and with GitHub stood in for: any other address is
 * refused and recorded. Returns what went wrong: CSP violations (from the browser) and requests the page should not make.
 */
async function openAdmin(page, { signedIn }) {
  const violations = [];
  const refused = [];
  const errors = [];
  const calls = [];
  const statusChecks = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content[- ]Security[- ]Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp = [...(window.__csp ?? []), `${e.violatedDirective} ${e.blockedURI}`];
    });
  });
  if (signedIn) {
    await page.addInitScript(() => {
      localStorage.setItem(
        'decap-cms-user',
        JSON.stringify({ backendName: 'github', token: 'test-token', login: 'tester' }),
      );
    });
  }

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      const response = await route.fetch();
      const headers = response.headers();
      if (headers['content-type']?.includes('text/html')) Object.assign(headers, headersFor(url.pathname));
      return route.fulfill({ response, headers });
    }
    if (url.origin === GITHUB_API) {
      const request = route.request();
      const data = request.postData();
      calls.push({ method: request.method(), path: url.pathname, body: data ? JSON.parse(data) : undefined });
      return route.fulfill({
        json: githubApi(request.method(), url.pathname),
        headers: { 'access-control-allow-origin': '*' },
      });
    }
    if (url.origin === GITHUB_STATUS) {
      statusChecks.push(url.pathname);
      return route.fulfill({
        json: { components: [{ name: 'API Requests', status: 'operational' }] },
        headers: { 'access-control-allow-origin': '*' },
      });
    }
    if (url.hostname === 'avatars.githubusercontent.com')
      return route.fulfill({ body: PIXEL, contentType: 'image/png' });
    refused.push(url.href);
    return route.abort();
  });

  await page.goto('/admin/');
  return { violations, refused, errors, calls, statusChecks };
}

test('the admin starts under its CSP and shows the GitHub login, with no violations or stray requests', async ({
  page,
}) => {
  const seen = await openAdmin(page, { signedIn: false });
  await expect(page.getByRole('button', { name: /login with github/i })).toBeVisible();
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('the signed-in editor draws under its CSP (list, new post form, live preview) with no violations', async ({
  page,
}) => {
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  // A new blog post opens the form, the Markdown editor and the preview pane (an iframe the editor fills with styles).
  await page.evaluate(() => (location.hash = '#/collections/blog/new'));
  await expect(page.getByText('Summary', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Title').first().fill('A *test* post');
  await expect(page.locator('iframe').first().contentFrame().getByRole('heading', { level: 1 })).toContainText('test');
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('saving a post with an uploaded image (a blob: URL) works under the admin CSP', async ({ page }) => {
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => (location.hash = '#/collections/blog/new'));
  await page.getByLabel('Title').first().fill('A post with a picture');
  await page.getByLabel('Summary').first().fill('One line about it.');
  await page.locator('[data-slate-editor]').first().fill('Some body text.');

  // The featured image: upload a file in the media library. Decap holds it as a blob: URL until it is saved, and reads
  // that URL back with fetch() to keep a draft backup and to build the commit.
  await page
    .getByRole('button', { name: /choose an image/i })
    .first()
    .click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: PIXEL });
  await page.getByRole('button', { name: /choose selected/i }).click();
  await page.getByRole('button', { name: /^save$/i }).click();

  // Saving in the editorial workflow ends with a pull request, so reaching it means every step before it worked.
  await expect
    .poll(() => seen.calls.some((c) => c.method === 'POST' && c.path.endsWith('/pulls')), { timeout: 15_000 })
    .toBe(true);
  const uploads = seen.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/git/blobs')).map((c) => c.body);
  expect(
    uploads.some((b) => b.content === PIXEL.toString('base64')),
    'the image is uploaded to GitHub',
  ).toBe(true);
  await expect(page.getByText(/failed to persist/i)).toHaveCount(0);
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
  expect(seen.refused, 'requests to other addresses').toEqual([]);
  expect(seen.errors).toEqual([]);
});

test('the editor checks GitHub status every five minutes without breaking the CSP', async ({ page }) => {
  await page.clock.install();
  const seen = await openAdmin(page, { signedIn: true });
  await expect(page.getByText(/blog posts/i).first()).toBeVisible({ timeout: 20_000 });
  await page.clock.fastForward('05:05');
  await expect.poll(() => seen.statusChecks.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__csp ?? []), 'CSP violations').toEqual([]);
  expect(seen.violations).toEqual([]);
});
