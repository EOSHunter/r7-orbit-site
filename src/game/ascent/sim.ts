// AscentSim: the agent's movement, one fixed step at a time (docs/ASCENT.md, "Code"). Pure: no three.js, no DOM, no clock of
// its own. The host tells it where the player is steering (a world-space direction, already turned by the camera), when Space
// goes down and up, and calls step() a fixed number of times per frame (clock.ts). The view only reads it.
//
// The jump is built to feel fair (docs/ASCENT.md, "Features"):
// - coyote time: a jump pressed shortly after walking off an edge still jumps;
// - jump buffering: a jump pressed shortly before landing happens on landing;
// - variable height: letting go of Space while rising cuts the jump short; holding it gives the full height;
// - a heavier fall than rise, so the arc lands where the eye expects.
// Falling below config.killY puts the agent back at the start. Hardcore by default; in assist mode (setAssist), touching a
// beacon makes it the checkpoint, and a fall of config.assist.drop below it, or off the world, puts the agent back on it.
//
// The climb's moving parts (docs/ASCENT.md, "Phase 3"), all driven by the sim's own time so a restart or a saved climb puts
// them back exactly:
// - fans: an updraft over a fan box pushes the agent up (config.fan caps the speed);
// - drifting boxes go to their offset and back, easing at each end; one carries the agent standing on it, and pushes it
//   aside rather than through it;
// - crumbling boxes break a moment after the agent first stands on them, and come back a few seconds later;
// - the goal ring: touching it finishes the climb, and the clock stops.
// A climb can grow while it is played (setLevel): zones load as the agent nears them, each added on top of the boxes before.

import { ASCENT_CONFIG, jumpPhysics, type AscentConfig } from './config';
import { agentBox, groundBelow, moveAgent, overlaps, type Box, type Vec3 } from './collision';
import type { Level } from './level';

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** A crumbling box's state: when the agent first stood on it, and when it broke (sim seconds), or null. */
export interface CrumbleState {
  touched: number | null;
  broke: number | null;
}

/** How far a drift has gone at time t: 0 at its start, 1 at its far end, easing at both. */
export const driftAt = (t: number, period: number) => (1 - Math.cos((2 * Math.PI * t) / period)) / 2;

/** Distance from p to the ring's tube (0 on the circle through its middle). */
export function ringDistance(p: Vec3, ring: NonNullable<Level['ring']>): number {
  const { x, y, z, w } = ring.rotation;
  // p moved into the ring's own frame: turned back by the conjugate of its rotation.
  const v = { x: p.x - ring.centre.x, y: p.y - ring.centre.y, z: p.z - ring.centre.z };
  const qx = -x;
  const qy = -y;
  const qz = -z;
  const cx = qy * v.z - qz * v.y;
  const cy = qz * v.x - qx * v.z;
  const cz = qx * v.y - qy * v.x;
  const lx = v.x + 2 * (w * cx + qy * cz - qz * cy);
  const ly = v.y + 2 * (w * cy + qz * cx - qx * cz);
  const lz = v.z + 2 * (w * cz + qx * cy - qy * cx);
  return Math.hypot(Math.hypot(lx, lz) - ring.radius, ly);
}

export class AscentSim {
  readonly cfg: AscentConfig;
  level: Level;
  /** The solids where they are now (drifting boxes move); the level's own boxes are where they start. */
  readonly solids: Box[] = [];
  /** The solids the agent can touch now: every one but the broken crumbling boxes. */
  private active: Box[] = [];
  /** Per crumbling box (level.crumbles), in the same order. */
  readonly crumbles: CrumbleState[] = [];
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
  /** Assist mode now; whether it was on at any time this climb (the finish says so); the beacon to return to. */
  assist = false;
  assisted = false;
  checkpoint: number | null = null;
  /** In an updraft this step (the view shows it). */
  lifted = false;
  /** The ring was touched: the climb is over, and time stands still. */
  finished = false;
  private move = { x: 0, z: 0 };

  constructor(level: Level, cfg: AscentConfig = ASCENT_CONFIG) {
    this.cfg = cfg;
    this.level = level;
    this.physics = jumpPhysics(cfg);
    this.half = cfg.agent.width / 2;
    this.pos = { ...level.spawn };
    this.prev = { ...level.spawn };
    this.yaw = this.prevYaw = level.spawnYaw;
    this.setLevel(level);
  }

  /**
   * A bigger level (the same boxes first, more on top: a zone of the climb has loaded). The boxes already there keep their
   * state; the new ones start where the level puts them for the time now.
   */
  setLevel(level: Level): void {
    this.level = level;
    for (let i = this.solids.length; i < level.boxes.length; i++) {
      const b = level.boxes[i];
      this.solids.push({ min: { ...b.min }, max: { ...b.max } });
    }
    for (let i = this.crumbles.length; i < (level.crumbles?.length ?? 0); i++) {
      this.crumbles.push({ touched: null, broke: null });
    }
    this.placeMovers();
    this.refreshActive();
  }

