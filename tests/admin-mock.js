import { readdirSync, readFileSync } from 'node:fs';

// The admin under test: public/_headers read the way Cloudflare Pages reads it, and a pretend GitHub. Shared by headers.spec.js
// (the CSP) and admin-images.spec.js (uploading pictures end to end).

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

export { headersFor, rules };

export const GITHUB_API = 'https://api.github.com';
export const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const GITHUB_STATUS = 'https://www.githubstatus.com';

// The pages as they are in the repository (About, the home page, the listing pages, subscribe, privacy, 404, search): the real
// files, so the tests follow them. Decap reads each from the blob API (base64), by blob sha (About keeps its own).
const PAGES_DIR = new URL('../src/content/pages/', import.meta.url);
export const PAGE_FILES = Object.fromEntries(
  readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => [f, readFileSync(new URL(f, PAGES_DIR), 'utf8').replaceAll('\r\n', '\n')]),
);
export const ABOUT_MD = PAGE_FILES['about.md'];
const ABOUT_SHA = 'aboutfilesha';
const PAGE_BLOBS = Object.fromEntries(
  Object.entries(PAGE_FILES).map(([file, text]) => [file === 'about.md' ? ABOUT_SHA : `page-${file.replace(/\.md$/, '')}-sha`, { path: file, text }]),
);
// The site settings as they are in the repository (src/data/site.json), for the Site settings collection.
export const SITE_JSON = readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const SITE_SHA = 'sitefilesha';

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
  // The page files: Decap finds each blob in the folder's tree, then reads the blob as raw text.
  if (path.includes('/git/trees/') && decodeURIComponent(path).endsWith('src/content/pages')) {
    const tree = Object.entries(PAGE_BLOBS).map(([blob, f]) => ({ path: f.path, type: 'blob', mode: '100644', sha: blob, size: f.text.length }));
    return { sha: sha(), tree, truncated: false };
  }
  if (path.includes('/git/trees/') && decodeURIComponent(path).endsWith('src/data')) {
    return { sha: sha(), tree: [{ path: 'site.json', type: 'blob', mode: '100644', sha: SITE_SHA, size: SITE_JSON.length }], truncated: false };
  }
  if (method === 'GET' && path === `${repo}/git/blobs/${SITE_SHA}`) {
    return { sha: SITE_SHA, encoding: 'base64', content: Buffer.from(SITE_JSON).toString('base64'), size: SITE_JSON.length };
  }
  const blob = method === 'GET' && path.startsWith(`${repo}/git/blobs/`) && PAGE_BLOBS[path.slice(`${repo}/git/blobs/`.length)];
  if (blob) {
    const id = path.slice(`${repo}/git/blobs/`.length);
    return { sha: id, encoding: 'base64', content: Buffer.from(blob.text).toString('base64'), size: blob.text.length };
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
export async function openAdmin(page, { signedIn }) {
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
      try {
        const response = await route.fetch();
        const headers = response.headers();
        if (headers['content-type']?.includes('text/html')) Object.assign(headers, headersFor(url.pathname));
        return await route.fulfill({ response, headers });
      } catch {
        // The test ended while this request was in flight (a picture the live preview was still loading): nothing to answer,
        // and an error thrown here would be reported as a failure of whichever test the worker runs next.
        return;
      }
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
