// The world's motion and layout, as pure maths (docs/RUNNER.md, "The world"). No three.js and no DOM, so the unit tests
// cover it in Node; environment.ts turns these numbers into the scene.
//
// The world (the rings, the track markers and the rocks) scrolls by its own offset, apart from the sim's distance: it cruises
// before a run (the idle scene), eases up into the sim's speed when a run starts, and slows to a stop after a crash. Once the
// ease is over it moves at exactly the sim's speed. It advances in the sim's fixed steps (environment.ts counts sim.steps), so
// it is frame-rate independent, interpolates like the sim, and stops whenever the game loop stops (a hidden tab, a pause).

import type { Phase } from './sim';

export const WORLD = {
  /** The idle scene's calm cruise, metres per second. */
  cruiseSpeed: 6,
  /** Seconds to ease from the cruise (or a stop) into the sim's speed when a run starts, and back to the cruise. */
  startEase: 0.8,
  /** Seconds to slow to a stop after a crash. */
  stopEase: 0.6,
  /** How much the rings and glows dim after a crash (0 = not at all, 1 = out). */
  overDim: 0.45,
  /** One breath of the idle scene's brass pulse, seconds: --dur-orbit / 3, as the prompt's hairlines in runner.css. */
  pulsePeriod: 14 / 3,
  /**
   * The fog closes in to this (near, far) in the idle scene and after a crash, and opens to the config's fog in a run. The first
   * row of a course is 70 m ahead, so a closed fog keeps the idle scene free of obstacles, and a new course's rows come out of
   * the fog as it opens instead of appearing.
   */
  closedFog: { near: 14, far: 64 },
  /** A view that falls behind by more steps than this catches up only this far (the sim's own cap is 8 a frame). */
  maxCatchUpSteps: 16,

  rings: {
    /** A ring is recycled to the far end once it passes this z (just behind the camera). */
    zNear: 9,
    /** Fully faded at fadeNear[0] metres ahead of the rover, full at fadeNear[1]; full until fadeFar[0], gone at fadeFar[1]. */
    fadeNear: [-7, 6] as [number, number],
    fadeFar: [55, 150] as [number, number],
  },

  rocks: {
    count: 28,
    /** The loop the rocks scroll round, metres: from zNear back to zNear - loop. */
    loop: 190,
    zNear: 12,
    /** Distance from the track's centre line: never nearer than this, so the lanes and the centre stay empty. */
    minX: 9.5,
    maxX: 46,
  },

  planet: {
    /** Angular diameter as a share of the view's height, in a landscape view. */
    heightShare: 0.34,
    /** In a narrow (portrait) view, at most this share of the view's width. */
    widthShare: 0.44,
    /** Centre's azimuth as a share of the half-width of the view (negative: left of the vanishing point). */
    azimuthShare: -0.55,
    /** Centre's elevation above the horizon in planet radii: 0.3 hides about a third of the disc below the horizon. */
    elevation: 0.3,
  },
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ease in and out (cubic): starts and ends at rest, so a change of speed has no jolt. */
export function easeInOut(t: number): number {
  const u = clamp01(t);
  return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
}

/** `value` modulo `length`, always in [0, length). */
export function wrap(value: number, length: number): number {
  const m = value % length;
  return m < 0 ? m + length : m + 0; // + 0: never -0
}

/**
 * The z of slot `i` of `count` evenly spaced things scrolling towards the camera by `offset` metres. Every slot is in
 * (zNear - count·spacing, zNear]; when one passes zNear it reappears at the far end, so the spacing never changes.
 */
export function slotZ(i: number, spacing: number, count: number, offset: number, zNear: number): number {
  return zNear - wrap(i * spacing - offset, count * spacing);
}

/** 0 to 1 and back to 0 along the distance ahead of the rover (-z): faded in from far away and out near the camera. */
export function distanceFade(ahead: number, near: [number, number], far: [number, number]): number {
  const fadeIn = clamp01((ahead - near[0]) / (near[1] - near[0]));
  const fadeOut = 1 - clamp01((ahead - far[0]) / (far[1] - far[0]));
  return fadeIn * fadeOut;
}

/**
 * The world's scroll, speed and mood. step() runs once per sim step with the sim's phase and speed; `reduced` is
 * prefers-reduced-motion: the idle scene is then a still frame and every change is immediate, but a run still moves.
 */
export class WorldMotion {
  /** Metres scrolled since mount, at the end of the last step, and at its start (for interpolation). */
  offset = 0;
  prevOffset = 0;
  /** The scroll speed now, m/s. */
  speed: number;
  /** 0 = full brightness, up to WORLD.overDim after a crash. */
  dim = 0;
  /** 1 in the idle scene, 0 in a run (eased between): how much of the idle pulse shows. */
  idle = 1;
  /** 1 while the fog is closed (idle scene, game over), 0 while it is open (a run), eased between. */
  veil = 1;
  /** Seconds of motion: drives the pulse and the sky (sky.ts: the twinkle, the glow's wave, the comets, the planet's turn); it
   *  stands still under reduced motion. */
  time = 0;

  private phase: Phase = 'ready';
  private age = 0;
  private from = { speed: 0, dim: 0, idle: 1, veil: 1 };

  constructor(private readonly w = WORLD) {
    this.speed = w.cruiseSpeed;
    this.from.speed = this.speed;
  }

  step(dt: number, phase: Phase, simSpeed: number, reduced: boolean): void {
    if (phase !== this.phase) {
      this.phase = phase;
      this.age = 0;
      this.from = { speed: this.speed, dim: this.dim, idle: this.idle, veil: this.veil };
    }
    this.age += dt;
    const k = reduced ? 1 : easeInOut(this.age / (phase === 'over' ? this.w.stopEase : this.w.startEase));
    const target =
      phase === 'playing'
        ? { speed: simSpeed, dim: 0, idle: 0, veil: 0 }
        : phase === 'over'
          ? { speed: 0, dim: this.w.overDim, idle: 0, veil: 1 }
          : { speed: reduced ? 0 : this.w.cruiseSpeed, dim: 0, idle: 1, veil: 1 };
    this.speed = lerp(this.from.speed, target.speed, k);
    this.dim = lerp(this.from.dim, target.dim, k);
    this.idle = lerp(this.from.idle, target.idle, k);
    this.veil = lerp(this.from.veil, target.veil, k);
    this.prevOffset = this.offset;
    this.offset += this.speed * dt;
    if (!reduced) this.time += dt;
  }

  /** The offset `alpha` of the way through the last step (as the sim's own values are drawn). */
  offsetAt(alpha: number): number {
    return lerp(this.prevOffset, this.offset, alpha);
  }

  /** The idle pulse, 0 to 1: a slow breath while idle, 0 in a run and under reduced motion. */
  pulse(): number {
    return this.idle * (0.5 - 0.5 * Math.cos((2 * Math.PI * this.time) / this.w.pulsePeriod));
  }
}

/**
 * Where the planet sits, in radians: azimuth (negative = left of straight ahead), elevation of its centre above the horizon,
 * and its angular radius. It keeps about a third of the view's height in a landscape view and shrinks to fit a narrow one.
 */
export function planetPlacement(
  aspect: number,
  verticalFovDeg: number,
  p = WORLD.planet,
): { azimuth: number; elevation: number; radius: number } {
  const halfV = (verticalFovDeg * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * Math.max(0.1, aspect));
  const radius = Math.min(p.heightShare * halfV, p.widthShare * halfH);
  return { azimuth: p.azimuthShare * halfH, elevation: p.elevation * radius, radius };
}
