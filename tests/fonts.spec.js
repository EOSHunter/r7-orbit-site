import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// The self-hosted fonts (src/styles/design-system/tokens.css, docs/DECISIONS.md "Fonts"): each face is split in a "core" file
// (ASCII and the punctuation the site prints) and a "rest" file (the other Latin letters and symbols) by unicode-range, so a page
// downloads the rest only when its text needs it. That split is worth about a third of the font bytes on every page (LCP).

const css = readFileSync(new URL('../src/styles/design-system/tokens.css', import.meta.url), 'utf8');
const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)]
  .map((m) => m[1])
  .filter((body) => /url\('\/fonts\//.test(body))
  .map((body) => ({
    key: ['font-family', 'font-style', 'font-weight']
      .map((p) => new RegExp(`${p}:\\s*([^;]+);`).exec(body)?.[1].trim())
      .join(' | '),
    url: /url\('([^']+)'\)/.exec(body)[1],
    range: /unicode-range:\s*([^;]+);/.exec(body)?.[1],
  }));

/** 'U+0020-007E, U+00A0' -> the code points. */
const codePoints = (range) =>
  range.split(',').flatMap((part) => {
    const [a, b = a] = part.trim().replace(/^U\+/i, '').split('-');
    const from = parseInt(a, 16);
    return Array.from({ length: parseInt(b, 16) - from + 1 }, (_, i) => from + i);
  });

test('every face is a core file and a rest file whose unicode-ranges do not overlap, and the files exist', () => {
  const byFace = Map.groupBy(faces, (f) => f.key);
  expect(byFace.size, 'faces').toBeGreaterThan(0);
  for (const [key, files] of byFace) {
    expect(files.map((f) => f.url.match(/-(core|rest)-/)?.[1]).sort(), key).toEqual(['core', 'rest']);
    for (const f of files) {
      expect(f.range, `${f.url} has a unicode-range`).toBeTruthy();
      expect(existsSync(new URL(`../public${f.url}`, import.meta.url)), f.url).toBe(true);
    }
    const [a, b] = files.map((f) => new Set(codePoints(f.range)));
    expect(
      [...a].filter((c) => b.has(c)),
      `${key}: shared code points`,
    ).toEqual([]);
  }
});

const core = new Set(faces.filter((f) => f.url.includes('-core-')).flatMap((f) => codePoints(f.range)));

for (const path of ['/', '/blog/', '/about/', '/styleguide/sections/']) {
  test(`${path} downloads a rest font file only if its text has a character outside the core range`, async ({
    page,
  }) => {
    const fonts = [];
    page.on('request', (req) => {
      if (req.resourceType() === 'font') fonts.push(new URL(req.url()).pathname);
    });
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const outside = await page.evaluate(
      (coreList) => {
        const set = new Set(coreList);
        return [
          ...new Set(
            [...document.body.innerText].filter((ch) => ch.codePointAt(0) > 0x7e && !set.has(ch.codePointAt(0))),
          ),
        ];
      },
      [...core],
    );
    expect(
      fonts.some((f) => f.includes('-core-')),
      'core files are used',
    ).toBe(true);
    if (outside.length === 0)
      expect(
        fonts.filter((f) => f.includes('-rest-')),
        'rest files',
      ).toEqual([]);
  });
}
