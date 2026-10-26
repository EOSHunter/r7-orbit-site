import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, createBot, type BotProfile } from './bots';
import { RUNNER_CONFIG, speedAt, timeAtDistance, withConfig, type RunnerConfig } from './config';
import {
  createGenerator,
  fixedCourse,
  jumpLeadTime,
  minRowSpacing,
  passableLanes,
  requiredTime,
  rowGapTime,
  rowLength,
  sweepFraction,
  tierAt,
  type Row,
} from './generator';
import { mulberry32 } from './random';
import { RunnerSim } from './sim';

const cfg = RUNNER_CONFIG;
const SPEEDS = [cfg.speed.start, 20, 27, 34, cfg.speed.max];
const fixedSpeed = (v: number, extra: Parameters<typeof withConfig>[0] = {}) =>
  withConfig({ speed: { start: v, max: v }, ...extra });
/** Every pattern and hazard from the first row, so a short course at a given speed meets all of them. */
const EVERYTHING = { generator: { tiers: { two: 0, three: 0 }, hazards: { wall: 0, sweeper: 0 } } };
const BLOCKED = new Set(['slab', 'wall', 'sweeper']);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
/** Seconds of clear track between two rows, from the rover clearing the first to it reaching the second. */
const gapTime = (prev: Row, row: Row, speed: number, config: RunnerConfig) =>
  (row.z - prev.z - (rowLength(prev, config) + rowLength(row, config)) / 2 - config.hitbox.rover.length) / speed;

describe('mulberry32', () => {
  it('is deterministic per seed and spread over [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(xs.reduce((s, x) => s + x, 0) / xs.length).toBeCloseTo(0.5, 1);
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });
});

describe('the fairness budget', () => {
  it('a lane change plus a jump needs the time of both moves, not one', () => {
    const r = cfg.generator.reactionTime;
    // From the ground: two lane changes and a jump can overlap; the slower of the two counts.
    expect(requiredTime(-1, 'run', 1, 'jump')).toBeCloseTo(
      r + Math.max(2 * cfg.track.laneChangeTime, jumpLeadTime()),
      9,
    );
    // Still in the air from jumping the last row: the next jump waits for the landing.
    expect(requiredTime(-1, 'jump', 1, 'jump')).toBeGreaterThanOrEqual(r + cfg.jump.duration + jumpLeadTime());
    // Only a slab blocks the way: a full wall of slabs has no route, and neither has a wall panel or a sweeper in every lane.
    expect(rowGapTime(null, { lanes: ['slab', 'slab', 'slab'] })).toBe(Infinity);
    expect(rowGapTime(null, { lanes: ['wall', 'sweeper', 'sweeper'] })).toBe(Infinity);
  });

  it('from every lane a player could have used, the gap reaches some lane of the next row', () => {
    const prev: Pick<Row, 'lanes'> = { lanes: ['barrier', 'slab', 'slab'] }; // only the left lane, by jumping
    const next: Pick<Row, 'lanes'> = { lanes: ['slab', 'slab', 'barrier'] }; // only the right lane, by jumping
    const t = rowGapTime(prev, next);
    expect(t).toBeCloseTo(requiredTime(-1, 'jump', 1, 'jump'), 9);
    const spacing = minRowSpacing(prev, next, cfg.speed.max);
    expect(spacing).toBeCloseTo(
      (rowLength(prev) + rowLength(next)) / 2 + cfg.hitbox.rover.length + cfg.speed.max * t,
      9,
    );
  });

  it('a wall with an opening and a sweeper leave exactly the lane that is not blocked', () => {
    expect(passableLanes({ lanes: ['wall', null, 'wall'] })).toEqual([{ lane: 0, mode: 'run' }]);
    expect(passableLanes({ lanes: ['wall', 'gate', 'wall'] })).toEqual([{ lane: 0, mode: 'crouch' }]);
    expect(passableLanes({ lanes: ['sweeper', 'sweeper', 'barrier'] })).toEqual([{ lane: 1, mode: 'jump' }]);
  });
});

