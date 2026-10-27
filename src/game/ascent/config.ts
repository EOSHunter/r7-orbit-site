// Every tunable number of R7: Ascent in one place (docs/ASCENT.md, "Code"). Distances are metres, times seconds, speeds
// metres per second, angles radians: nothing here is per frame. Phase 1 is the feel prototype, so this file is where the
// feel is tuned: change a number, reload /styleguide/ascent/, play. The sim, the camera and the tests all read this object.

export const ASCENT_CONFIG = {
  /** The fixed simulation step. The sim always advances by exactly this much, whatever the display's refresh rate. */
  step: 1 / 120,
  /** A frame longer than this (a stall, a debugger, a background tab) counts as this long: the game slows, it never jumps. */
  maxFrameDelta: 0.1,
  /** At most this many steps per frame; any time left over is dropped rather than carried (no catch-up spiral). */
  maxStepsPerFrame: 8,

  /** The agent's collision box: a little narrower than the capsule drawn, so a near miss on a wall counts as a miss. */
  agent: { width: 0.56, height: 1.2 },

  move: {
    /** Top running speed on the ground and in the air. */
    speed: 6,
    /** How fast the agent reaches the top speed on the ground (m/s²): about 0.1 s from standing. */
    groundAccel: 60,
    /** How fast it stops on the ground when no key is held: about 0.09 s, short enough to stop on a narrow block. */
    groundDecel: 70,
    /** Steering in the air: enough to correct a jump, not enough to turn it round. */
    airAccel: 24,
    /** Slowing in the air with no key held: almost none, so a jump keeps its run-up. */
    airDecel: 3,
    /** How fast the agent turns to face where it is going (radians per second). Drawing only: it never changes the motion. */
    turnRate: 14,
  },

  jump: {
    /** Height of the agent's feet at the top of a full jump (Space held), from where it took off. */
    height: 1.6,
    /** Time from take-off to the top of a full jump. Gravity and take-off speed are derived from these two (jumpPhysics). */
    timeToApex: 0.38,
    /** Gravity is this many times stronger on the way down: a quick fall reads as weight, and lands where the eye expects. */
    fallMultiplier: 1.4,
    /** Space let go while rising: gravity this many times stronger until the top, for a short hop (variable jump height). */
    cutMultiplier: 2.6,
    /** Coyote time: a jump pressed this long after walking off an edge still jumps. */
    coyoteTime: 0.1,
    /** Jump buffering: a jump pressed this long before landing happens on landing. */
    buffer: 0.12,
    /** The fastest fall (terminal speed). */
    maxFall: 32,
  },

  /** Falling below this height (metres, feet) puts the agent back at the start. Hardcore: no checkpoints in phase 1. */
  killY: -18,

  camera: {
    /** Distance from the look point to the camera, when nothing is in the way. */
    distance: 6,
    /** The camera never comes closer than this, even with a block in the way. */
    minDistance: 1.2,
    /** It stops this far short of a block it would otherwise be inside. */
    padding: 0.25,
    /** The look point: this high above the agent's feet. */
    lookHeight: 1.3,
    /** Pitch (the camera's angle above the look point): where it starts, and its limits (negative is below, looking up). */
    pitch: { start: 0.32, min: -0.45, max: 1.2 },
    /** Mouse or drag: radians per CSS pixel. */
    sensitivity: 0.0024,
    /** Q and E turn the camera this fast (radians per second), for playing with the keyboard alone. */
    keyTurnRate: 2.4,
    /** Follow smoothing, as time constants: across (snappy) and up and down (softer, so a jump does not bounce the view). */
    follow: { horizontal: 0.035, vertical: 0.14 },
    /** A blocked camera snaps in at once; it eases back out over this time constant once the way is clear. */
    easeOut: 0.25,
  },

  render: {
    fov: 62,
    /** Fog in metres from the camera: where it starts and where a block has faded into the background. */
    fog: { near: 18, far: 95 },
    /** The ivory edge lines' opacity (1px lines; the fog fades them with distance). */
    edgeOpacity: 0.55,
    /** The blob shadow: its radius under the agent, and the height above the ground at which it has faded out. */
    shadow: { radius: 0.42, fadeHeight: 12 },
    /** The goal ring above the top of the course: one turn takes this long (it stands still under reduced motion). */
    ringTurn: 24,
    /** Device pixel ratio cap: a mouse device, and a touch device (bigger screens with smaller dots). */
    maxPixelRatio: 2,
    maxPixelRatioTouch: 1.5,
  },
};

export type AscentConfig = typeof ASCENT_CONFIG;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** The config with some values replaced (the tests, and later a settings menu). */
export function withConfig(overrides: DeepPartial<AscentConfig>, base: AscentConfig = ASCENT_CONFIG): AscentConfig {
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
  ) as unknown as AscentConfig;
}

/**
 * Gravity on the way up and take-off speed, from the jump's height and time to the top (h = v0·t/2, g = v0/t), and the
 * gravity on the way down.
 */
export function jumpPhysics(cfg: AscentConfig = ASCENT_CONFIG): {
  gravity: number;
  takeoff: number;
  fallGravity: number;
} {
  const { height, timeToApex, fallMultiplier } = cfg.jump;
  const gravity = (2 * height) / (timeToApex * timeToApex);
  return { gravity, takeoff: gravity * timeToApex, fallGravity: gravity * fallMultiplier };
}

/**
 * How far a full jump at top speed carries the agent sideways (metres), landing `rise` metres above where it took off (a
 * negative rise is a drop). 0 when the jump cannot reach that height. The level's fairness test uses it.
 */
export function jumpReach(rise: number, cfg: AscentConfig = ASCENT_CONFIG): number {
  const { height, timeToApex } = cfg.jump;
  if (rise > height) return 0;
  const { fallGravity } = jumpPhysics(cfg);
  const fall = Math.sqrt((2 * (height - rise)) / fallGravity);
  return cfg.move.speed * (timeToApex + fall);
}
