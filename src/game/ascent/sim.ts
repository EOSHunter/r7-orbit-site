// AscentSim: the agent's movement, one fixed step at a time (docs/ASCENT.md, "Code"). Pure: no three.js, no DOM, no clock of
// its own. The host tells it where the player is steering (a world-space direction, already turned by the camera), when Space
// goes down and up, and calls step() a fixed number of times per frame (clock.ts). The view only reads it.
//
// The jump is built to feel fair (docs/ASCENT.md, "Features"):
// - coyote time: a jump pressed shortly after walking off an edge still jumps;
// - jump buffering: a jump pressed shortly before landing happens on landing;
// - variable height: letting go of Space while rising cuts the jump short; holding it gives the full height;
// - a heavier fall than rise, so the arc lands where the eye expects.
// Falling below config.killY puts the agent back at the start (hardcore: no checkpoints yet).

import { ASCENT_CONFIG, jumpPhysics, type AscentConfig } from './config';
import { groundBelow, moveAgent, type Box, type Vec3 } from './collision';
import type { Level } from './level';

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class AscentSim {
  readonly cfg: AscentConfig;
  readonly level: Level;
  private readonly solids: readonly Box[];
  private readonly physics: ReturnType<typeof jumpPhysics>;
  private readonly half: number;

  /** The middle of the agent's feet, now and one step ago (the view interpolates between them). */
  pos: Vec3;
  prev: Vec3;
  vel: Vec3 = { x: 0, y: 0, z: 0 };
  /** The way the agent faces (radians about +Y; 0 faces -Z), now and one step ago. Drawing only. */
  yaw: number;
  prevYaw: number;
  grounded = false;
  /** Seconds left in which a jump still counts after leaving the ground (coyote time). */
  coyote = 0;
  /** Seconds left in which a jump pressed in the air still happens on landing (jump buffering). */
  buffer = 0;
  /** Space is held: a jump keeps its full height. */
  held = false;
  /** In the rising half of a jump (variable height applies only then). */
  rising = false;
  /** Seconds simulated since the start (or the last restart). */
  time = 0;
  /** The highest the agent has stood, this climb (metres): the top of a jump does not count, only where it landed. */
  best = 0;
  jumps = 0;
  landings = 0;
  /** Times the agent fell off the world and went back to the start. */
  falls = 0;
  /** Goes up by one whenever the agent is moved without travelling (a respawn): the camera snaps instead of sweeping. */
  teleports = 0;
  private move = { x: 0, z: 0 };

  constructor(level: Level, cfg: AscentConfig = ASCENT_CONFIG) {
    this.cfg = cfg;
    this.level = level;
    this.solids = level.boxes;
    this.physics = jumpPhysics(cfg);
    this.half = cfg.agent.width / 2;
    this.pos = { ...level.spawn };
    this.prev = { ...level.spawn };
    this.yaw = this.prevYaw = level.spawnYaw;
  }

  /** The agent's feet, in metres above the ground at the start. */
  get altitude(): number {
    return this.pos.y - this.level.spawn.y;
  }

  /** Where the player steers, in world space (x, z), at most 1 long: the host turns the keys by the camera's yaw. */
  setMove(x: number, z: number): void {
    const len = Math.hypot(x, z);
    const k = len > 1 ? 1 / len : 1;
    this.move = { x: x * k, z: z * k };
  }

  /** Space went down: jump now if the agent may, or as soon as it lands within the buffer. */
  jumpPress(): void {
    this.held = true;
    this.buffer = this.cfg.jump.buffer;
  }

  /** Space came up: a jump still rising is cut short. */
  jumpRelease(): void {
    this.held = false;
  }

  /** Let go of everything (the game paused or lost focus): no key stays held, no jump stays buffered. */
  release(): void {
    this.move = { x: 0, z: 0 };
    this.held = false;
    this.buffer = 0;
  }

  /** Back to the start: position, speed, time and the best height. */
  restart(): void {
    this.respawn();
    this.time = 0;
    this.best = 0;
    this.falls = 0;
    this.jumps = 0;
    this.landings = 0;
  }

  /** Exactly one fixed step. */
  step(): void {
    const dt = this.cfg.step;
    const { move, jump } = this.cfg;
    this.prev = { ...this.pos };
    this.prevYaw = this.yaw;
    this.time += dt;

    this.buffer = Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? jump.coyoteTime : Math.max(0, this.coyote - dt);

    // Across: ease the speed towards where the player steers. Quick on the ground, gentle in the air.
    const steering = this.move.x !== 0 || this.move.z !== 0;
    const accel = this.grounded
      ? steering
        ? move.groundAccel
        : move.groundDecel
      : steering
        ? move.airAccel
        : move.airDecel;
    const tx = this.move.x * move.speed - this.vel.x;
    const tz = this.move.z * move.speed - this.vel.z;
    const gap = Math.hypot(tx, tz);
    const change = Math.min(gap, accel * dt);
    if (gap > 0) {
      this.vel.x += (tx / gap) * change;
      this.vel.z += (tz / gap) * change;
    }

    // Jump: pressed (or buffered) while on the ground or within coyote time.
    if (this.buffer > 0 && this.coyote > 0) {
      this.vel.y = this.physics.takeoff;
      this.buffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.rising = true;
      this.jumps++;
    }

    // Gravity: the rise's, heavier once Space is let go during a rise, heavier again on the way down.
    const g =
      this.vel.y > 0
        ? this.rising && !this.held
          ? this.physics.gravity * jump.cutMultiplier
          : this.physics.gravity
        : this.physics.fallGravity;
    this.vel.y = Math.max(this.vel.y - g * dt, -jump.maxFall);

    const r = moveAgent(
      this.pos,
      { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt },
      this.half,
      this.cfg.agent.height,
      this.solids,
    );
    this.pos = r.pos;
    if (r.hit.x) this.vel.x = 0;
    if (r.hit.z) this.vel.z = 0;
    const wasGrounded = this.grounded;
    if (r.hit.y) {
      this.grounded = this.vel.y < 0;
      this.vel.y = 0;
    } else {
      this.grounded = false;
    }
    if (this.vel.y <= 0) this.rising = false;
    if (this.grounded && !wasGrounded) this.landings++;

    // Face where the agent is going.
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.3) {
      const target = Math.atan2(-this.vel.x, -this.vel.z);
      const diff = wrapAngle(target - this.yaw);
      const turn = move.turnRate * dt;
      this.yaw = wrapAngle(this.yaw + Math.max(-turn, Math.min(turn, diff)));
    }

    if (this.pos.y < this.cfg.killY) {
      this.falls++;
      this.respawn();
    }
    if (this.grounded) this.best = Math.max(this.best, this.altitude);
  }

  /** The agent's feet `alpha` of the way from the last step to this one (0 to 1). */
  lerpPos(alpha: number): Vec3 {
    const { prev: a, pos: b } = this;
    return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha, z: a.z + (b.z - a.z) * alpha };
  }

  lerpYaw(alpha: number): number {
    return this.prevYaw + wrapAngle(this.yaw - this.prevYaw) * alpha;
  }

  /** The top of whatever is under the agent at `p` (the blob shadow), or null over the void. */
  groundUnder(p: Vec3 = this.pos): number | null {
    return groundBelow(p, this.half, this.solids);
  }

  private respawn(): void {
    this.pos = { ...this.level.spawn };
    this.prev = { ...this.level.spawn };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = this.prevYaw = this.level.spawnYaw;
    this.grounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.rising = false;
    this.teleports++;
  }
}
