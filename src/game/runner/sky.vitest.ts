// The atmosphere's pure maths (sky.ts): the tunnel's travelling glow, the stars' twinkle, the planet's turn, and when and
// where the shooting stars fly.
import { describe, expect, it } from 'vitest';
import { RUNNER_CONFIG } from './config';
import { mulberry32 } from './random';
import {
  CometClock,
  SKY_MOTION,
  cometEnvelope,
  cometPath,
  glowWave,
  glowWaveMean,
  inCometSky,
  planetAngles,
  ringGlow,
  twinkleAt,
  twinkleFor,
  type SkyFrame,
} from './sky';

const dt = RUNNER_CONFIG.step;
const G = SKY_MOTION.glow;
const C = SKY_MOTION.comets;
/** The fixture's framing at 16:9: horizon a little above the middle, the planet on the left. */
const FRAME: SkyFrame = { aspect: 16 / 9, horizon: 0.18, planet: { x: -0.55, y: 0.32, r: 0.34 } };

/** Run a comet clock for `seconds`; returns the start times (seconds) and the longest overlap seen. */
function fly(clock: CometClock, seconds: number, allowed: (t: number) => boolean = () => true) {
  const starts: number[] = [];
  let flyingAtStart = 0;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    const t = i * dt;
    const wasFlying = clock.flying;
    if (clock.step(dt, allowed(t))) {
      starts.push(t);
      if (wasFlying && clock.prevAge > 0) flyingAtStart++;
    }
  }
  return { starts, flyingAtStart };
}

describe('the ring glow', () => {
  it('the wave stays in 0..1 and repeats every period', () => {
    for (let ahead = -10; ahead <= 160; ahead += 3.7) {
      for (let t = 0; t < 20; t += 0.37) {
        const w = glowWave(ahead, t);
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
        expect(glowWave(ahead, t + G.period)).toBeCloseTo(w, 9);
      }
    }
  });

  it('the crest runs towards the camera as time passes', () => {
    // At t = 0 a crest is at ahead = 72 (one wavelength); a quarter period later it is a quarter wavelength nearer.
    expect(glowWave(G.wavelength, 0)).toBeCloseTo(1, 9);
    expect(glowWave(G.wavelength * 0.75, G.period / 4)).toBeCloseTo(1, 9);
    expect(glowWave(G.wavelength * 0.75, 0)).toBeLessThan(0.2);
  });

  it('its average over a period is what reduced motion shows', () => {
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) sum += glowWave(30, (i / n) * G.period);
    expect(sum / n).toBeCloseTo(glowWaveMean(), 4);
    expect(glowWaveMean()).toBeCloseTo(5 / 16, 9);
  });

  it('peaks at about half strength, dimmer near the camera, still under reduced motion', () => {
    let max = 0;
    for (let ahead = -10; ahead <= 160; ahead += 0.5) {
      for (let t = 0; t < G.period; t += 0.05) {
        const g = ringGlow(ahead, t, false);
        expect(g).toBeGreaterThanOrEqual(0);
        max = Math.max(max, g);
      }
    }
    expect(max).toBeLessThanOrEqual(0.5);
    expect(max).toBeGreaterThan(0.38);
    expect(ringGlow(80, 0, true)).toBe(ringGlow(80, 123.4, true));
    expect(ringGlow(80, 0, true)).toBeCloseTo(G.base + G.wave * glowWaveMean(), 9);
    expect(ringGlow(2, 0, true)).toBeCloseTo(G.nearGain * ringGlow(80, 0, true), 9);
  });
});

