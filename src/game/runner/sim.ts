// The game itself: state, the fixed-step update, lanes, jump and held crouch, collisions, spawning, scoring and the speed curve.
// Pure logic: no DOM, no clock, no rendering. Every call to step() advances exactly config.step seconds, so the result
// depends only on the seed and the inputs, never on the display's frame rate (the loop in index.ts decides how many steps
// a frame gets; clock.ts). render.ts only reads this state.

import { RUNNER_CONFIG, jumpPhysics, speedAt, touchMinCrouch, type RunnerConfig } from './config';
import { createGenerator, type Generator, type Lane, type ObstacleKind, type Row } from './generator';

/**
 * What a player asks for. `primary` is Space: start or restart when not playing, jump while playing. `start` is a tap.
 * Crouch is a held state: `crouch` is S or Down pressed, `crouchTouch` a swipe down (the finger stays down; it also crouches at
 * least touchMinCrouch), `crouchEnd` the key or finger let go, `crouchCancel` let go AND forget the touch minimum (blur, pause).
 */
export type Intent =
  | 'left'
  | 'right'
  | 'jump'
  | 'crouch'
  | 'crouchTouch'
  | 'crouchEnd'
  | 'crouchCancel'
  | 'primary'
  | 'start';

export type Phase = 'ready' | 'playing' | 'over';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  lane: Lane;
  /** Distance along the track of its centre. */
  z: number;
}

export interface Pickup {
  id: number;
  lane: Lane;
  z: number;
  /** Height of its centre above the track. */
  y: number;
  taken: boolean;
}

export interface SimOptions {
  /** Seed of the first run; each restart derives the next one from it. The live game passes Date.now(). */
  seed?: number;
  config?: RunnerConfig;
  /** Where rows come from (default: the seeded generator). The tests pass hand-made courses. */
  course?: (seed: number, cfg: RunnerConfig) => Generator;
}

export class RunnerSim {
  readonly cfg: RunnerConfig;
  private readonly makeCourse: (seed: number, cfg: RunnerConfig) => Generator;
  private readonly baseSeed: number;
  private readonly gravity: number;
  private readonly takeoff: number;

  phase: Phase = 'ready';
  /** Seconds since the phase began (counts in every phase; the restart delay reads it). */
  phaseTime = 0;
  /** Seconds of play in this run. */
  time = 0;
  /** Runs started since the sim was made (0 before the first). */
  run = 0;
  seed = 0;
  /** Steps taken since the sim was made. */
  steps = 0;

  distance = 0;
  speed = 0;
  /** The lane the rover is in or moving to. */
  lane: Lane = 0;
  /** Sideways position of the rover's centre (lane × laneWidth once it has arrived). */
  x = 0;
  /** Height of the rover's underside above the track. */
  y = 0;
  vy = 0;
  grounded = true;
  /** A key or finger is holding crouch. Cleared by crouchEnd, a jump, a crash, a restart: never by a timer. */
  crouchHeld = false;
  /** Touch only: seconds of crouch still owed after a swipe down, held or not (0 = none). */
  crouchMin = 0;
  /** How far down the rover is, 0 (standing) to 1 (crouched): eases up over crouch.inTime, down over crouch.outTime. */
  crouch = 0;
  /** Crouch was swiped in the air: the minimum starts on landing. */
  private slamMin = false;
  /** Seconds left during which a jump pressed in the air still happens on landing. */
  jumpBuffer = 0;
  /** Crouch was pressed in the air: the rover is dropping fast and crouches on landing (if still held). */
  slamming = false;

  pickups = 0;
  score = 0;
  obstacles: Obstacle[] = [];
  items: Pickup[] = [];
  /** What ended the run. */
  crash: Obstacle | null = null;

  /** The values at the start of the last step, for render interpolation. */
  prev = { distance: 0, x: 0, y: 0 };

  private queue: Intent[] = [];
  private course!: Generator;
  private lastRowZ = 0;
  private nextId = 1;

  constructor(opts: SimOptions = {}) {
    this.cfg = opts.config ?? RUNNER_CONFIG;
    this.makeCourse = opts.course ?? ((seed, cfg) => createGenerator(seed, cfg));
    this.baseSeed = (opts.seed ?? 1) >>> 0;
    ({ gravity: this.gravity, takeoff: this.takeoff } = jumpPhysics(this.cfg));
    this.reset();
  }