describe('the speed curve and the reaction window', () => {
  it('rises steadily from 13 to 40 m/s over 3 minutes, easing into the cap, and stays there', () => {
    expect(speedAt(0)).toBe(13);
    expect(speedAt(cfg.speed.rampTime)).toBe(40);
    expect(speedAt(cfg.speed.rampTime * 5)).toBe(40);
    expect(cfg.speed.rampTime).toBe(180);
    let last = 0;
    let lastSlope = Infinity;
    for (let t = 0; t < 180; t += 10) {
      const v = speedAt(t);
      expect(v).toBeGreaterThanOrEqual(last);
      const slope = speedAt(t + 1) - v;
      expect(slope, `still rising at ${t} s`).toBeGreaterThan(0);
      expect(slope, 'never speeds up faster than before').toBeLessThanOrEqual(lastSlope + 1e-9);
      last = v;
      lastSlope = slope;
    }
    // Steady: about 0.2 m/s every second at the start, and 20 m/s or so after half a minute.
    expect(speedAt(1) - speedAt(0)).toBeGreaterThan(0.15);
    expect(speedAt(1) - speedAt(0)).toBeLessThan(0.3);
    expect(speedAt(30)).toBeGreaterThan(18);
    expect(speedAt(30)).toBeLessThan(23);
    expect(speedAt(180) - speedAt(179)).toBeLessThan(0.01);
  });

  it('timeAtDistance inverts the sim: the rover is where the generator says at the time it says', () => {
    const sim = new RunnerSim({ seed: 1, course: () => fixedCourse([]) });
    sim.start(true);
    const checks = [100, 500, 1500, 4000, 9000];
    let i = 0;
    while (i < checks.length) {
      sim.step();
      if (sim.distance >= checks[i]) {
        expect(Math.abs(sim.time - timeAtDistance(checks[i]))).toBeLessThan(0.02);
        i++;
      }
    }
  });

  for (const speed of [cfg.speed.start, 27, cfg.speed.max]) {
    it(`at ${speed} m/s no gap is shorter than minGap (${cfg.generator.minGap} s) or than fairness needs`, () => {
      const config = fixedSpeed(speed, EVERYTHING);
      let pairs = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const gen = createGenerator(seed, config);
        let prev: Row | null = null;
        for (let i = 0; i < 40; i++) {
          const row = gen.next(speed);
          if (prev) {
            const need = rowGapTime(prev, row, config);
            expect(gapTime(prev, row, speed, config), `seed ${seed} row ${i}`).toBeGreaterThanOrEqual(
              Math.max(need, config.generator.minGap) - 1e-9,
            );
            pairs++;
          }
          prev = row;
        }
      }
      expect(pairs).toBe(300 * 39);
    });
  }

  it('the gap between patterns is long at the start speed and shrinks to near the minimum at the cap', () => {
    const singles = { generator: { patterns: { single: [1, 1, 1] as [number, number, number] } } };
    const gaps = (speed: number, extra: Parameters<typeof withConfig>[0] = singles) => {
      const config = withConfig(extra);
      const out: number[] = [];
      for (let seed = 1; seed <= 150; seed++) {
        const gen = createGenerator(seed, config);
        let prev: Row | null = null;
        for (let i = 0; i < 30; i++) {
          const row = gen.next(speed);
          if (prev) out.push(gapTime(prev, row, speed, config));
          prev = row;
        }
      }
      return out;
    };
    const start = median(gaps(cfg.speed.start));
    const mid = median(gaps((cfg.speed.start + cfg.speed.max) / 2));
    const cap = median(gaps(cfg.speed.max));
    expect(start).toBeGreaterThan(2.3);
    expect(mid).toBeLessThan(start * 0.75);
    expect(cap).toBeLessThan(mid * 0.8);
    expect(cap).toBeGreaterThanOrEqual(cfg.generator.minGap);
    expect(cap).toBeLessThan(1.1);
    // Tier 3 closes it further than tier 1, at the same speed.
    const t1 = median(gaps(20, { ...singles, generator: { ...singles.generator, tiers: { two: 1e9, three: 1e9 } } }));
    const t3 = median(gaps(20, { ...singles, generator: { ...singles.generator, tiers: { two: 0, three: 0 } } }));
    expect(t3).toBeLessThan(t1 * 0.9);
  });
});

