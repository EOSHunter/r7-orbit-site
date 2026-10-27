// The course as data: solid boxes, where the climb starts, and where the goal ring hangs. Two sources give this same shape:
// PROTOTYPE_LEVEL below, phase 1's grey boxes laid out in code (still playable at /styleguide/ascent/?level=code), and a level
// built in Blender (docs/ASCENT.md, "Blender is the level editor"): gltf-level.ts reads the .glb's objects and
// levelFromObjects turns them into a Level, so nothing that reads a Level knows where it came from.
//
// Every jump from one block to the next is checked against the jump's reach in level.vitest.ts (with a margin), for both
// levels, so a change to the jump in config.ts, or to a level, that makes the climb impossible fails a test.

import type { Box, Vec3 } from './collision';

export interface LevelBox extends Box {
  /** `ground` is the floor at the bottom; `block` anything to climb on or bump into. Drawing only. */
  kind: 'ground' | 'block';
  /** Its object's name in Blender (messages only). */
  name?: string;
}

export interface Level {
  /** Where the agent's feet start, and the way it faces (radians about +Y; 0 faces -Z, into the screen). */
  spawn: Vec3;
  spawnYaw: number;
  boxes: LevelBox[];
  /** The order of the climb: indexes into `boxes`, first block to last (the fairness test walks it). */
  route: number[];
  /** The middle of the goal ring (drawn only in phase 1: touching it does nothing yet). */
  goal: Vec3;
  /** Assist mode's checkpoints, in climbing order: where the agent's feet go when it returns to one. */
  beacons: Vec3[];
  /** The climb's zones, bottom to top (the HUD's altimeter); a level without them is one zone from the start to the goal. */
  zones?: LevelZone[];
}

export interface LevelZone {
  n: number;
  title: string;
  /** Heights (metres, the feet) where it starts and ends. */
  base: number;
  top: number;
}

/** A level's zones, or one zone from the start to the goal when it has none. */
export const zonesOf = (level: Level): LevelZone[] =>
  level.zones?.length ? level.zones : [{ n: 1, title: '', base: level.spawn.y, top: level.goal.y }];

/** A block `w` wide (x) and `d` deep (z), its top face at `top`, `h` thick. */
function block(x: number, top: number, z: number, w: number, d: number, h = 0.6): LevelBox {
  return {
    kind: 'block',
    min: { x: x - w / 2, y: top - h, z: z - d / 2 },
    max: { x: x + w / 2, y: top, z: z + d / 2 },
  };
}

/** A block standing on the ground (a pillar or a tower). */
const pillar = (x: number, z: number, w: number, d: number, top: number) => block(x, top, z, w, d, top);

/**
 * The phase 1 test climb: about 19 m, round a tower, in 22 jumps. Wide steps first, then a beam, a run of small blocks, a
 * 1.2 m step up, another beam, longer gaps, and the top. (x, top, z, width, depth), in metres.
 */
const ROUTE: LevelBox[] = [
  block(0, 0.7, 5.5, 3, 3),
  block(0, 1.6, 2, 2.5, 2.5),
  block(3.5, 2.4, 0.5, 2, 2),
  block(7, 3.2, -0.5, 2, 2),
  block(8.5, 4.0, -4, 1.6, 1.6),
  block(8.5, 4.4, -8.6, 0.6, 5), // a beam to walk along
  block(8.5, 5.2, -13.5, 2.6, 2.6),
  block(5, 6.0, -14.5, 1.4, 1.4),
  block(2, 6.8, -13.5, 1.4, 1.4),
  block(-1, 7.6, -14.5, 1.4, 1.4),
  block(-4.5, 8.4, -12.5, 2, 2),
  block(-6.5, 9.6, -8.5, 2, 2), // the first 1.2 m step up
  block(-6.5, 10.4, -4.8, 1.2, 1.2),
  block(-8, 11.2, -1.8, 1.2, 1.2),
  block(-6, 12.0, 1.4, 1.2, 1.2),
  block(-2, 12.4, 2.6, 5, 0.5), // a beam across
  block(2.5, 13.2, 2.6, 2.4, 2.4),
  block(5.5, 14.2, 4.6, 1.6, 1.6),
  block(5.5, 15.2, 8.4, 1.6, 1.6),
  block(2, 16.0, 9.4, 1.2, 1.2),
  block(-1.5, 16.8, 8.4, 1.2, 1.2),
  block(-4.5, 17.8, 6.5, 2, 2),
  block(-4.5, 19.0, 2, 4, 4), // the top
];

