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
    start: 13,
    /** The cap: the speed never goes above this. */
    max: 40,
    /** Seconds of play to reach the cap. */
    rampTime: 180,
    /** Shape of the ramp: 1 is a straight line with a corner at the cap, higher eases into the cap sooner (no jolt on arrival). */
    curve: 1.6,
  },

  jump: {
    /** Height of the rover's underside at the top of a jump. */
    height: 1.3,
    /** Time from take-off to landing. Gravity and take-off speed are derived from these two. */
    duration: 0.62,
    /** Jump pressed in the air this close to landing still jumps on landing. */
    buffer: 0.12,
  },

  /**
   * Crouch (docs/RUNNER.md, "Controls"): the rover is low for exactly as long as S or Down is held (or a finger stays down after
   * a swipe down). There is no timer: these are the eases and the touch minimum.
   */
  crouch: {
    /** Time for the crouch amount to go from 0 to 1 after a press. */
    inTime: 0.06,
    /** Time for it to go from 1 to 0 once the key is let go (the stand-up ease; it never starts while the key is held). */
    outTime: 0.1,
    /** Touch: a swipe down crouches at least this long at the start speed (see touchMinCrouch for other speeds). */
    touchMinTime: 0.35,
    /** Crouch pressed in the air drops the rover at this speed, and it crouches on landing. */
    slamSpeed: 18,
  },

  /** Collision boxes, in metres. They are a little smaller than the art so a near miss counts as a miss. */
  hitbox: {
    rover: { width: 1.0, length: 1.4, height: 1.1, crouchHeight: 0.5 },
    /** A tall block across its lane: only a lane change gets past it. */
    slab: { width: 1.8, length: 0.8, bottom: 0, top: 2.6 },
    /** A low block: jump over it. */
    barrier: { width: 1.9, length: 0.5, bottom: 0, top: 0.7 },
    /** The beam of an overhead arch: crouch under it. Its posts stand on the lane edges and are scenery, not obstacles. */
    gate: { width: 2.0, length: 0.5, bottom: 0.95, top: 2.6 },
    /** One panel of a wall across the track: thin and full height; the lane left open in it is the way through (hazards.ts). */
    wall: { width: 2.1, length: 0.3, bottom: 0, top: 3.2 },
    /** A slab that drifts sideways between two lanes (hazards.ts). */
    sweeper: { width: 1.7, length: 0.9, bottom: 0, top: 2.6 },
    /** A pickup is collected when the rover's box comes within this radius of its centre. */
    pickupRadius: 0.45,
  },

  spawn: {
    /** Rows are generated until this far ahead of the rover (past the fog, so nothing pops in). */
    ahead: 160,
    /** Obstacles and pickups this far behind the rover are dropped. */
    behind: 12,
    /** Free running at the start of a run before the first row. */
    firstRowAt: 105,
  },

  generator: {
    /**
     * The fairness budget: a player is assumed to need this long, after the rover has cleared a row, before acting on the
     * next one. Every gap the generator makes leaves at least this, plus the time the moves themselves take.
     */
    reactionTime: 0.25,
    /** The shortest gap there ever is between two rows, from cleared to contact, at any speed: 0.45 s is 18 m at the cap. */
    minGap: 0.45,
    /**
     * Free running between one pattern and the next, from the rover clearing a row to it reaching the next: this long at the
     * start speed, shrinking to this at the cap (linear in the speed in between), then a random extra of up to `extra` more.
     */
    window: { start: 2.3, cap: 0.6 },
    extra: { start: 1.1, cap: 0.3 },
    /** Between the rows of one pattern (a combination): the time the moves need, plus this (start speed, cap). */
    margin: { start: 0.06, cap: 0.03 },
    /** Later tiers close the window and the extra by these shares (tier 1, 2, 3). */
    tighten: [1, 0.9, 0.78] as [number, number, number],
    /** Distances (metres) at which tier 2 (pairs, combinations) and tier 3 (triples, chains, tighter) begin. */
    tiers: { two: 200, three: 1100 },
    /** Distances at which the new hazards start to appear: the wall with one opening, the sweeper. */
    hazards: { wall: 500, sweeper: 1000 },
    /** Odds of each of the basic obstacle kinds. */
    kinds: { slab: 0.4, barrier: 0.35, gate: 0.25 },
    /**
     * Pattern weights in tier 1, 2 and 3 (0 = not in that tier; the hazards also wait for their distance). A pattern is one or
     * more rows: `single`, `pair` (two obstacles in a row), `barrierGate` (jump, then at once crouch, or the other way round:
     * the lane is forced), `gateDodge` (crouch, then at once a lane change), `dodgeJump` (a slab in your lane, the free lane
     * beside it a barrier: lane change then jump), `trio` (a row with a slab, a barrier and a gate), `slalom` (a lane change
     * across the track), `chain3` (three forced rows), `wall` (a wall with one opening), `wallSlalom` (two walls, openings at
     * the opposite sides), `sweeper` (a slab swaying between two lanes).
     */
    patterns: {
      single: [1, 0.3, 0.12],
      pair: [0, 0.26, 0.12],
      barrierGate: [0, 0.1, 0.08],
      gateDodge: [0, 0.1, 0.08],
      dodgeJump: [0, 0.14, 0.08],
      trio: [0, 0.1, 0.08],
      slalom: [0, 0, 0.1],
      chain3: [0, 0, 0.14],
      wall: [0, 0.12, 0.1],
      wallSlalom: [0, 0, 0.08],
      sweeper: [0, 0.08, 0.1],
    } as Record<string, [number, number, number]>,
    /** The sweeper: seconds for one swing there and back, and the odds the way through a wall's opening holds a barrier or a gate. */
    sweeperPeriod: 3.4,
    wallOpeningBarrier: 0.25,
    wallOpeningGate: 0.2,
    /** Chance that a pattern gets pickups: a single, a combination or hazard (they lead along the way through it). */
    pickupChance: 0.6,
    pickupChanceCombo: 0.92,
    /** Odds that the pickups follow the harder way through a row (a jump or a crouch) when there is an easier one. */
    pickupRisk: 0.65,
    pickupSpacing: 3,
    pickupMaxInLine: 8,
    /** Height of a pickup on the ground run, over a barrier (on the jump) and under a gate (crouched). */
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
    /** The tunnel: a thin brass ring every ringSpacing metres (environment.ts; the count covers the fog's depth). */
    ringSpacing: 9,
    ringCount: 18,
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
  /** --surface-2: the planet's night side, a step above the sky. */
  night: 0x151518,
  /** --text-3-app: the planet's lit side, a dark warm grey. */
  stone: 0x6b675f,
  /** --brass-deep: brass in shadow, the planet's darker bands. */
  brassDeep: 0x5c4d2c,
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

/** Speed after `time` seconds of play: rises from the start speed, easing into the cap, then stays there. */
export function speedAt(time: number, cfg: RunnerConfig = RUNNER_CONFIG): number {
  const { start, max, rampTime, curve } = cfg.speed;
  const u = Math.min(1, Math.max(0, time / rampTime));
  return start + (max - start) * (1 - Math.pow(1 - u, curve));
}

/** Distance driven after `time` seconds of play: the integral of speedAt (the speed never depends on the player). */
export function distanceAt(time: number, cfg: RunnerConfig = RUNNER_CONFIG): number {
  const { start, max, rampTime, curve } = cfg.speed;
  const t = Math.max(0, time);
  const u = Math.min(1, t / rampTime);
  const ramp = start * u + (max - start) * (u - (1 - Math.pow(1 - u, curve + 1)) / (curve + 1));
  return ramp * rampTime + max * Math.max(0, t - rampTime);
}

/** Seconds of play at which the rover's centre reaches `distance` (the inverse of distanceAt). */
export function timeAtDistance(distance: number, cfg: RunnerConfig = RUNNER_CONFIG): number {
  let lo = 0;
  let hi = cfg.speed.rampTime + Math.max(0, distance) / Math.max(cfg.speed.start, 1e-6) + 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (distanceAt(mid, cfg) < distance) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** How hard the speed makes things: 0 at the start speed, 1 at the cap. */
export function speedProgress(speed: number, cfg: RunnerConfig = RUNNER_CONFIG): number {
  const range = cfg.speed.max - cfg.speed.start;
  return range > 0 ? Math.min(1, Math.max(0, (speed - cfg.speed.start) / range)) : 1;
}

/**
 * How long a swipe down keeps the rover crouched at least (seconds), at the speed the rover has now. A finger that stays down
 * keeps it crouched longer; a quick flick gets this much. It is the larger of two things: the distance of touchMinTime at the
 * start speed (so the feel is the same at every speed), and the time to get under and through the longest gate with a quarter
 * to spare, plus the ease down.
 */
export function touchMinCrouch(speed: number, cfg: RunnerConfig = RUNNER_CONFIG): number {
  const v = Math.max(speed, 1e-6);
  const gate = 1.25 * ((cfg.hitbox.rover.length + cfg.hitbox.gate.length) / v) + cfg.crouch.inTime;
  return Math.max((cfg.crouch.touchMinTime * cfg.speed.start) / v, gate);
}