describe('generated courses (structure, thousands of seeds)', () => {
  for (const speed of SPEEDS) {
    it(`at ${speed} m/s: never fully blocked, always a passable lane, every gap fair, pickups inside their gap`, () => {
      const config = fixedSpeed(speed, EVERYTHING);
      const seen = new Set<string>();
      const problems: string[] = [];
      for (let seed = 1; seed <= 1500; seed++) {
        const gen = createGenerator(seed, config);
        let prev: Row | null = null;
        for (let i = 0; i < 40; i++) {
          const row = gen.next(speed);
          seen.add(row.pattern ?? '?');
          const at = `seed ${seed} row ${i} (${row.pattern})`;
          if (passableLanes(row).length === 0) problems.push(`${at}: no passable lane`);
          if (row.lanes.every((k) => k !== null && BLOCKED.has(k))) problems.push(`${at}: every lane blocked`);
          if (prev && row.z - prev.z < minRowSpacing(prev, row, speed, config) - 1e-9)
            problems.push(`${at}: gap too short`);
          if (!prev && row.z !== config.spawn.firstRowAt) problems.push(`${at}: first row misplaced`);
          for (const p of row.pickups) {
            if (p.z > row.z + 1e-9 || (prev && p.z <= prev.z + rowLength(prev, config) / 2))
              problems.push(`${at}: pickup outside its gap`);
          }
          if (row.sweep) {
            // Two lanes marked, the third passable, and the swing ends over one of the two exactly when the rover arrives.
            const marked = row.lanes.map((k) => k === 'sweeper');
            if (marked.filter(Boolean).length !== 2 || !marked[row.sweep.lane + 1] || !marked[row.sweep.lane + 2])
              problems.push(`${at}: sweeper lanes`);
            const f = sweepFraction(row.sweep, timeAtDistance(row.z, config));
            if (Math.min(f, 1 - f) > 1e-6) problems.push(`${at}: sweeper not at an end on arrival (${f})`);
          }
          prev = row;
        }
      }
      expect(problems.slice(0, 10)).toEqual([]);
      for (const name of Object.keys(cfg.generator.patterns)) expect(seen, name).toContain(name);
    }, 60_000);
  }

  it('the same seed gives the same course; another seed another', () => {
    const take = (seed: number) => {
      const g = createGenerator(seed);
      return Array.from({ length: 60 }, () => g.next(20));
    };
    expect(take(5)).toEqual(take(5));
    expect(take(5)).not.toEqual(take(6));
  });
});

describe('tiers and hazards unlock by distance', () => {
  /** The rows of many seeded courses, with the speed the rover has when it gets there. */
  function courses(seeds: number, rows: number): Row[][] {
    const out: Row[][] = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const gen = createGenerator(seed);
      const list: Row[] = [];
      for (let i = 0; i < rows; i++) {
        const last = list[list.length - 1];
        list.push(gen.next(speedAt(last ? timeAtDistance(last.z) + 2 : 0)));
      }
      out.push(list);
    }
    return out;
  }
  const all = courses(300, 200);

  it('the first obstacle is a slab or a barrier alone in the middle lane; the free run before it is 8 to 10 s', () => {
    for (const list of all) {
      expect(list[0].lanes[1]).toMatch(/slab|barrier/);
      expect(list[0].lanes[0]).toBeNull();
      expect(list[0].lanes[2]).toBeNull();
    }
    const seconds = (cfg.spawn.firstRowAt - cfg.hitbox.rover.length / 2) / cfg.speed.start;
    expect(seconds).toBeGreaterThanOrEqual(7.5);
    expect(seconds).toBeLessThanOrEqual(10);
  });

  it('tier 1 (before 200 m) is single obstacles only; pairs and combinations come at tier 2', () => {
    let tier1 = 0;
    let tier2 = 0;
    const names = new Set<string>();
    for (const list of all) {
      for (const row of list) {
        if (tierAt(row.z) === 1) {
          tier1++;
          expect(row.pattern, `z ${row.z}`).toBe('single');
          expect(row.lanes.filter(Boolean).length).toBe(1);
        } else if (row.z < cfg.generator.tiers.three) {
          tier2++;
          names.add(row.pattern!);
        }
      }
    }
    expect(tier1).toBeGreaterThan(300);
    expect(tier2).toBeGreaterThan(1000);
    for (const n of ['single', 'pair', 'barrierGate', 'gateDodge', 'dodgeJump', 'trio']) expect(names, n).toContain(n);
    expect(names).not.toContain('slalom');
    expect(names).not.toContain('chain3');
  });

  it('the wall appears from 500 m, the sweeper from 1,000 m and tier 3 from its distance, never before', () => {
    const firstAt: Record<string, number> = {};
    for (const list of all) {
      for (const row of list) firstAt[row.pattern!] = Math.min(firstAt[row.pattern!] ?? Infinity, row.z);
    }
    const g = cfg.generator;
    expect(firstAt.wall).toBeGreaterThanOrEqual(g.hazards.wall);
    expect(firstAt.wallSlalom).toBeGreaterThanOrEqual(g.hazards.wall);
    expect(firstAt.sweeper).toBeGreaterThanOrEqual(g.hazards.sweeper);
    expect(firstAt.slalom).toBeGreaterThanOrEqual(g.tiers.three);
    expect(firstAt.chain3).toBeGreaterThanOrEqual(g.tiers.three);
    // ...and they do appear soon after.
    expect(firstAt.wall).toBeLessThan(g.hazards.wall + 400);
    expect(firstAt.sweeper).toBeLessThan(g.hazards.sweeper + 400);
    expect(firstAt.chain3).toBeLessThan(g.tiers.three + 600);
  });

  it('pickups lead along the risky way: over barriers, under gates, through combinations and hazards', () => {
    let jumpPicks = 0;
    let crouchPicks = 0;
    let combos = 0;
    let withPickups = 0;
    for (const list of all) {
      for (const row of list) {
        const comboRow = !['single', 'pair'].includes(row.pattern!);
        if (comboRow) combos++;
        if (comboRow && row.pickups.length) withPickups++;
        for (const p of row.pickups) {
          if (p.z !== row.z) continue;
          const kind = row.lanes[p.lane + 1];
          // Never a pickup inside a blocked lane.
          expect(kind === null || kind === 'barrier' || kind === 'gate', `pickup in a ${kind}`).toBe(true);
          if (kind === 'barrier') {
            jumpPicks++;
            expect(p.y).toBe(cfg.generator.pickupHeightOverBarrier);
          }
          if (kind === 'gate') {
            crouchPicks++;
            expect(p.y).toBe(cfg.generator.pickupHeightUnderGate);
          }
        }
      }
    }
    expect(jumpPicks).toBeGreaterThan(100);
    expect(crouchPicks).toBeGreaterThan(100);
    expect(withPickups / combos, 'combinations nearly always carry pickups').toBeGreaterThan(0.7);
  });
});

