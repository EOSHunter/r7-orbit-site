import { describe, expect, it } from 'vitest';
import { shouldPrefetch, startsRun, useTouchWords } from './runner-stage';

describe('useTouchWords', () => {
  it('uses the touch words on a coarse pointer, or when a touch woke the stage', () => {
    expect(useTouchWords(true)).toBe(true);
    expect(useTouchWords(false, 'touch')).toBe(true);
    expect(useTouchWords(true, 'mouse')).toBe(true);
  });

  it('keeps the keyboard words for a mouse, a pen on a fine pointer and a key press', () => {
    expect(useTouchWords(false)).toBe(false);
    expect(useTouchWords(false, 'mouse')).toBe(false);
    expect(useTouchWords(false, '')).toBe(false);
  });
});

describe('shouldPrefetch', () => {
  it('prefetches when the stage is near and the connection says nothing', () => {
    expect(shouldPrefetch({ nearViewport: true })).toBe(true);
    expect(shouldPrefetch({ nearViewport: true, connection: null })).toBe(true);
    expect(shouldPrefetch({ nearViewport: true, connection: {} })).toBe(true);
    expect(shouldPrefetch({ nearViewport: true, connection: { saveData: false, effectiveType: '4g' } })).toBe(true);
  });

  it('never prefetches when the stage is far from the viewport', () => {
    expect(shouldPrefetch({ nearViewport: false })).toBe(false);
    expect(shouldPrefetch({ nearViewport: false, connection: { saveData: false, effectiveType: '4g' } })).toBe(false);
  });

  it('respects data-saver and slow connections', () => {
    expect(shouldPrefetch({ nearViewport: true, connection: { saveData: true } })).toBe(false);
    expect(shouldPrefetch({ nearViewport: true, connection: { saveData: true, effectiveType: '4g' } })).toBe(false);
    expect(shouldPrefetch({ nearViewport: true, connection: { effectiveType: '2g' } })).toBe(false);
    expect(shouldPrefetch({ nearViewport: true, connection: { effectiveType: 'slow-2g' } })).toBe(false);
    expect(shouldPrefetch({ nearViewport: true, connection: { effectiveType: '3g' } })).toBe(true);
  });
});

describe('startsRun', () => {
  it('starts a run on a click, a tap and Space, and stops on the idle scene after Enter', () => {
    expect(startsRun(null)).toBe(true);
    expect(startsRun(' ')).toBe(true);
    expect(startsRun('Enter')).toBe(false);
  });
});
