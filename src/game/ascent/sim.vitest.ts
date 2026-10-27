import { describe, expect, it } from 'vitest';
import { ASCENT_CONFIG, jumpPhysics, jumpReach } from './config';
import type { Level } from './level';
import { AscentSim, ringDistance } from './sim';

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
  beacons: [],
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

describe('assist mode', () => {
  /** A high ledge with a beacon on it, the floor 12 m below. */
  const HIGH: Level = {
    spawn: { x: 0, y: 0, z: 6 },
    spawnYaw: 0,
    boxes: [
      { kind: 'ground', min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } },
      { kind: 'block', min: { x: -3, y: 11, z: -3 }, max: { x: 3, y: 12, z: 3 } },
    ],
    route: [1],
    goal: { x: 0, y: 20, z: 0 },
    beacons: [{ x: 0, y: 12, z: 0 }],
  };
  /** Put the agent on the ledge's beacon, then walk it off the edge to the floor. */
  function fallFromLedge(assist: boolean) {
    const sim = new AscentSim(HIGH);
    sim.setAssist(assist);
    sim.restore({
      pos: { x: 0, y: 12, z: 0 },
      yaw: 0,
      time: 0,
      best: 0,
      falls: 0,
      jumps: 0,
      assist,
      assisted: assist,
      checkpoint: null,
    });
    run(sim, 0.2);
    expect(sim.checkpoint).toBe(0);
    sim.setMove(1, 0);
    const teleports = sim.teleports;
    // Let go once it is put back, so it does not walk off again.
    run(sim, 3, (s) => s.teleports !== teleports && s.setMove(0, 0));
    return sim;
  }

  it('hardcore (the default): a fall from the beacon lands on the floor, and nothing brings it back', () => {
    const sim = fallFromLedge(false);
    expect(sim.pos.y).toBeCloseTo(0, 3);
    expect(sim.falls).toBe(0);
  });

  it('on: falling too far below the last beacon touched puts the agent back on it, a fall counted', () => {
    const sim = fallFromLedge(true);
    expect(sim.falls).toBe(1);
    expect(sim.pos.y).toBeGreaterThan(cfg.assist.drop);
    expect(sim.assisted).toBe(true);
  });

  it('turning it on marks the climb as assisted until a restart with it off', () => {
    const sim = new AscentSim(HIGH);
    expect(sim.assisted).toBe(false);
    sim.setAssist(true);
    sim.setAssist(false);
    expect(sim.assisted).toBe(true);
    sim.restart();
    expect(sim.assisted).toBe(false);
    expect(sim.checkpoint).toBeNull();
  });

  it('restores a saved climb, dropping a checkpoint the level does not have', () => {
    const sim = new AscentSim(HIGH);
    const before = sim.teleports;
    sim.restore({
      pos: { x: 2, y: 12, z: 1 },
      yaw: 1,
      time: 90,
      best: 12,
      falls: 2,
      jumps: 30,
      assist: true,
      assisted: true,
      checkpoint: 7,
    });
    expect(sim.pos).toEqual({ x: 2, y: 12, z: 1 });
    expect([sim.time, sim.best, sim.falls, sim.jumps]).toEqual([90, 12, 2, 30]);
    expect(sim.checkpoint).toBeNull();
    expect(sim.teleports).toBe(before + 1);
  });
});

