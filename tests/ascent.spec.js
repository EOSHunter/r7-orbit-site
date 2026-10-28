import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { watchPage } from './helpers.js';

// The R7: Ascent prototype (src/pages/styleguide/ascent/index.astro, docs/ASCENT.md phases 1 to 3): the game, the climb's
// first zones and the robot built in Blender load only on Play, draw into a running canvas with no console errors, and the
// robot moves, jumps, animates and pauses from the keyboard; the pause menu, saving, touch and the finish at the ring work.
// ?level=code plays phase 1's boxes, and so does a page whose level failed to load; a robot that failed to load is drawn as
// phase 1's capsule. Most tests play in the
// page (?lock=0&fullscreen=0); one plays as a visitor does, in full screen. WebGL runs on SwiftShader (software), as in
// runner.spec.js.

const FIXTURE = '/styleguide/ascent/';
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
// One test at a time in this file: each runs WebGL on the CPU, and several at once starve each other into timeouts.
test.describe.configure({ mode: 'default' });

// The mouse lock is always refused in these tests. On Windows, Chromium locks the mouse with ClipCursor, which holds the real
// cursor of whoever is using the machine inside the test browser's invisible window, even headless. A refusal is what the
// game already expects from some browsers (gesture.ts swallows it, and the game says to click to look around), so every test
// keeps its meaning.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.reject(new DOMException('The mouse lock is turned off in the tests', 'NotAllowedError'));
    };
  });
});

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
  await expect(page.locator('[data-stat="level"]')).toHaveText('the climb (Blender)');
  await expect(page.locator('[data-stat="agent"]')).toHaveText('robot (Blender)');

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
  await expect.poll(() => page.locator('[data-stat="animation"]').innerText()).toBe('idle');
  // D runs right (towards +X at the start, along the open floor), and the robot runs.
  const [xs] = await position(page);
  await page.keyboard.down('KeyD');
  await expect.poll(() => page.locator('[data-stat="animation"]').innerText(), MOUNTED).toBe('run');
  await expect.poll(async () => (await position(page))[0], MOUNTED).toBeGreaterThan(xs + 1);
  await page.keyboard.up('KeyD');
  await expect.poll(() => page.locator('[data-stat="animation"]').innerText(), MOUNTED).toBe('idle');

  // W runs away from the camera (towards -Z at the start), straight.
  const [x0, , z0] = await position(page);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page))[2], MOUNTED).toBeLessThan(z0 - 1);
  await page.keyboard.up('KeyW');
  const [x1] = await position(page);
  expect(Math.abs(x1 - x0)).toBeLessThan(0.5);

  // Space jumps: one jump, the agent leaves the ground, and the robot jumps or falls until it lands.
  await page.keyboard.down('Space');
  await expect.poll(() => stat(page, 'jumps')).toBe(1);
  await expect
    .poll(() => page.locator('[data-stat="animation"]').innerText(), { intervals: [50] })
    .toMatch(/^(jump|fall)$/);
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

test("the climb's first zones and the robot load only on Play; ?level=code plays the boxes without them", async ({
  page,
  baseURL,
}) => {
  const problems = watchPage(page, baseURL);
  const files = [];
  page.on('request', (r) => r.url().endsWith('.glb') && files.push(r.url()));
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0`, { waitUntil: 'networkidle' });
  expect(files, 'nothing heavy before Play').toEqual([]);
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  // The first two zones and the robot; the other zones wait until the agent nears them.
  expect(files).toHaveLength(3);
  expect(files.some((u) => /\/_astro\/zone-1\.[\w-]+\.glb$/.test(u))).toBe(true);
  expect(files.some((u) => /\/_astro\/zone-2\.[\w-]+\.glb$/.test(u))).toBe(true);
  expect(files.some((u) => /\/_astro\/agent\.[\w-]+\.glb$/.test(u))).toBe(true);

  await page.goto(`${FIXTURE}?lock=0&fullscreen=0&level=code`, { waitUntil: 'networkidle' });
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  await expect(page.locator('[data-stat="level"]')).toHaveText('grey boxes (code)');
  await expect(page.locator('[data-stat="agent"]')).toHaveText('robot (Blender)');
  expect(
    files.filter((u) => u.includes('/zone-')),
    'the climb is not fetched again',
  ).toHaveLength(2);
  await expect.poll(() => stat(page, 'time'), MOUNTED).toBeGreaterThan(0.2);
  expect(problems).toEqual([]);
});

test('a level and a robot that fail to load fall back to the boxes and the capsule, and the game still plays', async ({
  page,
}) => {
  await page.route('**/*.glb', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0`, { waitUntil: 'networkidle' });
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  await expect(page.locator('[data-stat="level"]')).toContainText('the climb did not load');
  await expect(page.locator('[data-stat="agent"]')).toContainText('capsule (the robot did not load');
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

  // A click on the game (away from the menu in the middle) resumes.
  await page.locator('.ascent-canvas').click({ position: { x: 24, y: 24 } });
  await expect(game(page)).toHaveAttribute('data-ascent-paused', 'false');
  await expect(game(page)).toHaveAttribute('data-ascent-fullscreen', 'true');
  await page.waitForTimeout(300);
  expect(problems).toEqual([]);
});