/**
 * A bot that plays like a player within the fairness budget: reaction time exactly the generator's, no mistakes, no timing
 * noise. It plays the REAL sim, so this checks the physics (the jump window, the crouch, the sweeper, the walls), not only the
 * generator's arithmetic: if a course ever needed a move faster than the budget allows, it would crash.
 */
const FAIR: BotProfile = {
  ...BOT_PROFILES.average,
  reaction: RUNNER_CONFIG.generator.reactionTime,
  mistake: 0,
  timing: 0,
  noticeLag: 0,
};

function fairPlay(seed: number, config: RunnerConfig, rowsToPass: number, course?: () => ReturnType<typeof fixedCourse>) {
  const sim = new RunnerSim({ seed, config, course });
  sim.start(true);
  const bot = createBot(FAIR, seed);
  let passed = 0;
  let lastZ = -1;
  for (let i = 0; i < 4e6 && sim.phase === 'playing' && passed < rowsToPass; i++) {
    bot.act(sim);
    sim.step();
    // A row is passed once the rover's centre is beyond its far edge.
    for (const o of sim.obstacles) {
      if (o.z > lastZ && o.z + config.hitbox[o.kind].length / 2 + config.hitbox.rover.length / 2 < sim.distance) {
        lastZ = o.z;
        passed++;
      }
    }
  }
  return { passed, crash: sim.crash, distance: sim.distance };
}

describe('generated courses (played by a bot within the fairness budget)', () => {
  for (const speed of SPEEDS) {
    it(`at ${speed} m/s: 200 seeded courses of 40 rows with every pattern and hazard, never a crash`, () => {
      const config = fixedSpeed(speed, EVERYTHING);
      for (let seed = 1; seed <= 200; seed++) {
        const run = fairPlay(seed * 7919, config, 40);
        expect(
          run.crash,
          `seed ${seed * 7919} at ${speed} m/s crashed on ${run.crash?.kind} at ${run.distance.toFixed(1)} m`,
        ).toBeNull();
        expect(run.passed).toBeGreaterThanOrEqual(40);
      }
    }, 120_000);
  }

  it('with the real speed curve (a 40 s ramp to the cap) and the real tiers: 80 courses of 200 rows, never a crash', () => {
    const quickRamp = withConfig({ speed: { rampTime: 40 } });
    for (let seed = 1; seed <= 80; seed++) {
      const run = fairPlay(seed, quickRamp, 200);
      expect(run.crash, `seed ${seed} crashed on ${run.crash?.kind} at ${run.distance.toFixed(1)} m`).toBeNull();
    }
    expect(speedAt(60, quickRamp)).toBe(quickRamp.speed.max);
  }, 180_000);

  it('the bot does crash on an unfair course (the test has teeth)', () => {
    // Only the left lane passes the first row, only the right lane the second, 6 m apart at the cap: no time to cross.
    const config = fixedSpeed(cfg.speed.max);
    const unfair = () =>
      fixedCourse([
        { z: 60, lanes: [null, 'slab', 'slab'] },
        { z: 66, lanes: ['slab', 'slab', null] },
      ]);
    const run = fairPlay(1, config, 2, unfair);
    expect(run.crash).not.toBeNull();
  });
});
