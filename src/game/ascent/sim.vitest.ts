import { describe, expect, it } from 'vitest';
import { ASCENT_CONFIG, jumpPhysics, jumpReach } from './config';
import type { Level } from './level';
import { AscentSim } from './sim';

const cfg = ASCENT_CONFIG;
const dt = cfg.step;
const steps = (seconds: number) => Math.round(seconds / dt);

/** A floor, and a ledge whose edge is at z = 0 (the ledge runs from z = 0 to z = -10, the floor is far below). */
const LEDGE: Level = {
  spawn: { x: 0, y: 5, z: -2 },
  spawnYaw: 0,
  boxes: [
    { kind: 'ground', min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } },
    { kind: 'block', min: { x: -5, y: 4, z: -10 }, max: { x: 5, y: 5, z: 0 } },
  ],
  route: [1],
  goal: { x: 0, y: 10, z: 0 },
};

const FLAT: Level = { ...LEDGE, spawn: { x: 0, y: 0, z: 0 }, boxes: [LEDGE.boxes[0]] };

function run(sim: AscentSim, seconds: number, each?: (sim: AscentSim) => void) {
  for (let i = 0; i < steps(seconds); i++) {
    sim.step();
    each?.(sim);
  }
}

/** A sim standing still on the ground. */
function settled(level: Level = FLAT): AscentSim {
  const sim = new AscentSim(level);
  run(sim, 0.1);
  expect(sim.grounded).toBe(true);
  return sim;
}

describe('jump physics', () => {
  it('derives gravity and take-off from the height and the time to the top', () => {
    const { gravity, takeoff, fallGravity } = jumpPhysics();
    expect((takeoff * takeoff) / (2 * gravity)).toBeCloseTo(cfg.jump.height, 6);
    expect(takeoff / gravity).toBeCloseTo(cfg.jump.timeToApex, 6);
    expect(fallGravity).toBeCloseTo(gravity * cfg.jump.fallMultiplier, 6);
  });

  it('reach shrinks as the landing rises, and is 0 above the jump height', () => {
    expect(jumpReach(0)).toBeGreaterThan(jumpReach(1));
    expect(jumpReach(cfg.jump.height + 0.01)).toBe(0);
  });
});

describe('standing and running', () => {
  it('stands still on the ground without drifting', () => {
    const sim = settled();
    const y = sim.pos.y;
    run(sim, 2);
    expect(sim.pos).toEqual({ x: 0, y, z: 0 });
    expect(sim.grounded).toBe(true);
  });

  it('reaches top speed quickly and stops quickly', () => {
    const sim = settled();
    sim.setMove(0, -1);
    run(sim, 0.15);
    expect(Math.hypot(sim.vel.x, sim.vel.z)).toBeCloseTo(cfg.move.speed, 6);
    sim.setMove(0, 0);
    run(sim, 0.15);
    expect(Math.hypot(sim.vel.x, sim.vel.z)).toBe(0);
  });

  it('clamps a steering vector longer than 1', () => {
    const sim = settled();
    sim.setMove(3, -3);
    run(sim, 0.5);
    expect(Math.hypot(sim.vel.x, sim.vel.z)).toBeCloseTo(cfg.move.speed, 6);
  });

  it('turns to face where it runs (yaw 0 faces -Z)', () => {
    const sim = settled();
    sim.setMove(1, 0);
    run(sim, 0.5);
    expect(sim.yaw).toBeCloseTo(-Math.PI / 2, 3);
  });
});

