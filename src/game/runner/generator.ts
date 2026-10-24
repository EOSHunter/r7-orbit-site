// The course: rows of obstacles across the three lanes, in patterns, and lines of pickups between them. Pure logic, no
// rendering.
//
// Fairness (docs/RUNNER.md, "Fairness"): every row leaves at least one lane the rover can pass (a free lane, a barrier to jump
// or a gate to crouch under; never three blocked lanes), and the gap before each row is long enough that, from ANY lane the
// player could have used to pass the row before it, there is a lane of the new row they can reach in time: a reaction time,
// then the lane changes and the jump or crouch that lane needs, at the speed the rover will have when it gets there. The
// player can never pick a lane that traps them. generator.vitest.ts proves it by playing thousands of seeded courses.
//
// Difficulty (docs/RUNNER.md, "Difficulty and bots"): a pattern is one to three rows. The gap between patterns shrinks with the
// speed (never below `generator.minGap`); the rows inside a pattern are only a little further apart than fairness needs (a
// combination). Which patterns can appear depends on the DISTANCE (tiers), and the two hazards, the wall with one opening and
// the sweeper, start at their own distances.

import { RUNNER_CONFIG, jumpPhysics, speedProgress, timeAtDistance, type RunnerConfig } from './config';
import { mulberry32, pickWeighted } from './random';

export type BasicKind = 'slab' | 'barrier' | 'gate';
/** `wall` is one panel of a wall across the track (the lane left open is the way through); `sweeper` drifts between two lanes. */
export type ObstacleKind = BasicKind | 'wall' | 'sweeper';
export type Lane = -1 | 0 | 1;
export const LANES: readonly Lane[] = [-1, 0, 1];

/** How the rover gets through a lane of a row: drive on, jump, crouch, or not at all (a slab, a wall, a sweeper). */
export type PassMode = 'run' | 'jump' | 'crouch';

/**
 * A sweeper's path: it swings between lane `lane` and the lane to its right, along a smooth sine (so it is slow at the ends
 * and fastest in the middle), once there and back every `period` seconds of play. It is over `lane` at play time `t0` plus any
 * whole number of periods, and over the next lane half a period later. The generator sets `t0` so it is at one end exactly
 * when the rover arrives (the speed does not depend on the player), so one of the two lanes is open then.
 */
export interface Sweep {
  lane: Lane;
  period: number;
  t0: number;
}

/** One row across the track. `lanes[lane + 1]` is the obstacle in that lane, or null when it is open. */
export interface Row {
  /** Distance along the track of the row's centre, in metres. */
  z: number;
  lanes: [ObstacleKind | null, ObstacleKind | null, ObstacleKind | null];
  pickups: { lane: Lane; z: number; y: number }[];
  /** A row of a sweeper marks both its lanes `sweeper` (blocked, for fairness) and says how it moves here. */
  sweep?: Sweep;
  /** The pattern this row belongs to, for the tests and the bots' table (the sim ignores it). */
  pattern?: string;
}

export function passMode(kind: ObstacleKind | null): PassMode | null {
  if (kind === null) return 'run';
  if (kind === 'barrier') return 'jump';
  if (kind === 'gate') return 'crouch';
  return null;
}

/** The lanes of a row the rover can get through, with how. */
export function passableLanes(row: Pick<Row, 'lanes'>): { lane: Lane; mode: PassMode }[] {
  const out: { lane: Lane; mode: PassMode }[] = [];
  for (const lane of LANES) {
    const mode = passMode(row.lanes[lane + 1]);
    if (mode) out.push({ lane, mode });
  }
  return out;
}

/** Length along the track of a row's longest obstacle (0 for an empty row). */
export function rowLength(row: Pick<Row, 'lanes'>, cfg: RunnerConfig = RUNNER_CONFIG): number {
  return Math.max(0, ...row.lanes.map((k) => (k ? cfg.hitbox[k].length : 0)));
}

/** Time from pressing jump until the rover's underside is above a barrier (plus 5 cm), in seconds. */
export function jumpLeadTime(cfg: RunnerConfig = RUNNER_CONFIG): number {
  const { gravity, takeoff } = jumpPhysics(cfg);
  const h = cfg.hitbox.barrier.top + 0.05;
  return (takeoff - Math.sqrt(takeoff * takeoff - 2 * gravity * h)) / gravity;
}

