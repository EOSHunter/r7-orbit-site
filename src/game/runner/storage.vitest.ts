import { describe, expect, it } from 'vitest';
import { BEST_KEY, loadBest, saveBest } from './storage';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('best score', () => {
  it('saves under r7-runner-best and only when it is beaten', () => {
    const store = memory();
    expect(BEST_KEY).toBe('r7-runner-best');
    expect(loadBest(() => store)).toBe(0);
    expect(saveBest(420.9, () => store)).toBe(420);
    expect(store.data.get(BEST_KEY)).toBe('420');
    expect(saveBest(100, () => store)).toBe(420);
    expect(store.data.get(BEST_KEY)).toBe('420');
    expect(saveBest(3850, () => store)).toBe(3850);
    expect(loadBest(() => store)).toBe(3850);
  });

  it('reads junk as no best', () => {
    for (const junk of ['', 'abc', '-5', 'NaN', 'Infinity']) {
      expect(loadBest(() => memory({ [BEST_KEY]: junk }))).toBe(0);
    }
  });

  it('never throws when storage is missing or throws (private mode, blocked storage, full quota)', () => {
    const throwingAccess = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    expect(loadBest(throwingAccess)).toBe(0);
    expect(saveBest(50, throwingAccess)).toBe(50);

    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };
    expect(loadBest(() => throwing)).toBe(0);
    expect(saveBest(77, () => throwing)).toBe(77);
    expect(loadBest(() => null)).toBe(0);
    expect(saveBest(12, () => null)).toBe(12);
  });

  it('the default (globalThis.localStorage) is safe where there is none, as in Node', () => {
    expect(() => loadBest()).not.toThrow();
    expect(() => saveBest(1)).not.toThrow();
  });
});
