import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { watchPage } from './helpers.js';

// The R7: Ascent prototype (src/pages/styleguide/ascent/index.astro, docs/ASCENT.md phases 1 and 2): the game and the test
// climb built in Blender load only on Play, draw into a running canvas with no console errors, and the agent moves, jumps and
// pauses from the keyboard. ?level=code plays phase 1's boxes, and so does a page whose .glb failed to load. Most tests play in the
// page (?lock=0&fullscreen=0); one plays as a visitor does, in full screen. WebGL runs on SwiftShader (software), as in
// runner.spec.js.

const FIXTURE = '/styleguide/ascent/';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
// One test at a time in this file: each runs WebGL on the CPU, and several at once starve each other into timeouts.
test.describe.configure({ mode: 'default' });

const host = (page) => page.locator('[data-ascent-host]');
const game = (page) => page.locator('[data-ascent]');
const play = (page) => page.getByRole('button', { name: 'Play', exact: true });
// Loading the chunk and compiling the shaders on SwiftShader takes a few seconds when several tests run at once.
const MOUNTED = { timeout: 30_000 };
/** A number from the debug readout (drawn five times a second). */
const stat = async (page, name) => parseFloat(await page.locator(`[data-stat="${name}"]`).innerText());
/** The agent's position from the debug readout: "x, y, z". */
const position = async (page) => (await page.locator('[data-stat="position"]').innerText()).split(',').map(Number);

async function boot(page) {
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0`, { waitUntil: 'networkidle' });
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  await expect.poll(() => stat(page, 'time'), MOUNTED).toBeGreaterThan(0.2);
}

test('Play loads the game; the canvas runs with no console errors', async ({ page, baseURL }) => {
  const problems = watchPage(page, baseURL);
  const scripts = [];
  page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0`, { waitUntil: 'networkidle' });
  const before = scripts.length;
  await expect(game(page)).toHaveCount(0);
  await expect(play(page)).toBeVisible();

  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  expect(scripts.length, 'the game chunk was requested on Play').toBeGreaterThan(before);
  await expect(page.locator('[data-stat="level"]')).toHaveText('test climb (Blender)');

  const canvas = page.getByRole('img', { name: 'R7: Ascent, a climbing game' });
  await expect(canvas).toBeVisible();
  await expect(host(page)).toBeFocused();
  // Running: the sim's clock advances and frames are drawn.
  const t0 = await stat(page, 'time');
  await expect.poll(() => stat(page, 'time'), MOUNTED).toBeGreaterThan(t0 + 0.5);
  await expect.poll(() => stat(page, 'calls')).toBeGreaterThan(0);
  // Something was drawn: the canvas is not one flat colour. Read from a screenshot (a WebGL canvas's own pixels are cleared
  // once a frame is shown).
  const png = (await canvas.screenshot()).toString('base64');
  const varied = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const probe = document.createElement('canvas');
    probe.width = 64;
    probe.height = 36;
    const ctx = probe.getContext('2d');
    ctx.drawImage(img, 0, 0, 64, 36);
    const data = ctx.getImageData(0, 0, 64, 36).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return seen.size;
  }, png);
  expect(varied).toBeGreaterThan(4);
  await page.waitForTimeout(500);
  expect(problems).toEqual([]);
});

test('the keyboard moves, jumps and pauses', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await expect.poll(() => page.locator('[data-stat="grounded"]').innerText()).toBe('yes');
  const [x0, , z0] = await position(page);

  // W runs away from the camera (towards -Z at the start).
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page))[2], MOUNTED).toBeLessThan(z0 - 1);
  await page.keyboard.up('KeyW');
  const [x1] = await position(page);
  expect(Math.abs(x1 - x0)).toBeLessThan(0.5);

  // Space jumps: one jump, and the agent leaves the ground.
  await page.keyboard.down('Space');
  await expect.poll(() => stat(page, 'jumps')).toBe(1);
  await page.keyboard.up('Space');
  await expect.poll(() => page.locator('[data-stat="grounded"]').innerText()).toBe('yes');

  // Escape pauses and stops the clock; Space resumes without jumping.
  await page.keyboard.press('Escape');
  await expect(game(page)).toHaveAttribute('data-ascent-paused', 'true');
  await expect(page.locator('.ascent-prompt')).toHaveText('Paused. Click or press Space to continue');
  const t = await stat(page, 'time');
  await page.waitForTimeout(600);
  expect(await stat(page, 'time')).toBe(t);
  await page.keyboard.press('Space');
  await expect(game(page)).toHaveAttribute('data-ascent-paused', 'false');
  await expect.poll(() => stat(page, 'time')).toBeGreaterThan(t);
  expect(await stat(page, 'jumps')).toBe(1);
});

