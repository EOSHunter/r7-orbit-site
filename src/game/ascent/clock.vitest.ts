import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './clock';
import { ASCENT_CONFIG } from './config';

const step = ASCENT_CONFIG.step;

describe('FixedStepClock', () => {
  it('the first frame only sets the clock', () => {
    expect(new FixedStepClock().advance(1000)).toEqual({ steps: 0, alpha: 0, delta: 0 });
  });

  it('runs the same number of steps per second at 60 Hz and at 144 Hz', () => {
    for (const hz of [60, 144]) {
      const clock = new FixedStepClock();
      let total = 0;
      for (let i = 0; i <= hz; i++) total += clock.advance((i * 1000) / hz).steps;
      expect(Math.abs(total - 1 / step)).toBeLessThanOrEqual(1);
    }
  });

  it('a stall counts as maxFrameDelta at most, and never more than maxStepsPerFrame steps', () => {
    const clock = new FixedStepClock();
    clock.advance(0);
    const tick = clock.advance(5000);
    expect(tick.delta).toBe(ASCENT_CONFIG.maxFrameDelta);
    expect(tick.steps).toBe(ASCENT_CONFIG.maxStepsPerFrame);
  });

  it('reset() forgets the last frame', () => {
    const clock = new FixedStepClock();
    clock.advance(0);
    clock.reset();
    expect(clock.advance(50).steps).toBe(0);
  });
});
