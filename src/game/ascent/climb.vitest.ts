// The full climb (climb.ts, tools/ascent/build_climb.py) read from the committed zone files through the game's own loader,
// and checked as the test climb is in level.vitest.ts: every step within reach of a jump (from a drifting block's far end,
// onto its near end; up a fan's updraft), nothing overlapping, the zones in order, the ring at the top, each file small.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CLIMB, loadClimb } from './climb';
import { overlaps, type Box } from './collision';
import { ASCENT_CONFIG, jumpPhysics, jumpReach } from './config';
import { parsePartModel } from './gltf-level';
import type { LevelBox } from './level';
import { AscentSim } from './sim';

const files = await Promise.all(CLIMB.zones.map((z) => readFile(new URL(`./assets/${z.file}`, import.meta.url))));
const climb = await loadClimb(CLIMB.zones.length, (n) => {
  const b = files[n - 1];
  return parsePartModel(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), CLIMB.zones[n - 1].file);
});
const level = climb.level;

/** The shortest distance across the ground between two boxes' footprints (0 when they overlap seen from above). */
function gap(a: Box, b: Box): number {
  const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
  const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
  return Math.hypot(dx, dz);
}
const shifted = (b: Box, d: { x: number; y: number; z: number }): Box => ({
  min: { x: b.min.x + d.x, y: b.min.y + d.y, z: b.min.z + d.z },
  max: { x: b.max.x + d.x, y: b.max.y + d.y, z: b.max.z + d.z },
});

const MARGIN = 0.8;
const MAX_RISE = 0.8;

describe('the climb', () => {
  it('has five zones in order, each starting where the one below ends, and the ring above the last', () => {
    expect(level.zones?.map((z) => z.title)).toEqual(['Workshop', 'Server stack', 'Cloud', 'Upper air', 'Orbit']);
    for (let i = 1; i < CLIMB.zones.length; i++) expect(CLIMB.zones[i].base).toBeGreaterThan(CLIMB.zones[i - 1].base);
    expect(level.ring).toBeDefined();
    expect(level.goal.y).toBeGreaterThan(300);
    expect(climb.parts[4].goal?.name).toBe('GOAL');
  });

  it('has fans, drifting blocks and crumbling ones, each in its own zone first', () => {
    const zoneOf = (box: number) => climb.zoneAt(level.boxes[box].max.y);
    expect(Math.min(...(level.fans ?? []).map((f) => zoneOf(f.box)))).toBe(2);
    expect(Math.min(...(level.movers ?? []).map((m) => zoneOf(m.box)))).toBe(3);
    expect(Math.min(...(level.crumbles ?? []).map((c) => zoneOf(c.box)))).toBe(4);
    expect(level.beacons.length).toBeGreaterThanOrEqual(CLIMB.zones.length);
  });

  it('has no two solids overlapping, wherever the drifting ones are', () => {
    const swept = level.boxes.map((b, i): Box => {
      const m = level.movers?.find((x) => x.box === i);
      if (!m) return b;
      const far = shifted(b, m.offset);
      return {
        min: { x: Math.min(b.min.x, far.min.x), y: b.min.y, z: Math.min(b.min.z, far.min.z) },
        max: { x: Math.max(b.max.x, far.max.x), y: b.max.y, z: Math.max(b.max.z, far.max.z) },
      };
    });
    for (let i = 0; i < swept.length; i++) {
      for (let j = i + 1; j < swept.length; j++) {
        expect(overlaps(swept[i], swept[j]), `${level.boxes[i].name} and ${level.boxes[j].name}`).toBe(false);
      }
    }
  });

  it('every step of the route is within reach: a jump, a ride, or an updraft', () => {
    const fanOf = new Map((level.fans ?? []).map((f) => [f.box, f]));
    const moverOf = new Map((level.movers ?? []).map((m) => [m.box, m]));
    const { takeoff } = jumpPhysics();
    for (let i = 1; i < level.route.length; i++) {
      const fromIndex = level.route[i - 1];
      const toIndex = level.route[i];
      const to: LevelBox = level.boxes[toIndex];
      // From a drifting block, the jump is from wherever it is best: its far end.
      const m = moverOf.get(fromIndex);
      const from: Box = m ? shifted(level.boxes[fromIndex], m.offset) : level.boxes[fromIndex];
      const rise = to.max.y - from.max.y;
      const name = `step ${i} (${level.boxes[fromIndex].name} to ${to.name})`;
      const fan = fanOf.get(fromIndex);
      if (fan) {
        // Up the updraft, then across: its top plus what the updraft's top speed carries above it.
        const lift = fan.height + (ASCENT_CONFIG.fan.maxRise ** 2 / (2 * jumpPhysics().gravity)) * 0.5;
        expect(rise, `${name}: rise`).toBeLessThanOrEqual(lift);
        expect(gap(from, to), `${name}: gap`).toBeLessThanOrEqual(1.5);
        continue;
      }
      expect(rise, `${name}: rise`).toBeGreaterThan(0);
      expect(rise, `${name}: rise`).toBeLessThanOrEqual(ASCENT_CONFIG.jump.height * MAX_RISE);
      expect(gap(from, to), `${name}: gap`).toBeLessThanOrEqual(jumpReach(rise) * MARGIN);
    }
    expect(takeoff).toBeGreaterThan(0);
  });

  it('the last block is a jump from the ring: standing under its lowest point, a full jump touches it', () => {
    const last = level.boxes[level.route[level.route.length - 1]];
    const ring = level.ring;
    if (!ring) throw new Error('no ring');
    // The ring's lowest point: round the circle through its tube, turned by its rotation.
    const { x: qx, y: qy, z: qz, w } = ring.rotation;
    const turn = (v: { x: number; y: number; z: number }) => {
      const cx = qy * v.z - qz * v.y;
      const cy = qz * v.x - qx * v.z;
      const cz = qx * v.y - qy * v.x;
      return {
        x: v.x + 2 * (w * cx + qy * cz - qz * cy),
        y: v.y + 2 * (w * cy + qz * cx - qx * cz),
        z: v.z + 2 * (w * cz + qx * cy - qy * cx),
      };
    };
    let lowest = { x: 0, y: Infinity, z: 0 };
    for (let a = 0; a < 2 * Math.PI; a += 0.002) {
      const p = turn({ x: ring.radius * Math.cos(a), y: 0, z: ring.radius * Math.sin(a) });
      if (p.y < lowest.y) lowest = p;
    }
    const under = { x: ring.centre.x + lowest.x, z: ring.centre.z + lowest.z };
    // It hangs over the last block, out of reach of the head while standing, and in reach of a jump.
    expect(under.x).toBeGreaterThan(last.min.x);
    expect(under.x).toBeLessThan(last.max.x);
    expect(under.z).toBeGreaterThan(last.min.z);
    expect(under.z).toBeLessThan(last.max.z);
    const sim = new AscentSim(level);
    sim.restore({
      pos: { x: under.x, y: last.max.y, z: under.z },
      yaw: 0,
      time: 0,
      best: 0,
      falls: 0,
      jumps: 0,
      assist: false,
      assisted: false,
      checkpoint: null,
    });
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.grounded).toBe(true);
    expect(sim.finished, 'standing under it does not touch it').toBe(false);
    sim.jumpPress();
    for (let i = 0; i < 120 && !sim.finished; i++) sim.step();
    expect(sim.finished, 'a full jump touches it').toBe(true);
  });

  it('keeps each zone file under 500 kB (docs/ASCENT.md, "Size targets")', () => {
    for (const f of files) expect(f.byteLength).toBeLessThan(500 * 1024);
  });
});