  /** Back to the start line of a new course, in the ready phase. */
  reset(seed: number = (this.baseSeed + Math.imul(this.run, 0x9e3779b9)) >>> 0): void {
    this.seed = seed;
    this.phase = 'ready';
    this.phaseTime = 0;
    this.time = 0;
    this.distance = 0;
    this.speed = speedAt(0, this.cfg);
    this.lane = 0;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.crouchHeld = false;
    this.crouchMin = 0;
    this.crouch = 0;
    this.slamMin = false;
    this.jumpBuffer = 0;
    this.slamming = false;
    this.pickups = 0;
    this.score = 0;
    this.obstacles = [];
    this.items = [];
    this.crash = null;
    this.queue = [];
    this.course = this.makeCourse(seed, this.cfg);
    this.lastRowZ = 0;
    this.prev = { distance: 0, x: 0, y: 0 };
    this.spawn();
  }

  /** Queue an intent; it takes effect at the start of the next step. */
  input(intent: Intent): void {
    this.queue.push(intent);
  }

  /**
   * Start a run: from ready at once, from game over with a fresh course (only once the restart delay has passed, unless
   * `force`). Returns whether a run started.
   */
  start(force = false): boolean {
    if (this.phase === 'playing') return false;
    if (this.phase === 'over') {
      if (!force && this.phaseTime < this.cfg.score.restartDelay) return false;
      this.reset((this.baseSeed + Math.imul(this.run, 0x9e3779b9)) >>> 0);
    }
    this.run += 1;
    this.phase = 'playing';
    this.phaseTime = 0;
    return true;
  }

  /** The rover is crouched (or being held down by a touch minimum): on the ground, and held or owed. What rover.ts folds by. */
  get crouching(): boolean {
    return this.grounded && (this.crouchHeld || this.crouchMin > 0);
  }

  /** The old name for `crouching`, still what rover.ts reads. */
  get sliding(): boolean {
    return this.crouching;
  }

  /** Height of the rover's collision box right now: it follows the crouch amount, so it stands up over crouch.outTime. */
  get roverHeight(): number {
    const r = this.cfg.hitbox.rover;
    return r.height - (r.height - r.crouchHeight) * this.crouch;
  }

  /** Advance exactly one fixed step (config.step seconds). */
  step(): void {
    const dt = this.cfg.step;
    this.steps += 1;
    for (const intent of this.queue.splice(0)) this.apply(intent);
    this.prev = { distance: this.distance, x: this.x, y: this.y };
    this.phaseTime += dt;
    if (this.phase !== 'playing') return;

    this.time += dt;
    this.speed = speedAt(this.time, this.cfg);
    this.distance += this.speed * dt;

    // Sideways: straight towards the lane at a fixed speed.
    const target = this.lane * this.cfg.track.laneWidth;
    const lateral = (this.cfg.track.laneWidth / this.cfg.track.laneChangeTime) * dt;
    const dx = target - this.x;
    this.x = Math.abs(dx) <= lateral ? target : this.x + Math.sign(dx) * lateral;

    // Up and down: exact for constant gravity, so a jump has the same height and length at any step size.
    if (this.grounded) {
      if (this.crouchMin > 0) this.crouchMin = Math.max(0, this.crouchMin - dt);
    } else {
      this.y += this.vy * dt - 0.5 * this.gravity * dt * dt;
      this.vy -= this.gravity * dt;
      if (this.y <= 0) this.land();
    }
    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    // The crouch amount follows the held state: up at once-ish, down only after the release.
    const { inTime, outTime } = this.cfg.crouch;
    this.crouch = this.crouching ? Math.min(1, this.crouch + dt / inTime) : Math.max(0, this.crouch - dt / outTime);

    this.spawn();
    this.collide();
    this.score = Math.floor(this.distance) + this.pickups * this.cfg.score.pickupBonus;
  }

