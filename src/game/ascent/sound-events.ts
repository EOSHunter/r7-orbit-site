// What the game should sound like this frame, worked out from the sim (docs/ASCENT.md, "Sound"): the one-off sounds (a jump,
// a landing and how hard it was, a footstep, a fall back to the start or a beacon, a beacon touched, a panel starting to
// creak and breaking, the finish) and how much of each zone's ambience plays at the agent's height. Pure: no Web Audio, no
// DOM. audio.ts plays what this says.

import type { LevelZone } from './level';

/** What the sound reads from the sim each frame. */
export interface SoundSnapshot {
  grounded: boolean;
  /** Speed across the ground (m/s) and up (m/s; negative falling). */
  speed: number;
  vy: number;
  /** The sim's counters: a change is a take-off, a landing, a respawn. */
  jumps: number;
  landings: number;
  teleports: number;
  /** The beacon to return to (assist mode), or null. */
  checkpoint: number | null;
  /** In an updraft over a fan. */
  lifted: boolean;
  /** How many crumbling panels are waiting to break, and how many are broken. */
  shaking: number;
  broken: number;
  finished: boolean;
}

export type SoundEvent =
  | { kind: 'jump' }
  /** strength: 0 (a step down) to 1 (the hardest landing). */
  | { kind: 'land'; strength: number }
  /** foot: 0 or 1, so the steps alternate. */
  | { kind: 'step'; foot: 0 | 1 }
  | { kind: 'respawn' }
  | { kind: 'checkpoint' }
  | { kind: 'creak' }
  | { kind: 'crumble' }
  | { kind: 'lift' }
  | { kind: 'finish' };

/** Metres between footsteps (half the animation's stride), the slowest speed that steps, the fall speed that is hardest. */
export const STEP_EVERY = 0.85;
export const STEP_SPEED = 0.6;
export const HARD_LANDING = 16;

export class SoundTracker {
  private last: SoundSnapshot | null = null;
  private walked = 0;
  private foot: 0 | 1 = 0;
  private airVy = 0;

  /** This frame's sounds, `dt` seconds after the last frame. The first frame only takes note. */
  update(s: SoundSnapshot, dt: number): SoundEvent[] {
    const out: SoundEvent[] = [];
    const last = this.last;
    this.last = { ...s };
    if (!last) return out;
    if (s.teleports !== last.teleports) {
      // A respawn is the only sound: it is not a landing or a step.
      this.walked = 0;
      out.push({ kind: 'respawn' });
      return out;
    }
    if (s.finished && !last.finished) out.push({ kind: 'finish' });
    if (s.jumps > last.jumps) out.push({ kind: 'jump' });
    if (s.landings > last.landings) {
      const strength = Math.min(1, Math.max(0, -this.airVy / HARD_LANDING));
      out.push({ kind: 'land', strength });
      this.walked = 0;
    }
    if (!s.grounded) this.airVy = s.vy;
    if (s.checkpoint !== null && s.checkpoint !== last.checkpoint) out.push({ kind: 'checkpoint' });
    if (s.shaking > last.shaking) out.push({ kind: 'creak' });
    if (s.broken > last.broken) out.push({ kind: 'crumble' });
    if (s.lifted && !last.lifted) out.push({ kind: 'lift' });
    if (s.grounded && s.speed > STEP_SPEED) {
      this.walked += s.speed * Math.max(0, Math.min(dt, 0.1));
      if (this.walked >= STEP_EVERY) {
        this.walked -= STEP_EVERY;
        out.push({ kind: 'step', foot: this.foot });
        this.foot = this.foot ? 0 : 1;
      }
    }
    return out;
  }

  /** Forget the last frame (after a pause): the next frame only takes note. */
  reset(): void {
    this.last = null;
    this.walked = 0;
  }
}

/** Metres over which one zone's ambience fades into the next's, either side of where the zone starts. */
export const AMBIENCE_FADE = 12;

/**
 * How much of each zone's ambience plays at height `y`: one weight per zone (bottom up), 0 to 1, summing to 1. Inside a zone
 * it is that zone's alone; within AMBIENCE_FADE of the line between two zones, the two are mixed.
 */
export function ambienceMix(y: number, zones: readonly Pick<LevelZone, 'base'>[]): number[] {
  const weights = zones.map(() => 0);
  if (!zones.length) return weights;
  let i = 0;
  for (let k = 0; k < zones.length; k++) if (y >= zones[k].base) i = k;
  weights[i] = 1;
  // Near the next zone's start (below or above it), share with it.
  const next = zones[i + 1];
  if (next && y > next.base - AMBIENCE_FADE) {
    const t = (y - (next.base - AMBIENCE_FADE)) / (2 * AMBIENCE_FADE);
    weights[i] = 1 - t;
    weights[i + 1] = t;
  } else if (i > 0 && y < zones[i].base + AMBIENCE_FADE) {
    const t = (y - (zones[i].base - AMBIENCE_FADE)) / (2 * AMBIENCE_FADE);
    weights[i - 1] = 1 - t;
    weights[i] = t;
  }
  return weights;
}
