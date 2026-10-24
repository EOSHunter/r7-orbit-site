import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { watchPage } from './helpers.js';

// The runner prototype (src/pages/styleguide/runner/index.astro, docs/RUNNER.md): the game is loaded on the first key or tap,
// played with the keyboard and with synthetic swipes, and checked for accessibility, scrolling and widths. WebGL runs on
// SwiftShader (software) in headless Chromium; one test takes WebGL away to check the fallback.

const FIXTURE = '/styleguide/runner/';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
// One test at a time in this file: each runs WebGL on the CPU (SwiftShader), and ten at once starve each other into timeouts.
// The other spec files still run in parallel beside it.
test.describe.configure({ mode: 'default' });

const host = (page) => page.locator('[data-runner-host]');
const game = (page) => page.locator('[data-runner]');
// Loading the chunk and compiling the shaders on SwiftShader takes a few seconds when several tests run at once.
const MOUNTED = { timeout: 30_000 };
const score = async (page) => Number((await page.locator('.runner-score').innerText()).slice(0, 5));
/** A number from the fixture's debug readout (drawn four times a second). */
const stat = async (page, name) => parseFloat(await page.locator(`[data-stat="${name}"]`).innerText());

/** Open the fixture on the ready screen (the idle scene): the game loads, no run starts. */
async function idle(page, query = '') {
  await page.goto(`${FIXTURE}?seed=5&start=0${query}`, { waitUntil: 'networkidle' });
  await host(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'ready', MOUNTED);
  await expect.poll(() => stat(page, 'scroll')).not.toBeNaN();
}

/** Open the fixture, focus the stage and press Space: the game loads and a run starts. */
async function boot(page, seed = 7) {
  await page.goto(`${FIXTURE}?seed=${seed}`, { waitUntil: 'networkidle' });
  await host(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
}

test('the game loads only when asked, with no console errors', async ({ page, baseURL }) => {
  const problems = watchPage(page, baseURL);
  const scripts = [];
  page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  const before = scripts.length;
  await expect(game(page)).toHaveCount(0);
  await expect(host(page)).toHaveAttribute('tabindex', '0');
  await expect(host(page).getByText('Press space to play')).toBeVisible();

  await host(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  expect(scripts.length, 'the game chunk was requested on Space').toBeGreaterThan(before);

  const canvas = page.getByRole('img', { name: 'Endless runner game' });
  await expect(canvas).toBeVisible();
  await expect(page.locator('#rn-howto')).toContainText('Up arrow, W or Space jumps');
  await expect(page.locator('#rn-howto')).toContainText('Hold S or Down to crouch');
  await expect(page.locator('[data-runner-live]')).toHaveAttribute('aria-live', 'polite');
  await page.waitForTimeout(500);
  expect(problems).toEqual([]);
});

test('keyboard: distance rises, a crash ends the run, the best is saved, Space restarts', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 900, height: 900 });
  await boot(page);
  const first = await score(page);
  await expect.poll(() => score(page), { timeout: 10_000 }).toBeGreaterThan(first + 5);
  await expect
    .poll(async () => parseFloat(await page.locator('[data-stat="distance"]').innerText()))
    .toBeGreaterThan(5);

  // No input: the rover drives into the first obstacle in the middle lane.
  await expect(game(page)).toHaveAttribute('data-runner-state', 'over', { timeout: 90_000 });
  const final = await score(page);
  expect(final).toBeGreaterThan(0);
  await expect(page.locator('[data-runner-live]')).toHaveText(`Game over, score ${final}`);
  await expect(page.locator('.runner-prompt')).toHaveText('Press space to try again');
  await expect(page.locator('.runner-result')).toContainText(String(final).padStart(5, '0'));
  await expect(page.locator('.runner-best')).toHaveText(`Best ${String(final).padStart(5, '0')} m`);
  expect(await page.evaluate(() => localStorage.getItem('r7-runner-best'))).toBe(String(final));

  await page.waitForTimeout(500); // past the restart delay
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
  expect(await score(page)).toBeLessThan(final);
  await expect(page.locator('[data-runner-live]')).toHaveText('');
});

test('the saved best shows on mount; blocked storage never breaks the game', async ({ page, context }) => {
  test.setTimeout(60_000); // two games mount, one after the other, each compiling its shaders on SwiftShader
  await context.addInitScript(() => localStorage.setItem('r7-runner-best', '420'));
  await boot(page);
  await expect(page.locator('.runner-best')).toHaveText('Best 00420 m');

  const blocked = await context.browser().newPage();
  const errors = [];
  blocked.on('pageerror', (e) => errors.push(e.message));
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  await blocked.goto(new URL(`${FIXTURE}?seed=3`, page.url()).href, { waitUntil: 'networkidle' });
  await blocked.locator('[data-runner-host]').focus();
  await blocked.keyboard.press('Space');
  await expect(blocked.locator('[data-runner]')).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  await expect(blocked.locator('.runner-best')).toHaveText('Best 00000 m');
  expect(errors).toEqual([]);
  await blocked.close();
});

