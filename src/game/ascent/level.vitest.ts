// The prototype course is climbable with the jump in config.ts: every step of the route is within reach, with a margin, and
// nothing overlaps. A change to the jump (or to the course) that breaks a step fails here, naming it.
import { describe, expect, it } from 'vitest';
import { ASCENT_CONFIG, jumpReach } from './config';
import { groundBelow, overlaps } from './collision';
import { PROTOTYPE_LEVEL as level, type LevelBox } from './level';

/** The shortest distance across the ground between two boxes' footprints (0 when they overlap seen from above). */
function gap(a: LevelBox, b: LevelBox): number {
  const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
  const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
  return Math.hypot(dx, dz);
}

/** Share of the jump's full reach a step may ask for: room for a jump taken a little early or at an angle. */
const MARGIN = 0.8;
/** The highest step up, as a share of the jump's height: the feet need to clear the edge with room to spare. */
const MAX_RISE = 0.8;

describe('the prototype course', () => {
  const route = level.route.map((i) => level.boxes[i]);

  it('starts on the ground, clear of every block', () => {
    expect(groundBelow(level.spawn, ASCENT_CONFIG.agent.width / 2, level.boxes)).toBe(0);
  });

  it('has no two solids overlapping', () => {
    for (let i = 0; i < level.boxes.length; i++) {
      for (let j = i + 1; j < level.boxes.length; j++) {
        expect(overlaps(level.boxes[i], level.boxes[j]), `boxes ${i} and ${j}`).toBe(false);
      }
    }
  });

  it('every step of the route is within reach of a jump', () => {
    for (let i = 1; i < route.length; i++) {
      const from = route[i - 1];
      const to = route[i];
      const rise = to.max.y - from.max.y;
      const name = `step ${i} (to block ${level.route[i]})`;
      expect(rise, `${name}: rise`).toBeLessThanOrEqual(ASCENT_CONFIG.jump.height * MAX_RISE);
      expect(gap(from, to), `${name}: gap`).toBeLessThanOrEqual(jumpReach(rise) * MARGIN);
    }
  });

  it('climbs: each step of the route is higher than the last, up to the goal', () => {
    for (let i = 1; i < route.length; i++) expect(route[i].max.y).toBeGreaterThan(route[i - 1].max.y);
    expect(level.goal.y).toBeGreaterThan(route[route.length - 1].max.y + ASCENT_CONFIG.agent.height);
  });
});
