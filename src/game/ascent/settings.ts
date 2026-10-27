// The player's settings (docs/ASCENT.md, "Settings"): how fast the camera turns, whether looking up and down is inverted, and
// reduced motion. Kept in the browser (localStorage `r7-ascent-settings`, beside the save); every read and write is wrapped in
// try/catch, and the game works the same without storage. The parsing is pure (unit-tested): anything unknown or out of range
// falls back to the default, so an old or hand-edited value never breaks the game.

export type MotionSetting = 'system' | 'reduce' | 'full';

export interface AscentSettings {
  /** Look speed, as a multiple of config.camera.sensitivity (and of the touch look). */
  sensitivity: number;
  /** Moving the mouse (or a finger) up looks down. */
  invertY: boolean;
  /** Reduced motion: as the system asks, always, or never. */
  motion: MotionSetting;
}

export const SETTINGS_KEY = 'r7-ascent-settings';
export const SENSITIVITY_RANGE = { min: 0.4, max: 2.5, step: 0.1 } as const;
export const DEFAULT_SETTINGS: AscentSettings = { sensitivity: 1, invertY: false, motion: 'system' };

const MOTIONS: readonly MotionSetting[] = ['system', 'reduce', 'full'];

/** Settings from a stored value; anything missing, unknown or out of range is the default. */
export function parseSettings(raw: unknown): AscentSettings {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.sensitivity === 'number' && Number.isFinite(r.sensitivity)) {
    out.sensitivity = Math.min(SENSITIVITY_RANGE.max, Math.max(SENSITIVITY_RANGE.min, r.sensitivity));
  }
  if (typeof r.invertY === 'boolean') out.invertY = r.invertY;
  if (typeof r.motion === 'string' && (MOTIONS as readonly string[]).includes(r.motion)) {
    out.motion = r.motion as MotionSetting;
  }
  return out;
}

/** Whether to reduce motion: the setting, or the system's when the setting follows it. */
export const reducesMotion = (settings: AscentSettings, systemReduces: boolean): boolean =>
  settings.motion === 'system' ? systemReduces : settings.motion === 'reduce';

/** The browser's localStorage, or null where it cannot be used (blocked, private window, no window). */
export function storage(win: Window | null | undefined): Storage | null {
  try {
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(store: Storage | null): AscentSettings {
  try {
    const text = store?.getItem(SETTINGS_KEY);
    return parseSettings(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(store: Storage | null, settings: AscentSettings): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // full or blocked: the settings last until the page is closed
  }
}
