// The look of the two newer obstacles (docs/RUNNER.md, "Difficulty and bots"): the WALL with one opening and the SWEEPER.
// render.ts hands them every wall and sweeper the sim has (the three basic kinds it draws itself); this file only reads the sim.
//
// Different by SHAPE, not colour: ivory solids, brass only as a line.
//  - Wall: a thin full-height curtain across the track, one panel per blocked lane, side by side with no seam. The lane left
//    open is marked in brass: a hairline up each edge of the opening and one across the track in it. (A gate or a barrier in
//    the opening is drawn by render.ts like any other.)
//  - Sweeper: a tall hexagonal pylon, narrower at the top, with a brass band round it and a brass line on the track under its
//    whole swing, so the lanes it can reach are marked before it gets there.
// Everything is instanced: four draw calls however many are in view, nothing allocated per frame.

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Object3D,
  type BufferGeometry,
  type Material,
} from 'three';
import type { RunnerConfig } from './config';
import type { RunnerSim } from './sim';

const WALL_CAPACITY = 24;
const BAR_CAPACITY = 96;
const SWEEPER_CAPACITY = 8;

/** Width of a brass hairline, and how far it stands proud of the wall's face. */
const HAIRLINE = 0.07;
const STAND_OFF = 0.03;

export interface Hazards {
  /** Add this to the scene. */
  object: Group;
  /** Place everything the sim has in view. `d` is the rover's interpolated distance, `time` the interpolated play time. */
  update(sim: RunnerSim, d: number, time: number): void;
  /** Free the geometries and instance buffers made here (the materials belong to the caller). */
  dispose(): void;
}

export function createHazards(cfg: RunnerConfig, materials: { ivory: Material; brass: Material }): Hazards {
  const lw = cfg.track.laneWidth;
  const hb = cfg.hitbox;
  const geometries: BufferGeometry[] = [];
  const geo = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const object = new Group();
  const dummy = new Object3D();

  // Wall: one panel as wide as the lane (the hitbox is a little narrower than the art), and a unit box for the brass lines,
  // scaled per instance.
  const panels = new InstancedMesh(geo(new BoxGeometry(lw, hb.wall.top, hb.wall.length)), materials.ivory, WALL_CAPACITY);
  const bars = new InstancedMesh(geo(new BoxGeometry(1, 1, 1)), materials.brass, BAR_CAPACITY);
  // Sweeper: a hexagonal pylon (6 sides, 0.55 at the top and 0.95 at the foot) and a brass band that hugs it.
  const bodyHeight = hb.sweeper.top;
  const bodyGeo = geo(new CylinderGeometry(0.55, 0.95, bodyHeight, 6, 1));
  const bandAt = 0.55 * bodyHeight;
  const bandRadius = 0.55 + (0.95 - 0.55) * (1 - bandAt / bodyHeight) + 0.03;
  const bandGeo = geo(new CylinderGeometry(bandRadius, bandRadius + 0.02, 0.1, 6, 1));
  const pylons = new InstancedMesh(bodyGeo, materials.ivory, SWEEPER_CAPACITY);
  const bands = new InstancedMesh(bandGeo, materials.brass, SWEEPER_CAPACITY);
  for (const m of [panels, bars, pylons, bands]) {
    m.count = 0;
    m.frustumCulled = false;
    object.add(m);
  }

  // The lanes each wall's row blocks, by distance: a bit per lane (1 = left, 2 = middle, 4 = right). Reused every frame.
  const rows = new Map<number, number>();

  const bar = (n: number, x: number, y: number, z: number, sx: number, sy: number, sz: number): number => {
    if (n >= BAR_CAPACITY) return n;
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    bars.setMatrixAt(n, dummy.matrix);
    return n + 1;
  };

  return {
    object,
    update(sim, d, time) {
      const far = cfg.render.fog.far + 10;
      rows.clear();
      for (const o of sim.obstacles) {
        if (o.kind === 'wall' && o.z - d <= far) rows.set(o.z, (rows.get(o.z) ?? 0) | (1 << (o.lane + 1)));
      }

      let p = 0;
      let b = 0;
      let s = 0;
      for (const o of sim.obstacles) {
        const rel = o.z - d;
        if (rel > far) continue;
        if (o.kind === 'wall') {
          if (p >= WALL_CAPACITY) continue;
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.position.set(o.lane * lw, hb.wall.top / 2, -rel);
          dummy.updateMatrix();
          panels.setMatrixAt(p++, dummy.matrix);
          const mask = rows.get(o.z) ?? 0;
          // A hairline up the edge that faces an open lane.
          for (const side of [-1, 1]) {
            const next = o.lane + side;
            if (next < -1 || next > 1 || mask & (1 << (next + 1))) continue;
            b = bar(b, o.lane * lw + side * (lw / 2), hb.wall.top / 2, -rel, HAIRLINE, hb.wall.top, hb.wall.length + 2 * STAND_OFF);
          }
        } else if (o.kind === 'sweeper' && o.sweep && s < SWEEPER_CAPACITY) {
          const x = sim.obstacleX(o, time);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.position.set(x, bodyHeight / 2, -rel);
          dummy.updateMatrix();
          pylons.setMatrixAt(s, dummy.matrix);
          dummy.position.set(x, bandAt, -rel);
          dummy.updateMatrix();
          bands.setMatrixAt(s, dummy.matrix);
          s++;
          // The swing's whole width on the track, from the left lane's edge to the right one's, one hairline.
          b = bar(b, (o.lane + 0.5) * lw, 0.02, -rel, lw + 1.8, 0.03, HAIRLINE);
        }
      }
      // A line across each wall's opening, flat on the track.
      for (const [z, mask] of rows) {
        for (let lane = -1; lane <= 1; lane++) {
          if (mask & (1 << (lane + 1))) continue;
          b = bar(b, lane * lw, 0.02, -(z - d), lw - 0.2, 0.03, HAIRLINE * 1.5);
        }
      }

      panels.count = p;
      bars.count = b;
      pylons.count = s;
      bands.count = s;
      for (const m of [panels, bars, pylons, bands]) m.instanceMatrix.needsUpdate = true;
      dummy.scale.set(1, 1, 1);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of [panels, bars, pylons, bands]) m.dispose();
      object.clear();
    },
  };
}
