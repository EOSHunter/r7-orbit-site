// What the game should sound like (sound-events.ts): the one-off sounds read from the sim's state frame by frame, and the
// zones' ambience mixed by height. Driven by the sim where it matters, so these are the game's own motions.
import { describe, expect, it } from 'vitest';
import { ASCENT_CONFIG } from './config';
import type { Level } from './level';
import { AscentSim } from './sim';
import {
  AMBIENCE_FADE,
  STEP_EVERY,
  SoundTracker,
  ambienceMix,
  type SoundEvent,
  type SoundSnapshot,
} from './sound-events';

const FLAT: Level = {
  spawn: { x: 0, y: 0, z: 0 },
  spawnYaw: 0,
  boxes: [{ kind: 'ground', min: { x: -200, y: -1, z: -200 }, max: { x: 200, y: 0, z: 200 } }],
  route: [],
  goal: { x: 0, y: 50, z: 0 },
  beacons: [],
};

const snap = (sim: AscentSim): SoundSnapshot => ({
  grounded: sim.grounded,
  speed: Math.hypot(sim.vel.x, sim.vel.z),
  vy: sim.vel.y,
  jumps: sim.jumps,
  landings: sim.landings,
  teleports: sim.teleports,
  checkpoint: sim.checkpoint,
  lifted: sim.lifted,
  shaking: sim.crumbles.filter((c) => c.touched !== null).length,
  broken: sim.crumbles.filter((c) => c.broke !== null).length,
  finished: sim.finished,
});

/** The sim and a tracker reading it a frame at a time (two sim steps a frame), collecting what it hears. */
function listen(level: Level = FLAT) {
  const sim = new AscentSim(level);
  const tracker = new SoundTracker();
  const heard: SoundEvent[] = [];
  const frames = (n: number) => {
    for (let i = 0; i < n; i++) {
      sim.step();
      sim.step();
      heard.push(...tracker.update(snap(sim), 2 * ASCENT_CONFIG.step));
    }
  };
  frames(30);
  heard.length = 0;
  return { sim, tracker, heard, frames };
}

describe('SoundTracker', () => {
  it('hears nothing while the agent stands still', () => {
    const { heard, frames } = listen();
    frames(120);
    expect(heard).toEqual([]);
  });

  it('steps as the agent runs, about one footfall per STEP_EVERY metres, alternating feet', () => {
    const { sim, heard, frames } = listen();
    sim.setMove(0, -1);
    frames(120); // two seconds at about 6 m/s
    const steps = heard.filter((e) => e.kind === 'step');
    const run = Math.abs(sim.pos.z);
    expect(steps.length).toBeGreaterThanOrEqual(Math.floor(run / STEP_EVERY) - 2);
    expect(steps.length).toBeLessThanOrEqual(Math.ceil(run / STEP_EVERY));
    expect(steps.map((e) => (e as { foot: number }).foot).slice(0, 4)).toEqual([0, 1, 0, 1]);
  });

  it('jumps, then lands, and a landing from higher is harder', () => {
    const { sim, heard, frames } = listen();
    sim.jumpPress();
    frames(90);
    expect(heard.map((e) => e.kind)).toEqual(['jump', 'land']);
    const low = (heard[1] as { strength: number }).strength;
    // Dropped from 12 m.
    sim.restore({
      pos: { x: 0, y: 12, z: 0 },
      yaw: 0,
      time: 0,
      best: 0,
      falls: 0,
      jumps: 0,
      assist: false,
      assisted: false,
      checkpoint: null,
    });
    frames(1);
    heard.length = 0;
    frames(120);
    const high = heard.find((e) => e.kind === 'land') as { strength: number };
    expect(high.strength).toBeGreaterThan(low);
  });

  it('a respawn is heard alone, not as a landing', () => {
    const { sim, heard, frames } = listen();
    sim.restart();
    frames(1);
    expect(heard).toEqual([{ kind: 'respawn' }]);
  });

  it('hears the panels creak and break, the updraft start, the beacon and the finish', () => {
    const t = new SoundTracker();
    const base: SoundSnapshot = {
      grounded: true,
      speed: 0,
      vy: 0,
      jumps: 0,
      landings: 0,
      teleports: 0,
      checkpoint: null,
      lifted: false,
      shaking: 0,
      broken: 0,
      finished: false,
    };
    t.update(base, 0.016);
    expect(t.update({ ...base, shaking: 1 }, 0.016)).toEqual([{ kind: 'creak' }]);
    expect(t.update({ ...base, shaking: 0, broken: 1 }, 0.016)).toEqual([{ kind: 'crumble' }]);
    expect(t.update({ ...base, broken: 1, lifted: true }, 0.016)).toEqual([{ kind: 'lift' }]);
    expect(t.update({ ...base, broken: 1, checkpoint: 2 }, 0.016)).toEqual([{ kind: 'checkpoint' }]);
    expect(t.update({ ...base, broken: 1, checkpoint: 2, finished: true }, 0.016)).toEqual([{ kind: 'finish' }]);
  });
});

describe('ambienceMix', () => {
  const zones = [{ base: 0 }, { base: 70 }, { base: 150 }];
  it('plays one zone alone in its middle, and two together across the line between them', () => {
    expect(ambienceMix(30, zones)).toEqual([1, 0, 0]);
    expect(ambienceMix(110, zones)).toEqual([0, 1, 0]);
    const at = ambienceMix(70, zones);
    expect(at[0]).toBeCloseTo(0.5);
    expect(at[1]).toBeCloseTo(0.5);
    expect(ambienceMix(70 - AMBIENCE_FADE + 0.01, zones)[0]).toBeGreaterThan(0.99);
    expect(ambienceMix(70 + AMBIENCE_FADE - 0.01, zones)[1]).toBeGreaterThan(0.99);
  });
  it('always sums to 1, below the first zone and above the last', () => {
    for (const y of [-20, 0, 69, 71, 149.5, 400]) {
      expect(ambienceMix(y, zones).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    }
  });
});
