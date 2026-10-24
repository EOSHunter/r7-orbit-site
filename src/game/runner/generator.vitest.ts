import { describe, expect, it } from 'vitest';
import { RUNNER_CONFIG, speedAt, withConfig, type RunnerConfig } from './config';
import {
  createGenerator,
  fixedCourse,
  jumpLeadTime,
  minRowSpacing,
  passableLanes,
  requiredTime,
  rowGapTime,
  rowLength,
  type Lane,
  type PassMode,
  type Row,
} from './generator';
import { mulberry32 } from './random';
import { RunnerSim } from './sim';

const cfg = RUNNER_CONFIG;
const SPEEDS = [cfg.speed.start, 18, 23, cfg.speed.max];
const fixedSpeed = (v: number) => withConfig({ speed: { start: v, max: v } });

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
    // Only a slab blocks the way: a full wall of slabs has no route.
    expect(rowGapTime(null, { lanes: ['slab', 'slab', 'slab'] })).toBe(Infinity);
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
});

describe('generated courses (structure, thousands of seeds)', () => {
  for (const speed of SPEEDS) {
    it(`at ${speed} m/s: never three slabs, always a passable lane, every gap at least the fair minimum`, () => {
      let rows = 0;
      let walls = 0;
      const problems: string[] = [];
      for (let seed = 1; seed <= 2500; seed++) {
        const gen = createGenerator(seed, cfg);
        let prev: Row | null = null;
        for (let i = 0; i < 60; i++) {
          const row = gen.next(speed);
          rows++;
          const at = `seed ${seed} row ${i}`;
          if (passableLanes(row).length === 0) problems.push(`${at}: no passable lane`);
          if (row.lanes.every((k) => k !== null)) walls++;
          if (prev && row.z - prev.z < minRowSpacing(prev, row, speed) - 1e-9) problems.push(`${at}: gap too short`);
          if (!prev && row.z !== cfg.spawn.firstRowAt) problems.push(`${at}: first row misplaced`);
          for (const p of row.pickups) {
            if (p.z > row.z + 1e-9 || (prev && p.z <= prev.z + rowLength(prev) / 2))
              problems.push(`${at}: pickup outside its gap`);
          }
          prev = row;
        }
      }
      expect(problems.slice(0, 10)).toEqual([]);
      expect(rows).toBe(2500 * 60);
      expect(walls, 'walls of three obstacles do occur').toBeGreaterThan(0);
    }, 60_000);
  }

  it('the same seed gives the same course; another seed another', () => {
    const take = (seed: number) => {
      const g = createGenerator(seed);
      return Array.from({ length: 30 }, () => g.next(15));
    };
    expect(take(5)).toEqual(take(5));
    expect(take(5)).not.toEqual(take(6));
  });
});

/**
 * A bot that plays like a player within the fairness budget: it may only start acting on a row once the rover has cleared
 * the one before and its reaction time has passed. Then it changes lane towards the lane of the next row that needs the
 * least time, and jumps or slides at the last sensible moment. It plays the REAL sim, so this checks the physics, not only
 * the generator's arithmetic: if a course ever needed a move faster than a player can make, the bot would crash.
 */