  private apply(intent: Intent): void {
    if (this.phase !== 'playing') {
      if (intent === 'primary' || intent === 'start') this.start();
      return;
    }
    switch (intent) {
      case 'left':
        this.lane = Math.max(-1, this.lane - 1) as Lane;
        break;
      case 'right':
        this.lane = Math.min(1, this.lane + 1) as Lane;
        break;
      case 'jump':
      case 'primary':
        if (this.grounded) this.jump();
        else if (!this.slamming) this.jumpBuffer = this.cfg.jump.buffer;
        break;
      case 'crouch':
      case 'crouchTouch':
        this.pressCrouch(intent === 'crouchTouch');
        break;
      case 'crouchEnd':
        this.crouchHeld = false;
        break;
      case 'crouchCancel':
        this.crouchHeld = false;
        this.crouchMin = 0;
        this.slamMin = false;
        break;
      case 'start':
        break;
    }
  }

  /** Crouch pressed (a key) or swiped (touch). On the ground it is held from now; in the air it slams the rover down first. */
  private pressCrouch(touch: boolean): void {
    this.crouchHeld = true;
    if (this.grounded) {
      if (touch) this.crouchMin = touchMinCrouch(this.speed, this.cfg);
    } else {
      this.slamming = true;
      this.slamMin = touch;
      this.jumpBuffer = 0;
      this.vy = Math.min(this.vy, -this.cfg.crouch.slamSpeed);
    }
  }

  private jump(): void {
    // A jump request wins over a crouch: it ends the hold (the key may still be down; it must be pressed again).
    this.crouchHeld = false;
    this.crouchMin = 0;
    this.slamMin = false;
    this.grounded = false;
    this.vy = this.takeoff;
    this.jumpBuffer = 0;
  }

  private land(): void {
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    if (this.slamming) {
      this.slamming = false;
      if (this.slamMin) this.crouchMin = touchMinCrouch(this.speed, this.cfg);
      this.slamMin = false;
    } else if (this.jumpBuffer > 0) {
      this.jump();
    }
  }

  /** Make rows until the course reaches `spawn.ahead` past the rover; drop what is behind it. */
  private spawn(): void {
    const { ahead, behind } = this.cfg.spawn;
    while (this.lastRowZ < this.distance + ahead) {
      // The generator spaces rows for the speed the rover will have on arrival. Speed only rises, so this bound holds: the
      // rover is at the last row within (lastRowZ - distance) / speed seconds, and the next gap is never 3 s long.
      const eta = Math.max(0, this.lastRowZ - this.distance) / Math.max(this.speed, 1e-6);
      const row = this.course.next(speedAt(this.time + eta + 3, this.cfg));
      this.lastRowZ = row.z;
      this.addRow(row);
    }
    const cut = this.distance - behind;
    if (this.obstacles.length && this.obstacles[0].z < cut) this.obstacles = this.obstacles.filter((o) => o.z >= cut);
    if (this.items.length && this.items[0].z < cut) this.items = this.items.filter((p) => p.z >= cut);
  }

  private addRow(row: Row): void {
    for (let i = 0; i < 3; i++) {
      const kind = row.lanes[i];
      if (kind) this.obstacles.push({ id: this.nextId++, kind, lane: (i - 1) as Lane, z: row.z });
    }
    for (const p of row.pickups) this.items.push({ id: this.nextId++, lane: p.lane, z: p.z, y: p.y, taken: false });
    this.items.sort((a, b) => a.z - b.z);
  }

  private collide(): void {
    const { hitbox, track } = this.cfg;
    const r = hitbox.rover;
    const top = this.y + this.roverHeight;
    for (const o of this.obstacles) {
      const box = hitbox[o.kind];
      if (Math.abs(o.z - this.distance) >= (r.length + box.length) / 2) continue;
      if (Math.abs(o.lane * track.laneWidth - this.x) >= (r.width + box.width) / 2) continue;
      if (this.y >= box.top || top <= box.bottom) continue;
      this.crash = o;
      this.phase = 'over';
      this.phaseTime = 0;
      this.crouchHeld = false;
      this.crouchMin = 0;
      this.score = Math.floor(this.distance) + this.pickups * this.cfg.score.pickupBonus;
      return;
    }
    const pr = hitbox.pickupRadius;
    for (const p of this.items) {
      if (p.taken) continue;
      if (p.z - this.distance > r.length / 2 + pr) break; // sorted by z: the rest are further on
      if (Math.abs(p.z - this.distance) >= r.length / 2 + pr) continue;
      if (Math.abs(p.lane * track.laneWidth - this.x) >= r.width / 2 + pr) continue;
      if (p.y - pr >= top || p.y + pr <= this.y) continue;
      p.taken = true;
      this.pickups += 1;
    }
  }
}