test('arrows change lane; keys do not scroll the page while the game has focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await boot(page);
  // Focusing the stage scrolled it into view, smoothly (scroll-behavior: smooth): wait until that scroll has finished.
  await page.waitForFunction(
    () => new Promise((done) => ((y) => setTimeout(() => done(window.scrollY === y), 250))(window.scrollY)),
  );
  const y = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('ArrowRight');
  await expect(game(page)).toHaveAttribute('data-runner-lane', '1');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('a');
  await expect(game(page)).toHaveAttribute('data-runner-lane', '-1');
  for (const key of ['Space', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'Space']) await page.keyboard.press(key);
  expect(await page.evaluate(() => window.scrollY), 'the page did not scroll').toBe(y);
  await expect(host(page)).toBeFocused();
});

/** Sample the fixture's crouch readout (drawn four times a second) for `ms`, every 150 ms. */
async function crouchSamples(page, ms) {
  const out = [];
  for (let t = 0; t < ms; t += 150) {
    out.push(await stat(page, 'crouch'));
    await page.waitForTimeout(150);
  }
  return out;
}

// Hold to crouch (docs/RUNNER.md, "Controls"): the rover stays low for exactly as long as the key is held. The first row is
// far off at the start of a run, so a few seconds of holding is safe.
for (const key of ['s', 'ArrowDown']) {
  test(`hold ${key} for 2 s: crouched the whole time, standing after the release`, async ({ page }) => {
    test.setTimeout(60_000);
    await boot(page);
    await page.keyboard.down(key);
    // The crouch eases in over 60 ms of game time; the readout is drawn four times a second, and frames on SwiftShader are slow.
    await expect.poll(() => stat(page, 'crouch'), { timeout: 5000 }).toBe(1);
    const held = await crouchSamples(page, 2000);
    expect(held, 'the crouch stayed at 1 while the key was held').toEqual(held.map(() => 1));
    // Key repeat (the browser sends keydown again and again while a key is held) changes nothing.
    await page.keyboard.down(key);
    await page.keyboard.down(key);
    expect(await crouchSamples(page, 450)).toEqual([1, 1, 1]);
    await page.keyboard.up(key);
    await expect.poll(() => stat(page, 'crouch'), { timeout: 3000 }).toBe(0);
    await page.waitForTimeout(600);
    expect(await stat(page, 'crouch')).toBe(0); // and it did not come back
    await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
  });
}

test('hold S, then lose focus: the rover stands up and the next press crouches again', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page);
  await page.keyboard.down('s');
  await page.waitForTimeout(500);
  expect(await stat(page, 'crouch')).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // the keyup would be lost
  await expect(game(page)).toHaveAttribute('data-runner-paused', 'true');
  await page.keyboard.up('s');
  await page.keyboard.press('Space'); // resume
  await expect(game(page)).toHaveAttribute('data-runner-paused', 'false');
  await expect.poll(() => stat(page, 'crouch'), { timeout: 3000 }).toBe(0);
  await page.keyboard.down('s');
  await expect.poll(() => stat(page, 'crouch'), { timeout: 3000 }).toBe(1);
  await page.keyboard.up('s');
});

test('touch: a swipe down crouches for as long as the finger stays down, and a lift or a cancel ends it', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await boot(page);
  const touch = (type, dy, id = 5) =>
    page.locator('[data-runner]').evaluate(
      (el, [type, dy, id]) => {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: 'touch',
            isPrimary: true,
            bubbles: true,
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2 + dy,
          }),
        );
      },
      [type, dy, id],
    );
  for (const ending of ['pointerup', 'pointercancel']) {
    await touch('pointerdown', 0);
    await touch('pointermove', 20);
    await touch('pointermove', 70);
    await expect.poll(() => stat(page, 'crouch'), { timeout: 5000 }).toBe(1);
    const held = await crouchSamples(page, 2000);
    expect(held, `${ending}: crouched while the finger was down`).toEqual(held.map(() => 1));
    await touch(ending, 70);
    await expect.poll(() => stat(page, 'crouch'), { timeout: 3000 }).toBe(0);
  }
  // A quick flick is a short crouch (at least the minimum), then standing.
  await touch('pointerdown', 0);
  await touch('pointermove', 60);
  await touch('pointerup', 60);
  await expect.poll(() => stat(page, 'crouch'), { timeout: 3000 }).toBe(0);
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
});

