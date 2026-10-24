import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { watchPage } from './helpers.js';

// The endless runner on the 404 page (src/components/RunnerStage.astro, docs/RUNNER.md "On the 404 page"): a poster until the
// first interaction, the game fetched then (and prefetched when idle and near), played with keys and touch, from any missing
// address. The page's own words are checked in tests/pages.spec.js against tests/fixtures/pages/404.txt; this file checks the
// stage. WebGL runs on SwiftShader (software) in headless Chromium, one test at a time like tests/runner.spec.js.

const PAGE = '/no-such-page/';
const DEEP = '/a/b/c/d/e/no-such-page/?utm=x#top';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
test.describe.configure({ mode: 'default' });

const stage = (page) => page.locator('[data-runner-stage]');
const play = (page) => page.locator('[data-runner-play]');
const game = (page) => page.locator('[data-runner]');
// Fetching the chunk and compiling the shaders on SwiftShader takes a few seconds.
const MOUNTED = { timeout: 30_000 };
const GAME_URL = /\/_astro\/(runner|rover)\./;
const score = async (page) => Number((await page.locator('.runner-score').innerText()).slice(0, 5));

/** The browser logs the 404 document itself as a console error; every other problem still counts. */
const real = (problems) => problems.filter((m) => !m.startsWith('console error: Failed to load resource'));

/** With data-saver on, the page never prefetches: nothing of the game is requested until someone asks. */
const dataSaver = (page) =>
  page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));

/** Wait until the stage has been brought fully into view under the sticky header and the scroll has come to rest (it is smooth). */
async function settled(page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const r = document.querySelector('[data-runner-stage]').getBoundingClientRect();
          return r.top >= 56 && r.bottom <= innerHeight + 1;
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
  let last = -1;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => window.scrollY);
      const rest = y === last;
      last = y;
      return rest;
    }, { intervals: [250], timeout: 15_000 })
    .toBe(true);
}

/** Focus the poster's button and press a key: the game loads (and, on Space, a run starts). */
async function wake(page, key = 'Space', url = PAGE) {
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await play(page).focus();
  await page.keyboard.press(key);
}

/** One touch swipe through the browser's own touch input (pointer events with pointerType touch), from the middle of the game. */
async function swipe(page, cdp, dx, dy) {
  const box = await game(page).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const send = (type, px, py) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] });
  await send('touchStart', x, y);
  for (let i = 1; i <= 3; i++) await send('touchMove', x + (dx * i) / 3, y + (dy * i) / 3);
  await send('touchEnd');
}

