// Save and resume (docs/ASCENT.md, "Save and resume"): the climb in progress is kept in the browser when the player pauses,
// leaves or hides the tab, and offered back when they return. localStorage `r7-ascent-save`, beside the runner's
// `r7-runner-best`; every read and write in try/catch, and the game works the same without storage. Pure apart from the two
// storage calls: the format is versioned and checked field by field, so a save from an older build, another level or a
// hand edit is ignored rather than trusted.

import type { Vec3 } from './collision';

export const SAVE_KEY = 'r7-ascent-save';
export const SAVE_VERSION = 1;

export interface AscentSave {
  v: typeof SAVE_VERSION;
  /** Which level it belongs to (a save never moves to another level). */
  level: string;
  /** The agent's feet and the way it faces. */
  pos: Vec3;
  yaw: number;
  /** Seconds climbed, the highest it stood, falls and jumps. */
  time: number;
  best: number;
  falls: number;
  jumps: number;
  /** Assist mode, and the beacon it returns to (its number), if one was touched. */
  assist: boolean;
  /** Ever played in assist mode this climb (marked on the finish). */
  assisted: boolean;
  checkpoint: number | null;
  /** When it was saved (ms since 1970). */
  savedAt: number;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const vec = (v: unknown): v is Vec3 =>
  !!v && typeof v === 'object' && finite((v as Vec3).x) && finite((v as Vec3).y) && finite((v as Vec3).z);

/** A save from a stored value, or null when it is not a whole, current save for `level`. */
export function parseSave(raw: unknown, level: string): AscentSave | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== SAVE_VERSION || r.level !== level) return null;
  if (!vec(r.pos) || !finite(r.yaw) || !finite(r.time) || !finite(r.best) || !finite(r.savedAt)) return null;
  if (!finite(r.falls) || !finite(r.jumps) || typeof r.assist !== 'boolean' || typeof r.assisted !== 'boolean') {
    return null;
  }
  if (!(r.checkpoint === null || (finite(r.checkpoint) && Number.isInteger(r.checkpoint)))) return null;
  if (r.time < 0 || r.falls < 0 || r.jumps < 0) return null;
  return {
    v: SAVE_VERSION,
    level,
    pos: { x: r.pos.x, y: r.pos.y, z: r.pos.z },
    yaw: r.yaw,
    time: r.time,
    best: Math.max(0, r.best),
    falls: Math.floor(r.falls),
    jumps: Math.floor(r.jumps),
    assist: r.assist,
    assisted: r.assisted,
    checkpoint: r.checkpoint as number | null,
    savedAt: r.savedAt,
  };
}

export function loadSave(store: Storage | null, level: string): AscentSave | null {
  try {
    const text = store?.getItem(SAVE_KEY);
    return text ? parseSave(JSON.parse(text), level) : null;
  } catch {
    return null;
  }
}

export function writeSave(store: Storage | null, save: AscentSave): void {
  try {
    store?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // full or blocked: the climb is not kept
  }
}

export function clearSave(store: Storage | null): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    // nothing to do
  }
}

/** A climb's time as m:ss (or h:mm:ss past an hour), for the HUD and the finish. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