describe('jumping', () => {
  it('a held jump reaches the configured height; one landing, no double jump in the air', () => {
    const sim = settled();
    const ground = sim.pos.y;
    sim.jumpPress();
    let top = ground;
    run(sim, 0.3, (s) => (top = Math.max(top, s.pos.y)));
    sim.jumpRelease();
    sim.jumpPress(); // in the air, long before landing: no second jump
    run(sim, 1.2, (s) => (top = Math.max(top, s.pos.y)));
    expect(top - ground).toBeGreaterThan(cfg.jump.height - 0.08);
    expect(top - ground).toBeLessThan(cfg.jump.height + 0.08);
    expect(sim.jumps).toBe(1);
    expect(sim.grounded).toBe(true);
    expect(sim.best).toBeCloseTo(0, 3); // the best is where it stood, not the top of a jump
  });

  it('the best height is the highest block stood on', () => {
    const step = { kind: 'block' as const, min: { x: -2, y: 0, z: -4 }, max: { x: 2, y: 1, z: -1 } };
    const sim = new AscentSim({ ...FLAT, boxes: [...FLAT.boxes, step] });
    run(sim, 0.1);
    sim.setMove(0, -1);
    sim.jumpPress();
    run(sim, 0.35);
    sim.setMove(0, 0); // over the step: stop on it
    run(sim, 0.8);
    expect(sim.pos.y).toBeCloseTo(1, 3);
    expect(sim.best).toBeCloseTo(1, 3);
  });

  it('letting go of Space early makes a short hop', () => {
    const sim = settled();
    sim.jumpPress();
    sim.step();
    sim.jumpRelease();
    let top = 0;
    run(sim, 1, (s) => (top = Math.max(top, s.pos.y)));
    expect(top).toBeLessThan(cfg.jump.height * 0.6);
    expect(top).toBeGreaterThan(0.2);
  });

  it('coyote time: a jump just after walking off the edge still jumps', () => {
    const sim = new AscentSim(LEDGE);
    run(sim, 0.1);
    sim.setMove(0, 1); // towards the edge at z = 0
    let airborne = 0;
    while (sim.grounded || airborne === 0) {
      sim.step();
      if (!sim.grounded) airborne++;
      if (sim.time > 5) throw new Error('never left the ledge');
    }
    run(sim, cfg.jump.coyoteTime * 0.6);
    expect(sim.grounded).toBe(false);
    sim.jumpPress();
    sim.step();
    expect(sim.jumps).toBe(1);
    expect(sim.vel.y).toBeGreaterThan(0);
  });

  it('coyote time runs out', () => {
    const sim = new AscentSim(LEDGE);
    run(sim, 0.1);
    sim.setMove(0, 1);
    while (sim.grounded) sim.step();
    run(sim, cfg.jump.coyoteTime + 0.03);
    sim.jumpPress();
    sim.step();
    expect(sim.jumps).toBe(0);
  });

  it('jump buffering: a jump pressed just before landing happens on landing', () => {
    const sim = new AscentSim({ ...FLAT, spawn: { x: 0, y: 3, z: 0 } });
    // Fall until about 0.08 s from the ground, then press.
    const { fallGravity } = jumpPhysics();
    while (sim.pos.y > 0 && sim.pos.y + sim.vel.y * 0.08 - 0.5 * fallGravity * 0.08 * 0.08 > 0) sim.step();
    expect(sim.grounded).toBe(false);
    sim.jumpPress();
    run(sim, 0.12);
    expect(sim.jumps).toBe(1);
  });

  it('a press too long before landing is forgotten', () => {
    const sim = new AscentSim({ ...FLAT, spawn: { x: 0, y: 6, z: 0 } });
    run(sim, 0.05);
    sim.jumpPress();
    run(sim, 1.5);
    expect(sim.grounded).toBe(true);
    expect(sim.jumps).toBe(0);
  });

  it('a full running jump covers about the reach the level is checked against', () => {
    const sim = settled();
    sim.setMove(0, -1);
    run(sim, 0.3);
    const start = sim.pos.z;
    sim.jumpPress();
    let landedAt: number | null = null;
    for (let i = 0; i < steps(2) && landedAt === null; i++) {
      sim.step();
      if (i > 2 && sim.grounded) landedAt = sim.pos.z;
    }
    expect(landedAt).not.toBeNull();
    expect(Math.abs(start - (landedAt ?? 0) - jumpReach(0))).toBeLessThan(0.1);
  });
});

describe('falling', () => {
  it('falling below killY puts the agent back at the start, facing the start way', () => {
    const sim = new AscentSim({ ...LEDGE, boxes: [LEDGE.boxes[1]] }); // no floor under the ledge
    run(sim, 0.1);
    const teleports = sim.teleports;
    sim.setMove(0, 1);
    run(sim, 0.6);
    sim.setMove(0, 0);
    run(sim, 3);
    expect(sim.falls).toBe(1);
    expect(sim.teleports).toBe(teleports + 1);
    expect(sim.pos.z).toBeCloseTo(LEDGE.spawn.z, 6);
    expect(sim.yaw).toBe(LEDGE.spawnYaw);
  });

  it('never falls faster than maxFall', () => {
    const sim = new AscentSim({ ...FLAT, spawn: { x: 0, y: 400, z: 0 } });
    run(sim, 5);
    expect(sim.vel.y).toBeGreaterThanOrEqual(-cfg.jump.maxFall);
    expect(sim.vel.y).toBeLessThan(-cfg.jump.maxFall + 1e-9);
  });

  it('release() lets go of everything, restart() resets the climb', () => {
    const sim = settled();
    sim.setMove(1, 0);
    sim.jumpPress();
    sim.release();
    run(sim, 0.5);
    expect(sim.jumps).toBe(0);
    expect(sim.pos.x).toBe(0);
    sim.setMove(1, 0);
    run(sim, 0.5);
    sim.restart();
    expect(sim.pos).toEqual(FLAT.spawn);
    expect(sim.time).toBe(0);
    expect(sim.best).toBe(0);
  });
});

describe('interpolation', () => {
  it('lerps between the last two steps', () => {
    const sim = settled();
    sim.setMove(1, 0);
    run(sim, 0.3);
    const mid = sim.lerpPos(0.5);
    expect(mid.x).toBeCloseTo((sim.prev.x + sim.pos.x) / 2, 9);
  });
});
