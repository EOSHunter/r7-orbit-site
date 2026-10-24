// Every tunable number of the runner in one place (docs/RUNNER.md, "Config knobs"). Distances are metres, times seconds,
// speeds metres per second: nothing here is per frame. The sim, the generator and the tests all read this object, so a change
// here is a change to the game and to what the fairness test proves.

export const RUNNER_CONFIG = {
  /** The fixed simulation step. The sim always advances by exactly this much, whatever the display's refresh rate. */
  step: 1 / 120,
  /** A frame longer than this (a stall, a debugger, a background tab) counts as this long: the game slows, it never jumps. */
  maxFrameDelta: 0.1,
  /** At most this many steps per frame; any time left over is dropped rather than carried (no catch-up spiral). */
  maxStepsPerFrame: 8,

  track: {
    /** Lanes are -1 (left), 0 (middle), 1 (right), this far apart centre to centre. */
    laneWidth: 2.2,
    /** Time for the rover to move one lane sideways (it moves at laneWidth / laneChangeTime). */
    laneChangeTime: 0.14,
  },

  speed: {
    /** Speed at the start of a run. */
    start: 12,
    /** The cap: the speed never goes above this. */
    max: 28,
    /** Seconds of play to reach the cap. The curve eases out (no jolt when it arrives). */
    rampTime: 100,
  },

  jump: {
    /** Height of the rover's underside at the top of a jump. */
    height: 1.3,
    /** Time from take-off to landing. Gravity and take-off speed are derived from these two. */
    duration: 0.62,
    /** Jump pressed in the air this close to landing still jumps on landing. */
    buffer: 0.12,
  },

  slide: {
    /** How long a slide keeps the rover low. Pressing slide again restarts it; jump cancels it. */
    duration: 0.65,
    /** Slide pressed in the air drops the rover at this speed, and it slides on landing. */
    slamSpeed: 18,
  },

  /** Collision boxes, in metres. They are a little smaller than the art so a near miss counts as a miss. */
  hitbox: {
    rover: { width: 1.0, length: 1.4, height: 1.1, slideHeight: 0.5 },
    /** A tall block across its lane: only a lane change gets past it. */
    slab: { width: 1.8, length: 0.8, bottom: 0, top: 2.6 },
    /** A low block: jump over it. */
    barrier: { width: 1.9, length: 0.5, bottom: 0, top: 0.7 },
    /** The beam of an overhead arch: slide under it. Its posts stand on the lane edges and are scenery, not obstacles. */
    gate: { width: 2.0, length: 0.5, bottom: 0.95, top: 2.6 },
    /** A pickup is collected when the rover's box comes within this radius of its centre. */
    pickupRadius: 0.45,
  },

  spawn: {
    /** Rows are generated until this far ahead of the rover (past the fog, so nothing pops in). */
    ahead: 160,
    /** Obstacles and pickups this far behind the rover are dropped. */
    behind: 12,
    /** Free running at the start of a run before the first row. */
    firstRowAt: 70,
  },

  generator: {
    /**
     * The fairness budget: a player is assumed to need this long, after the rover has cleared a row, before acting on the
     * next one. Every gap the generator makes leaves at least this, plus the time the moves themselves take.
     */
    reactionTime: 0.25,
    /** Extra time between rows on top of what fairness needs, drawn at random between min and max (seconds) ... */
    extraTimeMin: 0.45,
    extraTimeMax: 1.3,
    /** ... and scaled down by up to this share as the speed reaches the cap (rows get closer, never closer than fair). */
    extraTimeShrink: 0.45,
    /** Pattern weights at the start speed and at the cap (linear in between): one, two or three obstacles in a row. */
    weights: {
      single: [1, 0.4] as [number, number],
      double: [0.5, 0.8] as [number, number],
      wall: [0.12, 0.5] as [number, number],
    },
    /** Odds of each obstacle kind. A row is never three slabs. */
    kinds: { slab: 0.45, barrier: 0.3, gate: 0.25 },
    /** Chance that a row gets a line of pickups in one of its open lanes. */
    pickupChance: 0.6,
    pickupSpacing: 3,
    pickupMaxInLine: 8,
    /** Height of a pickup on the ground run, over a barrier (on the jump) and under a gate (on the slide). */
    pickupHeight: 0.6,
    pickupHeightOverBarrier: 1.7,
    pickupHeightUnderGate: 0.3,
  },

  score: {
    /** Each pickup adds this many metres to the score. */
    pickupBonus: 5,
    /** After a crash, a restart is ignored for this long, so a key still held does not restart by accident. */
    restartDelay: 0.35,
  },

  input: {
    /** A swipe counts once the finger has moved this many CSS pixels. Shorter moves are ignored (or are a tap). */
    swipeMinPx: 30,
    /** The longer axis must be at least this many times the shorter one, or the swipe is ambiguous and ignored. */
    swipeDominance: 1.25,
    /** A tap moves less than this and lasts less than tapMaxMs. */
    tapSlopPx: 12,
    tapMaxMs: 350,
  },

  render: {
    /** Pixel ratio cap: 2 with a mouse, 1.5 on touch screens (most phones are 3x and would cost too much). */
    maxPixelRatio: 2,
    maxPixelRatioTouch: 1.5,
    fov: 60,
    camera: { height: 3.2, back: 6.5, lookAhead: 10, lookHeight: 1, follow: 0.55 },
    fog: { near: 35, far: 150 },
    /** The tunnel: a thin brass ring every ringSpacing metres. */
    ringSpacing: 14,
    ringCount: 12,
    ringRadius: 7.5,
  },
};