describe("the climb's moving parts", () => {
  const floor = { kind: 'ground' as const, min: { x: -50, y: -1, z: -50 }, max: { x: 50, y: 0, z: 50 } };
  const at = (x: number, top: number, z: number, w = 2, h = 0.5) => ({
    kind: 'block' as const,
    min: { x: x - w / 2, y: top - h, z: z - w / 2 },
    max: { x: x + w / 2, y: top, z: z + w / 2 },
  });
  const base = { spawnYaw: 0, route: [1, 2], goal: { x: 0, y: 50, z: 0 }, beacons: [] };

  it('a fan lifts the agent standing on it up its updraft, and no higher than its top speed carries', () => {
    const level: Level = { ...base, spawn: { x: 0, y: 1, z: 0 }, boxes: [floor, at(0, 1, 0), at(10, 1, 10)] };
    level.fans = [{ box: 1, height: 5, strength: 42 }];
    const sim = new AscentSim(level);
    let top = 0;
    run(sim, 2.5, (s) => (top = Math.max(top, s.pos.y)));
    expect(top).toBeGreaterThan(1 + 5);
    expect(top).toBeLessThan(1 + 5 + cfg.fan.maxRise ** 2 / (2 * jumpPhysics().gravity) + 0.5);
  });

  it('a drifting block carries the agent standing on it, and comes back on time', () => {
    const level: Level = { ...base, spawn: { x: 0, y: 1, z: 0 }, boxes: [floor, at(0, 1, 0, 3), at(20, 1, 20)] };
    level.movers = [{ box: 1, offset: { x: 4, y: 0, z: 0 }, period: 4 }];
    const sim = new AscentSim(level);
    run(sim, 2); // half a period: at the far end
    expect(sim.solids[1].min.x).toBeCloseTo(-1.5 + 4, 2);
    expect(sim.pos.x).toBeCloseTo(4, 1);
    expect(sim.grounded).toBe(true);
    run(sim, 2); // back where it started, the agent still on it
    expect(sim.solids[1].min.x).toBeCloseTo(-1.5, 2);
    expect(sim.pos.x).toBeCloseTo(0, 1);
  });

  it('a drifting block pushes an agent in its way aside, never through it', () => {
    const level: Level = { ...base, spawn: { x: 3, y: 0, z: 0 }, boxes: [floor, at(0, 1.5, 0, 2, 1.5), at(20, 1, 20)] };
    level.movers = [{ box: 1, offset: { x: 4, y: 0, z: 0 }, period: 4 }];
    const sim = new AscentSim(level);
    run(sim, 2, (s) => {
      const b = s.solids[1];
      const inside = s.pos.x + 0.28 > b.min.x + 0.01 && s.pos.x - 0.28 < b.max.x - 0.01 && s.pos.y < b.max.y;
      expect(inside).toBe(false);
    });
  });

  it('a crumbling block breaks after its delay once stood on, and comes back later', () => {
    const level: Level = { ...base, spawn: { x: 0, y: 4, z: 0 }, boxes: [floor, at(0, 4, 0), at(20, 1, 20)] };
    level.crumbles = [{ box: 1, delay: 0.7 }];
    const sim = new AscentSim(level);
    run(sim, 0.5);
    expect(sim.crumbles[0].touched).not.toBeNull();
    expect(sim.pos.y).toBeCloseTo(4, 3);
    run(sim, 0.5);
    expect(sim.crumbles[0].broke).not.toBeNull();
    run(sim, 1.5);
    expect(sim.pos.y).toBeCloseTo(0, 3); // fell to the floor
    run(sim, cfg.crumble.back);
    expect(sim.crumbles[0].broke).toBeNull();
  });

  it('touching the ring finishes the climb and stops the clock', () => {
    // A ring lying flat (no rotation) whose tube passes 1.9 m above a block's top: out of reach standing, in reach jumping.
    const level: Level = {
      ...base,
      spawn: { x: 0, y: 1, z: 0 },
      boxes: [floor, at(0, 1, 0, 4), at(20, 1, 20)],
      ring: { centre: { x: 3, y: 2.9, z: 0 }, radius: 3, tube: 0.1, rotation: { x: 0, y: 0, z: 0, w: 1 } },
    };
    const sim = new AscentSim(level);
    run(sim, 0.3);
    expect(sim.finished).toBe(false);
    sim.jumpPress();
    run(sim, 0.4);
    expect(sim.finished).toBe(true);
    const t = sim.time;
    run(sim, 1);
    expect(sim.time).toBe(t);
    sim.restart();
    expect(sim.finished).toBe(false);
  });

  it("measures the distance to the ring tube in the ring's own frame", () => {
    const flat = { centre: { x: 0, y: 0, z: 0 }, radius: 5, tube: 0.2, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    expect(ringDistance({ x: 5, y: 0, z: 0 }, flat)).toBeCloseTo(0, 9);
    expect(ringDistance({ x: 0, y: 0, z: 0 }, flat)).toBeCloseTo(5, 9);
    // Turned a quarter about X, the ring stands up: (0, 5, 0) is on it.
    const s = Math.SQRT1_2;
    expect(ringDistance({ x: 0, y: 5, z: 0 }, { ...flat, rotation: { x: s, y: 0, z: 0, w: s } })).toBeCloseTo(0, 6);
  });

  it('a bigger level keeps what was there and adds the rest', () => {
    const small: Level = { ...base, spawn: { x: 0, y: 1, z: 0 }, boxes: [floor, at(0, 1, 0, 3), at(20, 1, 20)] };
    small.movers = [{ box: 1, offset: { x: 4, y: 0, z: 0 }, period: 4 }];
    const sim = new AscentSim(small);
    run(sim, 1);
    const x = sim.solids[1].min.x;
    const big: Level = { ...small, boxes: [...small.boxes, at(0, 30, 0)], crumbles: [{ box: 3, delay: 1 }] };
    sim.setLevel(big);
    expect(sim.solids).toHaveLength(4);
    expect(sim.solids[1].min.x).toBeCloseTo(x, 6);
    expect(sim.crumbles).toHaveLength(1);
  });
});