/** Longest a slam (crouch pressed in the air) can take to bring the rover down from the top of a jump. */
export function slamTime(cfg: RunnerConfig = RUNNER_CONFIG): number {
  return cfg.jump.height / cfg.crouch.slamSpeed;
}

/**
 * Seconds needed between the moment the rover has fully cleared lane `a` of one row (passed with `modeA`) and the moment its
 * front reaches lane `b` of the next (to be passed with `modeB`): the reaction time, then the lane changes and the vertical
 * move, which can overlap (the rover can change lanes in the air or while crouched).
 */
export function requiredTime(
  a: Lane,
  modeA: PassMode,
  b: Lane,
  modeB: PassMode,
  cfg: RunnerConfig = RUNNER_CONFIG,
): number {
  const laneTime = Math.abs(a - b) * cfg.track.laneChangeTime;
  // Still in the air from jumping the last row: a new jump waits for the landing (at worst a whole jump), a crouch slams down.
  // From the ground or a crouch everything can start at once: a jump ends a crouch, and a crouch can be pressed again.
  let ready = 0;
  if (modeA === 'jump' && modeB === 'jump') ready = cfg.jump.duration;
  if (modeA === 'jump' && modeB === 'crouch') ready = slamTime(cfg);
  const lead = modeB === 'jump' ? jumpLeadTime(cfg) : modeB === 'crouch' ? cfg.crouch.inTime : 0;
  return cfg.generator.reactionTime + Math.max(laneTime, ready + lead);
}

/**
 * The time the gap between two rows must give: whichever lane the player used to pass `prev`, some lane of `next` is
 * reachable. Infinity when `next` has no passable lane (the generator never makes one).
 */
export function rowGapTime(
  prev: Pick<Row, 'lanes'> | null,
  next: Pick<Row, 'lanes'>,
  cfg: RunnerConfig = RUNNER_CONFIG,
): number {
  const to = passableLanes(next);
  if (to.length === 0) return Infinity;
  const from = prev ? passableLanes(prev) : LANES.map((lane) => ({ lane, mode: 'run' as PassMode }));
  let worst = 0;
  for (const f of from) {
    let best = Infinity;
    for (const t of to) best = Math.min(best, requiredTime(f.lane, f.mode, t.lane, t.mode, cfg));
    worst = Math.max(worst, best);
  }
  return worst;
}

/** The centre-to-centre distance two rows must be apart for the rover to have `time` between clearing one and reaching the next. */
export function spacingForTime(
  prev: Pick<Row, 'lanes'>,
  next: Pick<Row, 'lanes'>,
  speed: number,
  time: number,
  cfg: RunnerConfig = RUNNER_CONFIG,
): number {
  return (rowLength(prev, cfg) + rowLength(next, cfg)) / 2 + cfg.hitbox.rover.length + speed * time;
}

/** The least two rows may be apart at `speed`: what fairness needs and nothing more. */
export function minRowSpacing(
  prev: Pick<Row, 'lanes'>,
  next: Pick<Row, 'lanes'>,
  speed: number,
  cfg: RunnerConfig = RUNNER_CONFIG,
): number {
  return spacingForTime(prev, next, speed, rowGapTime(prev, next, cfg), cfg);
}

/** Which tier (1, 2 or 3) the course is in at distance `z`. */
export function tierAt(z: number, cfg: RunnerConfig = RUNNER_CONFIG): 1 | 2 | 3 {
  const { two, three } = cfg.generator.tiers;
  return z >= three ? 3 : z >= two ? 2 : 1;
}

/** The sweeper's position in lanes from its lower lane (0 = over `lane`, 1 = over the next one) at play time `time`. */
export function sweepFraction(sweep: Sweep, time: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * (time - sweep.t0)) / sweep.period);
}

export interface Generator {
  /** The next row, placed after the last one. `speed` must be at least the speed the rover will have when it gets there. */
  next(speed: number): Row;
}

