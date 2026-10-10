import { describe, expect, it } from 'vitest';
import { ORBIT_RATIO, ORBIT_TILT, orbit } from './orbit';

describe('the brand ring', () => {
  const ring = orbit({ cx: 160, cy: 90, rx: 112 });

  it('is the logo ellipse: 2.94 wide to 1 tall, tilted -24 degrees', () => {
    expect(ORBIT_RATIO).toBe(2.94);
    expect(ORBIT_TILT).toBe(-24);
    expect(ring.d).toContain(`A112 ${(112 / 2.94).toFixed(2)} -24 0 1`);
  });

  it('starts at angle 0 and closes, as two half arcs', () => {
    const [x0, y0] = ring.point(0);
    expect(ring.d.startsWith(`M${x0.toFixed(2)} ${y0.toFixed(2)}`)).toBe(true);
    expect(ring.d.endsWith('Z')).toBe(true);
    expect(ring.d.match(/A/g)).toHaveLength(2);
  });

  it('splits into a far half and a near half that meet at the ends', () => {
    expect(ring.back.startsWith(`M${ring.point(180).map((n) => n.toFixed(2)).join(' ')}`)).toBe(true);
    expect(ring.front.startsWith(`M${ring.point(0).map((n) => n.toFixed(2)).join(' ')}`)).toBe(true);
  });

  it('puts the near half below the far half (the tilt lifts the right end)', () => {
    const [, nearY] = ring.point(90);
    const [, farY] = ring.point(270);
    expect(nearY).toBeGreaterThan(farY);
    expect(ring.point(0)[1]).toBeLessThan(90); // right end above the centre
  });

  it('measures positions along the path out of 100, growing with the angle', () => {
    expect(ring.at(0)).toBe(0);
    expect(ring.at(360)).toBe(0);
    expect(ring.at(180)).toBeCloseTo(50, 0);
    expect(ring.at(90)).toBeLessThan(ring.at(120));
    expect(ring.at(-90)).toBe(ring.at(270));
  });

  it('keeps every point within the box it is drawn in', () => {
    const stat = orbit({ cx: 120, cy: 60, rx: 100 });
    for (let deg = 0; deg < 360; deg += 5) {
      const [x, y] = stat.point(deg);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(240);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(120);
    }
  });
});
