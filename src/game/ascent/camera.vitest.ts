import { describe, expect, it } from 'vitest';
import { OrbitCamera } from './camera';
import type { Box } from './collision';
import { ASCENT_CONFIG } from './config';

const cam = ASCENT_CONFIG.camera;
const feet = { x: 0, y: 0, z: 0 };

describe('OrbitCamera', () => {
  it('starts behind the agent (on +Z at yaw 0), above the look point', () => {
    const c = new OrbitCamera(0);
    c.snap(feet);
    expect(c.target.y).toBeCloseTo(cam.lookHeight, 9);
    expect(c.position.x).toBeCloseTo(0, 9);
    expect(c.position.z).toBeGreaterThan(0);
    expect(c.position.y).toBeGreaterThan(c.target.y);
    const d = Math.hypot(c.position.x - c.target.x, c.position.y - c.target.y, c.position.z - c.target.z);
    expect(d).toBeCloseTo(cam.distance, 9);
  });

  it('mouse right turns the view right; mouse down looks down; pitch stays in its limits', () => {
    const c = new OrbitCamera(0);
    c.look(100, 0);
    expect(c.yaw).toBeLessThan(0);
    const p = c.pitch;
    c.look(0, 50);
    expect(c.pitch).toBeGreaterThan(p);
    c.look(0, 1e6);
    expect(c.pitch).toBe(cam.pitch.max);
    c.look(0, -1e6);
    expect(c.pitch).toBe(cam.pitch.min);
  });

  it('Q and E turn at the configured rate; yaw stays within ±π', () => {
    const c = new OrbitCamera(0);
    c.turn(1, 0.5);
    expect(c.yaw).toBeCloseTo(cam.keyTurnRate * 0.5, 9);
    for (let i = 0; i < 100; i++) c.turn(1, 0.5);
    expect(Math.abs(c.yaw)).toBeLessThanOrEqual(Math.PI);
  });

  it('comes in front of a block in the way, at once, then eases back out once it is gone', () => {
    const wall: Box = { min: { x: -5, y: -5, z: 3 }, max: { x: 5, y: 10, z: 4 } };
    const c = new OrbitCamera(0);
    c.snap(feet);
    c.update(feet, 1 / 60, [wall]);
    expect(c.position.z).toBeLessThan(3);
    expect(c.distance).toBeGreaterThanOrEqual(cam.minDistance);
    const close = c.distance;
    c.update(feet, 1 / 60, []);
    expect(c.distance).toBeGreaterThan(close);
    expect(c.distance).toBeLessThan(cam.distance);
    for (let i = 0; i < 300; i++) c.update(feet, 1 / 60, []);
    expect(c.distance).toBeCloseTo(cam.distance, 3);
  });

  it('follows across faster than up and down', () => {
    const c = new OrbitCamera(0);
    c.snap(feet);
    c.update({ x: 1, y: 1, z: 0 }, 1 / 60, []);
    expect(c.target.x).toBeGreaterThan(c.target.y - cam.lookHeight);
  });
});
