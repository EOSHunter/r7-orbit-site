// Bots: players made of code, for measuring how hard the game is (docs/RUNNER.md, "Difficulty and bots"). They play the REAL
// sim, headless: each step they look at what the sim shows (its obstacles and the rover) and press the same intents a player
// does, `crouch` held and let go like a key. They never see more than a player could.
//
// A bot's day, per row of obstacles:
//   1. it notices a row when it is within `sight` seconds of travel, and starts to think about it once the row before has been
//      cleared (a player does not plan the next row while still in the last one);
//   2. after its `reaction` time it picks the way through that needs the least time (lane changes, then a jump or a crouch),
//      steers, and jumps or crouches at the last sensible moment (a little early or late by its `timing` noise);
//   3. with chance `mistake` per row that needs an action it errs: the wrong lane, forgets, mistimes the jump, is slow, or
//      lets go of the crouch while still under the gate. A wrong lane or a forgotten action is noticed `noticeLag` seconds
//      later and put right if there is time (so a slip is fatal only when the row is close); a mistimed jump and an early
//      release are not undone. None of it is a crash by script: the sim decides.
// A crouch is pressed shortly before a gate and let go once the rover has cleared it, like a key held for just that long.
//
// Everything a bot decides comes from its own seeded generator, so a run is a pure function of (profile, seed, config).

import { RUNNER_CONFIG, type RunnerConfig } from './config';
import { jumpLeadTime, passMode, passableLanes, requiredTime, type Lane, type PassMode, type Row } from './generator';
import { mulberry32, type Random } from './random';
import { RunnerSim } from './sim';

export type BotName = 'idle' | 'novice' | 'average' | 'expert' | 'perfect';

export interface BotProfile {
  name: BotName;
  /** Seconds from the moment it can think about a row to the first key press. */
  reaction: number;
  /** Chance, per row that needs an action, of a mistake. */
  mistake: number;
  /** Standard deviation of its timing (jump and crouch presses), seconds. */
  timing: number;
  /** How far ahead it sees, in seconds of travel. */
  sight: number;
  /** Seconds a wrong lane or a forgotten action goes unnoticed before it is put right. */
  noticeLag: number;
  /** It plans the lane for the row after the next one too (an oracle's habit). */
  lookahead: boolean;
  /** It does nothing at all. */
  idle: boolean;
}

export const BOT_PROFILES: Record<BotName, BotProfile> = {
  idle: { name: 'idle', reaction: 0, mistake: 0, timing: 0, sight: 0, noticeLag: 0, lookahead: false, idle: true },
  novice: { name: 'novice', reaction: 0.35, mistake: 0.15, timing: 0.07, sight: 1.4, noticeLag: 0.4, lookahead: false, idle: false },
  average: { name: 'average', reaction: 0.25, mistake: 0.08, timing: 0.04, sight: 1.6, noticeLag: 0.3, lookahead: false, idle: false },
  expert: { name: 'expert', reaction: 0.14, mistake: 0.02, timing: 0.02, sight: 1.8, noticeLag: 0.2, lookahead: false, idle: false },
  perfect: { name: 'perfect', reaction: 0, mistake: 0, timing: 0, sight: 3, noticeLag: 0, lookahead: true, idle: false },
};

export interface Bot {
  /** Called before every sim step: looks, thinks, presses. */
  act(sim: RunnerSim): void;
}

/** A row of obstacles as the bot sees it: what is in each lane, how long it is, where it is. */
interface SeenRow {
  z: number;
  lanes: Row['lanes'];
  length: number;
}

type Mistake = 'wrongLane' | 'forget' | 'mistime' | 'slow' | 'earlyRelease';

interface Plan {
  lane: Lane;
  mode: PassMode;
  /** Sim time of the first key press. */
  actAt: number;
  steered: boolean;
  pressed: boolean;
  /** Seconds added to the jump or crouch press (its noise, plus a mistimed jump's error). */
  offset: number;
  /** When to let go of a crouch: once cleared (the normal way), a moment after the row's front, or late. */
  release: 'cleared' | 'early' | 'late';
  mistake: Mistake | null;
  /** When a wrong lane or a forgotten action is noticed and put right (sim time), or null. */
  fixAt: number | null;
}

