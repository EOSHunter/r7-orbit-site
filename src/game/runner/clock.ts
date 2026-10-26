// Frame time to simulation steps: a fixed step with an accumulator. This is what keeps the game at the same speed on a 30 Hz
// laptop, a 60 Hz phone and a 240 Hz monitor (docs/RUNNER.md, "Frame rate"). Pure: it is given timestamps (the rAF
// timestamp, in milliseconds) and says how many steps to run and how far the display is between the last two.

import { RUNNER_CONFIG, type RunnerConfig } from './config';

export interface Tick {
  /** Fixed steps to run this frame (0 to maxStepsPerFrame). */
  steps: number;
  /** How far the display is past the last step, 0 to 1: render interpolates by this. */
  alpha: number;
}

export class FixedStepClock {
  private last: number | null = null;
  private acc = 0;
  private readonly step: number;
  private readonly maxDelta: number;
  private readonly maxSteps: number;

  constructor(cfg: RunnerConfig = RUNNER_CONFIG) {
    this.step = cfg.step;
    this.maxDelta = cfg.maxFrameDelta;
    this.maxSteps = cfg.maxStepsPerFrame;
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
      return { steps: 0, alpha: 0 };
    }
    const delta = Math.min((now - this.last) / 1000, this.maxDelta);
    this.last = now;
    this.acc += delta;
    let steps = Math.floor(this.acc / this.step + 1e-9);
    if (steps > this.maxSteps) {
      // Too far behind (a slow device or a stall): run the cap and drop the rest, so the game slows instead of jumping.
      steps = this.maxSteps;
      this.acc = 0;
    } else {
      this.acc = Math.max(0, this.acc - steps * this.step);
    }
    return { steps, alpha: Math.min(1, this.acc / this.step) };
  }
}
