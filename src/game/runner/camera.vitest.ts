import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import {
  CAMERA_BACK,
  CAMERA_HEIGHT,
  ChaseRig,
  FOV_MAX,
  FOV_MIN,
  HIT_STOP,
  LATERAL_FOLLOW,
  LOOK_AHEAD,
  LOOK_HEIGHT,
  SHAKE_DURATION,
  damp,
  fovForSpeed,
  smoothDamp,
} from './camera';
import { RUNNER_CONFIG } from './config';
import { RunnerSim } from './sim';

/** Run a critically damped spring from 0 to 1 for `time` seconds at `hz` frames per second; sample at `at`. */
function springPath(hz: number, time: number, at: number[]): number[] {
  const dt = 1 / hz;
  let value = 0;
  let velocity = 0;
  const out: number[] = [];
  let next = 0;
  for (let t = 0; t <= time + 1e-9; t += dt) {
    while (next < at.length && t >= at[next] - 1e-9) out[next++] = value;
    ({ value, velocity } = smoothDamp(value, 1, velocity, 0.3, dt));
  }
  return out;
}

describe('smoothDamp and damp', () => {
  it('reaches the target without overshoot', () => {
    let value = 0;
    let velocity = 0;
    let max = 0;
    for (let i = 0; i < 600; i++) {
      ({ value, velocity } = smoothDamp(value, 1, velocity, 0.3, 1 / 120));
      max = Math.max(max, value);
    }
    expect(max).toBeLessThanOrEqual(1 + 1e-9);
    expect(value).toBeCloseTo(1, 4);
  });

  it('follows the same path at 30, 60, 144 and 240 Hz', () => {
    const at = [0.1, 0.2, 0.4, 0.8];
    const reference = springPath(240, 1, at);
    for (const hz of [30, 60, 144]) {
      springPath(hz, 1, at).forEach((v, i) => expect(Math.abs(v - reference[i])).toBeLessThan(0.02));
    }
  });

  it('damp: two half frames equal one whole frame (exact frame-rate independence)', () => {
    const whole = damp(0, 10, 3, 0.1);
    const halves = damp(damp(0, 10, 3, 0.05), 10, 3, 0.05);
    expect(halves).toBeCloseTo(whole, 12);
  });
});

describe('fovForSpeed', () => {
  const { start, max } = RUNNER_CONFIG.speed;
  it('maps the start speed to FOV_MIN and the cap to FOV_MAX, clamped outside', () => {
    expect(fovForSpeed(start)).toBe(FOV_MIN);
    expect(fovForSpeed(max)).toBe(FOV_MAX);
    expect(fovForSpeed(0)).toBe(FOV_MIN);
    expect(fovForSpeed(max * 2)).toBe(FOV_MAX);
    expect(fovForSpeed((start + max) / 2)).toBeCloseTo((FOV_MIN + FOV_MAX) / 2, 9);
  });
  it('only ever rises with speed', () => {
    let last = -Infinity;
    for (let s = start; s <= max; s += 0.25) {
      const f = fovForSpeed(s);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });
});

/** Drive a real sim at `hz` with the rig following it; `act` may queue inputs at a given time. */
function play(
  hz: number,
  seconds: number,
  act: (sim: RunnerSim, t: number) => void,
  each: (rig: ChaseRig, sim: RunnerSim, t: number) => void,
) {
  // A course with no obstacles: the first row is far beyond the test's reach.
  const cfg = { ...RUNNER_CONFIG, spawn: { ...RUNNER_CONFIG.spawn, firstRowAt: 10_000 } };
  const sim = new RunnerSim({ seed: 1, config: cfg });
  const rig = new ChaseRig(cfg);
  sim.start();
  const dt = 1 / hz;
  let acc = 0;
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    const t = i / hz;
    act(sim, t);
    acc += dt;
    while (acc >= cfg.step) {
      sim.step();
      acc -= cfg.step;
    }
    rig.update(dt, { x: sim.x, speed: sim.speed, phase: sim.phase, run: sim.run, reducedMotion: false });
    each(rig, sim, (i + 1) / hz); // the time at the end of this frame
  }
  return { sim, rig };
}

