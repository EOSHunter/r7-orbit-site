// The agent's animation, as numbers (docs/ASCENT.md, "How it looks"): which animation the sim's state calls for, and the pose
// for this frame, a joint angle or a scale per part. Pure: no three.js, no DOM. agent.ts puts the pose on the model's parts
// (tools/ascent/build_agent.py names them). It only reads the sim; the motion is the same with or without it.
//
// - idle: a small bob, the arms swaying a little
// - run: the legs and arms swing with the distance covered, a bob on each step, a lean into the run
// - jump: a quick crouch at take-off that springs into a stretch, then arms up and legs tucked while rising
// - fall: arms out, legs reaching down
// - land: a squash as deep as the landing was hard, springing back
//
// The jump still leaves the ground on the key press (the feel does not change), so the crouch is drawn in the first few
// hundredths of a second of the rise, not before it. Under reduced motion the bob, the squash and stretch and the antenna's
// sway are left out; the legs and arms still say what the agent is doing.

import { ASCENT_CONFIG, jumpPhysics, type AscentConfig } from './config';

export type AgentAnimation = 'idle' | 'run' | 'jump' | 'fall' | 'land';

/** What the animation reads from the sim each frame. */
export interface AgentSnapshot {
  grounded: boolean;
  /** Velocity (m/s); y is up. */
  vx: number;
  vy: number;
  vz: number;
  /** The sim's counters: a change is a take-off, a landing, a respawn. */
  jumps: number;
  landings: number;
  teleports: number;
}

/** One frame's pose. Angles in radians; a positive swing is forward. */
export interface AgentPose {
  animation: AgentAnimation;
  /** The whole agent's height about its feet (1 at rest); agent.ts scales its width the other way, keeping its volume. */
  squash: number;
  /** The body raised (metres) and leaned forward. */
  bodyLift: number;
  lean: number;
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** Both arms raised out to the sides. */
  armOut: number;
  /** The head's nod forward, and the antenna's sway forward and to the side. */
  headNod: number;
  antennaPitch: number;
  antennaRoll: number;
}

export const restPose = (): AgentPose => ({
  animation: 'idle',
  squash: 1,
  bodyLift: 0,
  lean: 0,
  legL: 0,
  legR: 0,
  armL: 0,
  armR: 0,
  armOut: 0,
  headNod: 0,
  antennaPitch: 0,
  antennaRoll: 0,
});

/**
 * The animation for the sim's state: in the air it jumps while rising and falls after; on the ground it lands for a moment
 * after touching down, then runs or stands by its speed across the ground.
 */
export function chooseAnimation(
  s: { grounded: boolean; vy: number; speed: number; sinceLanding: number },
  cfg: AscentConfig = ASCENT_CONFIG,
): AgentAnimation {
  if (!s.grounded) return s.vy > 0 ? 'jump' : 'fall';
  if (s.sinceLanding < cfg.animation.landTime) return 'land';
  return s.speed > cfg.animation.runSpeed ? 'run' : 'idle';
}

