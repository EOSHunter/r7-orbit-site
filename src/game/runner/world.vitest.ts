// The world's pure maths (world.ts): ring slots and recycling, the fades, the idle scroll, the easing between cruise, run and
// stop, the reduced-motion switch, and where the planet goes.
import { describe, expect, it } from 'vitest';
import { RUNNER_CONFIG } from './config';
import { WORLD, WorldMotion, distanceFade, easeInOut, planetPlacement, slotZ, wrap } from './world';

const dt = RUNNER_CONFIG.step;
const stepFor = (m: WorldMotion, seconds: number, phase: 'ready' | 'playing' | 'over', speed = 12, reduced = false) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) m.step(dt, phase, speed, reduced);
};

describe('wrap and easeInOut', () => {
  it('wraps negatives and positives into [0, length)', () => {
    expect(wrap(5, 4)).toBe(1);
    expect(wrap(-1, 4)).toBe(3);
    expect(wrap(-8, 4)).toBe(0);
    expect(wrap(0, 4)).toBe(0);
  });

  it('eases from 0 to 1 at rest at both ends, symmetric, clamped', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
    expect(easeInOut(0.25) + easeInOut(0.75)).toBeCloseTo(1);
    expect(easeInOut(0.01)).toBeLessThan(0.001); // no jolt at the start
  });
});

describe('ring slots', () => {
  const { ringSpacing: s, ringCount: n } = RUNNER_CONFIG.render;
  const zNear = WORLD.rings.zNear;
  const slots = (offset: number) => Array.from({ length: n }, (_, i) => slotZ(i, s, n, offset, zNear));

  it('keeps every ring in the tunnel and evenly spaced at any offset', () => {
    for (const offset of [0, 0.3, 4.5, s, 17.25, 1234.5, 99_999.9]) {
      const z = slots(offset).sort((a, b) => a - b);
      expect(z[0]).toBeGreaterThan(zNear - n * s - 1e-6);
      expect(z[n - 1]).toBeLessThanOrEqual(zNear + 1e-6);
      for (let i = 1; i < n; i++) expect(z[i] - z[i - 1]).toBeCloseTo(s, 6);
    }
  });

  it('moves towards the camera with the offset and recycles a passed ring to the far end', () => {
    const before = slotZ(0, s, n, 0, zNear);
    expect(before).toBe(zNear);
    expect(slotZ(0, s, n, 1e-3, zNear)).toBeCloseTo(zNear - n * s + 1e-3, 6); // passed: now the farthest
    expect(slotZ(3, s, n, 2, zNear) - slotZ(3, s, n, 0, zNear)).toBeCloseTo(2, 6);
    // One full loop later every ring is back where it was.
    expect(slots(n * s + 3.3)).toEqual(slots(3.3).map((z) => expect.closeTo(z, 6)));
  });

  it('fades in from the fog and out before the camera', () => {
    const { fadeNear, fadeFar } = WORLD.rings;
    expect(distanceFade(fadeNear[0] - 1, fadeNear, fadeFar)).toBe(0);
    expect(distanceFade(fadeNear[1], fadeNear, fadeFar)).toBe(1);
    expect(distanceFade(fadeFar[0], fadeNear, fadeFar)).toBe(1);
    expect(distanceFade(fadeFar[1] + 5, fadeNear, fadeFar)).toBe(0);
    expect(distanceFade((fadeFar[0] + fadeFar[1]) / 2, fadeNear, fadeFar)).toBeCloseTo(0.5);
  });
});