test('touch: synthetic swipes change lanes, a tap resumes after a pause', async ({ page }) => {
  await boot(page);
  const swipe = (dx, dy) =>
    page.locator('[data-runner]').evaluate(
      (el, [dx, dy]) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const ev = (type, px, py) =>
          new PointerEvent(type, {
            pointerId: 5,
            pointerType: 'touch',
            isPrimary: true,
            bubbles: true,
            clientX: px,
            clientY: py,
          });
        el.dispatchEvent(ev('pointerdown', x, y));
        el.dispatchEvent(ev('pointermove', x + dx / 2, y + dy / 2));
        el.dispatchEvent(ev('pointermove', x + dx, y + dy));
        el.dispatchEvent(ev('pointerup', x + dx, y + dy));
      },
      [dx, dy],
    );

  // The first touch switches the words to taps. Pause at once (blur), before the first row can arrive, and resume with a tap.
  await swipe(-80, 6);
  await expect(game(page)).toHaveAttribute('data-runner-lane', '-1');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(game(page)).toHaveAttribute('data-runner-paused', 'true');
  await expect(page.locator('.runner-prompt')).toHaveText('Paused. Tap to continue');
  await swipe(0, 0);
  await expect(game(page)).toHaveAttribute('data-runner-paused', 'false');

  await swipe(90, -10);
  await swipe(90, 4);
  await expect(game(page)).toHaveAttribute('data-runner-lane', '1');
  await swipe(8, 5); // too small: nothing
  await swipe(60, 58); // diagonal: nothing
  await swipe(-60, -58);
  await page.waitForTimeout(100);
  await expect(game(page)).toHaveAttribute('data-runner-lane', '1');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
});

test('?start=0 mounts the game on its ready screen; Space then starts a run', async ({ page }) => {
  await page.goto(`${FIXTURE}?seed=5&start=0`, { waitUntil: 'networkidle' });
  await host(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'ready', MOUNTED);
  await expect(page.locator('.runner-prompt')).toHaveText('Press space to play');
  await expect(page.locator('.runner-score')).toHaveText('00000 m');
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
  await expect(page.locator('.runner-message')).toBeHidden();
});

test('the stage is focusable with a visible focus ring', async ({ page }) => {
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await host(page).focus();
  // Focus from script does not always count as keyboard focus; Tab away and back does.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(host(page)).toBeFocused();
  const ring = await host(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(ring.style).not.toBe('none');
  expect(ring.width).toBeGreaterThan(0);
});

test('axe passes on the fixture, before and during a run and after a crash', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  await host(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  await expect(game(page)).toHaveAttribute('data-runner-state', 'over', { timeout: 90_000 });
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
});

test('the idle scene: the world scrolls while the sim stands still, then eases into the run', async ({ page }) => {
  await idle(page);
  const first = await stat(page, 'scroll');
  await expect.poll(() => stat(page, 'scroll'), { timeout: 10_000 }).toBeGreaterThan(first + 1);
  expect(await stat(page, 'distance')).toBe(0);
  await expect(page.locator('.runner-message')).toBeVisible();
  await expect(page.locator('.runner-title')).toHaveText('Off course');

  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
  await expect.poll(() => stat(page, 'distance')).toBeGreaterThan(5);
  await expect(page.locator('.runner-message')).toBeHidden(); // after its fade
});

test('reduced motion: the idle scene is a still frame, and the game still plays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await idle(page);
  await page.waitForTimeout(600); // a few readouts
  const still = await stat(page, 'scroll');
  await page.waitForTimeout(1200);
  expect(await stat(page, 'scroll')).toBe(still);
  const breath = await page.locator('.runner-prompt').evaluate((el) => getComputedStyle(el, '::before').animationName);
  expect(breath).toBe('none');

  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
  await expect.poll(() => stat(page, 'distance')).toBeGreaterThan(5);
  expect(await stat(page, 'scroll')).toBeGreaterThan(still);
});

test('the scene stays within its budgets in the idle scene, a run and after a crash', async ({ page }) => {
  test.setTimeout(120_000);
  await idle(page);
  const counts = async () => ({
    triangles: await stat(page, 'triangles'),
    calls: await stat(page, 'calls'),
  });
  await expect.poll(() => stat(page, 'triangles')).toBeGreaterThan(0);
  const ready = await counts();
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);
  const playing = await counts();
  await expect(game(page)).toHaveAttribute('data-runner-state', 'over', { timeout: 90_000 });
  await page.waitForTimeout(500);
  const over = await counts();
  console.log('renderer.info', JSON.stringify({ ready, playing, over }));
  for (const c of [ready, playing, over]) expect(c.triangles).toBeLessThan(25_000);
});