/**
 * The scene's colours: copied from src/styles/design-system/tokens.css, because WebGL cannot read CSS variables. They are the
 * only raw colour values in the runner. If a token changes, change it here too.
 */
export const RUNNER_COLORS = {
  /** --bg: obsidian, the clear colour and the fog. */
  obsidian: 0x09090a,
  /** --surface-1: the track, one tone up from the background. */
  track: 0x0f0f11,
  /** --text: ivory, every solid (rover, slab, barrier, gate) and the lane hairlines. */
  ivory: 0xece6d8,
  /** --brass: the one accent (rings, pickups, the rover's beacon). */
  brass: 0xc9a96a,
  /** --brass-highlight: the beacon's point of light. */
  brassHighlight: 0xf1dca8,
  /** --surface-3: the 404 numerals cut into the slab, and the rover's wheels. */
  shade: 0x1b1b1f,
} as const;

export type RunnerConfig = typeof RUNNER_CONFIG;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** The config with some values replaced (for the tests, and for a host page that wants an easier or harder game). */
export function withConfig(overrides: DeepPartial<RunnerConfig>, base: RunnerConfig = RUNNER_CONFIG): RunnerConfig {
  const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
      if (v === undefined) continue;
      const cur = a[k];
      out[k] =
        v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object'
          ? merge(cur as Record<string, unknown>, v as Record<string, unknown>)
          : v;
    }
    return out;
  };
  return merge(
    base as unknown as Record<string, unknown>,
    overrides as Record<string, unknown>,
  ) as unknown as RunnerConfig;
}

/** Gravity and take-off speed from the jump's height and duration (a parabola: h = v0²/2g, T = 2·v0/g). */
export function jumpPhysics(cfg: RunnerConfig = RUNNER_CONFIG): { gravity: number; takeoff: number } {
  const { height, duration } = cfg.jump;
  return { gravity: (8 * height) / (duration * duration), takeoff: (4 * height) / duration };
}

/** Speed after `time` seconds of play: eases out from the start speed to the cap, then stays there. */
export function speedAt(time: number, cfg: RunnerConfig = RUNNER_CONFIG): number {
  const { start, max, rampTime } = cfg.speed;
  const u = Math.min(1, Math.max(0, time / rampTime));
  return start + (max - start) * (1 - (1 - u) * (1 - u));
}
