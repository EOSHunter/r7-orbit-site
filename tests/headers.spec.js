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

test('the sign-in popup keeps its link to the admin: no Cross-Origin-Opener-Policy', () => {
  for (const path of ['/', '/admin/']) expect(headersFor(path)['cross-origin-opener-policy'], path).toBeUndefined();
});

test('only the admin is noindex and uncached, and only it has a CSP', () => {
  const admin = headersFor('/admin/');
  expect(admin['x-robots-tag']).toBe('noindex, nofollow');
  expect(admin['cache-control']).toBe('no-store');
  expect(admin['content-security-policy']).toMatch(/script-src 'self' 'unsafe-eval';/); // Decap's Ajv needs eval; never inline scripts
  expect(admin['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  expect(admin['content-security-policy']).toContain("connect-src 'self' https://api.github.com;");
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

/**
 * Loads /admin/ with the headers from _headers added to the document, and with GitHub stood in for: any other address is
 * refused and recorded. Returns what went wrong: CSP violations (from the browser) and requests the page should not make.
 */
async function openAdmin(page, { signedIn }) {
  const violations = [];
  const refused = [];
  const errors = [];
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
      const path = url.pathname;
      const body =
        path === '/user'
          ? { login: 'tester', name: 'Test Author', avatar_url: 'https://avatars.githubusercontent.com/u/1' }
          : /^\/repos\/[^/]+\/[^/]+$/.test(path)
            ? {
                owner: { login: 'EOSHunter' },
                permissions: { pull: true, push: true },
                default_branch: 'main',
                private: false,
              }
            : /\/git\/trees\//.test(path)
              ? { tree: [], truncated: false }
              : /\/branches\//.test(path)
                ? { name: 'main', commit: { sha: 'abc', commit: { tree: { sha: 'def' } } } }
                : [];
      return route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.hostname === 'avatars.githubusercontent.com')
      return route.fulfill({ body: PIXEL, contentType: 'image/png' });
    refused.push(url.href);
    return route.abort();
  });

  await page.goto('/admin/');
  return { violations, refused, errors };
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
