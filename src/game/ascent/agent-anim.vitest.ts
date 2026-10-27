// The agent's animation as numbers (agent-anim.ts): which animation the sim's state calls for, and the pose's shape through a
// run, a jump and a landing, with and without reduced motion. The sim drives it here, so these are the game's own motions.
import { describe, expect, it } from 'vitest';
import { AgentAnimator, chooseAnimation, type AgentSnapshot } from './agent-anim';
import { ASCENT_CONFIG } from './config';
import type { Level } from './level';
import { AscentSim } from './sim';

/** A wide empty floor: room to run in any direction without bumping into a block. */
const FLAT: Level = {
  spawn: { x: 0, y: 0, z: 0 },
  spawnYaw: 0,
  boxes: [{ kind: 'ground', min: { x: -200, y: -1, z: -200 }, max: { x: 200, y: 0, z: 200 } }],
  route: [],
  goal: { x: 0, y: 50, z: 0 },
  beacons: [],
};

const A = ASCENT_CONFIG.animation;
const FRAME = 1 / 60;

describe('chooseAnimation', () => {
  const ground = { grounded: true, vy: 0, sinceLanding: Infinity };
  it('stands, or runs once it moves faster than runSpeed', () => {
    expect(chooseAnimation({ ...ground, speed: 0 })).toBe('idle');
    expect(chooseAnimation({ ...ground, speed: A.runSpeed * 0.9 })).toBe('idle');
    expect(chooseAnimation({ ...ground, speed: A.runSpeed * 1.1 })).toBe('run');
  });
  it('jumps while rising and falls after the top, whatever its speed across', () => {
    expect(chooseAnimation({ grounded: false, vy: 4, speed: 6, sinceLanding: Infinity })).toBe('jump');
    expect(chooseAnimation({ grounded: false, vy: 0, speed: 0, sinceLanding: Infinity })).toBe('fall');
    expect(chooseAnimation({ grounded: false, vy: -8, speed: 6, sinceLanding: 0 })).toBe('fall');
  });
  it('lands for landTime after touching down, then stands or runs', () => {
    expect(chooseAnimation({ ...ground, speed: 6, sinceLanding: 0 })).toBe('land');
    expect(chooseAnimation({ ...ground, speed: 0, sinceLanding: A.landTime * 0.9 })).toBe('land');
    expect(chooseAnimation({ ...ground, speed: 0, sinceLanding: A.landTime * 1.1 })).toBe('idle');
  });
});

/** The sim on phase 1's level and an animator reading it, stepped together a frame at a time (2 sim steps per frame). */
function rig(reducedMotion = false) {
  const sim = new AscentSim(FLAT);
  const anim = new AgentAnimator();
  const snap = (): AgentSnapshot => ({
    grounded: sim.grounded,
    vx: sim.vel.x,
    vy: sim.vel.y,
    vz: sim.vel.z,
    jumps: sim.jumps,
    landings: sim.landings,
    teleports: sim.teleports,
  });
  const frame = () => {
    sim.step();
    sim.step();
    return { ...anim.update(snap(), FRAME, reducedMotion) };
  };
  const frames = (n: number) => Array.from({ length: n }, frame);
  // Settle onto the floor at the start.
  frames(60);
  return { sim, anim, frame, frames };
}

