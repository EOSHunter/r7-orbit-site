import { describe, expect, it } from 'vitest';
import { SKIN, agentBox, groundBelow, moveAgent, overlaps, raycast, sweepAxis, type Box } from './collision';

const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Box => ({
  min: { x: x0, y: y0, z: z0 },
  max: { x: x1, y: y1, z: z1 },
});
const floor = box(-10, -1, -10, 10, 0, 10);
const wall = box(2, 0, -5, 3, 4, 5);
const HALF = 0.3;
const H = 1.2;

describe('boxes', () => {
  it('overlap only when they share volume (touching faces do not)', () => {
    expect(overlaps(box(0, 0, 0, 1, 1, 1), box(0.5, 0.5, 0.5, 2, 2, 2))).toBe(true);
    expect(overlaps(box(0, 0, 0, 1, 1, 1), box(1, 0, 0, 2, 1, 1))).toBe(false);
  });

  it('the agent box stands on its feet', () => {
    expect(agentBox({ x: 1, y: 2, z: 3 }, HALF, H)).toEqual(box(0.7, 2, 2.7, 1.3, 3.2, 3.3));
  });
});

describe('sweepAxis', () => {
  it('stops at the face it would cross, just short of it', () => {
    const a = agentBox({ x: 0, y: 0.5, z: 0 }, HALF, H);
    const r = sweepAxis(a, 'x', 5, [wall]);
    expect(r.hit).toBe(true);
    expect(a.max.x + r.moved).toBeCloseTo(2 - SKIN, 9);
  });

  it('never lets a thin block through, however far the move', () => {
    const thin = box(-1, 5, -1, 1, 5.05, 1);
    const a = agentBox({ x: 0, y: 10, z: 0 }, HALF, H);
    const r = sweepAxis(a, 'y', -100, [thin]);
    expect(r.hit).toBe(true);
    expect(a.min.y + r.moved).toBeCloseTo(5.05 + SKIN, 9);
  });

  it('ignores a box the agent is already inside, so it can always get out', () => {
    const a = agentBox({ x: 2.5, y: 0.5, z: 0 }, HALF, H);
    expect(sweepAxis(a, 'x', 1, [wall])).toEqual({ moved: 1, hit: false });
  });

  it('ignores boxes it only touches on another axis (the floor when walking)', () => {
    const a = agentBox({ x: 0, y: SKIN, z: 0 }, HALF, H);
    expect(sweepAxis(a, 'x', 1, [floor])).toEqual({ moved: 1, hit: false });
  });
});

describe('moveAgent', () => {
  it('lands on the floor and reports the hit on y', () => {
    const r = moveAgent({ x: 0, y: 0.2, z: 0 }, { x: 0, y: -1, z: 0 }, HALF, H, [floor]);
    expect(r.hit.y).toBe(true);
    expect(r.pos.y).toBeCloseTo(SKIN, 9);
  });

  it('slides along a wall: the blocked axis stops, the other carries on', () => {
    const r = moveAgent({ x: 1.5, y: SKIN, z: 0 }, { x: 0.5, y: 0, z: 0.5 }, HALF, H, [floor, wall]);
    expect(r.hit.x).toBe(true);
    expect(r.hit.z).toBe(false);
    expect(r.pos.x).toBeCloseTo(2 - HALF - SKIN, 9);
    expect(r.pos.z).toBeCloseTo(0.5, 9);
  });

  it('bumps its head on a ceiling', () => {
    const ceiling = box(-1, 2, -1, 1, 3, 1);
    const r = moveAgent({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 1, z: 0 }, HALF, H, [ceiling]);
    expect(r.hit.y).toBe(true);
    expect(r.pos.y + H).toBeCloseTo(2 - SKIN, 9);
  });
});

describe('groundBelow', () => {
  const step = box(-1, 0, -1, 1, 2, 1);
  it('finds the highest top under the footprint, not above the feet', () => {
    expect(groundBelow({ x: 0, y: 3, z: 0 }, HALF, [floor, step])).toBe(2);
    expect(groundBelow({ x: 0, y: 1, z: 0 }, HALF, [floor, step])).toBe(0);
    expect(groundBelow({ x: 5, y: 3, z: 0 }, HALF, [floor, step])).toBe(0);
  });

  it('counts a block the footprint only half covers, and nothing over the void', () => {
    expect(groundBelow({ x: 1.2, y: 3, z: 0 }, HALF, [step])).toBe(2);
    expect(groundBelow({ x: 20, y: 3, z: 0 }, HALF, [floor, step])).toBeNull();
    expect(groundBelow({ x: 0, y: 30, z: 0 }, HALF, [floor], 10)).toBeNull();
  });
});

describe('raycast', () => {
  it('returns the distance to the first box on the ray', () => {
    expect(raycast({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10, [wall])).toBeCloseTo(2, 9);
    expect(raycast({ x: 0, y: 1, z: 0 }, { x: -1, y: 0, z: 0 }, 10, [wall])).toBeNull();
  });

  it('stops looking at maxT, and ignores a box it starts inside', () => {
    expect(raycast({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 1.5, [wall])).toBeNull();
    expect(raycast({ x: 2.5, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10, [wall])).toBeNull();
  });

  it('picks the nearest of several', () => {
    const near = box(1, 0, -1, 1.5, 3, 1);
    expect(raycast({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 10, [wall, near])).toBeCloseTo(1, 9);
  });
});
