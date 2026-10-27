// The course as data: solid boxes, where the climb starts, and where the goal ring hangs. Phase 1 lays out a short test climb
// in code, grey boxes only, to judge how moving and jumping feel; phase 2 reads levels from Blender (.glb with COL_ boxes, a
// SPAWN empty and a GOAL, docs/ASCENT.md) into this same shape, so nothing that reads a Level changes then.
//
// Every jump from one block to the next is checked against the jump's reach in level.vitest.ts (with a margin), so a change to
// the jump in config.ts that makes the course impossible fails a test.

import type { Box, Vec3 } from './collision';

export interface LevelBox extends Box {
  /** `ground` is the floor at the bottom; `block` anything to climb on or bump into. Drawing only. */
  kind: 'ground' | 'block';
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
}

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
};
