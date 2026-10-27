// Box-only collision, written for the game (docs/ASCENT.md, "Blender is the level editor"): no physics engine. Every solid
// is an axis-aligned box; the agent is one too. The agent moves one axis at a time, and each move is swept against the
// boxes it overlaps on the other two axes, so it stops at the face it would cross and can never pass through a block, however
// thin the block or fast the fall. A box the agent already overlaps (it spawned inside one) never blocks it, so it can always
// get out. Later phases add boxes rotated about the vertical axis; nothing here is tilted.
//
// Pure: no three.js, no DOM. Units are metres; +Y is up.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** An axis-aligned box, from its smallest corner to its largest. */
export interface Box {
  min: Vec3;
  max: Vec3;
}

export type Axis = 'x' | 'y' | 'z';

/** Gap left between the agent and a face it stopped at, so the next sweep starts outside the box. */
export const SKIN = 1e-4;

const others: Record<Axis, [Axis, Axis]> = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };

/** The agent's box: `pos` is the middle of its feet; it is `2 × halfWidth` across and `height` tall. */
export function agentBox(pos: Vec3, halfWidth: number, height: number): Box {
  return {
    min: { x: pos.x - halfWidth, y: pos.y, z: pos.z - halfWidth },
    max: { x: pos.x + halfWidth, y: pos.y + height, z: pos.z + halfWidth },
  };
}

/** Whether two boxes overlap along one axis (touching faces do not). */
function overlapsOn(a: Box, b: Box, axis: Axis): boolean {
  return a.min[axis] < b.max[axis] && a.max[axis] > b.min[axis];
}

export function overlaps(a: Box, b: Box): boolean {
  return overlapsOn(a, b, 'x') && overlapsOn(a, b, 'y') && overlapsOn(a, b, 'z');
}

/**
 * Moves `box` by `delta` along `axis`, stopping at the first face it would cross. Returns how far it actually moved and
 * whether it was stopped. `box` is not changed.
 */
export function sweepAxis(
  box: Box,
  axis: Axis,
  delta: number,
  solids: readonly Box[],
): { moved: number; hit: boolean } {
  if (delta === 0) return { moved: 0, hit: false };
  const [a1, a2] = others[axis];
  let moved = delta;
  let hit = false;
  for (const s of solids) {
    if (!overlapsOn(box, s, a1) || !overlapsOn(box, s, a2)) continue;
    if (delta > 0) {
      // Moving towards +axis: the box's leading face is max; it may cross the solid's min face.
      if (box.max[axis] > s.min[axis] + SKIN) continue; // already past or inside that face
      const room = Math.max(0, s.min[axis] - box.max[axis] - SKIN);
      if (room < moved) {
        moved = room;
        hit = true;
      }
    } else {
      if (box.min[axis] < s.max[axis] - SKIN) continue;
      const room = Math.min(0, s.max[axis] - box.min[axis] + SKIN);
      if (room > moved) {
        moved = room;
        hit = true;
      }
    }
  }
  return { moved, hit };
}

/**
 * Moves the agent (feet at `pos`) by `delta`, across then up or down: x, then z, then y. Returns the new position and which
 * axes were stopped. Moving across first means a jump that clips a ledge's corner is stopped by its side, and then falls,
 * rather than being lifted onto it.
 */
export function moveAgent(
  pos: Vec3,
  delta: Vec3,
  halfWidth: number,
  height: number,
  solids: readonly Box[],
): { pos: Vec3; hit: Record<Axis, boolean> } {
  const next = { ...pos };
  const hit = { x: false, y: false, z: false };
  for (const axis of ['x', 'z', 'y'] as const) {
    const r = sweepAxis(agentBox(next, halfWidth, height), axis, delta[axis], solids);
    next[axis] += r.moved;
    hit[axis] = r.hit;
  }
  return { pos: next, hit };
}

/**
 * The top of the highest solid under the agent's footprint at or below its feet, within `maxDrop` metres, or null. The blob
 * shadow sits there.
 */
export function groundBelow(
  pos: Vec3,
  halfWidth: number,
  solids: readonly Box[],
  maxDrop = Number.POSITIVE_INFINITY,
): number | null {
  let best: number | null = null;
  for (const s of solids) {
    if (pos.x + halfWidth <= s.min.x || pos.x - halfWidth >= s.max.x) continue;
    if (pos.z + halfWidth <= s.min.z || pos.z - halfWidth >= s.max.z) continue;
    const top = s.max.y;
    if (top > pos.y + SKIN * 10 || pos.y - top > maxDrop) continue;
    if (best === null || top > best) best = top;
  }
  return best;
}

/**
 * The distance along a ray (`dir` need not be unit length: the distance is in units of `dir`) to the first box it enters,
 * up to `maxT`, or null. A ray that starts inside a box ignores that box. The camera uses it to stay out of blocks.
 */
export function raycast(origin: Vec3, dir: Vec3, maxT: number, solids: readonly Box[]): number | null {
  let nearest: number | null = null;
  for (const s of solids) {
    let t0 = 0;
    let t1 = maxT;
    let inside = true;
    let ok = true;
    for (const axis of ['x', 'y', 'z'] as const) {
      const o = origin[axis];
      const d = dir[axis];
      if (o < s.min[axis] || o > s.max[axis]) inside = false;
      if (Math.abs(d) < 1e-12) {
        if (o < s.min[axis] || o > s.max[axis]) {
          ok = false;
          break;
        }
        continue;
      }
      let near = (s.min[axis] - o) / d;
      let far = (s.max[axis] - o) / d;
      if (near > far) [near, far] = [far, near];
      t0 = Math.max(t0, near);
      t1 = Math.min(t1, far);
      if (t0 > t1) {
        ok = false;
        break;
      }
    }
    if (!ok || inside) continue;
    if (nearest === null || t0 < nearest) nearest = t0;
  }
  return nearest;
}