/** Things to bump into and look past: a tower in the middle of the spiral and two pillars by the first beam. */
const SCENERY: LevelBox[] = [pillar(1, -6, 2, 2, 11), pillar(11, -8, 1, 3, 7), pillar(11.5, -12, 1, 1, 9)];

const GROUND: LevelBox = {
  kind: 'ground',
  min: { x: -24, y: -1, z: -24 },
  max: { x: 24, y: 0, z: 24 },
};

export const PROTOTYPE_LEVEL: Level = {
  spawn: { x: 0, y: 0, z: 10 },
  spawnYaw: 0,
  boxes: [GROUND, ...ROUTE, ...SCENERY],
  route: ROUTE.map((_, i) => i + 1),
  goal: { x: -4.5, y: 22, z: 2 },
  // On the first wide step, the first beam's far end and the beam across (assist mode).
  beacons: [
    { x: 0, y: 1.6, z: 2 },
    { x: 8.5, y: 5.2, z: -13.5 },
    { x: 2.5, y: 13.2, z: 2.6 },
  ],
};

/** An object of a level file as the loader saw it, in world space (metres, +Y up). */
export interface LevelObject {
  /** Its name in Blender. */
  name: string;
  /** Its custom properties (glTF extras). */
  userData: Record<string, unknown>;
  /** Its mesh's bounds, axis-aligned; an empty's are its origin. */
  min: Vec3;
  max: Vec3;
  /** Its origin. */
  position: Vec3;
  /** Its rotation (a unit quaternion). */
  rotation: { x: number; y: number; z: number; w: number };
}

/** The names and the custom properties a level file uses (tools/ascent/, docs/ASCENT.md "Blender is the level editor"). */
export const LEVEL_NAMES = {
  collision: 'COL_',
  spawn: 'SPAWN',
  goal: 'GOAL',
  beacon: 'BEACON_',
  route: 'route',
  ground: 'ground',
} as const;

/**
 * A collision box's corners are rounded to this (metres): a file stores float32, so two faces that meet in Blender can come
 * out a hair apart, or a hair inside each other, which would count as an overlap.
 */
export const LEVEL_GRID = 1e-4;

const snap = (v: Vec3): Vec3 => ({
  x: Math.round(v.x / LEVEL_GRID) * LEVEL_GRID,
  y: Math.round(v.y / LEVEL_GRID) * LEVEL_GRID,
  z: Math.round(v.z / LEVEL_GRID) * LEVEL_GRID,
});

/** `v` turned by the unit quaternion `q`. */
function rotate(v: Vec3, q: LevelObject['rotation']): Vec3 {
  // v + 2w(u × v) + 2u × (u × v), u = q's vector part
  const cx = q.y * v.z - q.z * v.y;
  const cy = q.z * v.x - q.x * v.z;
  const cz = q.x * v.y - q.y * v.x;
  return {
    x: v.x + 2 * (q.w * cx + q.y * cz - q.z * cy),
    y: v.y + 2 * (q.w * cy + q.z * cx - q.x * cz),
    z: v.z + 2 * (q.w * cz + q.x * cy - q.y * cx),
  };
}

/** The way an object faces, as a turn about +Y (0 faces -Z, the way Blender's +Y comes out of the glTF exporter). */
export function yawOf(rotation: LevelObject['rotation']): number {
  const f = rotate({ x: 0, y: 0, z: -1 }, rotation);
  return Math.atan2(-f.x, -f.z);
}