describe('AgentAnimator', () => {
  it('stands still at rest: a small bob, no squash, the limbs near zero', () => {
    const { frames } = rig();
    const poses = frames(120);
    for (const p of poses) {
      expect(p.animation).toBe('idle');
      expect(p.squash).toBeCloseTo(1, 2);
      expect(Math.abs(p.legL) + Math.abs(p.legR)).toBeLessThan(0.01);
      expect(Math.abs(p.bodyLift)).toBeLessThanOrEqual(A.idleBob + 1e-9);
    }
    // ...and it does bob.
    expect(Math.max(...poses.map((p) => p.bodyLift)) - Math.min(...poses.map((p) => p.bodyLift))).toBeGreaterThan(0.01);
  });

  it('runs: the legs swing opposite each other, the arms opposite the legs, and it leans into the run', () => {
    const { sim, frames } = rig();
    sim.setMove(0, -1);
    const poses = frames(90).slice(30);
    expect(poses.every((p) => p.animation === 'run')).toBe(true);
    for (const p of poses) {
      expect(p.legL).toBeCloseTo(-p.legR, 1);
      expect(Math.sign(p.armR) === Math.sign(p.legL) || Math.abs(p.legL) < 0.05).toBe(true);
    }
    const swing = Math.max(...poses.map((p) => p.legL));
    expect(swing).toBeGreaterThan(A.legSwing * 0.7);
    expect(swing).toBeLessThanOrEqual(A.legSwing + 1e-9);
    expect(Math.min(...poses.map((p) => p.lean))).toBeGreaterThan(A.runLean * 0.7);
  });

  it('jumps: crouches first, springs into a stretch, raises its arms, then falls with them out and squashes on landing', () => {
    const { sim, frame, frames } = rig();
    sim.jumpPress();
    const first = frame();
    expect(first.animation).toBe('jump');
    expect(first.squash, 'the crouch').toBeLessThan(1 - A.crouch * 0.5);
    const rising = frames(12);
    expect(Math.max(...rising.map((p) => p.squash)), 'the stretch after it').toBeGreaterThan(1.03);
    expect(rising.at(-1)!.armL).toBeGreaterThan(A.jumpArms * 0.8);
    expect(rising.at(-1)!.legL).toBeGreaterThan(0.5);

    const rest: ReturnType<typeof frame>[] = [];
    while (!sim.grounded && rest.length < 300) rest.push(frame());
    const falling = rest.filter((p) => p.animation === 'fall');
    expect(falling.length).toBeGreaterThan(5);
    expect(falling.at(-1)!.armOut).toBeGreaterThan(A.fallArmsOut * 0.8);

    const landing = frames(3);
    expect(landing[0].animation).toBe('land');
    expect(Math.min(...landing.map((p) => p.squash)), 'the squash').toBeLessThan(1 - A.landSquash * 0.25);
    const after = frames(60);
    expect(after.at(-1)!.animation).toBe('idle');
    expect(after.at(-1)!.squash).toBeCloseTo(1, 1);
  });

  it('squashes more on a hard landing than a soft one', () => {
    const deepest = (vy: number) => {
      const anim = new AgentAnimator();
      const s: AgentSnapshot = { grounded: true, vx: 0, vy: 0, vz: 0, jumps: 0, landings: 0, teleports: 0 };
      anim.update(s, FRAME);
      anim.update({ ...s, grounded: false, vy }, FRAME);
      let low = 1;
      for (let i = 0; i < 30; i++) low = Math.min(low, anim.update({ ...s, landings: 1 }, FRAME).squash);
      return low;
    };
    expect(deepest(-20)).toBeLessThan(deepest(-4));
  });

  it('under reduced motion: no bob, no squash or stretch, no antenna sway; the legs still run and the arms still rise', () => {
    const { sim, frames, frame } = rig(true);
    sim.setMove(0, -1);
    const running = frames(60);
    for (const p of running) {
      expect(p.squash).toBe(1);
      expect(p.bodyLift).toBe(0);
      expect(p.antennaPitch).toBe(0);
      expect(p.antennaRoll).toBe(0);
    }
    expect(Math.max(...running.map((p) => Math.abs(p.legL)))).toBeGreaterThan(A.legSwing * 0.7);
    sim.jumpPress();
    const jump = [frame(), ...frames(12)];
    expect(jump.every((p) => p.squash === 1)).toBe(true);
    expect(jump.at(-1)!.armL).toBeGreaterThan(A.jumpArms * 0.8);
  });

  it('a respawn puts it back at rest', () => {
    const { sim, anim, frames } = rig();
    sim.setMove(0, -1);
    frames(30);
    sim.restart();
    sim.setMove(0, 0);
    const p = anim.update(
      { grounded: false, vx: 0, vy: 0, vz: 0, jumps: 0, landings: 0, teleports: sim.teleports },
      FRAME,
    );
    expect(p.legL).toBeCloseTo(0, 1);
    expect(p.lean).toBeCloseTo(0, 1);
  });

  it('a long stall does not fling the springs', () => {
    const { sim, anim, frame } = rig();
    sim.jumpPress();
    frame();
    const s = { grounded: sim.grounded, vx: 0, vy: sim.vel.y, vz: 0, jumps: sim.jumps, landings: sim.landings };
    const p = anim.update({ ...s, teleports: sim.teleports }, 5);
    expect(Number.isFinite(p.squash)).toBe(true);
    expect(p.squash).toBeGreaterThan(0.6);
    expect(p.squash).toBeLessThan(1.4);
  });
});
