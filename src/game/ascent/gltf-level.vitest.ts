// A level made in Blender, read the way the game reads it: the committed test climb through GLTFLoader (gltf-level.ts), and the
// rules for a level file's objects (levelFromObjects, level.ts) on hand-made objects, including every error a script could
// cause. The route's fairness is level.vitest.ts.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, BoxGeometry } from 'three/src/Three.js';
import { LEVEL_MATERIALS } from './colors';
import { ASCENT_CONFIG } from './config';
import { levelModelFromScene, parseLevelModel } from './gltf-level';
import { isAxisAligned, levelFromObjects, yawOf, type LevelObject } from './level';
import { AscentSim } from './sim';

const turn = (yaw: number) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
const still = turn(0);

/** A COL_ box from (x0, y0, z0) to (x1, y1, z1). */
function col(name: string, min: [number, number, number], max: [number, number, number], userData = {}): LevelObject {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  return {
    name: `COL_${name}`,
    userData,
    min: { x: x0, y: y0, z: z0 },
    max: { x: x1, y: y1, z: z1 },
    position: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 },
    rotation: still,
  };
}

function marker(name: string, x: number, y: number, z: number, rotation = still): LevelObject {
  const p = { x, y, z };
  return { name, userData: {}, min: p, max: p, position: p, rotation };
}

const FLOOR = col('floor', [-10, -1, -10], [10, 0, 10], { ground: 1 });
const A = col('a', [-1, 0, -1], [1, 1, 1], { route: 1 });
const B = col('b', [2, 0, -1], [4, 2, 1], { route: 2 });
const SPAWN = marker('SPAWN', 0, 0, 5);
const GOAL = marker('GOAL', 3, 6, 0);

describe('levelFromObjects', () => {
  it('makes the floor, the route in order, the start and the goal', () => {
    const level = levelFromObjects([GOAL, B, FLOOR, SPAWN, A]);
    expect(level.boxes.map((b) => [b.name, b.kind])).toEqual([
      ['COL_b', 'block'],
      ['COL_floor', 'ground'],
      ['COL_a', 'block'],
    ]);
    expect(level.route.map((i) => level.boxes[i].name)).toEqual(['COL_a', 'COL_b']);
    expect(level.spawn).toEqual({ x: 0, y: 0, z: 5 });
    expect(level.spawnYaw).toBeCloseTo(0);
    expect(level.goal).toEqual({ x: 3, y: 6, z: 0 });
  });

  it('turns the start with SPAWN, about the vertical', () => {
    const level = levelFromObjects([FLOOR, A, B, GOAL, marker('SPAWN', 0, 0, 5, turn(Math.PI / 2))]);
    expect(level.spawnYaw).toBeCloseTo(Math.PI / 2);
  });

  it('puts the corners on the 0.1 mm grid, so faces that meet in Blender meet', () => {
    const low = col('low', [0, 0, 0], [1, 6.0000002, 1]);
    const high = col('high', [0, 5.9999998, 0], [1, 7, 1]);
    const level = levelFromObjects([FLOOR, A, B, SPAWN, GOAL, low, high]);
    const [l, h] = ['COL_low', 'COL_high'].map((n) => level.boxes.find((b) => b.name === n));
    expect(l?.max.y).toBe(h?.min.y);
  });

  it('says what is wrong, naming the object', () => {
    const tilted = {
      ...col('tilted', [0, 0, 0], [1, 1, 1]),
      rotation: { x: Math.sin(0.1), y: 0, z: 0, w: Math.cos(0.1) },
    };
    const cases: [LevelObject[], RegExp][] = [
      [[FLOOR, A, B, GOAL], /has no SPAWN/],
      [[FLOOR, A, B, SPAWN], /has no GOAL/],
      [[FLOOR, A, B, SPAWN, SPAWN, GOAL], /2 objects named SPAWN/],
      [[FLOOR, A, B, SPAWN, GOAL, tilted], /COL_tilted is turned or tilted/],
      [[FLOOR, A, B, SPAWN, GOAL, { ...col('turned', [0, 0, 0], [1, 1, 1]), rotation: turn(0.3) }], /COL_turned/],
      [[FLOOR, A, B, SPAWN, GOAL, col('flat', [0, 1, 0], [1, 1, 1])], /COL_flat has no size/],
      [[FLOOR, A, col('c', [5, 0, 0], [6, 1, 1], { route: 3 }), SPAWN, GOAL], /route 2 is missing/],
      [[FLOOR, A, col('c', [5, 0, 0], [6, 1, 1], { route: 1 }), SPAWN, GOAL], /route 1 is on two boxes/],
      [[FLOOR, A, col('c', [5, 0, 0], [6, 1, 1], { route: 1.5 }), SPAWN, GOAL], /COL_c has route 1.5/],
      [[FLOOR, A, SPAWN, GOAL], /fewer than two blocks/],
      [[SPAWN, GOAL], /no COL_ boxes/],
    ];
    for (const [objects, message] of cases) expect(() => levelFromObjects(objects, 'x.glb')).toThrow(message);
  });

  it('a quarter turn keeps a box on the axes; anything else does not', () => {
    expect(isAxisAligned(turn(Math.PI / 2))).toBe(true);
    expect(isAxisAligned(turn(Math.PI))).toBe(true);
    expect(isAxisAligned(turn(0.2))).toBe(false);
    expect(yawOf(turn(-1))).toBeCloseTo(-1);
  });
});

