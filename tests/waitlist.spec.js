import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TURNSTILE_TEST_SITE_KEY } from '../src/lib/waitlist.ts';

// The waitlist (docs/PAGES.md "Waitlist"). Two halves, for what the build draws (src/lib/waitlist.ts, waitlistState):
// - the waitlist off in Site settings: no page has any of it, and /waitlist/remove/ does not exist;
// - the forms drawn: in a WAITLIST_PREVIEW=1 build (forced on with Cloudflare's test key; CI runs this file again after one:
//   WAITLIST_PREVIEW=1 npm run build && npx playwright test tests/waitlist.spec.js), or in a normal build once the author has
//   turned the waitlist on with the widget's own site key. The forms are tested with whichever key the build put in them.
// Nothing leaves the machine: Turnstile's script is answered by a fake that hands out tokens, and /api/* by the test (astro
// preview serves no Pages Functions; the endpoints are tested in src/lib/waitlist-api.vitest.ts).

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const removePage = join(dist, 'waitlist', 'remove', 'index.html');
/** The build draws the forms (the remove page exists only then). */
const preview = existsSync(removePage);
/** The Turnstile site key the forms carry: Cloudflare's test key in a WAITLIST_PREVIEW=1 build, the settings' own otherwise. */
const SITE_KEY = preview ? readFileSync(removePage, 'utf8').match(/data-sitekey="([^"]+)"/)?.[1] : undefined;
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const site = JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8'));
const words = site.waitlist;

/** Every public HTML file of dist/ (not the editor). */
function htmlFiles(dir = dist, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory())
      return prefix === '' && e.name === 'admin' ? [] : htmlFiles(join(dir, e.name), `${prefix}${e.name}/`);
    return e.name.endsWith('.html') ? [`${prefix}${e.name}`] : [];
  });
}

test.describe('with the waitlist off (the normal build)', () => {
  test.skip(preview, 'this build draws the waitlist forms');

  test('no page carries the form, its styles, its script or Turnstile', () => {
    const files = htmlFiles();
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const html = readFileSync(join(dist, file), 'utf8');
      expect(html, file).not.toMatch(
        /data-waitlist|class="waitlist|challenges\.cloudflare\.com|\/api\/waitlist|turnstile/i,
      );
    }
  });

  test('/waitlist/remove/ does not exist', async ({ page }) => {
    const response = await page.goto('/waitlist/remove/');
    expect(response?.status()).toBe(404);
  });
});

