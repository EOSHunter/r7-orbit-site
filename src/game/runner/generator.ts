// The course: rows of obstacles across the three lanes, and lines of pickups between them. Pure logic, no rendering.
//
// Fairness (docs/RUNNER.md, "Fairness"): every row leaves at least one lane the rover can pass (a free lane, a barrier to jump
// or a gate to slide under; never three slabs), and the gap before each row is long enough that, from ANY lane the player
// could have used to pass the row before it, there is a lane of the new row they can reach in time: a reaction time, then the
// lane changes and the jump or slide that lane needs, at the speed the rover will have when it gets there. The player can
// never pick a lane that traps them. src/game/runner/generator.vitest.ts proves it by playing thousands of seeded courses.

import { RUNNER_CONFIG, jumpPhysics, type RunnerConfig } from './config';
import { mulberry32, pickWeighted, type Random } from './random';

export type ObstacleKind = 'slab' | 'barrier' | 'gate';
export type Lane = -1 | 0 | 1;
export const LANES: readonly Lane[] = [-1, 0, 1];

/** How the rover gets through a lane of a row: drive on, jump, slide, or not at all (a slab). */
export type PassMode = 'run' | 'jump' | 'slide';

/** One row across the track. `lanes[lane + 1]` is the obstacle in that lane, or null when it is open. */
export interface Row {
  /** Distance along the track of the row's centre, in metres. */
  z: number;
  lanes: [ObstacleKind | null, ObstacleKind | null, ObstacleKind | null];
  pickups: { lane: Lane; z: number; y: number }[];
}

export function passMode(kind: ObstacleKind | null): PassMode | null {
  if (kind === null) return 'run';
  if (kind === 'barrier') return 'jump';
  if (kind === 'gate') return 'slide';
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

/** Longest a slam (slide pressed in the air) can take to bring the rover down from the top of a jump. */
export function slamTime(cfg: RunnerConfig = RUNNER_CONFIG): number {
  return cfg.jump.height / cfg.slide.slamSpeed;
}

/**
 * Seconds needed between the moment the rover has fully cleared lane `a` of one row (passed with `modeA`) and the moment its
 * front reaches lane `b` of the next (to be passed with `modeB`): the reaction time, then the lane changes and the vertical
 * move, which can overlap (the rover can change lanes in the air or while sliding).
 */
export function requiredTime(
  a: Lane,
  modeA: PassMode,
  b: Lane,
  modeB: PassMode,
  cfg: RunnerConfig = RUNNER_CONFIG,
): number {
  const laneTime = Math.abs(a - b) * cfg.track.laneChangeTime;
  // Still in the air from jumping the last row: a new jump waits for the landing (at worst a whole jump), a slide slams down.
  // From the ground or a slide everything can start at once: jump cancels a slide, and slide restarts one.
  let ready = 0;
  if (modeA === 'jump' && modeB === 'jump') ready = cfg.jump.duration;
  if (modeA === 'jump' && modeB === 'slide') ready = slamTime(cfg);
  const lead = modeB === 'jump' ? jumpLeadTime(cfg) : modeB === 'slide' ? 0.05 : 0;
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

/**
 * The centre-to-centre distance two rows must be apart at `speed`: the rover's centre travels from "cleared the first" to
 * "front at the second" in the required time, plus half of each row's length and the rover's length.
 */
export function minRowSpacing(
  prev: Pick<Row, 'lanes'>,
  next: Pick<Row, 'lanes'>,
  speed: number,
  cfg: RunnerConfig = RUNNER_CONFIG,
): number {
  return (
    (rowLength(prev, cfg) + rowLength(next, cfg)) / 2 + cfg.hitbox.rover.length + speed * rowGapTime(prev, next, cfg)
  );
}

export interface Generator {
  /** The next row, placed after the last one. `speed` must be at least the speed the rover will have when it gets there. */
  next(speed: number): Row;
}

/** A row's obstacles at a difficulty from 0 (start speed) to 1 (the cap). Never three slabs. */
export function randomLanes(rand: Random, difficulty: number, cfg: RunnerConfig = RUNNER_CONFIG): Row['lanes'] {
  const g = cfg.generator;
  const at = ([lo, hi]: readonly [number, number] | readonly number[]) => lo + (hi - lo) * difficulty;
  const pattern = pickWeighted(rand, {
    single: at(g.weights.single),
    double: at(g.weights.double),
    wall: at(g.weights.wall),
  });
  const count = pattern === 'single' ? 1 : pattern === 'double' ? 2 : 3;
  const lanes: Row['lanes'] = [null, null, null];
  const order = [0, 1, 2];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < count; i++) lanes[order[i]] = pickWeighted(rand, { ...g.kinds });
  if (lanes[0] === 'slab' && lanes[1] === 'slab' && lanes[2] === 'slab') {
    lanes[Math.floor(rand() * 3)] = rand() < 0.5 ? 'barrier' : 'gate';
  }
  return lanes;
}

export function createGenerator(seed: number, cfg: RunnerConfig = RUNNER_CONFIG): Generator {
  const rand = mulberry32(seed);
  const g = cfg.generator;
  let prev: Row | null = null;

  return {
    next(speed: number): Row {
      const range = cfg.speed.max - cfg.speed.start;
      const difficulty = range > 0 ? Math.min(1, Math.max(0, (speed - cfg.speed.start) / range)) : 1;
      const lanes = randomLanes(rand, difficulty, cfg);
      let z: number;
      if (!prev) {
        z = cfg.spawn.firstRowAt;
      } else {
        const extra =
          (g.extraTimeMin + rand() * (g.extraTimeMax - g.extraTimeMin)) * (1 - g.extraTimeShrink * difficulty);
        z = prev.z + minRowSpacing(prev, { lanes }, speed, cfg) + speed * extra;
      }
      const row: Row = { z, lanes, pickups: [] };
      if (rand() < g.pickupChance) row.pickups = pickupLine(rand, prev, row, cfg);
      prev = row;
      return row;
    },
  };
}

/** A line of pickups in one open lane of `row`, running up to it from the row before, with one on the jump or the slide. */
function pickupLine(rand: Random, prev: Row | null, row: Row, cfg: RunnerConfig): Row['pickups'] {
  const g = cfg.generator;
  const open = passableLanes(row);
  const { lane, mode } = open[Math.floor(rand() * open.length)];
  const start = (prev ? prev.z + rowLength(prev, cfg) / 2 : 0) + 4;
  const end = row.z - rowLength(row, cfg) / 2 - 3;
  const out: Row['pickups'] = [];
  for (let z = end; z >= start && out.length < g.pickupMaxInLine; z -= g.pickupSpacing)
    out.unshift({ lane, z, y: g.pickupHeight });
  if (mode === 'jump') out.push({ lane, z: row.z, y: g.pickupHeightOverBarrier });
  if (mode === 'slide') out.push({ lane, z: row.z, y: g.pickupHeightUnderGate });
  return out.length >= 2 ? out : [];
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
