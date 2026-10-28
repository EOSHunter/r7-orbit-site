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

  /** Falling below this height (metres, feet) puts the agent back at the start, or at its checkpoint in assist mode. */
  killY: -18,

  /**
   * Assist mode (off by default: hardcore): touching a beacon makes it the checkpoint, and falling this far below it puts the
   * agent back on it. A beacon counts as touched when the agent stands within `radius` of it across and `height` of it up.
   */
  assist: { radius: 1.3, height: 0.6, drop: 6 },

  /** An updraft never lifts faster than this (m/s); its push is the fan's own (the level file's `strength`). */
  fan: { maxRise: 9 },
  /** A crumbling box is back this long after it broke (s); while it waits to break it shakes this far (m, drawing only). */
  crumble: { back: 4, shake: 0.035 },
  /** The ring counts as touched within this distance of its tube (m): a little more than the agent's half width, so a
   * jump that brushes it counts. */
  finish: { reach: 0.45 },

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
    /**
     * A lit climb (its zones have a look: render.ts): fog into the horizon's colour, from `near` to `far` metres (further than
     * the toned look's: the colours carry the depth); how far the sky's camera sees (the Earth, the Moon, the stars); the
     * metres either side of a zone's start over which its sky, sun and fog blend into the next zone's.
     */
    lit: { fog: { near: 35, far: 150 }, skyFar: 8000, fade: 18 },
    /**
     * The blob shadow: its radius under the agent (it fades out softly towards it), the height above the ground at which it
     * has faded out, and how dark its middle is (toned look, lit look). It is drawn only on the tops it falls on, never past
     * their edges.
     */
    shadow: { radius: 0.5, fadeHeight: 12, opacity: 0.9, litOpacity: 0.55 },
    /** The goal ring above the top of the course: one turn takes this long (it stands still under reduced motion). */
    ringTurn: 24,
    /** A fan's updraft is drawn as short ivory streaks rising through it: how many, how long, how fast, how bright. */
    fanStreaks: { count: 10, length: 0.7, speed: 4, opacity: 0.35 },
    /** Device pixel ratio cap: a mouse device, and a touch device (bigger screens with smaller dots). */
    maxPixelRatio: 2,
    maxPixelRatioTouch: 1.5,
    /**
     * The light on the agent (the one lit thing; the level is shaded by tone). Each number is the share of a part's colour it
     * gives a face square to it: an ambient on every face, then a key, a fill and a rim that turn with the camera (yaw in
     * degrees from the camera's side of the agent, positive to the camera's left; pitch in degrees up from level), so the
     * agent's faces, sides and outline come out in different tones whichever way the player looks. The same numbers light
     * the previews in tools/ascent/build_agent.py.
     */
    agentLight: {
      ambient: 0.1,
      key: { share: 0.9, yaw: -60, pitch: 35 },
      fill: { share: 0.2, yaw: 90, pitch: 0 },
      rim: { share: 0.6, yaw: 165, pitch: 25 },
      /** Brass also glows by this share of its colour, so the visor stays brass in shade. */
      brassGlow: 0.15,
    },
  },

  /**
   * The agent's animation (agent-anim.ts): drawing only, it never changes the motion. Metres, radians, seconds. Under reduced
   * motion the bob, the squash and stretch and the antenna's sway are left out; the legs and arms still show running and
   * jumping.
   */
  animation: {
    /** Faster than this across the ground (m/s) it runs; slower, it stands. */
    runSpeed: 0.6,
    /** Metres covered in one full stride (both legs) at any speed. */
    stride: 1.7,
    /** At top speed: how far the legs and the arms swing either way, the bob, the forward lean. */
    legSwing: 0.75,
    armSwing: 0.85,
    runBob: 0.035,
    runLean: 0.14,
    /** Standing: a slow bob (metres, cycles per second) and the arms' sway. */
    idleBob: 0.008,
    idleRate: 0.5,
    idleSway: 0.05,
    /** The crouch at take-off: how far it squashes and for how long, then the stretch it springs into (1/s). */
    crouch: 0.2,
    crouchTime: 0.07,
    stretchKick: 3.2,
    /** Rising: arms up and forward, legs tucked (one a little more than the other). */
    jumpArms: 2.3,
    jumpLegs: [0.95, 0.55],
    /** Falling: arms out to the sides and a little forward, legs reaching down. */
    fallArmsOut: 1.05,
    fallArms: 0.35,
    fallLegs: [0.15, -0.1],
    /** A little taller rising fast, a little shorter falling fast (share of its height at take-off speed). */
    airStretch: 0.06,
    /** Landing: the squash at the hardest landing (share of its height), the fall speed that counts as hardest, how long the
     * landing pose lasts. */
    landSquash: 0.26,
    landHard: 16,
    landTime: 0.18,
    /** The squash and stretch spring and the antenna's spring: stiffness (1/s²) and damping ratio (1: no overshoot). */
    squashSpring: { stiffness: 260, damping: 0.38 },
    antennaSpring: { stiffness: 170, damping: 0.22 },
    /** How hard a take-off, a landing and each running step flick the antenna (rad/s). */
    antennaKick: 4,
    /** How fast each limb eases to its new pose (1/s): between poses, and while running. */
    blend: 14,
    runBlend: 26,
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