test('the level from Blender loads only on Play; ?level=code plays the boxes in code without it', async ({
  page,
  baseURL,
}) => {
  const problems = watchPage(page, baseURL);
  const levels = [];
  page.on('request', (r) => r.url().endsWith('.glb') && levels.push(r.url()));
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0`, { waitUntil: 'networkidle' });
  expect(levels, 'nothing heavy before Play').toEqual([]);
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  expect(levels).toHaveLength(1);
  expect(levels[0]).toMatch(/\/_astro\/test-climb\.[\w-]+\.glb$/);

  await page.goto(`${FIXTURE}?lock=0&fullscreen=0&level=code`, { waitUntil: 'networkidle' });
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  await expect(page.locator('[data-stat="level"]')).toHaveText('grey boxes (code)');
  expect(levels).toHaveLength(1);
  await expect.poll(() => stat(page, 'time'), MOUNTED).toBeGreaterThan(0.2);
  expect(problems).toEqual([]);
});

test('a level that fails to load falls back to the boxes in code, and the game still plays', async ({ page }) => {
  await page.route('**/*.glb', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0`, { waitUntil: 'networkidle' });
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  await expect(page.locator('[data-stat="level"]')).toContainText('the test climb did not load');
  await expect.poll(() => stat(page, 'time'), MOUNTED).toBeGreaterThan(0.2);
});

test('the page and the running game pass axe; the page does not scroll sideways at 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0`, { waitUntil: 'networkidle' });
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('without WebGL the game says so and draws no canvas', async ({ page, baseURL }) => {
  const problems = watchPage(page, baseURL);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return type === 'webgl2' || type === 'webgl' ? null : original.call(this, type, ...rest);
    };
  });
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0`, { waitUntil: 'networkidle' });
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'unsupported', MOUNTED);
  await expect(game(page)).toContainText('This game needs WebGL.');
  await expect(page.locator('.ascent-canvas')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('Play goes full screen in the same click; leaving full screen pauses; a click comes back', async ({
  page,
  baseURL,
}) => {
  const problems = watchPage(page, baseURL);
  await page.goto(FIXTURE, { waitUntil: 'networkidle' });
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  await expect(game(page)).toHaveAttribute('data-ascent-fullscreen', 'true');
  expect(await page.evaluate(() => document.fullscreenElement?.hasAttribute('data-ascent-host'))).toBe(true);
  // The mouse is either locked to the game, or the game says how to lock it: never a mouse that silently does nothing.
  const locked = (await game(page).getAttribute('data-ascent-locked')) === 'true';
  await expect(page.locator('.ascent-look')).toBeVisible({ visible: !locked });

  await page.evaluate(() => document.exitFullscreen());
  await expect(game(page)).toHaveAttribute('data-ascent-paused', 'true');
  await expect(game(page)).toHaveAttribute('data-ascent-fullscreen', 'false');
  await expect(page.locator('.ascent-prompt')).toHaveText('Paused. Click or press Space to continue');

  await page.locator('.ascent-canvas').click();
  await expect(game(page)).toHaveAttribute('data-ascent-paused', 'false');
  await expect(game(page)).toHaveAttribute('data-ascent-fullscreen', 'true');
  await page.waitForTimeout(300);
  expect(problems).toEqual([]);
});