// The wall with one opening (seed 3) and the sweeper (seed 1) start at 500 m and 1,000 m in a real run; ?all=1 lets them come
// from the first row, so they are in view within the first seconds. Seed 2 is two walls in a row (the slalom).
test('the wall and the sweeper are drawn within the triangle budget, with a clean console', async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  const problems = watchPage(page, baseURL);
  for (const seed of [3, 1, 2]) {
    await page.goto(`${FIXTURE}?seed=${seed}&all=1`, { waitUntil: 'networkidle' });
    await host(page).focus();
    await page.keyboard.press('Space');
    await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
    let most = 0;
    // Nothing is pressed: the rover drives into the first obstacle, passing the rows after it only in the readout's range.
    for (let i = 0; i < 400 && (await game(page).getAttribute('data-runner-state')) === 'playing'; i++) {
      most = Math.max(most, await stat(page, 'triangles'));
      await page.waitForTimeout(150);
    }
    expect(most, `seed ${seed}`).toBeGreaterThan(5000);
    expect(most, `seed ${seed}`).toBeLessThan(25_000);
  }
  expect(problems).toEqual([]);
});

for (const variant of ['framed', 'blended']) {
  test(`the ${variant} variant: the page blend only where asked, no layout shift`, async ({ page }) => {
    // Shifts from the moment the game is asked for (the page's own font swap before it is not the game's).
    await page.addInitScript(() => {
      window.__shift = 0;
      window.__from = Infinity;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (entry.startTime >= window.__from) window.__shift += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(`${FIXTURE}?seed=5&start=0&variant=${variant}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready.then(() => (window.__from = performance.now())));
    await host(page).focus();
    await page.keyboard.press('Space');
    await expect(game(page)).toHaveAttribute('data-runner-state', 'ready', MOUNTED);
    await expect(game(page)).toHaveAttribute('data-runner-variant', variant);
    const blend = page.locator('.runner-blend');
    await expect(blend).toHaveAttribute('aria-hidden', 'true');
    if (variant === 'blended') {
      await expect(blend).toBeVisible();
      expect(await blend.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
      expect(await host(page).evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgba(0, 0, 0, 0)');
    } else {
      await expect(blend).toBeHidden();
    }
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    await page.keyboard.press('Space');
    await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__shift)).toBe(0);
  });
}

for (const [width, variant] of [
  [320, 'framed'],
  [375, 'framed'],
  [1280, 'framed'],
  [320, 'blended'],
  [375, 'blended'],
  [1280, 'blended'],
]) {
  test(`no horizontal scroll at ${width}px with the game running (${variant})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${FIXTURE}?seed=7&variant=${variant}`, { waitUntil: 'networkidle' });
    await host(page).focus();
    await page.keyboard.press('Space');
    await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
    const box = await game(page).boundingBox();
    expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('.runner-score')).toBeVisible();
  });
}

test('unmount and mount again: nothing left behind, no errors', async ({ page, baseURL }) => {
  const problems = watchPage(page, baseURL);
  await boot(page);
  await page.getByRole('button', { name: 'Unmount the game' }).click();
  await expect(game(page)).toHaveCount(0);
  await expect(host(page).getByText('Press space to play')).toBeVisible();
  await host(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(problems).toEqual([]);
});

test('the rover model loads after the game, and a missing one leaves the stand-in rover, throwing nothing', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const models = [];
  page.on('request', (r) => r.url().endsWith('.glb') && models.push(r.url()));
  await page.route('**/*.glb', (route) => route.fulfill({ status: 404, body: '' }));
  const problems = watchPage(page, baseURL);
  await page.goto(`${FIXTURE}?seed=7`, { waitUntil: 'networkidle' });
  expect(models, 'no model before the game is asked for').toEqual([]);
  await host(page).focus();
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing', MOUNTED);
  await expect.poll(() => models.length).toBeGreaterThan(0);
  // The game goes on with the stand-in: it drives, crashes and restarts.
  await expect(game(page)).toHaveAttribute('data-runner-state', 'over', { timeout: 90_000 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-runner-state', 'playing');
  // The only complaints are the 404 this test made: the response, the browser's console line about it, and the request
  // reported as aborted (the loader drops the body of a failed response).
  const expected = (p) =>
    /bad response 404: .*\.glb$/.test(p) ||
    /console error: Failed to load resource.*404/.test(p) ||
    /request failed: .*\.glb \(net::ERR_ABORTED\)$/.test(p);
  expect(problems.filter((p) => !expected(p))).toEqual([]);
});

test('without WebGL the game says so, in neutral words, and throws nothing', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (/webgl/i.test(String(type))) return null;
      return original.call(this, type, ...rest);
    };
  });
  const problems = watchPage(page, baseURL);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await host(page).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.runner-fallback')).toHaveText('This game needs WebGL.', MOUNTED);
  await expect(game(page)).toHaveAttribute('data-runner-state', 'unsupported');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  expect(problems).toEqual([]);
});