describe('WorldMotion', () => {
  it('cruises in the idle scene while the sim stands still, the same at any frame rate', () => {
    const m = new WorldMotion();
    stepFor(m, 2, 'ready');
    expect(m.speed).toBe(WORLD.cruiseSpeed);
    expect(m.offset).toBeCloseTo(2 * WORLD.cruiseSpeed, 6);
    expect(m.idle).toBe(1);
    expect(m.offsetAt(0)).toBe(m.prevOffset);
    expect(m.offsetAt(0.5)).toBeCloseTo(m.offset - (WORLD.cruiseSpeed * dt) / 2, 9);
  });

  it('eases from the cruise into the run speed over startEase, then moves at exactly the sim speed', () => {
    const m = new WorldMotion();
    stepFor(m, 1, 'ready');
    m.step(dt, 'playing', 12, false);
    expect(m.speed).toBeGreaterThan(WORLD.cruiseSpeed);
    expect(m.speed).toBeLessThan(WORLD.cruiseSpeed + 0.01); // no jump cut
    stepFor(m, WORLD.startEase / 2 - dt, 'playing');
    expect(m.speed).toBeCloseTo((WORLD.cruiseSpeed + 12) / 2, 1);
    stepFor(m, WORLD.startEase / 2, 'playing');
    expect(m.speed).toBe(12);
    const at = m.offset;
    stepFor(m, 1, 'playing', 20);
    expect(m.offset - at).toBeCloseTo(20, 6);
    expect(m.idle).toBe(0);
  });

  it('slows to a stop over stopEase after a crash and dims, then eases back on a restart', () => {
    const m = new WorldMotion();
    stepFor(m, 2, 'playing', 24);
    stepFor(m, WORLD.stopEase / 2, 'over');
    expect(m.speed).toBeGreaterThan(0);
    expect(m.speed).toBeLessThan(24);
    stepFor(m, WORLD.stopEase / 2 + dt, 'over');
    expect(m.speed).toBe(0);
    expect(m.dim).toBeCloseTo(WORLD.overDim, 9);
    const stopped = m.offset;
    stepFor(m, 1, 'over');
    expect(m.offset).toBe(stopped);
    m.step(dt, 'playing', 12, false);
    expect(m.speed).toBeLessThan(0.01);
    stepFor(m, WORLD.startEase, 'playing');
    expect(m.speed).toBe(12);
    expect(m.dim).toBe(0);
  });

  it('pulses only while idle, between 0 and 1', () => {
    const m = new WorldMotion();
    const seen: number[] = [];
    for (let i = 0; i < WORLD.pulsePeriod / dt; i++) {
      m.step(dt, 'ready', 0, false);
      seen.push(m.pulse());
    }
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seen)).toBeLessThanOrEqual(1);
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(0.95);
    stepFor(m, 2, 'playing');
    expect(m.pulse()).toBe(0);
  });

  it('reduced motion: the idle scene is a still frame, a run still moves, changes are immediate', () => {
    const m = new WorldMotion();
    stepFor(m, 3, 'ready', 0, true);
    expect(m.offset).toBe(0);
    expect(m.time).toBe(0); // no planet spin, no pulse
    expect(m.pulse()).toBe(0);
    m.step(dt, 'playing', 12, true);
    expect(m.speed).toBe(12);
    expect(m.offset).toBeCloseTo(12 * dt, 9);
    m.step(dt, 'over', 0, true);
    expect(m.speed).toBe(0);
    expect(m.dim).toBe(WORLD.overDim);
  });
});

describe('planetPlacement', () => {
  it('is about a third of the view high in a landscape view, left of the vanishing point, its base under the horizon', () => {
    const p = planetPlacement(16 / 9, 60);
    const diameterShare = (2 * p.radius) / ((60 * Math.PI) / 180);
    expect(diameterShare).toBeGreaterThanOrEqual(0.3);
    expect(diameterShare).toBeLessThanOrEqual(0.4);
    expect(p.azimuth).toBeLessThan(0);
    expect(p.elevation).toBeGreaterThan(0);
    expect(p.elevation).toBeLessThan(p.radius); // partly cut by the horizon
  });

  it('shrinks to fit a portrait view and stays on screen', () => {
    for (const aspect of [0.46, 0.75, 1, 16 / 9, 2.4]) {
      const p = planetPlacement(aspect, 60);
      const halfH = Math.atan(Math.tan(Math.PI / 6) * aspect);
      expect(Math.abs(p.azimuth)).toBeLessThan(halfH); // its centre is in view
      expect(2 * p.radius).toBeLessThanOrEqual(0.44 * 2 * halfH + 1e-9);
    }
  });
});