  /** The agent's feet, in metres above the ground at the start. */
  get altitude(): number {
    return this.pos.y - this.level.spawn.y;
  }

  /** The solids the agent can touch now (the camera keeps out of them too). */
  get boxes(): readonly Box[] {
    return this.active;
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

  /** Assist mode on or off. Turning it on marks the climb as assisted. */
  setAssist(on: boolean): void {
    this.assist = on;
    if (on) this.assisted = true;
  }

  /** Back to the start: position, speed, time and the best height; the checkpoint is forgotten, the climb not finished. */
  restart(): void {
    this.checkpoint = null;
    this.assisted = this.assist;
    this.finished = false;
    this.time = 0;
    this.resetParts();
    this.respawn();
    this.best = 0;
    this.falls = 0;
    this.jumps = 0;
    this.landings = 0;
  }

  /** Exactly one fixed step. Nothing moves once the climb is finished. */
  step(): void {
    if (this.finished) return;
    const dt = this.cfg.step;
    const { move, jump } = this.cfg;
    this.prev = { ...this.pos };
    this.prevYaw = this.yaw;
    this.time += dt;

    // The drifting boxes move first, carrying the agent that stands on one, and pushing it aside if one runs into it.
    this.driftParts();
    this.updateCrumbles();

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

    // An updraft over a fan pushes up, to a top speed.
    this.lifted = false;
    for (const f of this.level.fans ?? []) {
      const b = this.solids[f.box];
      if (this.pos.x < b.min.x || this.pos.x > b.max.x || this.pos.z < b.min.z || this.pos.z > b.max.z) continue;
      if (this.pos.y < b.max.y - 0.05 || this.pos.y > b.max.y + f.height) continue;
      this.vel.y = Math.min(this.vel.y + f.strength * dt, this.cfg.fan.maxRise);
      this.rising = false; // not a jump: letting go of Space does not cut it
      this.lifted = true;
      break;
    }

    const r = moveAgent(
      this.pos,
      { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt },
      this.half,
      this.cfg.agent.height,
      this.active,
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

    if (this.grounded) {
      this.touchBeacons();
      this.touchCrumbles();
    }
    const back = this.assist && this.checkpoint !== null ? this.level.beacons[this.checkpoint] : null;
    if (this.pos.y < this.cfg.killY || (back && this.pos.y < back.y - this.cfg.assist.drop)) {
      this.falls++;
      this.respawn();
    }
    if (this.grounded) this.best = Math.max(this.best, this.altitude);
    if (this.level.ring && this.touchesRing()) this.finished = true;
  }

  /** A climb in progress, put back as it was saved (save.ts); the camera snaps to it. */
  restore(s: {
    pos: Vec3;
    yaw: number;
    time: number;
    best: number;
    falls: number;
    jumps: number;
    assist: boolean;
    assisted: boolean;
    checkpoint: number | null;
  }): void {
    this.pos = { ...s.pos };
    this.prev = { ...s.pos };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = this.prevYaw = s.yaw;
    this.time = s.time;
    this.best = s.best;
    this.falls = s.falls;
    this.jumps = s.jumps;
    this.assist = s.assist;
    this.assisted = s.assisted;
    this.checkpoint = s.checkpoint !== null && s.checkpoint < this.level.beacons.length ? s.checkpoint : null;
    this.finished = false;
    this.grounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.rising = false;
    this.resetParts();
    this.teleports++;
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
    return groundBelow(p, this.half, this.active);
  }

  /** Whether the agent stands on solids[i] now (its feet on the top, its footprint over it). */
  private standsOn(i: number): boolean {
    const b = this.solids[i];
    const h = this.half;
    return (
      this.grounded &&
      Math.abs(this.pos.y - b.max.y) < 0.002 &&
      this.pos.x + h > b.min.x &&
      this.pos.x - h < b.max.x &&
      this.pos.z + h > b.min.z &&
      this.pos.z - h < b.max.z
    );
  }

  /** Every drifting box where its drift puts it at the time now (no carrying: a restart or a restore). */
  private placeMovers(): void {
    for (const m of this.level.movers ?? []) {
      const rest = this.level.boxes[m.box];
      const s = driftAt(this.time, m.period);
      const b = this.solids[m.box];
      b.min = { x: rest.min.x + m.offset.x * s, y: rest.min.y + m.offset.y * s, z: rest.min.z + m.offset.z * s };
      b.max = { x: rest.max.x + m.offset.x * s, y: rest.max.y + m.offset.y * s, z: rest.max.z + m.offset.z * s };
    }
  }

  private driftParts(): void {
    const movers = this.level.movers;
    if (!movers?.length) return;
    let carry: Vec3 | null = null;
    const riding = movers.map((m) => this.standsOn(m.box));
    for (let k = 0; k < movers.length; k++) {
      const m = movers[k];
      const b = this.solids[m.box];
      const before = { ...b.min };
      const rest = this.level.boxes[m.box];
      const s = driftAt(this.time, m.period);
      const d = {
        x: rest.min.x + m.offset.x * s - before.x,
        y: rest.min.y + m.offset.y * s - before.y,
        z: rest.min.z + m.offset.z * s - before.z,
      };
      b.min = { x: b.min.x + d.x, y: b.min.y + d.y, z: b.min.z + d.z };
      b.max = { x: b.max.x + d.x, y: b.max.y + d.y, z: b.max.z + d.z };
      if (riding[k] && !carry) carry = d;
    }
    if (carry) {
      // Carried with the box it stands on (an upward drift lifts it: its feet stay on the top).
      const r = moveAgent(this.pos, { x: carry.x, y: 0, z: carry.z }, this.half, this.cfg.agent.height, this.active);
      this.pos = { ...r.pos, y: r.pos.y + carry.y };
    }
    // A box that drifted into the agent pushes it out the shortest way across.
    for (const m of movers) {
      const b = this.solids[m.box];
      const a = agentBox(this.pos, this.half, this.cfg.agent.height);
      if (!overlaps(a, b)) continue;
      const pushes = [
        { x: b.max.x - a.min.x, z: 0 },
        { x: b.min.x - a.max.x, z: 0 },
        { x: 0, z: b.max.z - a.min.z },
        { x: 0, z: b.min.z - a.max.z },
      ];
      pushes.sort((p, q) => Math.abs(p.x + p.z) - Math.abs(q.x + q.z));
      const p = pushes[0];
      this.pos = {
        x: this.pos.x + p.x + Math.sign(p.x) * 1e-4,
        y: this.pos.y,
        z: this.pos.z + p.z + Math.sign(p.z) * 1e-4,
      };
    }
  }

  /** Crumbling boxes the agent stands on start to break. */
  private touchCrumbles(): void {
    const list = this.level.crumbles ?? [];
    for (let i = 0; i < list.length; i++) {
      const state = this.crumbles[i];
      if (state.touched === null && state.broke === null && this.standsOn(list[i].box)) state.touched = this.time;
    }
  }

  /** Break the ones whose time has come; put back the ones broken long enough ago (unless the agent is in the way). */
  private updateCrumbles(): void {
    const list = this.level.crumbles ?? [];
    let changed = false;
    for (let i = 0; i < list.length; i++) {
      const state = this.crumbles[i];
      if (state.broke === null && state.touched !== null && this.time - state.touched >= list[i].delay) {
        state.broke = this.time;
        state.touched = null;
        changed = true;
      } else if (state.broke !== null && this.time - state.broke >= this.cfg.crumble.back) {
        const a = agentBox(this.pos, this.half, this.cfg.agent.height);
        if (overlaps(a, this.solids[list[i].box])) continue;
        state.broke = null;
        changed = true;
      }
    }
    if (changed) this.refreshActive();
  }

  private refreshActive(): void {
    const broken = new Set<number>();
    const list = this.level.crumbles ?? [];
    for (let i = 0; i < list.length; i++) if (this.crumbles[i].broke !== null) broken.add(list[i].box);
    this.active = broken.size ? this.solids.filter((_, i) => !broken.has(i)) : this.solids;
  }

  /** Every crumbling box whole and every drift where the time puts it. */
  private resetParts(): void {
    for (const c of this.crumbles) c.touched = c.broke = null;
    this.placeMovers();
    this.refreshActive();
  }

  /** Whether any part of the agent (its feet, middle and head) is within its reach of the ring's tube. */
  private touchesRing(): boolean {
    const ring = this.level.ring;
    if (!ring) return false;
    const h = this.cfg.agent.height;
    const reach = ring.tube + this.cfg.finish.reach;
    for (const f of [0.1, 0.5, 0.9]) {
      if (ringDistance({ x: this.pos.x, y: this.pos.y + h * f, z: this.pos.z }, ring) <= reach) return true;
    }
    return false;
  }

  /** Standing at a beacon makes it the checkpoint (the last one touched counts, in assist mode or not). */
  private touchBeacons(): void {
    const { radius, height } = this.cfg.assist;
    const beacons = this.level.beacons;
    for (let i = 0; i < beacons.length; i++) {
      const b = beacons[i];
      if (Math.abs(this.pos.y - b.y) > height) continue;
      if (Math.hypot(this.pos.x - b.x, this.pos.z - b.z) <= radius) {
        this.checkpoint = i;
        return;
      }
    }
  }

  private respawn(): void {
    const back = this.assist && this.checkpoint !== null ? this.level.beacons[this.checkpoint] : null;
    const at = back ?? this.level.spawn;
    this.pos = { ...at };
    this.prev = { ...at };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = this.prevYaw = back ? this.yaw : this.level.spawnYaw;
    this.grounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.rising = false;
    this.teleports++;
  }
}
