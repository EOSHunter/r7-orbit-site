// The third-person camera as pure maths: an orbit round a look point above the agent. The mouse (or Q and E) turns it; it
// follows the agent with a little smoothing, softer up and down so a jump does not bounce the view; and it comes in front of
// any block that would hide the agent, then eases back out. The view copies `position` and `target` into three.js; the host
// reads `yaw` to turn the movement keys, so "forward" is always away from the camera.
//
// Angles: yaw is about +Y (0 puts the camera on the +Z side, looking towards -Z); pitch is the camera's angle above the look
// point (negative is below it, looking up).

import { ASCENT_CONFIG, type AscentConfig } from './config';
import { raycast, type Box, type Vec3 } from './collision';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** The share of the way to close in `dt` seconds with time constant `tau` (frame-rate independent smoothing). */
const ease = (dt: number, tau: number) => (tau <= 0 ? 1 : 1 - Math.exp(-dt / tau));

export class OrbitCamera {
  readonly cfg: AscentConfig;
  yaw: number;
  pitch: number;
  /** The distance now (shorter than config while a block is in the way). */
  distance: number;
  /** The look point (smoothed) and the camera's position. */
  target: Vec3 = { x: 0, y: 0, z: 0 };
  position: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(yaw = 0, cfg: AscentConfig = ASCENT_CONFIG) {
    this.cfg = cfg;
    this.yaw = yaw;
    this.pitch = cfg.camera.pitch.start;
    this.distance = cfg.camera.distance;
  }

  /** The mouse moved (CSS pixels): right turns the view right, up looks up. */
  look(dx: number, dy: number): void {
    const { sensitivity, pitch } = this.cfg.camera;
    this.yaw = Math.atan2(Math.sin(this.yaw - dx * sensitivity), Math.cos(this.yaw - dx * sensitivity));
    this.pitch = clamp(this.pitch + dy * sensitivity, pitch.min, pitch.max);
  }

  /** Q and E: +1 turns the view left, -1 right, for `dt` seconds. */
  turn(direction: number, dt: number): void {
    if (!direction) return;
    const a = this.yaw + direction * this.cfg.camera.keyTurnRate * dt;
    this.yaw = Math.atan2(Math.sin(a), Math.cos(a));
  }

  /** The unit vector from the look point to the camera. */
  offsetDirection(): Vec3 {
    const c = Math.cos(this.pitch);
    return { x: Math.sin(this.yaw) * c, y: Math.sin(this.pitch), z: Math.cos(this.yaw) * c };
  }

  /** Jump to the agent at `feet` with no smoothing (the first frame, a respawn). */
  snap(feet: Vec3, solids: readonly Box[] = []): void {
    this.target = { x: feet.x, y: feet.y + this.cfg.camera.lookHeight, z: feet.z };
    this.distance = this.clearDistance(solids);
    this.place();
  }

  /** Follow the agent at `feet` for `dt` real seconds, keeping clear of `solids`. */
  update(feet: Vec3, dt: number, solids: readonly Box[]): void {
    const { lookHeight, follow, easeOut } = this.cfg.camera;
    const kh = ease(dt, follow.horizontal);
    const kv = ease(dt, follow.vertical);
    this.target = {
      x: this.target.x + (feet.x - this.target.x) * kh,
      y: this.target.y + (feet.y + lookHeight - this.target.y) * kv,
      z: this.target.z + (feet.z - this.target.z) * kh,
    };
    const clear = this.clearDistance(solids);
    // In at once (never show the inside of a block), out gently (no jolt when the way clears).
    this.distance = clear < this.distance ? clear : this.distance + (clear - this.distance) * ease(dt, easeOut);
    this.place();
  }

  /** How far back the camera can sit before a block is in the way. */
  private clearDistance(solids: readonly Box[]): number {
    const { distance, minDistance, padding } = this.cfg.camera;
    const hit = raycast(this.target, this.offsetDirection(), distance + padding, solids);
    return hit === null ? distance : clamp(hit - padding, minDistance, distance);
  }

  private place(): void {
    const d = this.offsetDirection();
    this.position = {
      x: this.target.x + d.x * this.distance,
      y: this.target.y + d.y * this.distance,
      z: this.target.z + d.z * this.distance,
    };
  }
}