test('the HUD counts the time; the pause menu turns on assist mode and keeps the settings', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const problems = watchPage(page, baseURL);
  await boot(page);
  await expect(page.locator('.ascent-time')).toHaveText(/\d+:\d\d/);
  await expect(page.locator('.ascent-altimeter-marker')).toHaveCount(1);

  await host(page).press('Escape');
  await expect(game(page)).toHaveAttribute('data-ascent-paused', 'true');
  const menu = page.getByRole('group', { name: 'Game menu' });
  await expect(menu.getByRole('button', { name: 'Resume' })).toBeFocused();

  const assist = menu.getByRole('button', { name: 'Assist mode' });
  await assist.click();
  await expect(assist).toHaveAttribute('aria-pressed', 'true');

  await menu.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('group', { name: 'Settings' });
  await settings.getByRole('button', { name: 'Reduced' }).click();
  await expect(settings.getByRole('button', { name: 'Reduced' })).toHaveAttribute('aria-pressed', 'true');
  await settings.getByLabel('Invert looking up and down').check();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('r7-ascent-settings')))).toMatchObject({
    motion: 'reduce',
    invertY: true,
  });
  // Space on a button presses it; it does not jump or resume.
  await settings.getByRole('button', { name: 'Back' }).focus();
  await page.keyboard.press('Space');
  await expect(menu.getByRole('button', { name: 'Settings' })).toBeFocused();
  expect(await stat(page, 'jumps')).toBe(0);

  await menu.getByRole('button', { name: 'Resume' }).click();
  await expect(game(page)).toHaveAttribute('data-ascent-paused', 'false');
  // The readout runs with the frames, which stop while paused.
  await expect(page.locator('[data-stat="assist"]')).toHaveText(/^on/, MOUNTED);
  expect(problems).toEqual([]);
});

test('a climb in progress is saved, and offered back as Continue', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await expect.poll(() => page.locator('[data-stat="grounded"]').innerText(), MOUNTED).toBe('yes');
  const [, , z0] = await position(page);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page))[2], MOUNTED).toBeLessThan(z0 - 1);
  await page.keyboard.up('KeyW');
  await expect.poll(() => page.locator('[data-stat="grounded"]').innerText()).toBe('yes');
  await host(page).press('Escape');
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('r7-ascent-save')));
  expect(saved).toMatchObject({ v: 1, level: 'climb-1' });

  await page.goto(`${FIXTURE}?lock=0&fullscreen=0&start=0`, { waitUntil: 'networkidle' });
  await play(page).click();
  const resume = page.getByRole('button', { name: /^Continue · \d+ m · \d+:\d\d$/ });
  await expect(resume).toBeVisible(MOUNTED);
  await expect(page.getByRole('button', { name: 'New climb' })).toBeVisible();
  await resume.click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing');
  await expect.poll(async () => (await position(page))[2], MOUNTED).toBeCloseTo(saved.pos.z, 1);
});