describe('levelModelFromScene', () => {
  const mesh = (name: string, material: string) => {
    const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ name: material }));
    m.name = name;
    return m;
  };

  it('refuses a material the game does not know', () => {
    const root = new Group();
    root.add(mesh('desk', 'obsidain'));
    expect(() => levelModelFromScene(root, 'x.glb')).toThrow(/desk has the material "obsidain"/);
  });
});

describe('the test climb (assets/test-climb.glb)', async () => {
  const glb = await readFile(new URL('./assets/test-climb.glb', import.meta.url));
  const model = await parseLevelModel(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength));

  it('starts on the floor in front of the desk, facing it, and ends at the ring', () => {
    expect(model.level.spawn.x).toBeCloseTo(0);
    expect(model.level.spawn.y).toBeCloseTo(0);
    expect(model.level.spawn.z).toBeCloseTo(10);
    expect(model.level.spawnYaw).toBeCloseTo(0);
    expect(model.goal?.name).toBe('GOAL');
    expect(model.level.boxes.filter((b) => b.kind === 'ground')).toHaveLength(1);
  });

  it('has scenery in known materials, and no collision box or goal among it', () => {
    expect(model.scenery.length).toBeGreaterThan(10);
    for (const { mesh, material } of model.scenery) {
      expect(Object.keys(LEVEL_MATERIALS)).toContain(material);
      expect(mesh.name.startsWith('COL_') || mesh.name === 'GOAL').toBe(false);
    }
  });

  it('is solid where Blender says: the agent walks into the first book, stops at its side, and climbs onto it', () => {
    // The first book (route 1): 0.8 m high, x -4.6 to -1.4, z 4.8 to 7.2. Fixed steps, so this is the game's own motion.
    const sim = new AscentSim(model.level);
    const run = (until: () => boolean, max = 600) => {
      for (let i = 0; i < max && !until(); i++) sim.step();
    };
    sim.setMove(-1, 0);
    run(() => sim.pos.x < -3);
    sim.setMove(0, 0);
    run(() => sim.vel.x === 0);
    sim.setMove(0, -1);
    run(() => false, 240);
    expect(sim.pos.z, 'stopped by the side of the book').toBeCloseTo(7.2 + ASCENT_CONFIG.agent.width / 2, 2);
    expect(sim.grounded).toBe(true);
    sim.jumpPress();
    run(() => sim.pos.y > 0.5);
    run(() => sim.grounded);
    expect(sim.pos.y).toBeCloseTo(0.8, 3);
    expect(sim.best).toBeCloseTo(0.8, 3);
    expect(sim.falls).toBe(0);
  });

  it('stays small (docs/ASCENT.md, "Size targets": a zone under 500 kB)', () => {
    expect(glb.byteLength).toBeLessThan(500 * 1024);
  });
});
