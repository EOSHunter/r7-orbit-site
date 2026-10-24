// The atmosphere's motion, as pure maths (docs/RUNNER.md, "Atmosphere"): the tunnel's travelling glow, the stars' twinkle,
// the rare shooting star and the planet's spin. No three.js and no DOM, so the unit tests cover it in Node; environment.ts
// turns these numbers into the scene.
//
// Everything here runs on the world's clock (WorldMotion.time): seconds of the sim's fixed steps, so it is frame-rate
// independent, stops when the game loop stops (a hidden tab, a pause), and stands still under prefers-reduced-motion. None of
// it reads or changes the sim: the shooting stars draw from their own random generator, never the course's.

import type { Random } from './random';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export const SKY_MOTION = {
  glow: {
    /** One wave of light down the tunnel, seconds: a crest leaves the vanishing point this often. */
    period: 4,
    /** Distance between two crests along the tunnel, metres (eight rings). */
    wavelength: 72,
    /** The glow's brightness, 0 to 1 of brass: always `base`, up to base + wave on a crest. */
    base: 0.13,
    wave: 0.29,
    /** The crest's sharpness (a raised cosine to this power): higher is a shorter, softer glint. */
    sharpness: 3,
    /** Rings nearer than near[0] metres glow at `nearGain` of the far rings; full from near[1] on. */
    near: [8, 70] as [number, number],
    nearGain: 0.45,
    /** How much of the wave also brightens the hairline ring itself (the glow carries the rest). */
    core: 0.1,
  },
  stars: {
    /** A star's brightness swings by up to this share either way. */
    amplitude: [0.12, 0.38] as [number, number],
    /** One twinkle, seconds. */
    period: [0.5, 2.5] as [number, number],
    /**
     * Every twinkle period divides this one, so the shader's clock can wrap at it with no jump (a float clock that ran for
     * hours would lose the precision a fast twinkle needs).
     */
    loop: 60,
    /** A few brighter stars on top of the field, a little larger and softer. */
    bright: 9,
  },
  comets: {
    /** Seconds from one shooting star to the next (start to start), drawn at random. */
    interval: [15, 40] as [number, number],
    /** Seconds to cross. */
    duration: [0.9, 1.6] as [number, number],
    /** Angle below the horizontal, degrees: shallow. */
    angle: [8, 24] as [number, number],
    /** Horizontal travel, in shares of the half-width of the view. */
    travel: [0.24, 0.5] as [number, number],
    /** The tail's length, in shares of the half-height of the view (and never more than 70% of the path). */
    tail: [0.2, 0.34] as [number, number],
    /** Never nearer the middle than this share of the half-width: the middle third holds the lanes and the obstacles. */
    clearX: 1 / 3,
    /** Never lower than this much above the horizon, in shares of the half-height. */
    aboveHorizon: 0.16,
    /** Never higher than this (device coordinates) on the left, and on the right, where the score and the best sit. */
    top: [0.82, 0.6] as [number, number],
    /** Room kept round the planet, in planet radii. */
    planetClearance: 1.3,
  },
  planet: {
    /** Seconds for one turn of the planet itself ... */
    bodyTurn: 300,
    /** ... and of its rings, a little slower: the two drift apart. */
    ringTurn: 540,
  },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const wrapTo = (v: number, length: number) => {
  const m = v % length;
  return m < 0 ? m + length : m + 0;
};

// ------------------------------------------------------------------------------------------------ the tunnel's glow

/** The travelling wave alone, 0 to 1: a crest every `period` seconds, moving towards the camera (smaller `ahead`) in time. */
export function glowWave(ahead: number, time: number, g = SKY_MOTION.glow): number {
  const phase = TAU * (ahead / g.wavelength + time / g.period);
  return (0.5 + 0.5 * Math.cos(phase)) ** g.sharpness;
}

/** The wave's average over a period: a raised cosine to the power n averages C(2n, n) / 4^n (5/16 for n = 3). */
export function glowWaveMean(g = SKY_MOTION.glow): number {
  let c = 1;
  for (let k = 1; k <= g.sharpness; k++) c = (c * (g.sharpness + k)) / k;
  return c / 4 ** g.sharpness;
}

/**
 * A ring's glow `ahead` metres in front of the rover, 0 to base + wave (0.5): dimmer close to the camera, brighter towards the
 * vanishing point, with the wave running down the tunnel. Under reduced motion it is still, at the wave's average.
 */
export function ringGlow(ahead: number, time: number, reduced: boolean, g = SKY_MOTION.glow): number {
  const wave = reduced ? glowWaveMean(g) : glowWave(ahead, time, g);
  const depth = lerp(g.nearGain, 1, smoothstep(g.near[0], g.near[1], ahead));
  return depth * (g.base + g.wave * wave);
}

// ------------------------------------------------------------------------------------------------ the stars

export interface Twinkle {
  /** Starting phase, radians. */
  phase: number;
  /** Radians per second: 2π / period, with a period that divides SKY_MOTION.stars.loop. */
  rate: number;
  /** Share of the brightness it swings by, either way. */
  amplitude: number;
}

/** One star's twinkle: a phase, a rate (one cycle in 0.5 to 2.5 s) and a small amplitude. */
export function twinkleFor(rand: Random, s = SKY_MOTION.stars): Twinkle {
  // A whole number of cycles per loop, so the wrapped clock never jumps: loop / period[1] to loop / period[0] cycles.
  const minCycles = Math.ceil(s.loop / s.period[1]);
  const maxCycles = Math.floor(s.loop / s.period[0]);
  const cycles = minCycles + Math.floor(rand() * (maxCycles - minCycles + 1));
  return {
    phase: rand() * TAU,
    rate: (TAU * cycles) / s.loop,
    amplitude: lerp(s.amplitude[0], s.amplitude[1], rand()),
  };
}

/** A star's brightness factor at `time` (what the star shader computes): 1 on average, 1 ± amplitude at most. */
export function twinkleAt(t: Twinkle, time: number, s = SKY_MOTION.stars): number {
  return 1 + t.amplitude * Math.sin(t.phase + t.rate * wrapTo(time, s.loop));
}

// ------------------------------------------------------------------------------------------------ the planet

/** The planet's and its rings' turn after `time` seconds, radians in [0, 2π). Its tilt is not touched. */
export function planetAngles(time: number, p = SKY_MOTION.planet): { body: number; rings: number } {
  return { body: wrapTo((TAU * time) / p.bodyTurn, TAU), rings: wrapTo((TAU * time) / p.ringTurn, TAU) };
}

// ------------------------------------------------------------------------------------------------ shooting stars

/**
 * When the shooting stars fly. step() is called with the world's clock; it counts only while comets are `allowed` (not under
 * reduced motion, not after a crash, never while the loop is stopped since it is not called then). One at a time: the next
 * start is 15 to 40 s after the last start, much longer than one crossing.
 */
export class CometClock {
  /** Seconds until the next comet may start (counted only while allowed). */
  wait: number;
  /** Seconds the comet in flight has flown, or -1 when none is; and at the start of the last step (for interpolation). */
  age = -1;
  prevAge = -1;
  /** Seconds the comet in flight takes to cross. */
  duration = 0;
  /** Comets started so far. */
  count = 0;

  constructor(
    private readonly rand: Random,
    first?: number,
    private readonly c = SKY_MOTION.comets,
  ) {
    this.wait = first !== undefined && first > 0 ? first : this.interval();
  }

  get flying(): boolean {
    return this.age >= 0;
  }

  /** Advance by `dt` seconds. Returns true when a comet starts in this step (the caller then picks its path). */
  step(dt: number, allowed: boolean): boolean {
    this.prevAge = this.age;
    if (!allowed) {
      this.age = this.prevAge = -1; // a comet in flight is gone at once (a crash dims the scene; reduced motion stops it)
      return false;
    }
    if (this.age >= 0) {
      this.age += dt;
      if (this.age >= this.duration) this.age = this.prevAge = -1;
    }
    this.wait -= dt;
    if (this.wait > 0 || this.age >= 0) return false;
    this.wait += this.interval();
    this.duration = lerp(this.c.duration[0], this.c.duration[1], this.rand());
    this.age = 0;
    this.prevAge = 0;
    this.count++;
    return true;
  }

  /** How far through its crossing the comet is, 0 to 1, `alpha` of the way through the last step; -1 when none flies. */
  progress(alpha: number): number {
    if (this.age < 0) return -1;
    return clamp01(lerp(Math.max(0, this.prevAge), this.age, alpha) / this.duration);
  }

  /** Stop the comet in flight (no path fitted the view). */
  cancel(): void {
    this.age = this.prevAge = -1;
  }

  private interval(): number {
    return lerp(this.c.interval[0], this.c.interval[1], this.rand());
  }
}

/**
 * What a comet must avoid, in normalised device coordinates (x and y in -1 to 1): the horizon's height, and the planet's
 * centre and radius (radius in units of the half-height). `aspect` is width / height.
 */
export interface SkyFrame {
  aspect: number;
  horizon: number;
  planet: { x: number; y: number; r: number };
}

/** A comet's crossing: its head runs from (x0, y0) to (x1, y1), in device coordinates; its tail's length, in half-heights. */
export interface CometPath {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  tail: number;
}

/** Whether a point (device coordinates) is in the sky a comet may cross. */
export function inCometSky(x: number, y: number, f: SkyFrame, c = SKY_MOTION.comets): boolean {
  if (Math.abs(x) < c.clearX || Math.abs(x) > 0.97 || y > c.top[x < 0 ? 0 : 1]) return false;
  if (y < f.horizon + c.aboveHorizon) return false;
  const dx = (x - f.planet.x) * f.aspect; // in half-heights, so the circle is round on screen
  const dy = y - f.planet.y;
  return Math.hypot(dx, dy) >= f.planet.r * c.planetClearance;
}

/**
 * A comet's path through the upper sky: it starts high on one side and runs down at a shallow angle towards the middle,
 * stopping short of the middle third, above the horizon, clear of the planet. Tries a few random paths; null when none fits
 * (a very small or oddly framed view), and the caller skips that comet.
 */
export function cometPath(rand: Random, f: SkyFrame, c = SKY_MOTION.comets): CometPath | null {
  for (let attempt = 0; attempt < 12; attempt++) {
    const side = rand() < 0.5 ? -1 : 1;
    const x0 = side * lerp(0.6, 0.95, rand());
    const y0 = lerp(f.horizon + c.aboveHorizon + 0.08, c.top[side < 0 ? 0 : 1], rand());
    const angle = lerp(c.angle[0], c.angle[1], rand()) * DEG;
    const x1 = x0 - side * lerp(c.travel[0], c.travel[1], rand());
    const length = Math.abs(x1 - x0) * f.aspect; // in half-heights
    const y1 = y0 - Math.tan(angle) * length;
    const tail = Math.min(lerp(c.tail[0], c.tail[1], rand()), (0.7 * length) / Math.cos(angle));
    let ok = true;
    for (let i = 0; i <= 12 && ok; i++) ok = inCometSky(lerp(x0, x1, i / 12), lerp(y0, y1, i / 12), f, c);
    if (ok) return { x0, y0, x1, y1, tail };
  }
  return null;
}

/** A comet's brightness through its crossing (u from 0 to 1): flares up fast, fades out slowly, 0 at both ends. */
export function cometEnvelope(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  return smoothstep(0, 0.12, u) * (1 - smoothstep(0.5, 1, u));
}
