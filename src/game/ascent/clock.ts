// Frame time to simulation steps: a fixed step with an accumulator, as the runner's clock (src/game/runner/clock.ts,
// docs/RUNNER.md "Frame rate"). It keeps the game the same on a 30 Hz laptop, a 60 Hz phone and a 240 Hz monitor. Its own
// copy, so the two games never share a chunk. Pure: it is given rAF timestamps (milliseconds).

import { ASCENT_CONFIG, type AscentConfig } from './config';

export interface Tick {
  /** Fixed steps to run this frame (0 to maxStepsPerFrame). */
  steps: number;
  /** How far the display is past the last step, 0 to 1: the view interpolates by this. */
  alpha: number;
  /** Real seconds since the last frame (clamped to maxFrameDelta): for the camera, which is not part of the sim. */
  delta: number;
}

type ClockConfig = Pick<AscentConfig, 'step' | 'maxFrameDelta' | 'maxStepsPerFrame'>;

export class FixedStepClock {
  private last: number | null = null;
  private acc = 0;
  private readonly cfg: ClockConfig;

  constructor(cfg: ClockConfig = ASCENT_CONFIG) {
    this.cfg = cfg;
  }

  /** Forget the last timestamp: the next frame only sets the clock. Call it on start, on resume and when the tab returns. */
  reset(): void {
    this.last = null;
    this.acc = 0;
  }

  /** A frame at `now` milliseconds. */
  advance(now: number): Tick {
    if (this.last === null || now < this.last) {
      this.last = now;
      this.acc = 0;
      return { steps: 0, alpha: 0, delta: 0 };
    }
    const { step, maxFrameDelta, maxStepsPerFrame } = this.cfg;
    const delta = Math.min((now - this.last) / 1000, maxFrameDelta);
    this.last = now;
    this.acc += delta;
    let steps = Math.floor(this.acc / step + 1e-9);
    if (steps > maxStepsPerFrame) {
      // Too far behind (a slow device or a stall): run the cap and drop the rest, so the game slows instead of jumping.
      steps = maxStepsPerFrame;
      this.acc = 0;
    } else {
      this.acc = Math.max(0, this.acc - steps * step);
    }
    return { steps, alpha: Math.min(1, this.acc / step), delta };
  }
}
