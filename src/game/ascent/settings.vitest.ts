// The player's settings (settings.ts) and the saved climb (save.ts): what a stored value may hold, what is thrown away, and
// that storage failing never breaks the game. The stick's maths (touch.ts) is here too: all three are small and pure.
import { describe, expect, it } from 'vitest';
import { SAVE_KEY, clearSave, formatTime, loadSave, parseSave, writeSave, type AscentSave } from './save';
import {
  DEFAULT_SETTINGS,
  SENSITIVITY_RANGE,
  SETTINGS_KEY,
  loadSettings,
  parseSettings,
  reducesMotion,
  saveSettings,
} from './settings';
import { STICK, stickVector } from './touch';

/** A Storage in memory, or one whose every call throws (blocked storage). */
function memory(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}
const broken = new Proxy({} as Storage, {
  get: () => () => {
    throw new Error('blocked');
  },
});

describe('settings', () => {
  it('keeps what is valid and puts the default in place of anything else', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ sensitivity: 1.5, invertY: true, motion: 'reduce', volume: 0.3, muted: true })).toEqual({
      sensitivity: 1.5,
      invertY: true,
      motion: 'reduce',
      volume: 0.3,
      muted: true,
    });
    expect(parseSettings({ sensitivity: 99, invertY: 'yes', motion: 'wild', volume: 7, muted: 'no' })).toEqual({
      ...DEFAULT_SETTINGS,
      sensitivity: SENSITIVITY_RANGE.max,
      volume: 1,
    });
    expect(parseSettings({ sensitivity: Number.NaN }).sensitivity).toBe(DEFAULT_SETTINGS.sensitivity);
  });

  it('reduces motion as the system asks, unless set otherwise', () => {
    expect(reducesMotion({ ...DEFAULT_SETTINGS, motion: 'system' }, true)).toBe(true);
    expect(reducesMotion({ ...DEFAULT_SETTINGS, motion: 'system' }, false)).toBe(false);
    expect(reducesMotion({ ...DEFAULT_SETTINGS, motion: 'full' }, true)).toBe(false);
    expect(reducesMotion({ ...DEFAULT_SETTINGS, motion: 'reduce' }, false)).toBe(true);
  });

  it('round-trips through storage, and falls back to the defaults when storage fails', () => {
    const store = memory();
    saveSettings(store, { ...DEFAULT_SETTINGS, sensitivity: 0.8, invertY: true, motion: 'full' });
    expect(JSON.parse(store.getItem(SETTINGS_KEY) ?? '')).toMatchObject({
      sensitivity: 0.8,
      invertY: true,
      motion: 'full',
    });
    expect(loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, sensitivity: 0.8, invertY: true, motion: 'full' });
    store.setItem(SETTINGS_KEY, '{not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(broken, DEFAULT_SETTINGS)).not.toThrow();
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('the saved climb', () => {
  const save: AscentSave = {
    v: 1,
    level: 'climb',
    pos: { x: 1, y: 42.5, z: -3 },
    yaw: 0.4,
    time: 312.5,
    best: 44,
    falls: 3,
    jumps: 80,
    assist: false,
    assisted: true,
    checkpoint: 2,
    savedAt: 1_800_000_000_000,
  };

  it('round-trips, for its own level only', () => {
    const store = memory();
    writeSave(store, save);
    expect(loadSave(store, 'climb')).toEqual(save);
    expect(loadSave(store, 'another level')).toBeNull();
    clearSave(store);
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });

  it('throws away an old version, a missing or broken field, or a negative count', () => {
    expect(parseSave({ ...save, v: 0 }, 'climb')).toBeNull();
    expect(parseSave({ ...save, pos: { x: 1, y: 'high', z: 0 } }, 'climb')).toBeNull();
    expect(parseSave({ ...save, time: undefined }, 'climb')).toBeNull();
    expect(parseSave({ ...save, falls: -1 }, 'climb')).toBeNull();
    expect(parseSave({ ...save, checkpoint: 1.5 }, 'climb')).toBeNull();
    expect(parseSave({ ...save, checkpoint: null }, 'climb')?.checkpoint).toBeNull();
    expect(parseSave('nonsense', 'climb')).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    expect(loadSave(broken, 'climb')).toBeNull();
    expect(() => writeSave(broken, save)).not.toThrow();
    expect(() => clearSave(broken)).not.toThrow();
  });

  it('writes a time as m:ss, and h:mm:ss past an hour', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(14 * 60 + 32)).toBe('14:32');
    expect(formatTime(3600 + 62)).toBe('1:01:02');
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('stickVector', () => {
  it('rests inside the dead zone, reaches full speed at the radius, and never more', () => {
    expect(stickVector(STICK.radius * STICK.dead * 0.9, 0)).toEqual({ x: 0, y: 0 });
    expect(stickVector(STICK.radius, 0).x).toBeCloseTo(1, 9);
    const far = stickVector(0, -STICK.radius * 3);
    expect(far.y).toBeCloseTo(1, 9);
    expect(far.x).toBeCloseTo(0, 9);
  });

  it('a thumb pushed up is forward, down is back, and a small push is slow', () => {
    expect(stickVector(0, -40).y).toBeGreaterThan(0);
    expect(stickVector(0, 40).y).toBeLessThan(0);
    const small = stickVector(0, -STICK.radius * 0.4);
    expect(small.y).toBeGreaterThan(0);
    expect(small.y).toBeLessThan(0.5);
  });
});
