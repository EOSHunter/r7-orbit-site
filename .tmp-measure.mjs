// Throwaway: renderer.info and a rough uncapped frame rate on SwiftShader, and screenshots. Not committed.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4411';
const mode = process.argv[2] ?? 'measure';
const label = process.argv[3] ?? 'run';
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
const browser = await chromium.launch({ args });

async function open(query, viewport = { width: 1280, height: 720 }, reduced = false) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/styleguide/runner/${query}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__stats = null;
  });
  await page.locator('[data-runner-host]').focus();
  await page.keyboard.press('Space');
  await page.locator('[data-runner]').waitFor({ timeout: 30000 });
  return { page, errors };
}
const stat = (page, n) => page.locator(`[data-stat="${n}"]`).innerText();
async function counts(page) {
  return { triangles: await stat(page, 'triangles'), calls: await stat(page, 'calls'), memory: await stat(page, 'memory') };
}
async function fps(page, ms = 1500) {
  const runs = [];
  for (let i = 0; i < 7; i++) runs.push(Number(await fps1(page, ms)));
  runs.sort((a, b) => a - b);
  return runs[3].toFixed(2);
}
async function fps1(page, ms) {
  return page.evaluate(
    (ms) =>
      new Promise((done) => {
        let n = 0;
        const t0 = performance.now();
        const f = (t) => {
          n++;
          if (t - t0 < ms) requestAnimationFrame(f);
          else done(((t - t0) / n).toFixed(2));
        };
        requestAnimationFrame(f);
      }),
    ms,
  );
}

if (mode === 'measure') {
  const out = {};
  for (let k = 0; k < 2; k++) {
    const { page, errors } = await open('?seed=11&start=0');
    await page.waitForTimeout(2500);
    out[`idle${k}`] = { ...(await counts(page)), msPerFrame: await fps(page) };
    await page.keyboard.press('Space');
    await page.waitForTimeout(2500);
    out[`play${k}`] = { ...(await counts(page)), msPerFrame: await fps(page, 600) };
    out.errors = errors;
    await page.close();
  }
  console.log(label, JSON.stringify(out, null, 1));
} else if (mode === 'comet') {
  const { page } = await open('?seed=11&start=0&comet=1');
  const seen = [];
  for (let i = 0; i < 80; i++) {
    const c = await stat(page, 'comets');
    seen.push(`${c}|${await stat(page, 'calls')}|${await stat(page, 'triangles')}`);
    await page.waitForTimeout(60);
  }
  console.log([...new Set(seen)].join('  '));
} else if (mode === 'shots') {
  for (const vp of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    const q = process.argv[4] ?? '';
    const { page, errors } = await open(`?seed=11&start=0&variant=blended${q}`, vp);
    const stage = page.locator('[data-runner-host]');
    await stage.scrollIntoViewIfNeeded();
    if (q.includes('comet')) {
      await page.waitForFunction(() => document.querySelector('[data-stat="comets"]')?.textContent?.includes('flying'), null, { polling: 20, timeout: 20000 });
      for (let i = 0; i < 3; i++) {
        await stage.screenshot({ path: `.tmp-shots/${label}-${vp.width}-comet${i}.png` });
        await page.waitForTimeout(Number(process.env.COMET_STEP ?? 250));
      }
    }
    await page.waitForTimeout(3000);
    await stage.screenshot({ path: `.tmp-shots/${label}-${vp.width}-idle.png` });

    await page.keyboard.press('Space');
    await page.waitForTimeout(2500);
    await stage.screenshot({ path: `.tmp-shots/${label}-${vp.width}-play.png` });
    console.log(vp.width, errors);
    await page.close();
  }
}
await browser.close();