/** A damped spring towards 0, stepped in small fixed slices so it behaves the same at any frame rate (rover.ts's). */
class Spring {
  value = 0;
  velocity = 0;
  constructor(private readonly opts: { stiffness: number; damping: number }) {}
  step(target: number, dt: number): void {
    const { stiffness, damping } = this.opts;
    const c = 2 * Math.sqrt(stiffness) * damping;
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      this.velocity += (-stiffness * (this.value - target) - c * this.velocity) * h;
      this.value += this.velocity * h;
    }
  }
  reset(): void {
    this.value = 0;
    this.velocity = 0;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Ease `cur` towards `target` at `rate` per second (exponential, frame-rate independent). */
const ease = (cur: number, target: number, rate: number, dt: number) => target + (cur - target) * Math.exp(-rate * dt);

/** The longest frame the animation steps by: a stall or a pause does not fling the springs. */
const MAX_DT = 0.1;

export class AgentAnimator {
  readonly pose: AgentPose = restPose();
  private readonly cfg: AscentConfig;
  private readonly takeoff: number;
  private readonly squash: Spring;
  private readonly antenna: Spring;
  private seen: Pick<AgentSnapshot, 'jumps' | 'landings' | 'teleports'> | null = null;
  /** Seconds since the last landing, since the crouch started, and in all. */
  private sinceLanding = Infinity;
  private crouch = Infinity;
  private time = 0;
  /** Where the legs are in their stride (radians), and the last step it flicked the antenna on. */
  private phase = 0;
  private lastStep = 0;
  /** The fall speed just before touching down (the sim has zeroed it by the landing frame). */
  private airVy = 0;

  constructor(cfg: AscentConfig = ASCENT_CONFIG) {
    this.cfg = cfg;
    this.takeoff = jumpPhysics(cfg).takeoff;
    this.squash = new Spring(cfg.animation.squashSpring);
    this.antenna = new Spring(cfg.animation.antennaSpring);
  }

  /** The pose for this frame, `dt` seconds after the last; `reducedMotion` leaves out the bob, squash and sway. */
  update(s: AgentSnapshot, dt: number, reducedMotion = false): AgentPose {
    const a = this.cfg.animation;
    dt = clamp(dt, 0, MAX_DT);
    const p = this.pose;

    // The sim's counters: a respawn puts everything at rest; a take-off starts the crouch; a landing starts the squash.
    if (!this.seen || s.teleports !== this.seen.teleports) {
      Object.assign(p, restPose());
      this.squash.reset();
      this.antenna.reset();
      this.sinceLanding = Infinity;
      this.crouch = Infinity;
      this.airVy = 0;
    } else {
      if (s.jumps > this.seen.jumps) {
        this.crouch = 0;
        this.antenna.velocity -= a.antennaKick;
      }
      if (s.landings > this.seen.landings) {
        this.sinceLanding = 0;
        const hard = clamp(-this.airVy / a.landHard, 0.3, 1);
        this.squash.value = -a.landSquash * hard;
        this.squash.velocity = 0;
        this.antenna.velocity += a.antennaKick * hard;
      }
    }
    this.seen = { jumps: s.jumps, landings: s.landings, teleports: s.teleports };
    if (!s.grounded) this.airVy = s.vy;

    this.time += dt;
    this.sinceLanding += dt;
    this.crouch += dt;
    const speed = Math.hypot(s.vx, s.vz);
    const animation = chooseAnimation(
      { grounded: s.grounded, vy: s.vy, speed, sinceLanding: this.sinceLanding },
      this.cfg,
    );
    p.animation = animation;

    // Targets for this animation; the limbs ease towards them.
    const run = clamp(speed / this.cfg.move.speed, 0, 1);
    let legL = 0;
    let legR = 0;
    let armL: number;
    let armR: number;
    let armOut = 0;
    let lean = 0;
    let lift = 0;
    let nod = 0;
    let rate = a.blend;
    if (animation === 'run' || (animation === 'land' && speed > a.runSpeed)) {
      if (s.grounded) this.phase += (speed / a.stride) * 2 * Math.PI * dt;
      const swing = Math.sin(this.phase);
      legL = a.legSwing * run * swing;
      legR = -legL;
      armR = a.armSwing * run * swing;
      armL = -armR;
      lean = a.runLean * run;
      lift = a.runBob * run * Math.abs(Math.cos(this.phase));
      nod = -lean * 0.4;
      rate = a.runBlend;
      // Each footfall (twice a stride) flicks the antenna.
      const step = Math.floor(this.phase / Math.PI);
      if (step !== this.lastStep) {
        this.lastStep = step;
        this.antenna.velocity += a.antennaKick * 0.25 * run;
      }
    } else if (animation === 'idle') {
      const breath = Math.sin(this.time * a.idleRate * 2 * Math.PI);
      lift = a.idleBob * breath;
      armL = a.idleSway * breath;
      armR = a.idleSway * breath;
      armOut = a.idleSway * 0.5 * (1 + breath);
    } else if (animation === 'jump') {
      armL = armR = a.jumpArms;
      [legL, legR] = a.jumpLegs;
      lean = -0.08;
      nod = -0.1;
    } else if (animation === 'fall') {
      armL = armR = a.fallArms;
      armOut = a.fallArmsOut;
      [legL, legR] = a.fallLegs;
      lean = 0.06;
      nod = 0.08;
    } else {
      // land: arms thrown forward a little to catch the weight, a nod into it
      armL = armR = 0.3;
      armOut = 0.25;
      lean = 0.12;
      nod = 0.15;
    }
    if (reducedMotion) lift = 0;

    p.legL = ease(p.legL, legL, rate, dt);
    p.legR = ease(p.legR, legR, rate, dt);
    p.armL = ease(p.armL, armL, rate, dt);
    p.armR = ease(p.armR, armR, rate, dt);
    p.armOut = ease(p.armOut, armOut, rate, dt);
    p.lean = ease(p.lean, lean, rate, dt);
    p.headNod = ease(p.headNod, nod, rate, dt);
    p.bodyLift = animation === 'run' || reducedMotion ? lift : ease(p.bodyLift, lift, a.blend, dt);

    // Squash and stretch: the crouch at take-off, then a spring (kicked into a stretch as the crouch ends, pushed into a
    // squash by a landing) whose rest stretches a little with the speed up or down in the air.
    const airTarget = s.grounded ? 0 : a.airStretch * clamp(Math.abs(s.vy) / this.takeoff, 0, 1) * Math.sign(s.vy);
    const crouching = this.crouch < a.crouchTime;
    if (crouching) {
      this.squash.value = -a.crouch * Math.sin((Math.PI / 2) * Math.min(1, this.crouch / (a.crouchTime * 0.5)));
      this.squash.velocity = 0;
    } else if (this.crouch - dt < a.crouchTime) {
      this.squash.velocity = a.stretchKick; // the crouch just ended: spring up into the stretch
    }
    if (!crouching) this.squash.step(airTarget, dt);
    this.antenna.step(0, dt);
    p.squash = reducedMotion ? 1 : clamp(1 + this.squash.value, 0.65, 1.35);
    p.antennaPitch = reducedMotion ? 0 : clamp(this.antenna.value * 0.35 - p.lean * 0.8, -0.6, 0.6); // trails a lean
    p.antennaRoll = reducedMotion ? 0 : clamp(this.antenna.velocity * 0.012, -0.25, 0.25);
    return p;
  }
}