function botPlay(
  seed: number,
  config: RunnerConfig,
  rowsToPass: number,
  course?: () => ReturnType<typeof fixedCourse>,
) {
  const sim = new RunnerSim({ seed, config, course: course ? () => course() : undefined });
  sim.start(true);
  const rover = config.hitbox.rover;
  const r = config.generator.reactionTime;
  let passed = 0;
  let targetZ = -1;
  let plan: { lane: Lane; mode: PassMode; actAt: number; steered: boolean; done: boolean } | null = null;
  let lastMode: PassMode = 'run';
  let clearedAt = 0;

  const rowAt = (z: number): Pick<Row, 'lanes'> => {
    const lanes: Row['lanes'] = [null, null, null];
    for (const o of sim.obstacles) if (o.z === z) lanes[o.lane + 1] = o.kind;
    return { lanes };
  };

  for (let i = 0; i < 2e6 && sim.phase === 'playing' && passed < rowsToPass; i++) {
    // The next row is the nearest one the rover has not fully cleared.
    let next = Infinity;
    for (const o of sim.obstacles) {
      if (o.z + config.hitbox[o.kind].length / 2 + rover.length / 2 > sim.distance) next = Math.min(next, o.z);
    }
    if (next !== targetZ) {
      if (targetZ >= 0) {
        passed++;
        clearedAt = sim.time;
        lastMode = plan?.mode ?? 'run';
      }
      targetZ = next;
      plan = null;
      if (Number.isFinite(next)) {
        const row = rowAt(next);
        let best: { lane: Lane; mode: PassMode; t: number } | null = null;
        for (const t of passableLanes(row)) {
          const need = requiredTime(sim.lane, lastMode, t.lane, t.mode, config);
          if (!best || need < best.t) best = { ...t, t: need };
        }
        plan = best ? { lane: best.lane, mode: best.mode, actAt: clearedAt + r, steered: false, done: false } : null;
      }
    }
    if (plan && sim.time >= plan.actAt) {
      if (!plan.steered) {
        for (let k = sim.lane; k < plan.lane; k++) sim.input('right');
        for (let k = sim.lane; k > plan.lane; k--) sim.input('left');
        plan.steered = true;
      }
      const kind = rowAt(targetZ).lanes[plan.lane + 1];
      const len = kind ? config.hitbox[kind].length : 0;
      const toContact = (targetZ - len / 2 - rover.length / 2 - sim.distance) / sim.speed;
      if (!plan.done && plan.mode === 'jump' && toContact <= jumpLeadTime(config) + 0.02 && sim.grounded) {
        sim.input('jump');
        plan.done = true;
      }
      const fall = sim.grounded ? 0 : sim.y / config.slide.slamSpeed;
      if (!plan.done && plan.mode === 'slide' && toContact <= 0.1 + fall) {
        sim.input('slide');
        plan.done = true;
      }
    }
    sim.step();
  }
  return { passed, crash: sim.crash, distance: sim.distance };
}

describe('generated courses (played by a bot within the fairness budget)', () => {
  for (const speed of SPEEDS) {
    it(`at ${speed} m/s: 500 seeded courses of 30 rows, never a crash`, () => {
      const config = fixedSpeed(speed);
      for (let seed = 1; seed <= 500; seed++) {
        const run = botPlay(seed * 7919, config, 30);
        expect(run.crash, `seed ${seed * 7919} at ${speed} m/s crashed at ${run.distance.toFixed(1)} m`).toBeNull();
        expect(run.passed).toBe(30);
      }
    }, 60_000);
  }

  it('with the real speed curve (ramping to the cap): 60 courses of 120 rows, never a crash', () => {
    const quickRamp = withConfig({ speed: { rampTime: 40 } });
    for (let seed = 1; seed <= 60; seed++) {
      const run = botPlay(seed, quickRamp, 120);
      expect(run.crash, `seed ${seed} crashed at ${run.distance.toFixed(1)} m`).toBeNull();
    }
    expect(speedAt(60, quickRamp)).toBe(quickRamp.speed.max);
  }, 60_000);

  it('the bot does crash on an unfair course (the test has teeth)', () => {
    // Only the left lane passes the first row, only the right lane the second, 6 m apart at the cap: no time to cross.
    const config = fixedSpeed(cfg.speed.max);
    const unfair = () =>
      fixedCourse([
        { z: 60, lanes: [null, 'slab', 'slab'] },
        { z: 66, lanes: ['slab', 'slab', null] },
      ]);
    const run = botPlay(1, config, 2, unfair);
    expect(run.crash).not.toBeNull();
  });
});