describe('ChaseRig', () => {
  it('stays at a constant height and looks at a fixed point through a jump, a slide and lane changes', () => {
    const actions: [number, 'jump' | 'right' | 'slide' | 'left'][] = [
      [0.2, 'jump'],
      [0.3, 'right'],
      [1.2, 'slide'],
      [1.3, 'right'],
      [2.0, 'jump'],
      [2.1, 'left'],
      [2.15, 'left'],
    ];
    let maxY = 0;
    let lastX = 0;
    let maxStep = 0;
    let sawAir = false;
    play(
      60,
      3.5,
      (sim, t) => {
        while (actions.length && t >= actions[0][0]) sim.input(actions.shift()![1]);
      },
      (rig, sim) => {
        sawAir ||= sim.y > 0.5;
        expect(rig.position.y).toBe(CAMERA_HEIGHT);
        expect(rig.position.z).toBe(CAMERA_BACK);
        expect(rig.target).toEqual({ x: 0, y: LOOK_HEIGHT, z: -LOOK_AHEAD });
        // Sideways: never more than the follow share of the rover's offset beyond where it has been, and smooth.
        expect(Math.abs(rig.position.x)).toBeLessThanOrEqual(LATERAL_FOLLOW * RUNNER_CONFIG.track.laneWidth + 1e-9);
        maxStep = Math.max(maxStep, Math.abs(rig.position.x - lastX));
        lastX = rig.position.x;
        maxY = Math.max(maxY, rig.position.y);
      },
    );
    expect(sawAir).toBe(true);
    expect(maxY).toBe(CAMERA_HEIGHT);
    // A lane is 2.2 m and takes the rover 0.14 s; the camera's biggest step in one 60 Hz frame is a few centimetres.
    expect(maxStep).toBeLessThan(0.06);
  });

  it('settles at the follow share of the lane offset, with no overshoot', () => {
    let max = 0;
    const { rig, sim } = play(
      120,
      2.5,
      (s, t) => {
        if (t === 0) s.input('right');
      },
      (r) => (max = Math.max(max, r.position.x)),
    );
    const target = LATERAL_FOLLOW * sim.x;
    expect(rig.position.x).toBeCloseTo(target, 3);
    expect(max).toBeLessThanOrEqual(target + 1e-6);
  });

  it('follows a lane change the same way at 30 and 240 Hz', () => {
    const at = (hz: number, sample: number) => {
      let value = 0;
      play(
        hz,
        sample,
        (s, t) => {
          if (t === 0) s.input('right');
        },
        (r, _s, end) => {
          if (Math.abs(end - sample) < 1e-9) value = r.position.x;
        },
      );
      return value;
    };
    // Sampled at frame ends both rates share. The spring itself agrees to 2% (above); the rest is the rover's position
    // being read every 33 ms instead of every 4 ms during its 0.14 s lane change. 5 cm of an 88 cm follow.
    for (const sample of [0.2, 0.4, 0.8]) expect(Math.abs(at(30, sample) - at(240, sample))).toBeLessThan(0.05);
  });

  it('a crash: holds for the hit-stop, fires impact once, shakes briefly, and not at all with reduced motion', () => {
    for (const reducedMotion of [false, true]) {
      const rig = new ChaseRig();
      const input = { x: 0, speed: 20, phase: 'playing' as const, run: 1, reducedMotion };
      rig.update(1 / 60, input);
      const over = { ...input, phase: 'over' as const };
      let impacts = 0;
      let frozenTime = 0;
      let maxOffset = 0;
      const dt = 1 / 240;
      for (let t = 0; t < 0.6; t += dt) {
        rig.update(dt, over);
        if (rig.frozen) frozenTime += dt;
        if (rig.impact) impacts++;
        maxOffset = Math.max(maxOffset, Math.abs(rig.position.y - CAMERA_HEIGHT), Math.abs(rig.position.x));
        if (t > HIT_STOP + SHAKE_DURATION + 0.01) {
          expect(rig.position.y).toBe(CAMERA_HEIGHT);
        }
      }
      expect(impacts).toBe(1);
      expect(frozenTime).toBeGreaterThan(HIT_STOP - 2 * dt);
      expect(frozenTime).toBeLessThan(HIT_STOP + 2 * dt);
      if (reducedMotion) expect(maxOffset).toBe(0);
      else {
        expect(maxOffset).toBeGreaterThan(0);
        expect(maxOffset).toBeLessThan(0.1);
      }
    }
  });

  it('a restart clears the crash; apply() sets a level camera and the field of view', () => {
    const rig = new ChaseRig();
    rig.update(0.016, { x: 0, speed: 28, phase: 'playing', run: 1, reducedMotion: false });
    rig.update(0.016, { x: 0, speed: 28, phase: 'over', run: 1, reducedMotion: false });
    expect(rig.frozen).toBe(true);
    rig.update(0.016, { x: 0, speed: 12, phase: 'playing', run: 2, reducedMotion: false });
    expect(rig.frozen).toBe(false);
    const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 100);
    rig.apply(camera);
    expect(camera.fov).toBeGreaterThanOrEqual(FOV_MIN);
    expect(camera.fov).toBeLessThanOrEqual(FOV_MAX);
    expect(camera.rotation.z).toBeCloseTo(0, 9); // no roll
  });
});
