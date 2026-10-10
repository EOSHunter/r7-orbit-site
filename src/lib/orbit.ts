// The brand ring as geometry: the logo's ellipse, 2.94 times as wide as it is tall and tilted -24 degrees
// (src/scripts/orbit.js, RING). Used to draw the ring and its dot in SVG (the article components in
// src/components/article/ and the imagery prototypes, docs/IMAGE_STYLE.md). Pure; unit-tested in orbit.vitest.ts.

export const ORBIT_RATIO = 2.94;
export const ORBIT_TILT = -24;

export interface Ellipse {
  cx: number;
  cy: number;
  /** Half the width before the tilt. The height follows from ORBIT_RATIO. */
  rx: number;
}

export interface Orbit {
  /** The whole ring from angle 0, clockwise on screen. */
  d: string;
  /** The far half (180 to 360 degrees: the upper arc), drawn behind what the ring circles. */
  back: string;
  /** The near half (0 to 180 degrees: the lower arc), drawn in front of it. */
  front: string;
  /** Where an angle falls along the whole path, out of 100 (for a path drawn with pathLength="100"). */
  at(deg: number): number;
  /** The point at an angle, rounded to two decimals. */
  point(deg: number): [number, number];
}

export function orbit(e: Ellipse): Orbit {
  const ry = e.rx / ORBIT_RATIO;
  const r = (ORBIT_TILT * Math.PI) / 180;
  const exact = (deg: number): [number, number] => {
    const t = (deg * Math.PI) / 180;
    const x = e.rx * Math.cos(t);
    const y = ry * Math.sin(t);
    return [e.cx + x * Math.cos(r) - y * Math.sin(r), e.cy + x * Math.sin(r) + y * Math.cos(r)];
  };
  const xy = (deg: number) => exact(deg).map((n) => n.toFixed(2)).join(' ');
  const arc = `${e.rx} ${ry.toFixed(2)} ${ORBIT_TILT} 0 1`;
  // Arc length from angle 0, sampled every degree, so a position on the ring can be given as an angle.
  const lengths = [0];
  for (let deg = 1; deg <= 360; deg++) {
    const [ax, ay] = exact(deg - 1);
    const [bx, by] = exact(deg);
    lengths.push(lengths[deg - 1] + Math.hypot(bx - ax, by - ay));
  }
  return {
    d: `M${xy(0)}A${arc} ${xy(180)}A${arc} ${xy(0)}Z`,
    back: `M${xy(180)}A${arc} ${xy(0)}`,
    front: `M${xy(0)}A${arc} ${xy(180)}`,
    at: (deg) => +((lengths[Math.round(((deg % 360) + 360) % 360)] / lengths[360]) * 100).toFixed(2),
    point: (deg) => exact(deg).map((n) => +n.toFixed(2)) as [number, number],
  };
}