test('touch: a stick on the left moves, Jump jumps, Pause pauses', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const problems = watchPage(page, baseURL);
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0&touch=1`, { waitUntil: 'networkidle' });
  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  await expect(game(page)).toHaveAttribute('data-ascent-touch', 'true');
  await expect(page.locator('.ascent-hint')).toHaveText(/Left thumb to move/);
  await expect.poll(() => page.locator('[data-stat="grounded"]').innerText(), MOUNTED).toBe('yes');
  const [, , z0] = await position(page);

  // A thumb down on the left half, pushed up: forward, away from the camera.
  await page.evaluate(() => {
    const c = document.querySelector('.ascent-canvas');
    const r = c.getBoundingClientRect();
    const at = (type, dy) =>
      c.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: 'touch',
          clientX: r.left + r.width * 0.2,
          clientY: r.top + r.height * 0.7 + dy,
          bubbles: true,
        }),
      );
    at('pointerdown', 0);
    at('pointermove', -80);
  });
  await expect.poll(async () => (await position(page))[2], MOUNTED).toBeLessThan(z0 - 1);

  const jump = page.getByRole('button', { name: 'Jump' });
  await jump.dispatchEvent('pointerdown', { pointerId: 8, pointerType: 'touch' });
  await expect.poll(() => stat(page, 'jumps')).toBe(1);
  await jump.dispatchEvent('pointerup', { pointerId: 8, pointerType: 'touch' });

  await page.getByRole('button', { name: 'Pause' }).dispatchEvent('pointerdown', { pointerType: 'touch' });
  await expect(game(page)).toHaveAttribute('data-ascent-paused', 'true');
  await expect(page.locator('.ascent-prompt')).toHaveText('Paused');
  expect(problems).toEqual([]);
});

test('touching the ring finishes the climb: the finish screen, and Climb again', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const problems = watchPage(page, baseURL);
  // A saved climb standing under the ring's near rim on the last platform: build_climb.py hangs the ring out from the
  // platform, away from the middle of the zone, its near rim 2.2 m over the platform's top.
  const climb = JSON.parse(readFileSync(new URL('../src/game/ascent/assets/climb.json', import.meta.url), 'utf8'));
  const { x, y, z } = climb.goal;
  const out = Math.hypot(x, z);
  const [ox, oz] = [x / out, z / out];
  const [radius, tilt] = [5, 0.42];
  const rim = {
    x: x - ox * radius * Math.cos(tilt),
    y: y - radius * Math.sin(tilt),
    z: z - oz * radius * Math.cos(tilt),
  };
  const save = {
    v: 1,
    level: 'climb-1',
    pos: { x: rim.x, y: rim.y - 2.2, z: rim.z },
    yaw: Math.atan2(-ox, -oz),
    time: 900,
    best: rim.y - 2.2,
    falls: 4,
    jumps: 400,
    assist: false,
    assisted: false,
    checkpoint: null,
    savedAt: Date.now(),
  };
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('r7-ascent-save', value);
      sessionStorage.setItem('seeded', '1');
    }
  }, JSON.stringify(save));
  await page.goto(`${FIXTURE}?lock=0&fullscreen=0&start=0`, { waitUntil: 'networkidle' });
  await play(page).click();
  await page.getByRole('button', { name: /^Continue/ }).click(MOUNTED);
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  await expect(page.locator('[data-stat="zones"]')).toHaveText('5 of 5', MOUNTED);
  await expect.poll(() => page.locator('[data-stat="grounded"]').innerText(), MOUNTED).toBe('yes');

  // A full jump (Space held: a tap is a short hop).
  await page.keyboard.down('Space');
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'finished', MOUNTED);
  await page.keyboard.up('Space');
  await expect(page.locator('.ascent-title')).toHaveText('You reached orbit');
  await expect(page.locator('.ascent-finish-stats')).toContainText('15:0');
  const again = page.getByRole('button', { name: 'Climb again' });
  await expect(again).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('r7-ascent-save'))).toBeNull();

  await again.click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing');
  await expect.poll(async () => (await position(page))[1], MOUNTED).toBeLessThan(1);
  expect(problems).toEqual([]);
});

test('the public page /ascent/: the game in full screen on Play, the credits with the name from Site settings', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const problems = watchPage(page, baseURL);
  const site = JSON.parse(readFileSync(new URL('../src/data/site.json', import.meta.url), 'utf8'));
  const glbs = [];
  page.on('request', (r) => r.url().endsWith('.glb') && glbs.push(r.url()));
  await page.goto('/ascent/', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toHaveCount(1);
  // The credits (the page's last Text block) print the author's name through {author.name}.
  await expect(page.locator('#ascent-howto')).toContainText(site.author.name);
  await expect(page.locator('#ascent-howto')).not.toContainText('{author.name}');
  expect(glbs, 'nothing heavy before Play').toEqual([]);

  await play(page).click();
  await expect(game(page)).toHaveAttribute('data-ascent-state', 'playing', MOUNTED);
  await expect(game(page)).toHaveAttribute('data-ascent-fullscreen', 'true');
  expect(glbs.filter((u) => u.includes('/zone-'))).toHaveLength(2);
  await page.evaluate(() => document.exitFullscreen());
  await expect(game(page)).toHaveAttribute('data-ascent-paused', 'true');
  await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();
  await page.getByRole('button', { name: 'Leave' }).click();
  await expect(game(page)).toHaveCount(0);
  await expect(play(page)).toBeFocused();
  expect(problems).toEqual([]);
});
