// npm run runner:bots [-- --runs 300] [-- --bots novice,average] [-- --max 600] [-- --json] [-- --config '{"speed":{"max":36}}']
// Plays the runner's bots (src/game/runner/bots.ts) through the real sim, headless, and prints the table of docs/RUNNER.md
// ("Difficulty and bots"): median, mean and 90th percentile of survival time and distance, and where the deaths are. The
// TypeScript is bundled with esbuild (already installed with Vite) into a temp file and run; nothing is written to the repo.
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const runs = Number(opt('runs', 300));
const maxTime = Number(opt('max', 600));
const names = opt('bots', 'idle,novice,average,expert,perfect').split(',');
const json = args.includes('--json');
const overrides = opt('config', null);

const dir = await mkdtemp(join(tmpdir(), 'runner-bots-'));
try {
  const outfile = join(dir, 'bots.mjs');
  await build({
    stdin: {
      contents: "export * from './src/game/runner/bots'; export { withConfig } from './src/game/runner/config';",
      resolveDir: root,
      sourcefile: 'entry.ts',
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'error',
  });
  const { BOT_PROFILES, playMany, formatTable, withConfig } = await import(pathToFileURL(outfile).href);
  const config = overrides ? withConfig(JSON.parse(overrides)) : undefined; // a variant of RUNNER_CONFIG, for tuning
  const summaries = [];
  for (const name of names) {
    const profile = BOT_PROFILES[name];
    if (!profile) throw new Error(`unknown bot "${name}" (${Object.keys(BOT_PROFILES).join(', ')})`);
    const started = Date.now();
    summaries.push(playMany(profile, runs, { maxTime, config }));
    if (!json) console.error(`${name}: ${runs} runs in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  console.log(json ? JSON.stringify(summaries, null, 2) : formatTable(summaries));
} finally {
  await rm(dir, { recursive: true, force: true });
}