/** Whether a rotation keeps a box's faces on the axes: upright, and turned a whole number of quarter turns. */
export function isAxisAligned(rotation: LevelObject['rotation'], tolerance = 1e-4): boolean {
  const up = rotate({ x: 0, y: 1, z: 0 }, rotation);
  if (up.y < 1 - tolerance) return false;
  const quarter = yawOf(rotation) / (Math.PI / 2);
  return Math.abs(quarter - Math.round(quarter)) < tolerance;
}

/**
 * A Level from a level file's objects: each COL_ box becomes a solid (the floor when it has `ground`, the n-th block of the
 * route when it has `route` = n), its corners on a 0.1 mm grid (LEVEL_GRID); SPAWN gives the start and the way the agent faces, GOAL the middle of the ring. Throws an
 * error that names the object for anything the game cannot use: no SPAWN or GOAL, a collision box that is turned or tilted
 * (collision is axis-aligned boxes only), a route number missing, repeated or not a whole number. Everything else is scenery,
 * which the view draws and the sim never sees.
 */
export function levelFromObjects(objects: readonly LevelObject[], source = 'the level'): Level {
  const fail = (why: string): never => {
    throw new Error(`R7: Ascent could not use ${source}: ${why}`);
  };
  const named = (name: string) => {
    const found = objects.filter((o) => o.name === name);
    if (found.length !== 1) fail(found.length ? `it has ${found.length} objects named ${name}` : `it has no ${name}`);
    return found[0];
  };
  const spawn = named(LEVEL_NAMES.spawn);
  const goal = named(LEVEL_NAMES.goal);

  const boxes: LevelBox[] = [];
  const byStep = new Map<number, number>();
  for (const o of objects) {
    if (!o.name.startsWith(LEVEL_NAMES.collision)) continue;
    if (!isAxisAligned(o.rotation)) fail(`${o.name} is turned or tilted; collision boxes must be axis-aligned`);
    if (!(o.max.x > o.min.x && o.max.y > o.min.y && o.max.z > o.min.z)) fail(`${o.name} has no size`);
    const ground = Boolean(o.userData[LEVEL_NAMES.ground]);
    boxes.push({ kind: ground ? 'ground' : 'block', name: o.name, min: snap(o.min), max: snap(o.max) });
    const step = o.userData[LEVEL_NAMES.route];
    if (step === undefined) continue;
    if (typeof step !== 'number' || !Number.isInteger(step) || step < 1) fail(`${o.name} has route ${String(step)}`);
    const n = step as number;
    if (byStep.has(n)) fail(`route ${n} is on two boxes`);
    byStep.set(n, boxes.length - 1);
  }
  if (!boxes.length) fail('it has no COL_ boxes');
  const route: number[] = [];
  for (let n = 1; n <= byStep.size; n++) {
    const i = byStep.get(n);
    if (i === undefined) fail(`route ${n} is missing (the route runs 1, 2, 3 ... with no gaps)`);
    route.push(i as number);
  }
  if (route.length < 2) fail('its route has fewer than two blocks');

  // Beacons (BEACON_<n>, custom property beacon = n): in order of n, which need not start at 1 (a zone's first beacon
  // carries on from the zone below's).
  const beacons = objects
    .filter((o) => o.name.startsWith(LEVEL_NAMES.beacon))
    .map((o) => {
      const n = o.userData.beacon;
      if (typeof n !== 'number' || !Number.isInteger(n)) fail(`${o.name} has beacon ${String(n)}`);
      return { n: n as number, at: { ...o.position } };
    })
    .sort((a, b) => a.n - b.n)
    .map((b) => b.at);

  return {
    spawn: { ...spawn.position },
    spawnYaw: yawOf(spawn.rotation),
    boxes,
    route,
    goal: { ...goal.position },
    beacons,
  };
}