describe('the twinkle', () => {
  it('every star gets a phase, a 0.5 to 2.5 s cycle that divides the loop, and a small amplitude', () => {
    const rand = mulberry32(1);
    const S = SKY_MOTION.stars;
    for (let i = 0; i < 2000; i++) {
      const t = twinkleFor(rand);
      const period = (2 * Math.PI) / t.rate;
      expect(t.phase).toBeGreaterThanOrEqual(0);
      expect(t.phase).toBeLessThan(2 * Math.PI);
      expect(period).toBeGreaterThanOrEqual(S.period[0] - 1e-9);
      expect(period).toBeLessThanOrEqual(S.period[1] + 1e-9);
      const cycles = S.loop / period;
      expect(Math.abs(cycles - Math.round(cycles))).toBeLessThan(1e-9);
      expect(t.amplitude).toBeGreaterThanOrEqual(S.amplitude[0]);
      expect(t.amplitude).toBeLessThanOrEqual(S.amplitude[1]);
    }
  });

  it('stays within 1 ± amplitude and does not jump when the shader clock wraps', () => {
    const t = twinkleFor(mulberry32(9));
    for (let s = 0; s < 10; s += 0.013) {
      const b = twinkleAt(t, s);
      expect(Math.abs(b - 1)).toBeLessThanOrEqual(t.amplitude + 1e-12);
    }
    const loop = SKY_MOTION.stars.loop;
    const unwrapped = (time: number) => 1 + t.amplitude * Math.sin(t.phase + t.rate * time);
    for (const time of [loop - 0.001, loop, loop + 0.37, 7 * loop + 1.1]) {
      expect(twinkleAt(t, time)).toBeCloseTo(unwrapped(time), 6);
    }
  });

  it('the same seed gives the same stars', () => {
    expect(twinkleFor(mulberry32(4))).toEqual(twinkleFor(mulberry32(4)));
  });
});

describe('the planet', () => {
  it('turns once in 300 s, its rings once in 540 s, never from the sim', () => {
    expect(planetAngles(0)).toEqual({ body: 0, rings: 0 });
    expect(planetAngles(75).body).toBeCloseTo(Math.PI / 2, 9);
    expect(planetAngles(135).rings).toBeCloseTo(Math.PI / 2, 9);
    expect(planetAngles(300).body).toBeCloseTo(0, 9);
    expect(planetAngles(540).rings).toBeCloseTo(0, 9);
    const { body, rings } = planetAngles(1e5);
    for (const a of [body, rings]) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(2 * Math.PI);
    }
    expect(SKY_MOTION.planet.bodyTurn).toBeGreaterThanOrEqual(240);
    expect(SKY_MOTION.planet.bodyTurn).toBeLessThanOrEqual(360);
    expect(SKY_MOTION.planet.ringTurn).toBeGreaterThanOrEqual(480);
    expect(SKY_MOTION.planet.ringTurn).toBeLessThanOrEqual(600);
  });
});

