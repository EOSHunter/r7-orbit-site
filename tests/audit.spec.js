import { test, expect } from '@playwright/test';
import routes, { articlePaths } from './routes.js';

// Phase 7 checks that go beyond the smoke test: layout at every width, head tags, JSON-LD, links, heading order.
const widths = [320, 375, 768, 1024, 1280, 1480];

for (const route of routes) {
  test(`layout ${route.path}`, async ({ page }) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route.path, { waitUntil: 'networkidle' });
      const issues = await page.evaluate(() => {
        const out = [];
        const view = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth > view) out.push('horizontal scroll');
        // Elements poking out of the viewport, unless they sit inside a scroller (code blocks, tables, frames).
        for (const el of document.body.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= view + 1) continue;
          let p = el.parentElement;
          let scrolls = false;
          while (p && p !== document.body) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') scrolls = true;
            if (getComputedStyle(p).position === 'fixed') scrolls = true;
            p = p.parentElement;
          }
          const cs = getComputedStyle(el);
          if (!scrolls && cs.position !== 'fixed' && cs.visibility !== 'hidden' && cs.display !== 'none') {
            out.push(`overflows: <${el.tagName.toLowerCase()} class="${el.className}">`);
            if (out.length > 5) break;
          }
        }
        // Tap targets: visible controls at least 24x24 CSS px (WCAG 2.5.8); axe's target-size rule covers spacing for small links.
        for (const el of document.querySelectorAll(
          'button, [role=button], input:not([type=hidden]), select, summary, a.btn, a.chip',
        )) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.width < 24 || r.height < 24)
            out.push(`small target ${Math.round(r.width)}x${Math.round(r.height)}: ${el.outerHTML.slice(0, 80)}`);
        }
        return out;
      });
      expect(issues, `${width}px`).toEqual([]);
    }
  });

  test(`head, links and headings ${route.path}`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'networkidle' });
    const info = await page.evaluate(() => {
      const q = (s) => document.querySelector(s)?.getAttribute('content') ?? null;
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? '');
      const links = [...document.querySelectorAll('a')].map((a) => ({
        href: a.getAttribute('href'),
        name:
          (a.textContent ?? '').trim() ||
          a.getAttribute('aria-label') ||
          a.querySelector('img[alt]')?.getAttribute('alt') ||
          '',
      }));
      const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
      return {
        ogTitle: q('meta[property="og:title"]'),
        ogDesc: q('meta[property="og:description"]'),
        ogUrl: q('meta[property="og:url"]'),
        ogImage: q('meta[property="og:image"]'),
        ogAlt: q('meta[property="og:image:alt"]'),
        twitter: q('meta[name="twitter:card"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
        ld,
        links,
        levels,
        skip: document.querySelector('a[href="#main"]') !== null,
        main: document.querySelectorAll('main#main').length,
      };
    });

    expect(info.ogTitle, 'og:title').toBeTruthy();
    expect(info.ogDesc, 'og:description').toBeTruthy();
    expect(info.ogUrl, 'og:url is absolute').toMatch(/^https?:\/\//);
    expect(info.ogImage, 'og:image is absolute').toMatch(/^https?:\/\//);
    // The brand image always has alt text. A post's own image with no alt text (allowed: "" marks it decorative) gets no
    // og:image:alt rather than a wrong one (resolveSeo in src/lib/seo.ts).
    if (/\/og-default\.png$/.test(info.ogImage ?? '')) expect(info.ogAlt, 'og:image:alt').toBeTruthy();
    expect(info.twitter, 'twitter:card').toBeTruthy();
    expect(info.canonical, 'canonical is absolute').toMatch(/^https?:\/\//);
    expect(info.ogTitle, 'no * markers in og:title').not.toContain('*');
    expect(info.skip, 'skip link').toBe(true);
    expect(info.main, 'one <main id="main">').toBe(1);

    // noindex pages (404, styleguide) carry no structured data.
    if (!route.noindex) expect(info.ld.length, 'JSON-LD blocks').toBeGreaterThan(0);
    for (const block of info.ld) {
      const data = JSON.parse(block);
      const nodes = Array.isArray(data) ? data : (data['@graph'] ?? [data]);
      for (const n of nodes) expect(n['@type'], 'JSON-LD @type').toBeTruthy();
    }

    for (const l of info.links) {
      expect(l.href, 'link has an href').toBeTruthy();
      if (!route.noindex) expect(l.href, `no placeholder href (${l.name})`).not.toMatch(/^#?$|^javascript:/); // the specimen's sample cards use #
      expect(l.name, `link ${l.href} has an accessible name`).not.toBe('');
      expect(l.href, 'owner has no GitHub profile link').not.toMatch(/^https?:\/\/(www\.)?github\.com\/[^/]+\/?$/);
    }

    // Heading order: never skip a level going down.
    for (let i = 1; i < info.levels.length; i++) {
      expect(info.levels[i] - info.levels[i - 1], `heading order ${info.levels.join(',')}`).toBeLessThanOrEqual(1);
    }
  });
}

// Print: a post prints as plain text on paper, with no site chrome.
test('print stylesheet for a post', async ({ page }) => {
  test.skip(articlePaths.length === 0, 'no blog post or news item is published yet');
  await page.goto(articlePaths[0], { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  const hidden = await page.evaluate(() =>
    ['.site-header', '.site-footer', '.share'].map((s) => {
      const el = document.querySelector(s);
      return [s, !el || getComputedStyle(el).display === 'none'];
    }),
  );
  expect(
    hidden.filter(([, ok]) => !ok).map(([s]) => s),
    'chrome still visible in print',
  ).toEqual([]);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg, 'paper background in print').toMatch(/^rgba?\(255, 255, 255|rgba\(0, 0, 0, 0\)/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(overflow, 'no horizontal overflow in print').toBe(true);
});

// Forced colors (Windows high contrast): nothing overflows and the page still has its landmarks.
test('forced colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  for (const path of ['/', ...articlePaths.slice(0, 1), '/privacy/']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const ok = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(ok, `${path} overflows in forced colors`).toBe(true);
    await expect(page.locator('main#main')).toBeVisible();
  }
});