test('the page keeps its words, search form and buttons; the stage comes after them with a play button', async ({
  page,
}) => {
  const response = await page.goto(PAGE);
  expect(response.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('.lost [data-orbit] svg')).toHaveCount(1);
  await expect(page.locator('.lost .eyebrow')).toHaveText('Error 404');
  await expect(page.locator('.lost h1')).toBeVisible();
  await expect(page.locator('.lost form[role="search"] input[type="search"]')).toBeVisible();
  const links = page.locator('.lost .cluster a.btn');
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute('href', '/');
  await expect(links.nth(1)).toHaveAttribute('href', '/#latest');

  // The stage is in <main>, after the page's buttons (so the tab order of the page is unchanged), and holds one real button.
  await expect(stage(page)).toHaveCount(1);
  const order = await page.evaluate(
    () =>
      document
        .querySelector('.lost .cluster')
        .compareDocumentPosition(document.querySelector('[data-runner-stage]')) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(order).toBeTruthy();
  await expect(play(page)).toBeVisible();
  await expect(play(page)).toHaveAccessibleName('Press space to play');
  await expect(game(page)).toHaveCount(0);
  await expect(stage(page).locator('svg')).toHaveAttribute('aria-hidden', 'true');
});

test('nothing of the game is requested before interaction; then the chunk and the model load, root-absolute, and it plays', async ({
  page,
  baseURL,
}) => {
  await dataSaver(page);
  const problems = watchPage(page, baseURL);
  const seen = [];
  page.on('request', (r) => seen.push(new URL(r.url()).pathname));
  const answers = {};
  page.on('response', (r) => GAME_URL.test(r.url()) && (answers[new URL(r.url()).pathname] = r.status()));
  await page.goto(DEEP, { waitUntil: 'load' });
  await page.waitForTimeout(2500); // past the idle callback that would prefetch
  expect(seen.filter((p) => GAME_URL.test(p)), 'before interaction').toEqual([]);
  expect(seen.some((p) => /three|webgl/i.test(p))).toBe(false);
  await expect(page.locator('link[rel="prefetch"]')).toHaveCount(0);
  await expect(game(page)).toHaveCount(0);

  await play(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  // The model is fetched by the game after it mounts, so it may answer a moment after the run starts.
  await expect.poll(() => Object.keys(answers).some((p) => /\/_astro\/rover\..*\.glb$/.test(p)), MOUNTED).toBe(true);
  const files = Object.keys(answers);
  expect(files.some((p) => /\/_astro\/runner\..*\.js$/.test(p))).toBe(true);
  for (const file of files) expect(answers[file], file).toBe(200);
  await expect(page.getByRole('img', { name: 'Endless runner game' })).toBeVisible();
  expect(real(problems)).toEqual([]);
});

test('every address the page uses for the game is root-absolute in the build', async () => {
  const dist = join(process.cwd(), 'dist');
  const html = readFileSync(join(dist, '404.html'), 'utf8');
  expect(html).toMatch(/data-rover="\/_astro\/rover\.[\w-]+\.glb"/);
  const script = readdirSync(join(dist, '_astro')).find((f) => /^RunnerStage\..*\.js$/.test(f));
  expect(script, 'the stage script').toBeTruthy();
  const code = readFileSync(join(dist, '_astro', script), 'utf8');
  const chunk = code.match(/`(\/_astro\/runner\.[\w-]+\.js)`/)?.[1];
  expect(chunk, 'the chunk is named by a root-absolute address').toBeTruthy();
  expect(existsSync(join(dist, chunk))).toBe(true);
  // The chunk stands alone: a shared chunk hung off another page's script (the admin's, 5.9 MB) once made the 404 page's game fetch it.
  expect(readFileSync(join(dist, chunk), 'utf8'), 'the game chunk imports no other chunk').not.toMatch(/^import[ {*]/);
  expect(code).not.toMatch(/import\(`\.\.?\//); // never a relative import of the game
  for (const src of html.match(/(?:src|href)="[^"]*_astro[^"]*"/g) ?? []) expect(src, src).toMatch(/="\//);
});

test('idle prefetch: when the page is idle and the stage is near, the chunk and the model are fetched but not run', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(PAGE, { waitUntil: 'load' });
  await expect(page.locator('link[rel="prefetch"]')).toHaveCount(2, { timeout: 15_000 });
  const hrefs = await page.locator('link[rel="prefetch"]').evaluateAll((l) => l.map((e) => e.getAttribute('href')));
  expect(hrefs.some((h) => /^\/_astro\/runner\..*\.js$/.test(h))).toBe(true);
  expect(hrefs.some((h) => /^\/_astro\/rover\..*\.glb$/.test(h))).toBe(true);
  await expect(game(page)).toHaveCount(0); // fetched, not run: nothing is mounted until someone asks
  // The press asks for the very files that were prefetched (same address, same request mode), so a cacheable response (the
  // host's immutable /_astro/ rule, tests/headers.spec.js) is reused. `astro preview` sends no caching headers, so the reuse
  // itself is not visible here; the sameness is.
  const requested = [];
  page.on('request', (r) => GAME_URL.test(r.url()) && requested.push(new URL(r.url()).pathname));
  await play(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  for (const href of hrefs) expect(requested, href).toContain(href);
  expect(await page.locator('link[rel="prefetch"]').evaluateAll((l) => l.map((e) => e.crossOrigin))).toEqual([
    'anonymous',
    'anonymous',
  ]);
});

test('no prefetch while the stage is far away, on data-saver or on a slow connection; it follows the scroll', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 360, height: 400 });
  await page.goto(PAGE, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await expect(page.locator('link[rel="prefetch"]')).toHaveCount(0);
  await page.evaluate(() => document.querySelector('[data-runner-stage]').scrollIntoView());
  await expect(page.locator('link[rel="prefetch"]')).toHaveCount(2, { timeout: 15_000 });

  const slow = await browser.newPage();
  await slow.addInitScript(() =>
    Object.defineProperty(navigator, 'connection', { value: { effectiveType: '2g' }, configurable: true }),
  );
  await slow.setViewportSize({ width: 1280, height: 720 });
  await slow.goto(new URL(PAGE, page.url()).href, { waitUntil: 'load' });
  await slow.waitForTimeout(2000);
  await expect(slow.locator('link[rel="prefetch"]')).toHaveCount(0);
  await slow.close();
});

test('Space on the button starts a run; a crash ends it; Space restarts; the best survives a reload', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const problems = watchPage(page, baseURL);
  await page.setViewportSize({ width: 1280, height: 720 });
  await wake(page);
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  await expect(stage(page)).toBeFocused();
  await expect(stage(page)).toHaveAttribute('role', 'application');
  await expect(play(page)).toBeHidden();
  const first = await score(page);
  await expect.poll(() => score(page), { timeout: 10_000 }).toBeGreaterThan(first + 5);

  // No input: the rover drives into the first obstacle.
  await expect(game(page)).toHaveAttribute('data-runner-state', 'over', { timeout: 100_000 });
  const final = await score(page);
  expect(final).toBeGreaterThan(0);
  await expect(page.locator('[data-runner-live]')).toHaveText(`Game over, score ${final}`);
  await expect(page.locator('.runner-prompt')).toHaveText('Press space to try again');
  expect(await page.evaluate(() => localStorage.getItem('r7-runner-best'))).toBe(String(final));
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
  expect(await score(page)).toBeLessThan(final);

  // A new visit: the best is still there, and the ready screen shows it.
  await page.goto(PAGE, { waitUntil: 'load' });
  await play(page).focus();
  await page.keyboard.press('Enter');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'ready', MOUNTED);
  await expect(page.locator('.runner-best')).toHaveText(`Best ${String(final).padStart(5, '0')} m`);
  await expect(page.locator('.runner-best')).toBeVisible();
  expect(real(problems)).toEqual([]);
});

test('Enter loads the idle scene without starting; with no best score yet none is shown; Space then starts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await wake(page, 'Enter');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'ready', MOUNTED);
  await expect(page.locator('.runner-prompt')).toHaveText('Press space to play');
  await expect(page.locator('.runner-title')).toHaveText('Off course');
  await expect(page.locator('.runner-best')).toBeHidden();
  await page.waitForTimeout(800);
  expect(await score(page)).toBe(0); // idle: the distance does not move
  await expect(stage(page)).toBeFocused();
  await expect(stage(page)).toHaveAccessibleDescription('Press space to play');
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
});

test('a mouse click anywhere on the poster loads the game and starts a run', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(PAGE, { waitUntil: 'load' });
  await stage(page).scrollIntoViewIfNeeded();
  const box = await stage(page).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
});

test('keys: Escape pauses and Space resumes, Tab leaves, and Space scrolls the page when the stage is not focused', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await wake(page);
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  await settled(page);
  const y = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(game(page)).toHaveAttribute('data-runner-lane', '1');
  expect(await page.evaluate(() => window.scrollY), 'keys do not scroll the page while the stage has focus').toBe(y);

  await page.keyboard.press('Escape');
  await expect(game(page)).toHaveAttribute('data-runner-paused', 'true');
  await expect(page.locator('.runner-prompt')).toHaveText('Paused. Press space to continue');
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-paused', 'false');

  // Tab leaves the stage (it is not a trap), and pauses the run.
  await page.keyboard.press('Tab');
  await expect(stage(page)).not.toBeFocused();
  await expect(game(page)).toHaveAttribute('data-runner-paused', 'true');
  expect(await page.evaluate(() => document.activeElement?.closest('[data-runner-stage]'))).toBeNull();

  // Elsewhere on the page Space is the page's: it scrolls, and the game is not started or resumed by it.
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY), 'Space scrolled the page').toBeGreaterThan(0);
  await expect(game(page)).toHaveAttribute('data-runner-paused', 'true');
});

test('touch: the button says "Tap to play", a tap starts, swipes steer without scrolling, the touch-action follows the state', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const problems = watchPage(page, baseURL);
  await page.goto(PAGE, { waitUntil: 'load' });
  await expect(play(page)).toHaveAccessibleName('Tap to play');
  await expect(play(page).locator('.runner-keys')).toBeHidden();
  await play(page).tap();
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  await expect(page.locator('.runner-score')).toBeVisible();
  await settled(page);
  const cdp = await context.newCDPSession(page);

  // Playing: a swipe in the stage never scrolls the page, and steers the rover. Once a run has ended the page scrolls again (which
  // is the point), so each try is thrown away, and a new run started, if the rover crashed before its swipes were done: on a
  // busy machine the first obstacle (nearly six seconds in) can arrive first.
  const action = () => page.locator('.runner-canvas').evaluate((c) => getComputedStyle(c).touchAction);
  const state = () => game(page).getAttribute('data-runner-state');
  let held = false;
  for (let attempt = 0; attempt < 6 && !held; attempt++) {
    if (attempt) {
      await page.waitForTimeout(500);
      await game(page).tap();
      await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
    }
    const y = await page.evaluate(() => window.scrollY);
    expect(await action()).toBe('none');
    await swipe(page, cdp, 0, -120);
    await swipe(page, cdp, 0, 120);
    if ((await state()) !== 'playing') continue;
    expect(await page.evaluate(() => window.scrollY), 'swipes did not scroll the page').toBe(y);
    const lanes = [];
    for (const dx of [-90, 90, 90]) {
      await swipe(page, cdp, dx, 0);
      await page.waitForTimeout(160); // a lane change takes 0.14 s
      lanes.push(await game(page).getAttribute('data-runner-lane'));
    }
    if ((await state()) !== 'playing') continue;
    expect(lanes, 'left, right, right').toEqual(['-1', '0', '1']);
    held = true;
  }
  expect(held, 'a run lasted through the swipes').toBe(true);

  // Game over: the page scrolls as usual again, and a tap restarts.
  await expect(game(page)).toHaveAttribute('data-runner-state', 'over', { timeout: 100_000 });
  expect(await action()).toBe('pan-y pinch-zoom');
  await expect(page.locator('.runner-prompt')).toHaveText('Tap to try again');
  await page.waitForTimeout(500);
  await page.locator('[data-runner]').tap();
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
  expect(real(problems)).toEqual([]);
  await context.close();
});

test('reduced motion: nothing animates on the poster, the game appears at once, and it still plays on request', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(PAGE, { waitUntil: 'load' });
  const animation = () =>
    play(page).evaluate((b) => [getComputedStyle(b, '::before').animationName, getComputedStyle(b, '::after').animationName]);
  expect(await animation()).toEqual(['none', 'none']);
  await play(page).focus();
  await page.keyboard.press('Enter');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'ready', MOUNTED);
  expect(await game(page).evaluate((g) => getComputedStyle(g).animationName)).toBe('none');
  await expect(stage(page).locator('[data-runner-poster]')).toBeHidden();
  expect(await page.locator('.runner-prompt').evaluate((p) => getComputedStyle(p, '::before').animationName)).toBe('none');
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
  await context.close();
});

test('motion allowed: the poster hairlines breathe', async ({ page }) => {
  await page.goto(PAGE, { waitUntil: 'load' });
  expect(await play(page).evaluate((b) => getComputedStyle(b, '::before').animationName)).toBe('rs-breathe');
});

test('without WebGL the game says so, the poster stays, and the page stays usable', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (/webgl/i.test(String(type))) return null;
      return original.call(this, type, ...rest);
    };
  });
  const problems = watchPage(page, baseURL);
  await wake(page);
  await expect(page.locator('.runner-fallback')).toHaveText('This game needs WebGL.', MOUNTED);
  await expect(game(page)).toHaveAttribute('data-runner-state', 'unsupported');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(play(page)).toBeHidden();
  await expect(stage(page)).not.toHaveAttribute('tabindex', /.*/);
  await expect(stage(page).locator('svg')).toBeVisible();
  // The rest of the page still works.
  await page.locator('#lost-search').fill('orbit');
  await expect(page.locator('#lost-search')).toHaveValue('orbit');
  await expect(page.locator('.lost .cluster a.btn').first()).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  expect(real(problems)).toEqual([]);
});

test('without JavaScript the stage is not drawn: no game, no empty gap', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(PAGE);
  await expect(stage(page)).toBeHidden();
  await expect(page.locator('.lost h1')).toBeVisible();
  const gap = await page.evaluate(() => {
    const lost = document.querySelector('.lost').getBoundingClientRect();
    const footer = document.querySelector('.site-footer').getBoundingClientRect();
    return footer.top - lost.bottom;
  });
  expect(gap, 'the footer follows the page directly').toBeLessThan(120);
  await context.close();
});

test('the stage holds its space: no layout shift from the first paint through loading and playing', async ({ page }) => {
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(PAGE, { waitUntil: 'load' });
  const reserved = await stage(page).boundingBox();
  await page.waitForTimeout(1500);
  expect((await stage(page).boundingBox()).height).toBe(reserved.height);
  await play(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  await page.waitForTimeout(1200);
  expect((await stage(page).boundingBox()).height).toBe(reserved.height);
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.005);
});

for (const width of [320, 375, 768, 1280]) {
  test(`${width}px: no horizontal scroll, no console errors, the HUD stays inside the stage, axe passes`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const problems = watchPage(page, baseURL);
    await page.setViewportSize({ width, height: width < 600 ? 800 : 720 });
    await page.goto(PAGE, { waitUntil: 'load' });
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow(), 'poster').toBeLessThanOrEqual(0);
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations, 'axe on the poster').toEqual([]);

    await play(page).focus();
    await page.keyboard.press('Enter');
    await expect(game(page)).toHaveAttribute('data-runner-state', 'ready', MOUNTED);
    expect(await overflow(), 'ready').toBeLessThanOrEqual(0);
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations, 'axe, ready').toEqual([]);
    await page.keyboard.press('Space');
    await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
    // Where the page scrolled to is tested above and below; here the stage is put in view at once, and its layout is measured.
    await stage(page).evaluate((el) => el.scrollIntoView({ block: 'nearest', behavior: 'instant' }));
    await page.waitForTimeout(700); // past any smooth scroll still running
    expect(await overflow(), 'playing').toBeLessThanOrEqual(0);

    // The HUD sits inside the stage, below the sticky header, and clear of the page's text above it.
    const hud = await page.locator('.runner-hud').boundingBox();
    const box = await stage(page).boundingBox();
    const header = await page.locator('.site-header').boundingBox();
    expect(hud.x + hud.width).toBeLessThanOrEqual(box.x + box.width);
    expect(hud.y).toBeGreaterThanOrEqual(box.y);
    expect(hud.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations, 'axe, playing').toEqual([]);
    expect(real(problems)).toEqual([]);
  });
}

test('the stage fills a screen sensibly: about 16:9 and at most 720px on a wide screen, taller on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(PAGE);
  let box = await stage(page).boundingBox();
  expect(box.width).toBe(1920);
  expect(box.height).toBeLessThanOrEqual(720);
  expect(box.height).toBeGreaterThanOrEqual(0.6 * 1080 - 1);

  await page.setViewportSize({ width: 390, height: 844 });
  box = await stage(page).boundingBox();
  expect(box.height / box.width).toBeGreaterThan(1.2);
  expect(box.height / box.width).toBeLessThan(1.6);

  await page.setViewportSize({ width: 844, height: 390 }); // a phone on its side: the whole stage fits under the header
  box = await stage(page).boundingBox();
  expect(box.height).toBeLessThanOrEqual(390 - 56 - 24);
});

test('starting the game brings the whole stage into view, clear of the sticky header', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await wake(page);
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  await settled(page);
  const box = await stage(page).boundingBox();
  const header = await page.locator('.site-header').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(box.y + box.height).toBeLessThanOrEqual(720 + 1);
});