test.describe('with the waitlist on (WAITLIST_PREVIEW=1, or on in Site settings)', () => {
  test.skip(!preview, 'needs a build that draws the forms: WAITLIST_PREVIEW=1 npm run build');

  test('every form carries the key the build was made with: the test key in a preview build, else the settings key', () => {
    expect([TURNSTILE_TEST_SITE_KEY, site.waitlist.turnstileSiteKey.trim()]).toContain(SITE_KEY);
    for (const file of htmlFiles()) {
      for (const [, key] of readFileSync(join(dist, file), 'utf8').matchAll(/data-sitekey="([^"]*)"/g)) expect(key, file).toBe(SITE_KEY);
    }
  });

  /** Answers Turnstile's script with a fake widget (tokens "token-1", "token-2", …), and records every request to Cloudflare. */
  async function fakeTurnstile(page) {
    const hits = [];
    await page.route('https://challenges.cloudflare.com/**', (route) => {
      hits.push(route.request().url());
      return route.fulfill({
        contentType: 'text/javascript',
        body: `(function () {
          var n = 0, widgets = [];
          window.turnstile = {
            render: function (el, opts) { widgets.push(opts); window.__turnstileOptions = opts; var id = widgets.length - 1;
              setTimeout(function () { opts.callback('token-' + (++n)); }, 20); return id; },
            reset: function (id) { var opts = widgets[id]; setTimeout(function () { opts.callback('token-' + (++n)); }, 20); },
            getResponse: function () { return undefined; }
          };
        })();`,
      });
    });
    return hits;
  }

  /** Answers an endpoint with `status` and `body`, after `delay` ms, and records what was posted. */
  async function answer(page, path, { status = 200, body = { ok: true }, delay = 0 } = {}) {
    const posts = [];
    await page.route(`**${path}`, async (route) => {
      posts.push(route.request());
      if (delay) await new Promise((r) => setTimeout(r, delay));
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    return posts;
  }

  const hero = (page) => page.locator('.hero [data-waitlist]');

  test('the home page asks Cloudflare for nothing until the reader comes to the form', async ({ page }) => {
    const hits = await fakeTurnstile(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    expect(hits).toEqual([]);
    await page.locator('#waitlist-hero-email').focus();
    await expect.poll(() => hits.length).toBe(1);
    expect(hits[0]).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    const options = await page.evaluate(() => {
      const o = window.__turnstileOptions;
      return { sitekey: o.sitekey, appearance: o.appearance, action: o.action, responseField: o['response-field'] };
    });
    expect(options).toEqual({
      sitekey: SITE_KEY,
      appearance: 'interaction-only',
      action: 'waitlist',
      responseField: false,
    });
  });

  test('a post band loads Turnstile when the reader scrolls to it, not before', async ({ page }) => {
    const hits = await fakeTurnstile(page);
    await page.goto('/styleguide/posts/blog/');
    await page.waitForLoadState('networkidle');
    expect(hits).toEqual([]);
    await page.locator('.waitlist-band').scrollIntoViewIfNeeded();
    await expect.poll(() => hits.length).toBe(1);
  });

  test('joining: the address, source, honeypot and token are sent; success shows only on { ok: true }; the box is cleared', async ({
    page,
  }) => {
    await fakeTurnstile(page);
    const posts = await answer(page, '/api/waitlist', { delay: 400 });
    await page.goto('/');
    await page.fill('#waitlist-hero-email', 'reader@example.com');
    const button = hero(page).locator('button[type="submit"]');
    await button.click();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(hero(page).locator('[data-waitlist-status]')).toHaveText(words.successMessage);
    await expect(button).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#waitlist-hero-email')).toHaveValue('');
    expect(posts).toHaveLength(1);
    expect(posts[0].method()).toBe('POST');
    const body = new URLSearchParams(posts[0].postData() ?? '');
    expect(Object.fromEntries(body)).toEqual({
      email: 'reader@example.com',
      company: '',
      source: 'hero',
      'cf-turnstile-response': 'token-1',
    });
    // The token is used once: the next send carries a fresh one.
    await page.fill('#waitlist-hero-email', 'second@example.com');
    await button.click();
    await expect.poll(() => posts.length).toBe(2);
    expect(new URLSearchParams(posts[1].postData() ?? '').get('cf-turnstile-response')).toBe('token-2');
  });

  for (const [what, reply, shown] of [
    [
      'a server error',
      { status: 500, body: { ok: false, message: 'Your address could not be saved.' } },
      words.errorMessage,
    ],
    ['a 503 with no message', { status: 503, body: { ok: false } }, words.errorMessage],
    ['a 200 that is not ok', { status: 200, body: { ok: false } }, words.errorMessage],
    ['a 200 that is not JSON', { status: 200, body: 'ok' }, words.errorMessage],
    [
      'a 400 with its message',
      { status: 400, body: { ok: false, message: 'Please enter a valid email address.' } },
      'Please enter a valid email address.',
    ],
  ]) {
    test(`never says it worked after ${what}`, async ({ page }) => {
      await fakeTurnstile(page);
      await answer(page, '/api/waitlist', reply);
      await page.goto('/');
      await page.fill('#waitlist-hero-email', 'reader@example.com');
      await hero(page).locator('button[type="submit"]').click();
      const status = hero(page).locator('[data-waitlist-status]');
      await expect(status).toHaveText(shown);
      await expect(status).toHaveAttribute('data-tone', 'error');
      await expect(page.locator('#waitlist-hero-email')).toHaveValue('reader@example.com');
    });
  }

  test('a network failure, or Turnstile not loading, shows the error message', async ({ page }) => {
    await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
    await page.goto('/');
    await page.fill('#waitlist-hero-email', 'reader@example.com');
    await hero(page).locator('button[type="submit"]').click();
    await expect(hero(page).locator('[data-waitlist-status]')).toHaveText(words.errorMessage);

    await page.unroute('https://challenges.cloudflare.com/**');
    await fakeTurnstile(page);
    await page.route('**/api/waitlist', (route) => route.abort());
    await page.goto('/');
    await page.fill('#waitlist-hero-email', 'reader@example.com');
    await hero(page).locator('button[type="submit"]').click();
    await expect(hero(page).locator('[data-waitlist-status]')).toHaveText(words.errorMessage);
  });

  test('the browser refuses an empty or malformed address before anything is sent', async ({ page }) => {
    await fakeTurnstile(page);
    const posts = await answer(page, '/api/waitlist');
    await page.goto('/');
    const button = hero(page).locator('button[type="submit"]');
    await button.click();
    await page.fill('#waitlist-hero-email', 'not an address');
    await button.click();
    await page.waitForTimeout(300);
    expect(posts).toEqual([]);
    expect(await page.locator('#waitlist-hero-email').evaluate((el) => el.validity.valid)).toBe(false);
  });

  test('the form: a labelled box with no example address, a live status line, a hidden honeypot, 44px targets', async ({
    page,
  }) => {
    await page.goto('/');
    const form = hero(page);
    const input = page.locator('#waitlist-hero-email');
    await expect(page.locator('label[for="waitlist-hero-email"]')).toHaveText(words.emailLabel);
    await expect(input).toHaveAttribute('type', 'email');
    await expect(input).toHaveAttribute('autocomplete', 'email');
    expect(await page.locator('[data-waitlist] [placeholder]').count()).toBe(0);
    await expect(form.locator('[data-waitlist-status]')).toHaveAttribute('role', 'status');
    await expect(form.locator('input[name="company"]')).toBeHidden();
    await expect(form.locator('button[type="submit"]')).toHaveText(words.buttonLabel);
    await expect(form.locator('a.waitlist-remove')).toHaveAttribute('href', '/waitlist/remove/');
    await expect(form.locator('a.waitlist-remove')).toHaveText(words.removeLinkLabel);
    for (const target of [input, form.locator('button[type="submit"]'), form.locator('a.waitlist-remove')]) {
      expect((await target.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    // Tab goes from the box to the button, never into the honeypot.
    await input.focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('type'))).toBe('submit');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('name'))).not.toBe('company');
  });

  test('without JavaScript the reader sees the noscript sentence, not a form that cannot work', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.hero .waitlist-nojs')).toBeVisible();
    await expect(page.locator('.hero .waitlist-nojs')).toHaveText(words.noscriptMessage);
    await expect(page.locator('.hero .waitlist-form')).toBeHidden();
    await context.close();
  });

  const kinds = [
    ['blog', 'blog'],
    ['news', 'blog'],
    ['vlogs', 'vlog'],
    ['projects', 'other'],
    ['repos', 'other'],
  ];
  for (const [kind, source] of kinds) {
    test(`a ${kind} post that asks for it ends with the band (source "${source}"), after the body and before related posts`, async ({
      page,
    }) => {
      await fakeTurnstile(page);
      const posts = await answer(page, '/api/waitlist');
      await page.goto(`/styleguide/posts/${kind}/`);
      const band = page.locator('section.waitlist-band');
      await expect(band).toHaveCount(1);
      await expect(band.locator('h2')).toHaveText(words.heading.replace(/\*/g, ''));
      await expect(band.locator('.waitlist-text')).toHaveText(words.text);
      // After the post's own content, before related posts and previous/next, whichever the page has.
      const order = await page.evaluate(() => {
        const main = document.querySelector('main');
        const at = (el) => (el ? [...main.querySelectorAll('*')].indexOf(el) : -1);
        const band = document.querySelector('.waitlist-band');
        const body = document.querySelector('#article, .split, .sections');
        const after = [
          document.querySelector('[aria-labelledby="related-h"]'),
          document.querySelector('.post-nav'),
        ].filter(Boolean);
        return { band: at(band), body: at(body), after: after.map(at) };
      });
      expect(order.band).toBeGreaterThan(order.body);
      for (const index of order.after) expect(order.band).toBeLessThan(index);
      await band.locator('input[type="email"]').fill('reader@example.com');
      await band.locator('button[type="submit"]').click();
      await expect(band.locator('[data-waitlist-status]')).toHaveText(words.successMessage);
      expect(new URLSearchParams(posts[0].postData() ?? '').get('source')).toBe(source);
    });
  }

  // The author's two posts that ask for the band (src/content/: `waitlist: true` and nothing else changed), and two that do not.
  const BLOG = '/blog/so-youve-got-an-ai-that-writes-code-cool-what-if-you-had-ten/';
  const VLOG = '/vlogs/so-youve-got-an-ai-that-writes-code-cool-what-if-you-had-ten/';
  for (const [path, source] of [
    [BLOG, 'blog'],
    [VLOG, 'vlog'],
  ]) {
    test(`${path} ends with the band (source "${source}") before related posts, and asks Cloudflare for nothing until the reader scrolls`, async ({
      page,
    }) => {
      const hits = await fakeTurnstile(page);
      const posts = await answer(page, '/api/waitlist');
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(hits).toEqual([]);
      const band = page.locator('section.waitlist-band');
      await expect(band).toHaveCount(1);
      const order = await page.evaluate(() => {
        const all = [...document.querySelectorAll('main *')];
        const at = (el) => (el ? all.indexOf(el) : -1);
        return {
          band: at(document.querySelector('.waitlist-band')),
          body: at(document.querySelector('#article, .split')),
          after: [document.querySelector('[aria-labelledby="related-h"]'), document.querySelector('.post-nav')]
            .filter(Boolean)
            .map(at),
        };
      });
      expect(order.band).toBeGreaterThan(order.body);
      for (const index of order.after) expect(order.band).toBeLessThan(index);
      await band.scrollIntoViewIfNeeded();
      await expect.poll(() => hits.length).toBe(1);
      await band.locator('input[type="email"]').fill('reader@example.com');
      await band.locator('button[type="submit"]').click();
      await expect(band.locator('[data-waitlist-status]')).toHaveText(words.successMessage);
      expect(new URLSearchParams(posts[0].postData() ?? '').get('source')).toBe(source);
    });
  }

  for (const path of ['/blog/test/', '/vlogs/building-a-browser-game-with-ai-agents-in-r7-orbit/']) {
    test(`${path} does not ask for the band, and has none`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('[data-waitlist]')).toHaveCount(0);
    });
  }

  test('the waitlist block draws the band with the source the author chose (the block gallery: source "other")', async ({
    page,
  }) => {
    await fakeTurnstile(page);
    const posts = await answer(page, '/api/waitlist');
    await page.goto('/styleguide/sections/');
    const block = page.locator('.sec-row-band section.waitlist-band');
    await expect(block).toHaveCount(1);
    await expect(block.locator('input[type="email"]')).toHaveAttribute('id', /^waitlist-sec-\d+-email$/);
    await block.locator('input[type="email"]').fill('reader@example.com');
    await block.locator('button[type="submit"]').click();
    await expect(block.locator('[data-waitlist-status]')).toHaveText(words.successMessage);
    expect(new URLSearchParams(posts[0].postData() ?? '').get('source')).toBe('other');
  });

  test(`${BLOG}: no layout shift while the page loads, nor when the band answers`, async ({ page }) => {
    await fakeTurnstile(page);
    await answer(page, '/api/waitlist', { delay: 800 });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts.push(e.value);
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(BLOG);
    await page.waitForLoadState('networkidle');
    const band = page.locator('section.waitlist-band');
    await band.scrollIntoViewIfNeeded();
    const next = page.locator('section.waitlist-band ~ *').first();
    const before = await next.boundingBox();
    await band.locator('input[type="email"]').fill('reader@example.com');
    await band.locator('button[type="submit"]').click();
    await expect(band.locator('[data-waitlist-status]')).toHaveText(words.successMessage);
    expect(await next.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => window.__shifts.reduce((a, b) => a + b, 0))).toBeLessThan(0.005);
  });

  test('the remove page posts to /api/waitlist-remove, sends no source, and says the neutral sentence', async ({
    page,
  }) => {
    await fakeTurnstile(page);
    const posts = await answer(page, '/api/waitlist-remove');
    await page.goto('/waitlist/remove/');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toHaveText(words.removeHeading);
    await page.fill('#waitlist-remove-email', 'reader@example.com');
    await page.locator('[data-waitlist] button[type="submit"]').click();
    await expect(page.locator('[data-waitlist-status]')).toHaveText(words.removeSuccessMessage);
    const body = Object.fromEntries(new URLSearchParams(posts[0].postData() ?? ''));
    expect(body).toEqual({ email: 'reader@example.com', company: '', 'cf-turnstile-response': 'token-1' });
    expect(await page.evaluate(() => window.__turnstileOptions.action)).toBe('waitlist-remove');
    await expect(page.locator('a.waitlist-remove')).toHaveCount(0);
  });

  test('the remove page is in neither the sitemap nor the search index', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    expect(sitemap).not.toContain('/waitlist/');
    expect(readFileSync('pagefind.yml', 'utf8')).not.toMatch(/waitlist/);
  });

  for (const path of ['/', '/waitlist/remove/', '/styleguide/posts/vlogs/', BLOG, VLOG, '/styleguide/sections/']) {
    test(`${path}: no axe violations, and no sideways scroll from 320 to 1480px`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(tags).include('[data-waitlist]').analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
      for (const width of [320, 375, 768, 1280, 1480]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px`).toBe(
          true,
        );
      }
    });
  }

  test('the floating Turnstile box shifts nothing when Cloudflare asks the reader to tick it', async ({ page }) => {
    await fakeTurnstile(page);
    await page.goto('/');
    await page.locator('#waitlist-hero-email').focus();
    await page.waitForFunction(() => window.__turnstileOptions);
    const below = page.locator('main section.hero ~ *').first();
    const before = await below.boundingBox();
    await page.evaluate(() => window.__turnstileOptions['before-interactive-callback']());
    const slot = page.locator('.hero [data-waitlist-challenge]');
    await expect(slot).toHaveAttribute('data-open', '');
    expect(await below.boundingBox()).toEqual(before);
    await page.evaluate(() => window.__turnstileOptions['after-interactive-callback']());
    await expect(slot).not.toHaveAttribute('data-open', '');
  });
});
