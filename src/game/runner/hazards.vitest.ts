import { InstancedMesh, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { RUNNER_CONFIG, timeAtDistance } from './config';
import { fixedCourse, type Row } from './generator';
import { createHazards } from './hazards';
import { RunnerSim } from './sim';

// hazards.ts in Node: three.js builds geometry and instance buffers without a GL context, so the placement and the clean-up can
// be checked here (the look itself is judged in the browser, docs/RUNNER.md).

const cfg = RUNNER_CONFIG;
const lw = cfg.track.laneWidth;

function simOn(rows: (Omit<Row, 'pickups'> & { pickups?: Row['pickups'] })[]) {
  const sim = new RunnerSim({ seed: 1, course: () => fixedCourse(rows) });
  sim.start(true);
  return sim;
}

function setup() {
  const ivory = new MeshLambertMaterial();
  const brass = new MeshBasicMaterial();
  const hazards = createHazards(cfg, { ivory, brass });
  const meshes = hazards.object.children as InstancedMesh[];
  const [panels, bars, pylons, bands] = meshes;
  return { hazards, panels, bars, pylons, bands, ivory, brass };
}

describe('hazards', () => {
  it('draws a wall as one panel per blocked lane, with brass lines up the edges of the opening and across it', () => {
    const { hazards, panels, bars, pylons } = setup();
    const sim = simOn([{ z: 40, lanes: ['wall', null, 'wall'] }]);
    hazards.update(sim, 0, 0);
    expect(panels.count).toBe(2);
    expect(pylons.count).toBe(0);
    // Each panel has one side that faces the open middle lane: two vertical hairlines; plus one line across the opening.
    expect(bars.count).toBe(3);
    // The panels sit in their lanes, 40 m ahead of the rover (drawn at z = -rel).
    const m = panels.instanceMatrix.array;
    // (instance matrices are 32-bit floats)
    expect(m[12]).toBeCloseTo(-lw, 5);
    expect(m[13]).toBeCloseTo(cfg.hitbox.wall.top / 2, 5);
    expect(m[14]).toBe(-40);
    expect(m[16 + 12]).toBeCloseTo(lw, 5);
  });

  it('a wall with the opening at the edge marks only the sides that face it', () => {
    const { hazards, panels, bars } = setup();
    hazards.update(simOn([{ z: 40, lanes: [null, 'wall', 'wall'] }]), 0, 0);
    expect(panels.count).toBe(2);
    expect(bars.count).toBe(1 + 1); // the edge between the open left lane and the middle panel, and the line across the opening
  });

  it('draws a sweeper where the sim has it at that time, with a line under its whole swing', () => {
    const { hazards, panels, bars, pylons, bands } = setup();
    const z = 60;
    const t0 = timeAtDistance(z) - 3.4 / 2; // over the upper lane when the rover arrives
    const sim = simOn([{ z, lanes: ['sweeper', 'sweeper', null], sweep: { lane: -1, period: 3.4, t0 } }]);
    hazards.update(sim, 0, t0); // at t0 it is over the lower lane
    expect(pylons.count).toBe(1);
    expect(bands.count).toBe(1);
    expect(panels.count).toBe(0);
    expect(bars.count).toBe(1);
    expect(pylons.instanceMatrix.array[12]).toBeCloseTo(-lw, 5);
    hazards.update(sim, 0, t0 + 3.4 / 2); // half a swing later: over the middle lane
    expect(pylons.instanceMatrix.array[12]).toBeCloseTo(0, 5);
    hazards.update(sim, 0, t0 + 3.4 / 4); // a quarter: halfway between
    expect(pylons.instanceMatrix.array[12]).toBeCloseTo(-lw / 2, 5);
  });

  it('draws nothing for the basic kinds or for what is far beyond the fog, and counts come back to zero', () => {
    const { hazards, panels, pylons } = setup();
    const sim = simOn([
      { z: 30, lanes: ['slab', 'barrier', 'gate'] },
      { z: 900, lanes: ['wall', null, 'wall'] },
    ]);
    hazards.update(sim, 0, 0);
    expect(panels.count + pylons.count).toBe(0);
  });

  it('dispose frees every geometry and instance buffer it made, and not the materials it was lent', () => {
    const { hazards, ivory, brass } = setup();
    const spies = (hazards.object.children as InstancedMesh[]).map((m) => ({
      geo: vi.spyOn(m.geometry, 'dispose'),
      mesh: vi.spyOn(m, 'dispose'),
    }));
    const ivorySpy = vi.spyOn(ivory, 'dispose');
    const brassSpy = vi.spyOn(brass, 'dispose');
    hazards.dispose();
    for (const s of spies) {
      expect(s.geo).toHaveBeenCalled();
      expect(s.mesh).toHaveBeenCalled();
    }
    expect(ivorySpy).not.toHaveBeenCalled();
    expect(brassSpy).not.toHaveBeenCalled();
    expect(hazards.object.children.length).toBe(0);
  });

  it('is four draw calls whatever is in view, and a handful of triangles', () => {
    const { hazards, panels, bars, pylons, bands } = setup();
    expect(hazards.object.children.length).toBe(4);
    const tris = (m: InstancedMesh) => ((m.geometry.index?.count ?? 0) / 3) * Math.max(1, m.instanceMatrix.count);
    hazards.update(simOn([{ z: 40, lanes: ['wall', null, 'wall'] }]), 0, 0);
    // The capacity is the most that can ever be drawn: even full, well under a thousand triangles.
    expect(tris(panels) + tris(bars) + tris(pylons) + tris(bands)).toBeLessThan(2000);
  });
});