interface Planned {
  lanes: Row['lanes'];
  /** A sweeper row: its lower lane, and whether it is over the upper one when the rover arrives. */
  sweep?: { lane: Lane; atUpper: boolean };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function createGenerator(seed: number, cfg: RunnerConfig = RUNNER_CONFIG): Generator {
  const rand = mulberry32(seed);
  const g = cfg.generator;
  let prev: Row | null = null;
  const queue: Row[] = [];
  const sweepAtUpper = new WeakMap<Row, boolean>();

  const shuffle3 = (): [number, number, number] => {
    const order = [0, 1, 2];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order as [number, number, number];
  };
  const kind = (): BasicKind => pickWeighted(rand, { ...g.kinds });
  const blank = (): Row['lanes'] => [null, null, null];
  const modeKind = (mode: PassMode): ObstacleKind | null => (mode === 'run' ? null : mode === 'jump' ? 'barrier' : 'gate');
  /** A row with exactly one way through: lane index `pass`, by `mode`; every other lane is a slab. */
  const forced = (pass: number, mode: PassMode): Planned => {
    const lanes: Row['lanes'] = ['slab', 'slab', 'slab'];
    lanes[pass] = modeKind(mode);
    return { lanes };
  };
  const anyMode = (runShare: number): PassMode => {
    const r = rand();
    return r < runShare ? 'run' : r < runShare + (1 - runShare) / 2 ? 'jump' : 'crouch';
  };
  const opening = (): ObstacleKind | null => {
    const r = rand();
    return r < g.wallOpeningBarrier ? 'barrier' : r < g.wallOpeningBarrier + g.wallOpeningGate ? 'gate' : null;
  };
  const wallRow = (open: number): Planned => {
    const lanes: Row['lanes'] = ['wall', 'wall', 'wall'];
    lanes[open] = opening();
    return { lanes };
  };

  const builders: Record<string, () => Planned[]> = {
    single: () => {
      const lanes = blank();
      lanes[shuffle3()[0]] = kind();
      return [{ lanes }];
    },
    pair: () => {
      const [a, b] = shuffle3();
      const lanes = blank();
      lanes[a] = kind();
      lanes[b] = kind();
      return [{ lanes }];
    },
    // Jump and at once crouch, or the other way round, in the one lane the slabs leave.
    barrierGate: () => {
      const [a] = shuffle3();
      return (rand() < 0.5 ? (['jump', 'crouch'] as const) : (['crouch', 'jump'] as const)).map((m) => forced(a, m));
    },
    // Crouch under a gate, then at once a lane change.
    gateDodge: () => {
      const [a, b] = shuffle3();
      return [forced(a, 'crouch'), forced(b, anyMode(0.7))];
    },
    // A slab in your lane, the free lane beside it a barrier (or a gate): change lane, then jump.
    dodgeJump: () => [forced(shuffle3()[1], rand() < 0.75 ? 'jump' : 'crouch')],
    trio: () => {
      const [a, b, c] = shuffle3();
      const lanes = blank();
      lanes[a] = 'slab';
      lanes[b] = 'barrier';
      lanes[c] = 'gate';
      return [{ lanes }];
    },
    // From one side of the track to the other.
    slalom: () => {
      const left = rand() < 0.5;
      return [forced(left ? 0 : 2, anyMode(0.6)), forced(left ? 2 : 0, anyMode(0.6))];
    },
    chain3: () => [0, 1, 2].map(() => forced(Math.floor(rand() * 3), anyMode(0.4))),
    wall: () => [wallRow(Math.floor(rand() * 3))],
    wallSlalom: () => {
      const left = rand() < 0.5;
      return [wallRow(left ? 0 : 2), wallRow(left ? 2 : 0)];
    },
    sweeper: () => {
      const lower: Lane = rand() < 0.5 ? -1 : 0;
      const lanes = blank();
      lanes[lower + 1] = 'sweeper';
      lanes[lower + 2] = 'sweeper';
      const third = lower === -1 ? 2 : 0;
      const r = rand();
      lanes[third] = r < 0.3 ? 'barrier' : r < 0.5 ? 'gate' : null;
      return [{ lanes, sweep: { lane: lower, atUpper: rand() < 0.5 } }];
    },
  };
  const comboNames = new Set(Object.keys(builders).filter((n) => n !== 'single' && n !== 'pair'));

  /** The patterns open at distance `z`, with their odds. */
  const available = (z: number): Record<string, number> => {
    const tier = tierAt(z, cfg);
    const out: Record<string, number> = {};
    for (const [name, weights] of Object.entries(g.patterns)) {
      if ((name === 'wall' || name === 'wallSlalom') && z < g.hazards.wall) continue;
      if (name === 'sweeper' && z < g.hazards.sweeper) continue;
      const w = weights[tier - 1];
      if (w > 0) out[name] = w;
    }
    return out;
  };

  /** The way the rover goes through a row, for the pickups to lead along: a risky way when there is a safe one, by chance. */
  const route = (row: Row): { lane: Lane; mode: PassMode } | null => {
    if (row.sweep) {
      // The reward for reading the sweeper: the lane it has left open when the rover arrives.
      const lane = sweepAtUpper.get(row) ? row.sweep.lane : ((row.sweep.lane + 1) as Lane);
      return { lane, mode: 'run' };
    }
    const open = passableLanes(row);
    if (!open.length) return null;
    const risky = open.filter((o) => o.mode !== 'run');
    const safe = open.filter((o) => o.mode === 'run');
    const pool = risky.length && safe.length ? (rand() < g.pickupRisk ? risky : safe) : open;
    return pool[Math.floor(rand() * pool.length)];
  };

  /** A line of pickups in `way`'s lane, running up to `row` from the row before, with one on the jump or the crouch. */
  const pickupLine = (before: Row | null, row: Row, way: { lane: Lane; mode: PassMode }): Row['pickups'] => {
    const start = (before ? before.z + rowLength(before, cfg) / 2 : 0) + 4;
    const end = row.z - rowLength(row, cfg) / 2 - 3;
    const out: Row['pickups'] = [];
    for (let z = end; z >= start && out.length < g.pickupMaxInLine; z -= g.pickupSpacing)
      out.unshift({ lane: way.lane, z, y: g.pickupHeight });
    if (way.mode === 'jump') out.push({ lane: way.lane, z: row.z, y: g.pickupHeightOverBarrier });
    if (way.mode === 'crouch') out.push({ lane: way.lane, z: row.z, y: g.pickupHeightUnderGate });
    return out.length >= 2 ? out : [];
  };

  /** Place a pattern's rows after the last one: the first after the window between patterns, the rest after the margin. */
  const place = (name: string, planned: Planned[], speed: number): Row[] => {
    const d = speedProgress(speed, cfg);
    const out: Row[] = [];
    const before = prev;
    const tight = g.tighten[(before ? tierAt(before.z, cfg) : 1) - 1];
    for (let i = 0; i < planned.length; i++) {
      const p = planned[i];
      const row: Row = { z: 0, lanes: p.lanes, pickups: [], pattern: name };
      const last: Row | null = out[i - 1] ?? before;
      if (!last) {
        row.z = cfg.spawn.firstRowAt;
      } else {
        const need = rowGapTime(last, row, cfg);
        let time: number;
        if (i === 0) {
          const window = lerp(g.window.start, g.window.cap, d) * tight;
          time = Math.max(need, window, g.minGap) + rand() * lerp(g.extra.start, g.extra.cap, d) * tight;
        } else {
          time = Math.max(need + lerp(g.margin.start, g.margin.cap, d) * tight, g.minGap);
        }
        row.z = last.z + spacingForTime(last, row, speed, time, cfg);
      }
      if (p.sweep) {
        // At play time `arrive` the rover's centre is over the row; the sweeper is at one end of its swing then.
        const arrive = timeAtDistance(row.z, cfg);
        const t0 = arrive - (p.sweep.atUpper ? g.sweeperPeriod / 2 : 0);
        row.sweep = { lane: p.sweep.lane, period: g.sweeperPeriod, t0 };
        sweepAtUpper.set(row, p.sweep.atUpper);
      }
      out.push(row);
    }
    if (rand() < (comboNames.has(name) ? g.pickupChanceCombo : g.pickupChance)) {
      out.forEach((row, i) => {
        const way = route(row);
        if (way) row.pickups = pickupLine(out[i - 1] ?? before, row, way);
      });
    }
    return out;
  };

  return {
    next(speed: number): Row {
      if (!queue.length) {
        let name = 'single';
        let planned: Planned[];
        if (!prev) {
          // The first obstacle is always in the middle lane, where the rover starts: a run that does nothing ends on it.
          const lanes = blank();
          lanes[1] = rand() < 0.55 ? 'slab' : 'barrier';
          planned = [{ lanes }];
        } else {
          name = pickWeighted(rand, available(prev.z));
          planned = builders[name]();
        }
        queue.push(...place(name, planned, speed));
      }
      const row = queue.shift()!;
      prev = row;
      return row;
    },
  };
}

/** A fixed list of rows instead of random ones (the tests' hand-made courses). Returns rows far away once it runs out. */
export function fixedCourse(rows: (Omit<Row, 'pickups'> & { pickups?: Row['pickups'] })[]): Generator {
  let i = 0;
  return {
    next(): Row {
      const r = rows[i++];
      if (!r) return { z: 1e9 + i, lanes: [null, null, null], pickups: [] };
      return { pickups: [], ...r };
    },
  };
}
