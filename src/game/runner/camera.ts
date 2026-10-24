// The chase camera (docs/RUNNER.md, "Camera"): fixed to the TRACK, not to the rover. It sits at a constant height and
// distance behind the start line, follows only part of the rover's sideways position through a critically damped spring,
// never follows a jump or a slide, never rolls, and always looks at the same point ahead on the track's centre line, so the
// horizon stays level and still. The field of view widens a little with speed. A crash freezes the picture for a moment
// (the hit-stop; the sim's time is not touched) and then gives a short, damped shake.
//
// Every number is a named constant here; every rate takes the frame's dt, so 30 Hz and 240 Hz look the same. Read-only over
// the game: the view passes in what it read from the sim.

import type { PerspectiveCamera } from 'three';
import { RUNNER_CONFIG, type RunnerConfig } from './config';
import type { Phase } from './sim';

/** Height of the camera above the track (m). Constant: jumps and slides never move it. */
export const CAMERA_HEIGHT = 3.1;
/** Distance of the camera behind the rover's line (m, +z). */
export const CAMERA_BACK = 6.4;
/** The look target: this far ahead of the rover on the track's centre line (m) ... */
export const LOOK_AHEAD = 14;
/** ... at this height (m). With the camera height, this fixes the horizon's place on screen. */
export const LOOK_HEIGHT = 0.9;
/** Share of the rover's sideways offset the camera follows (the rest is the rover moving on screen). */
export const LATERAL_FOLLOW = 0.4;
/** Smooth time of the sideways spring (s): critically damped, about this long to cover most of a lane change. */
export const LATERAL_SMOOTH_TIME = 0.32;
/** Field of view at the start speed and at the cap (degrees, vertical). */
export const FOV_MIN = 58;
export const FOV_MAX = 64;
/** How fast the field of view eases towards its target (1/s; exponential, so never a jump, even on a restart). */
export const FOV_RATE = 1.6;
/** The crash: the picture holds still this long (s) before the effects and the shake start. */
export const HIT_STOP = 0.09;
/** The shake after the hit-stop: how long (s), how far at most (m), and its two frequencies (Hz). */
export const SHAKE_DURATION = 0.15;
export const SHAKE_AMPLITUDE = 0.07;
export const SHAKE_FREQ_X = 31;
export const SHAKE_FREQ_Y = 23;
/** Longest frame the rig integrates at once (s): a stall or a resumed tab never throws it. */
export const MAX_DT = 0.1;

/**
 * A critically damped spring towards `target` (the well-known SmoothDamp form): no overshoot, continuous velocity, and
 * the same path at any frame rate to within a fraction of a percent. Returns the new value and velocity.
 */
export function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
): { value: number; velocity: number } {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return { value: target + (change + temp) * decay, velocity: (velocity - omega * temp) * decay };
}

/** Exponential approach: `rate` per second, exact at any frame rate (two half-frames equal one whole one). */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** The field of view for a speed: FOV_MIN at the start speed, FOV_MAX at the cap, smoothstep between, clamped. */
export function fovForSpeed(speed: number, cfg: RunnerConfig = RUNNER_CONFIG): number {
  const { start, max } = cfg.speed;
  const u = Math.min(1, Math.max(0, (speed - start) / Math.max(1e-6, max - start)));
  return FOV_MIN + (FOV_MAX - FOV_MIN) * u * u * (3 - 2 * u);
}

/** What the rig reads from the game each frame (interpolated where it matters). */
export interface RigInput {
  /** The rover's sideways position (m). Its height is deliberately not an input. */
  x: number;
  speed: number;
  phase: Phase;
  /** Runs started so far (a change means a restart). */
  run: number;
  /** Prefers-reduced-motion: no shake. */
  reducedMotion: boolean;
}

interface Vec {
  x: number;
  y: number;
  z: number;
}

export class ChaseRig {
  /** Where the camera is and what it looks at, after the last update. */
  readonly position: Vec = { x: 0, y: CAMERA_HEIGHT, z: CAMERA_BACK };
  readonly target: Vec = { x: 0, y: LOOK_HEIGHT, z: -LOOK_AHEAD };
  fov: number;
  /** True while the hit-stop holds the picture: the view should not advance its own animation. */
  frozen = false;
  /** True for the one update at which the hit-stop ends: start the crash effects now. */
  impact = false;

  private x = 0;
  private vx = 0;
  private crashAge = -1;
  private lastPhase: Phase | null = null;
  private lastRun = 0;

  constructor(private readonly cfg: RunnerConfig = RUNNER_CONFIG) {
    this.fov = fovForSpeed(cfg.speed.start, cfg);
  }

  /** Back to rest: centred, start-speed field of view, no crash. */
  reset(): void {
    this.x = 0;
    this.vx = 0;
    this.crashAge = -1;
    this.frozen = false;
    this.impact = false;
    this.fov = fovForSpeed(this.cfg.speed.start, this.cfg);
    this.position.x = 0;
    this.target.x = 0;
  }

  update(rawDt: number, input: RigInput): void {
    const dt = Math.min(MAX_DT, Math.max(0, rawDt));
    // A crash is the step from playing to over; anything else (a restart, mounting on a finished run) clears it.
    if (input.phase !== 'over') this.crashAge = -1;
    else if (this.lastPhase === 'playing' && input.run === this.lastRun) this.crashAge = 0;
    this.lastPhase = input.phase;
    this.lastRun = input.run;

    // The hit-stop: nothing moves (the sim has already stopped; this holds the view's own motion too).
    this.impact = false;
    if (this.crashAge >= 0) {
      const before = this.crashAge;
      this.crashAge += dt;
      this.frozen = this.crashAge < HIT_STOP;
      if (before < HIT_STOP && !this.frozen) this.impact = true;
      if (this.frozen) return;
    } else {
      this.frozen = false;
    }

    const s = smoothDamp(this.x, input.x * LATERAL_FOLLOW, this.vx, LATERAL_SMOOTH_TIME, dt);
    this.x = s.value;
    this.vx = s.velocity;
    this.fov = damp(this.fov, fovForSpeed(input.speed, this.cfg), FOV_RATE, dt);

    let sx = 0;
    let sy = 0;
    const shakeAge = this.crashAge - HIT_STOP;
    if (!input.reducedMotion && this.crashAge >= 0 && shakeAge < SHAKE_DURATION) {
      const fade = (1 - shakeAge / SHAKE_DURATION) ** 2;
      sx = SHAKE_AMPLITUDE * fade * Math.sin(shakeAge * 2 * Math.PI * SHAKE_FREQ_X);
      sy = SHAKE_AMPLITUDE * 0.6 * fade * Math.sin(shakeAge * 2 * Math.PI * SHAKE_FREQ_Y + 1.3);
    }
    this.position.x = this.x + sx;
    this.position.y = CAMERA_HEIGHT + sy;
    this.position.z = CAMERA_BACK;
    this.target.x = sx * 0.5;
    this.target.y = LOOK_HEIGHT + sy * 0.5;
    this.target.z = -LOOK_AHEAD;
  }

  /** Put the camera where the rig says. The up vector is world up and never changes: no roll. */
  apply(camera: PerspectiveCamera): void {
    camera.position.set(this.position.x, this.position.y, this.position.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.target.x, this.target.y, this.target.z);
    if (Math.abs(camera.fov - this.fov) > 1e-4) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
  }
}