/** The standard normal, from two uniform draws (Box-Muller). */
function gaussian(rand: Random): number {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

/** Rows of the sim's obstacles in front of `from` (a distance), nearest first. */
function rowsAhead(sim: RunnerSim, from: number, limit: number): SeenRow[] {
  const rows: SeenRow[] = [];
  const hb = sim.cfg.hitbox;
  for (const o of sim.obstacles) {
    if (o.z + hb[o.kind].length / 2 + hb.rover.length / 2 <= from) continue;
    let row = rows[rows.length - 1];
    if (!row || row.z !== o.z) {
      if (rows.length >= limit) break;
      row = { z: o.z, lanes: [null, null, null], length: 0 };
      rows.push(row);
    }
    row.lanes[o.lane + 1] = o.kind;
    row.length = Math.max(row.length, hb[o.kind].length);
  }
  return rows;
}

export function createBot(profile: BotProfile, seed: number): Bot {
  if (profile.idle) return { act() {} };
  const rand = mulberry32(seed ^ 0x5bd1e995);
  const noticed = new Map<number, number>();
  let targetZ: number | null = null;
  let plan: Plan | null = null;
  let lastMode: PassMode = 'run';
  let clearedAt = 0;
  let releaseAt: number | null = null;
  let held = false;

  const press = (sim: RunnerSim, p: Plan): void => {
    if (p.mode === 'crouch') {
      sim.input('crouch');
      held = true;
    } else if (p.mode === 'jump') sim.input('jump');
    p.pressed = true;
  };

  const choose = (sim: RunnerSim, row: SeenRow, after: SeenRow | undefined, mayErr = true): Plan => {
    const cfg = sim.cfg;
    let best: { lane: Lane; mode: PassMode; cost: number } | null = null;
    for (const t of passableLanes(row)) {
      let cost = requiredTime(sim.lane, lastMode, t.lane, t.mode, cfg);
      if (profile.lookahead && after) {
        // The oracle also keeps the next row easy to reach: the time that lane needs, from where this one leaves it.
        let next = Infinity;
        for (const u of passableLanes(after)) next = Math.min(next, requiredTime(t.lane, t.mode, u.lane, u.mode, cfg));
        cost += 0.5 * next;
      }
      if (!best || cost < best.cost) best = { ...t, cost };
    }
    const lane = best?.lane ?? sim.lane;
    const mode = best?.mode ?? 'run';
    const needsAction = lane !== sim.lane || mode !== 'run';
    const p: Plan = {
      lane,
      mode,
      actAt: 0,
      steered: false,
      pressed: false,
      offset: profile.timing * gaussian(rand),
      release: 'cleared',
      mistake: null,
      fixAt: null,
    };
    if (mayErr && needsAction && rand() < profile.mistake) applyMistake(sim, row, p);
    return p;
  };

  /** A slip: one of five, among the ones that can happen for this row. */
  const applyMistake = (sim: RunnerSim, row: SeenRow, p: Plan): void => {
    const options: [Mistake, number][] = [
      ['wrongLane', 0.3],
      ['forget', 0.3],
      ['slow', 0.2],
    ];
    if (p.mode === 'jump') options.push(['mistime', 0.15]);
    if (p.mode === 'crouch') options.push(['earlyRelease', 0.15]);
    const total = options.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    let kind = options[0][0];
    for (const [k, w] of options) {
      r -= w;
      if (r < 0) {
        kind = k;
        break;
      }
    }
    p.mistake = kind;
    if (kind === 'wrongLane') {
      const others = ([-1, 0, 1] as Lane[]).filter((l) => l !== p.lane);
      p.lane = others[Math.floor(rand() * others.length)];
      p.mode = passMode(row.lanes[p.lane + 1]) ?? 'run';
    } else if (kind === 'forget') {
      p.lane = sim.lane;
      p.mode = 'run';
    } else if (kind === 'mistime') {
      p.offset += (rand() < 0.5 ? -1 : 1) * (0.3 + rand() * 0.15);
    } else if (kind === 'earlyRelease') {
      p.release = 'early';
    }
  };

  return {
    act(sim) {
      if (sim.phase !== 'playing') return;
      const cfg = sim.cfg;
      const rover = cfg.hitbox.rover;
      const rows = rowsAhead(sim, sim.distance, 3);
      for (const row of rows) {
        if (!noticed.has(row.z) && row.z - sim.distance <= profile.sight * sim.speed) noticed.set(row.z, sim.time);
      }
      const next = rows[0];

      if ((next?.z ?? null) !== targetZ) {
        // The row we were working on is cleared.
        if (targetZ !== null) {
          clearedAt = sim.time;
          lastMode = plan?.mode ?? 'run';
          noticed.delete(targetZ);
          if (plan?.mode === 'crouch' && held) {
            // Let go: at once when the plan was to, a little late for the careless.
            releaseAt = sim.time + (plan.release === 'late' ? 0.4 : Math.abs(profile.timing * gaussian(rand)));
          }
        }
        targetZ = next?.z ?? null;
        plan = null;
      }

      if (releaseAt !== null && sim.time >= releaseAt) {
        sim.input('crouchEnd');
        held = false;
        releaseAt = null;
      }
      if (!next || targetZ === null) return;

      if (!plan && noticed.has(targetZ)) {
        plan = choose(sim, next, rows[1]);
        const slow = plan.mistake === 'slow' ? 0.25 : 0;
        plan.actAt = Math.max(clearedAt, noticed.get(targetZ) ?? 0) + profile.reaction + slow;
        if (plan.mistake === 'wrongLane' || plan.mistake === 'forget') plan.fixAt = plan.actAt + profile.noticeLag;
        // A mistake worth having: the careless sometimes hold the crouch too long.
        if (plan.mode === 'crouch' && plan.release === 'cleared' && rand() < profile.mistake * 0.5) plan.release = 'late';
      }
      if (!plan) return;
      if (plan.fixAt !== null && sim.time >= plan.fixAt) {
        // It sees the slip: the right plan, from here, as if it had only now thought of it.
        const seen = rows[0];
        const fixed = choose(sim, seen, rows[1], false);
        fixed.actAt = sim.time;
        plan = fixed;
        if (held) {
          sim.input('crouchEnd');
          held = false;
        }
      }
      if (sim.time < plan.actAt) return;

      if (!plan.steered) {
        for (let k = sim.lane; k < plan.lane; k++) sim.input('right');
        for (let k = sim.lane; k > plan.lane; k--) sim.input('left');
        plan.steered = true;
      }
      const kind = next.lanes[plan.lane + 1];
      const len = kind ? cfg.hitbox[kind].length : 0;
      const toContact = (next.z - len / 2 - rover.length / 2 - sim.distance) / Math.max(sim.speed, 1e-6);
      if (plan.mode === 'jump' && !plan.pressed) {
        // The window in which a jump clears a barrier is the jump's length less the rise at both ends and the time the rover
        // takes to pass it; the middle of that window is the best moment.
        const lead = jumpLeadTime(cfg);
        const through = (len + rover.length) / sim.speed;
        const slack = Math.max(0, cfg.jump.duration - 2 * lead - through);
        if (toContact <= lead + slack / 2 - plan.offset) press(sim, plan);
      } else if (plan.mode === 'crouch') {
        if (!plan.pressed) {
          const fall = sim.grounded ? 0 : sim.y / cfg.crouch.slamSpeed;
          if (toContact <= 0.3 + fall - plan.offset) press(sim, plan);
        } else if (plan.release === 'early' && held && toContact <= -0.03) {
          // Let go while the rover is still under the beam.
          sim.input('crouchEnd');
          held = false;
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Playing many runs and summarising them.

export interface RunResult {
  seed: number;
  /** Seconds of play when the run ended (the cap if it never did). */
  time: number;
  distance: number;
  score: number;
  /** Where it ended: the obstacle's kind, the speed then, and whether the cap stopped it instead. */
  crash: { kind: string; speed: number } | null;
}

export interface PlayOptions {
  config?: RunnerConfig;
  /** Stop a run that lasts this long (seconds of play). */
  maxTime?: number;
}

export function playRun(profile: BotProfile, seed: number, opts: PlayOptions = {}): RunResult {
  const cfg = opts.config ?? RUNNER_CONFIG;
  const maxTime = opts.maxTime ?? 600;
  const sim = new RunnerSim({ seed, config: cfg });
  sim.start(true);
  const bot = createBot(profile, seed);
  while (sim.phase === 'playing' && sim.time < maxTime) {
    bot.act(sim);
    sim.step();
  }
  return {
    seed,
    time: sim.time,
    distance: sim.distance,
    score: sim.score,
    crash: sim.crash ? { kind: sim.crash.kind, speed: sim.speed } : null,
  };
}

export interface Summary {
  bot: BotName;
  runs: number;
  /** Runs that reached the time cap alive. */
  survivors: number;
  time: { median: number; mean: number; p90: number };
  distance: { median: number; mean: number; p90: number };
  /** Deaths per obstacle kind, and per band of speed (by `speedBand` m/s). */
  byKind: Record<string, number>;
  bySpeed: { from: number; to: number; deaths: number }[];
}

const quantile = (sorted: number[], q: number): number => {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.min(sorted.length - 1, lo + 1)] - sorted[lo]) * (i - lo);
};

export function summarize(bot: BotName, results: RunResult[], speedBand = 5): Summary {
  const stat = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      median: quantile(sorted, 0.5),
      mean: values.reduce((s, v) => s + v, 0) / Math.max(1, values.length),
      p90: quantile(sorted, 0.9),
    };
  };
  const byKind: Record<string, number> = {};
  const bands = new Map<number, number>();
  let survivors = 0;
  for (const r of results) {
    if (!r.crash) {
      survivors++;
      continue;
    }
    byKind[r.crash.kind] = (byKind[r.crash.kind] ?? 0) + 1;
    const band = Math.floor(r.crash.speed / speedBand) * speedBand;
    bands.set(band, (bands.get(band) ?? 0) + 1);
  }
  return {
    bot,
    runs: results.length,
    survivors,
    time: stat(results.map((r) => r.time)),
    distance: stat(results.map((r) => r.distance)),
    byKind,
    bySpeed: [...bands.entries()].sort((a, b) => a[0] - b[0]).map(([from, deaths]) => ({ from, to: from + speedBand, deaths })),
  };
}

export function playMany(profile: BotProfile, runs: number, opts: PlayOptions & { firstSeed?: number } = {}): Summary {
  const results: RunResult[] = [];
  const first = opts.firstSeed ?? 1;
  for (let i = 0; i < runs; i++) results.push(playRun(profile, Math.imul(first + i, 2654435761) >>> 0, opts));
  return summarize(profile.name, results);
}

/** The summary as the table in docs/RUNNER.md: one row per bot. */
export function formatTable(summaries: Summary[]): string {
  const f = (v: number, d = 0) => v.toFixed(d);
  const lines = [
    '| Bot | Runs | Median time | Mean time | 90th pct time | Median distance | Mean distance | 90th pct distance | Alive at cap |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const s of summaries) {
    lines.push(
      `| ${s.bot} | ${s.runs} | ${f(s.time.median, 1)} s | ${f(s.time.mean, 1)} s | ${f(s.time.p90, 1)} s | ${f(s.distance.median)} m | ${f(s.distance.mean)} m | ${f(s.distance.p90)} m | ${s.survivors} |`,
    );
  }
  lines.push('', '| Bot | Deaths by obstacle | Deaths by speed (m/s) |', '| --- | --- | --- |');
  for (const s of summaries) {
    const kinds = Object.entries(s.byKind)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(', ');
    const speeds = s.bySpeed.map((b) => `${b.from}-${b.to}: ${b.deaths}`).join(', ');
    lines.push(`| ${s.bot} | ${kinds || 'none'} | ${speeds || 'none'} |`);
  }
  return lines.join('\n');
}
