import { describe, expect, it } from 'vitest';
import type { Object3D } from 'three';
import { RUNNER_CONFIG } from './config';
import { createRover, type Rover } from './rover';
import { RunnerSim, type Intent } from './sim';

// The rover's animation, on the stand-in model (Node cannot fetch rover.glb, which is also what the fallback is for).
// Everything is driven from a real sim and the frame's dt.

const cfg = { ...RUNNER_CONFIG, spawn: { ...RUNNER_CONFIG.spawn, firstRowAt: 10_000 } };

function drive(
  rover: Rover,
  hz: number,
  seconds: number,
  inputs: [number, Intent][] = [],
  watch?: (sim: RunnerSim) => void,
) {
  const sim = new RunnerSim({ seed: 1, config: cfg });
  sim.start();
  const queue = [...inputs];
  const dt = 1 / hz;
  let acc = 0;
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    while (queue.length && i / hz >= queue[0][0]) sim.input(queue.shift()![1]);
    acc += dt;
    while (acc >= cfg.step - 1e-12) {
      sim.step();
      acc -= cfg.step;
    }
    rover.update(sim, acc / cfg.step, dt, false);
    watch?.(sim);
  }
  return sim;
}

const node = (rover: Rover, name: string) => rover.object.getObjectByName(name) as Object3D;
const holder = (rover: Rover) => rover.object.children[0];

describe('rover', () => {
  it('a missing model leaves the stand-in, with every node the animation uses, and throws nothing', async () => {
    const rover = createRover(cfg, { url: 'missing-rover.glb' });
    await expect(rover.loaded).resolves.toBe(false);
    for (const name of [
      'rover_body',
      'antenna',
      'beacon',
      'wheel_FL',
      'wheel_ML',
      'wheel_RL',
      'wheel_FR',
      'wheel_MR',
      'wheel_RR',
    ]) {
      expect(node(rover, name), name).toBeTruthy();
    }
    expect(() => rover.dispose()).not.toThrow();
  });

  it('wheels turn with the distance driven, the same at 60 and 144 Hz', () => {
    const spins: number[] = [];
    for (const hz of [60, 144]) {
      const rover = createRover(cfg, { url: 'missing-rover.glb' });
      const sim = drive(rover, hz, 2);
      const wheel = node(rover, 'wheel_MR');
      const scale = holder(rover).scale.x;
      // Rolling without slipping: angle = distance / radius (negative: the top of the wheel moves forward, to -z). The view
      // draws the interpolated distance, at most one sim step behind the sim's own.
      const radius = 0.33 * scale;
      expect(Math.abs(wheel.rotation.x + sim.distance / radius)).toBeLessThanOrEqual(
        (sim.speed * cfg.step) / radius + 1e-9,
      );
      spins.push(wheel.rotation.x);
      rover.dispose();
    }
    expect(Math.abs(spins[0] - spins[1]) / Math.abs(spins[0])).toBeLessThan(0.01);
  });

  it('a held crouch lowers the body and folds the antenna; a lane change yaws the rover', () => {
    const rover = createRover(cfg, { url: 'missing-rover.glb' });
    let lowest = 0;
    let fold = 0;
    let yaw = 0;
    drive(
      rover,
      120,
      1.2,
      [
        [0.1, 'crouch'],
        [0.8, 'right'],
      ],
      (sim) => {
        if (sim.sliding) {
          lowest = Math.min(lowest, node(rover, 'rover_body').position.y);
          fold = Math.max(fold, node(rover, 'antenna').rotation.x);
        }
        yaw = Math.min(yaw, holder(rover).rotation.y);
      },
    );
    expect(lowest).toBeLessThan(-0.05); // model metres
    expect(fold).toBeGreaterThan(1);
    expect(yaw).toBeLessThan(-0.05); // nose towards +x: about 7 degrees at most
    expect(yaw).toBeGreaterThan(-8 * (Math.PI / 180));
    rover.dispose();
  });

  it('the antenna stays folded and the body low for as long as the crouch is held (5 s), and rises after the release', () => {
    const rover = createRover(cfg, { url: 'missing-rover.glb' });
    const folds: number[] = [];
    const drops: number[] = [];
    let t = 0;
    const sim = drive(
      rover,
      60,
      7,
      [
        [0.5, 'crouch'],
        [5.5, 'crouchEnd'],
      ],
      () => {
        t += 1 / 60;
        if (t > 0.9 && t < 5.5) {
          folds.push(node(rover, 'antenna').rotation.x);
          drops.push(node(rover, 'rover_body').position.y);
        }
      },
    );
    expect(folds.length).toBeGreaterThan(250);
    expect(Math.min(...folds)).toBeGreaterThan(1.2); // folded back (78 degrees is 1.36 rad) the whole time
    expect(Math.max(...drops)).toBeLessThan(-0.03); // the body stays down
    expect(sim.crouching).toBe(false);
    expect(node(rover, 'antenna').rotation.x).toBeLessThan(0.1); // stood up again, 1.5 s after the release
    rover.dispose();
  });

  it('reduced motion: no pitch or roll in a jump or a lane change; the wheels still turn', () => {
    for (const reduced of [false, true]) {
      const rover = createRover(cfg, { url: 'missing-rover.glb', reducedMotion: () => reduced });
      let pitch = 0;
      let roll = 0;
      drive(
        rover,
        120,
        1.2,
        [
          [0.1, 'jump'],
          [0.15, 'right'],
        ],
        () => {
          pitch = Math.max(pitch, Math.abs(holder(rover).rotation.x), Math.abs(node(rover, 'rover_body').rotation.x));
          roll = Math.max(roll, Math.abs(node(rover, 'rover_body').rotation.z));
        },
      );
      if (reduced) {
        expect(pitch).toBe(0);
        expect(roll).toBe(0);
      } else {
        expect(pitch).toBeGreaterThan(0.02);
        expect(roll).toBeGreaterThan(0.01);
      }
      expect(node(rover, 'wheel_FL').rotation.x).toBeLessThan(-1);
      rover.dispose();
    }
  });
});