describe('the shooting stars', () => {
  it('start 15 to 40 s apart, one at a time, each crossing in 0.9 to 1.6 s', () => {
    const clock = new CometClock(mulberry32(3));
    let longest = 0;
    let flying = 0;
    const starts: number[] = [];
    for (let i = 0; i < Math.round(1800 / dt); i++) {
      if (clock.step(dt, true)) {
        expect(flying, 'a comet started while another flew').toBe(0);
        starts.push(i * dt);
        flying = 1;
        expect(clock.duration).toBeGreaterThanOrEqual(C.duration[0]);
        expect(clock.duration).toBeLessThanOrEqual(C.duration[1]);
      }
      if (!clock.flying && flying) {
        flying = 0;
      }
      if (clock.flying) longest = Math.max(longest, clock.age);
    }
    expect(starts.length).toBeGreaterThan(1800 / 40 - 2);
    expect(starts[0]).toBeGreaterThanOrEqual(C.interval[0] - dt);
    expect(starts[0]).toBeLessThanOrEqual(C.interval[1] + dt);
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i] - starts[i - 1];
      expect(gap).toBeGreaterThanOrEqual(C.interval[0] - dt);
      expect(gap).toBeLessThanOrEqual(C.interval[1] + dt);
    }
    expect(longest).toBeLessThanOrEqual(C.duration[1]);
    expect(clock.count).toBe(starts.length);
  });

  it('are deterministic with a seed, and the first can be brought forward', () => {
    expect(fly(new CometClock(mulberry32(77)), 300).starts).toEqual(fly(new CometClock(mulberry32(77)), 300).starts);
    expect(fly(new CometClock(mulberry32(77)), 300).starts).not.toEqual(
      fly(new CometClock(mulberry32(78)), 300).starts,
    );
    const early = fly(new CometClock(mulberry32(5), 1.5), 3).starts;
    expect(early).toHaveLength(1);
    expect(early[0]).toBeCloseTo(1.5, 1);
  });

  it('never fly while not allowed (reduced motion, a crash), and one in flight is gone at once', () => {
    const none = fly(new CometClock(mulberry32(2), 1), 200, () => false);
    expect(none.starts).toEqual([]);

    const clock = new CometClock(mulberry32(2), 1);
    for (let i = 0; i < Math.round(1.2 / dt); i++) clock.step(dt, true);
    expect(clock.flying).toBe(true);
    clock.step(dt, false);
    expect(clock.flying).toBe(false);
    expect(clock.progress(0.5)).toBe(-1);
    // The countdown holds while not allowed: no comet piles up for the moment it is allowed again.
    const wait = clock.wait;
    for (let i = 0; i < Math.round(100 / dt); i++) clock.step(dt, false);
    expect(clock.wait).toBe(wait);
    expect(clock.count).toBe(1);
  });

  it('a paused game is a clock that is not stepped: nothing moves', () => {
    const clock = new CometClock(mulberry32(2), 1);
    for (let i = 0; i < Math.round(1.3 / dt); i++) clock.step(dt, true);
    const at = clock.progress(1);
    expect(at).toBeGreaterThan(0);
    expect(clock.progress(1)).toBe(at); // reading it never advances it
  });

  it('progress runs 0 to 1, interpolated within a step', () => {
    const clock = new CometClock(mulberry32(6), dt);
    clock.step(dt, true);
    expect(clock.progress(0)).toBe(0);
    clock.step(dt, true);
    const half = clock.progress(0.5);
    expect(half).toBeCloseTo(dt / 2 / clock.duration, 9);
  });

  it('the envelope is 0 at both ends, never above 1', () => {
    expect(cometEnvelope(0)).toBe(0);
    expect(cometEnvelope(1)).toBe(0);
    expect(cometEnvelope(-1)).toBe(0);
    for (let u = 0; u <= 1; u += 0.01) {
      expect(cometEnvelope(u)).toBeGreaterThanOrEqual(0);
      expect(cometEnvelope(u)).toBeLessThanOrEqual(1);
    }
    expect(cometEnvelope(0.3)).toBe(1);
  });

  it('cross the upper sky at a shallow angle, out of the middle third, above the horizon, clear of the planet', () => {
    for (const frame of [FRAME, { ...FRAME, aspect: 0.46 }, { ...FRAME, aspect: 2.4, horizon: 0.1 }]) {
      const rand = mulberry32(12);
      let found = 0;
      for (let i = 0; i < 300; i++) {
        const p = cometPath(rand, frame);
        if (!p) continue;
        found++;
        for (let k = 0; k <= 40; k++) {
          const x = p.x0 + ((p.x1 - p.x0) * k) / 40;
          const y = p.y0 + ((p.y1 - p.y0) * k) / 40;
          expect(inCometSky(x, y, frame)).toBe(true);
          expect(Math.abs(x)).toBeGreaterThanOrEqual(1 / 3);
          expect(y).toBeGreaterThan(frame.horizon);
        }
        expect(Math.abs(p.x1)).toBeLessThan(Math.abs(p.x0)); // from the side towards the middle
        expect(p.y1).toBeLessThan(p.y0); // downwards
        const angle = (Math.atan2(p.y0 - p.y1, Math.abs(p.x0 - p.x1) * frame.aspect) * 180) / Math.PI;
        expect(angle).toBeGreaterThanOrEqual(C.angle[0] - 1e-9);
        expect(angle).toBeLessThanOrEqual(C.angle[1] + 1e-9);
        expect(p.tail).toBeGreaterThan(0);
        expect(p.tail).toBeLessThanOrEqual(C.tail[1]);
      }
      expect(found, `paths found at aspect ${frame.aspect}`).toBeGreaterThan(250);
    }
  });

  it('give up (null) rather than cross a sky with no room', () => {
    const full: SkyFrame = { aspect: 16 / 9, horizon: 0.7, planet: { x: 0.6, y: 0.8, r: 2 } };
    expect(cometPath(mulberry32(1), full)).toBeNull();
  });
});
