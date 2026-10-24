import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './clock';
import { RUNNER_CONFIG, jumpPhysics, speedAt, withConfig } from './config';
import { fixedCourse, type Row } from './generator';
import { RunnerSim, type Intent } from './sim';

const cfg = RUNNER_CONFIG;
const STEP = cfg.step;

/** A sim on a hand-made course, already playing. */
function simOn(rows: (Omit<Row, 'pickups'> & { pickups?: Row['pickups'] })[], config = cfg): RunnerSim {
  const sim = new RunnerSim({ seed: 1, config, course: () => fixedCourse(rows) });
  sim.start(true);
  return sim;
}

/** Steps until the rover's centre passes `distance` or the run ends; `actions` fire when the centre passes their `at`. */
function driveTo(sim: RunnerSim, distance: number, actions: { at: number; intent: Intent }[] = []): void {
  const todo = [...actions].sort((a, b) => a.at - b.at);
  for (let i = 0; i < 1e6 && sim.phase === 'playing' && sim.distance < distance; i++) {
    while (todo.length && sim.distance >= todo[0].at) sim.input(todo.shift()!.intent);
    sim.step();
  }
}

const stepsFor = (seconds: number) => Math.round(seconds / STEP);

describe('speed curve', () => {
  it('starts at the start speed, rises smoothly and never passes the cap', () => {
    expect(speedAt(0)).toBe(cfg.speed.start);
    let last = 0;
    for (let t = 0; t <= cfg.speed.rampTime * 3; t += 0.5) {
      const v = speedAt(t);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(cfg.speed.max);
      last = v;
    }
    expect(speedAt(cfg.speed.rampTime)).toBe(cfg.speed.max);
    expect(speedAt(cfg.speed.rampTime * 10)).toBe(cfg.speed.max);
    // Eases into the cap: no jolt when it arrives.
    expect(speedAt(cfg.speed.rampTime) - speedAt(cfg.speed.rampTime - 1)).toBeLessThan(0.01);
  });

  it('the sim follows it, in metres per second', () => {
    const sim = simOn([]);
    for (let i = 0; i < stepsFor(1); i++) sim.step();
    expect(sim.time).toBeCloseTo(1, 6);
    expect(sim.speed).toBeCloseTo(speedAt(1), 6);
    // About 12 m in the first second at 12 m/s, whatever the step count.
    expect(sim.distance).toBeGreaterThan(cfg.speed.start * 0.999);
    expect(sim.distance).toBeLessThan(speedAt(1) * 1.001);
    for (let i = 0; i < stepsFor(cfg.speed.rampTime * 2); i++) sim.step();
    expect(sim.speed).toBe(cfg.speed.max);
  });
});

describe('phases', () => {
  it('ready until started; Space (primary) starts; a tap (start) starts', () => {
    const a = new RunnerSim({ seed: 3 });
    a.step();
    expect(a.phase).toBe('ready');
    expect(a.distance).toBe(0);
    a.input('jump'); // Up arrow does not start a run, only Space or a tap
    a.step();
    expect(a.phase).toBe('ready');
    a.input('primary');
    a.step();
    expect(a.phase).toBe('playing');
    expect(a.grounded).toBe(true); // the Space that started the run did not also jump

    const b = new RunnerSim({ seed: 3 });
    b.input('start');
    b.step();
    expect(b.phase).toBe('playing');
  });

  it('after a crash, restart waits for the restart delay, then starts a fresh course', () => {
    const sim = simOn([{ z: 30, lanes: [null, 'slab', null] }]);
    driveTo(sim, 1000);
    expect(sim.phase).toBe('over');
    const firstSeed = sim.seed;
    sim.input('primary');
    sim.step();
    expect(sim.phase, 'too soon: still game over').toBe('over');
    for (let i = 0; i < stepsFor(cfg.score.restartDelay); i++) sim.step();
    sim.input('primary');
    sim.step();
    expect(sim.phase).toBe('playing');
    expect(sim.distance).toBeLessThan(1);
    expect(sim.score).toBe(0);
    expect(sim.crash).toBeNull();
    expect(sim.seed).not.toBe(firstSeed);
  });
});

describe('lanes', () => {
  it('changes one lane per press and stops at the edges', () => {
    const sim = simOn([]);
    sim.input('right');
    sim.input('right');
    sim.input('right');
    sim.step();
    expect(sim.lane).toBe(1);
    sim.input('left');
    sim.input('left');
    sim.input('left');
    sim.input('left');
    sim.step();
    expect(sim.lane).toBe(-1);
  });

  it('takes laneChangeTime to move one lane, and works in the air and while sliding', () => {
    const sim = simOn([]);
    sim.input('right');
    const n = Math.ceil(cfg.track.laneChangeTime / STEP - 1e-9);
    for (let i = 0; i < n - 1; i++) sim.step();
    expect(sim.x).toBeLessThan(cfg.track.laneWidth);
    sim.step();
    expect(sim.x).toBeCloseTo(cfg.track.laneWidth, 9);

    sim.input('jump');
    sim.input('left');
    for (let i = 0; i < n; i++) sim.step();
    expect(sim.grounded).toBe(false);
    expect(sim.x).toBeCloseTo(0, 9);

    for (let i = 0; i < stepsFor(1); i++) sim.step();
    sim.input('slide');
    sim.input('left');
    for (let i = 0; i < n; i++) sim.step();
    expect(sim.sliding).toBe(true);
    expect(sim.x).toBeCloseTo(-cfg.track.laneWidth, 9);
  });
});

describe('jump', () => {
  const { takeoff } = jumpPhysics();

  it('reaches jump.height and lands after jump.duration', () => {
    const sim = simOn([]);
    sim.input('jump');
    let apex = 0;
    let airSteps = 0;
    sim.step();
    while (!sim.grounded) {
      apex = Math.max(apex, sim.y);
      airSteps++;
      sim.step();
    }
    expect(apex).toBeGreaterThan(cfg.jump.height - 0.005);
    expect(apex).toBeLessThanOrEqual(cfg.jump.height + 1e-9);
    expect(Math.abs((airSteps + 1) * STEP - cfg.jump.duration)).toBeLessThanOrEqual(STEP);
  });

  it('no double jump; a jump pressed just before landing (within the buffer) happens on landing', () => {
    const sim = simOn([]);
    sim.input('jump');
    for (let i = 0; i < stepsFor(0.2); i++) sim.step();
    const vy = sim.vy;
    sim.input('jump'); // in the air, long before landing: ignored at landing
    sim.step();
    expect(sim.vy).toBeLessThan(vy); // still falling under gravity, not a fresh take-off
    while (!sim.grounded) sim.step();
    sim.step();
    expect(sim.grounded, 'the early press did not jump again').toBe(true);

    sim.input('jump');
    for (let i = 0; i < stepsFor(cfg.jump.duration) - stepsFor(cfg.jump.buffer / 2); i++) sim.step();
    expect(sim.grounded).toBe(false);
    sim.input('jump'); // within the buffer of landing
    let rejumped = false;
    for (let i = 0; i < stepsFor(cfg.jump.buffer) + 2; i++) {
      sim.step();
      if (sim.vy > takeoff * 0.9) rejumped = true;
    }
    expect(rejumped).toBe(true);
  });
});

describe('slide', () => {
  it('lasts slide.duration; pressing again restarts it', () => {
    const sim = simOn([]);
    sim.input('slide');
    sim.step();
    expect(sim.sliding).toBe(true);
    expect(sim.roverHeight).toBe(cfg.hitbox.rover.slideHeight);
    for (let i = 0; i < stepsFor(cfg.slide.duration) - 2; i++) sim.step();
    expect(sim.sliding).toBe(true);
    sim.input('slide');
    for (let i = 0; i < stepsFor(cfg.slide.duration / 2); i++) sim.step();
    expect(sim.sliding, 'restarted').toBe(true);
    for (let i = 0; i < stepsFor(cfg.slide.duration); i++) sim.step();
    expect(sim.sliding).toBe(false);
    expect(sim.roverHeight).toBe(cfg.hitbox.rover.height);
  });

  it('jump cancels a slide', () => {
    const sim = simOn([]);
    sim.input('slide');
    sim.step();
    sim.input('jump');
    sim.step();
    expect(sim.sliding).toBe(false);
    expect(sim.grounded).toBe(false);
  });

  it('slide in the air slams down and slides on landing, sooner than the jump would land', () => {
    const sim = simOn([]);
    sim.input('jump');
    for (let i = 0; i < stepsFor(0.15); i++) sim.step();
    sim.input('slide');
    let steps = 0;
    while (!sim.grounded) {
      sim.step();
      steps++;
    }
    expect(steps * STEP).toBeLessThanOrEqual(cfg.jump.height / cfg.slide.slamSpeed + STEP);
    expect(sim.sliding).toBe(true);
    // A jump pressed during the slam does not undo it.
    const s2 = simOn([]);
    s2.input('jump');
    for (let i = 0; i < stepsFor(0.15); i++) s2.step();
    s2.input('slide');
    s2.input('jump');
    while (!s2.grounded) s2.step();
    expect(s2.sliding).toBe(true);
  });
});

describe('collisions', () => {
  const contact = (z: number, kind: 'slab' | 'barrier' | 'gate') =>
    z - cfg.hitbox[kind].length / 2 - cfg.hitbox.rover.length / 2;
  // The rover reaches the row a little over 2 s in, at about 13 m/s; a press this far before contact is mid-window.
  const jumpAt = (z: number) => contact(z, 'barrier') - 2.6;
  const slideAt = (z: number) => contact(z, 'gate') - 3;

  it('a slab in the lane ends the run; jumping does not clear it; changing lane does', () => {
    const hit = simOn([{ z: 30, lanes: [null, 'slab', null] }]);
    driveTo(hit, 100);
    expect(hit.phase).toBe('over');
    expect(hit.crash?.kind).toBe('slab');
    expect(hit.distance).toBeGreaterThan(contact(30, 'slab') - 0.5);
    expect(hit.distance).toBeLessThanOrEqual(contact(30, 'slab') + 0.5);

    const jumped = simOn([{ z: 30, lanes: [null, 'slab', null] }]);
    driveTo(jumped, 100, [{ at: jumpAt(30), intent: 'jump' }]);
    expect(jumped.crash?.kind).toBe('slab');

    const dodged = simOn([{ z: 30, lanes: [null, 'slab', null] }]);
    driveTo(dodged, 100, [{ at: 20, intent: 'left' }]);
    expect(dodged.phase).toBe('playing');
  });

  it('a barrier: jumping over it succeeds, driving or sliding into it ends the run', () => {
    const ok = simOn([{ z: 30, lanes: [null, 'barrier', null] }]);
    driveTo(ok, 100, [{ at: jumpAt(30), intent: 'jump' }]);
    expect(ok.phase).toBe('playing');

    const ran = simOn([{ z: 30, lanes: [null, 'barrier', null] }]);
    driveTo(ran, 100);
    expect(ran.crash?.kind).toBe('barrier');

    const slid = simOn([{ z: 30, lanes: [null, 'barrier', null] }]);
    driveTo(slid, 100, [{ at: slideAt(30), intent: 'slide' }]);
    expect(slid.crash?.kind).toBe('barrier');
  });

  it('a gate: sliding under it succeeds, driving or jumping into it ends the run', () => {
    const ok = simOn([{ z: 30, lanes: [null, 'gate', null] }]);
    driveTo(ok, 100, [{ at: slideAt(30), intent: 'slide' }]);
    expect(ok.phase).toBe('playing');

    const ran = simOn([{ z: 30, lanes: [null, 'gate', null] }]);
    driveTo(ran, 100);
    expect(ran.crash?.kind).toBe('gate');

    const jumped = simOn([{ z: 30, lanes: [null, 'gate', null] }]);
    driveTo(jumped, 100, [{ at: jumpAt(30), intent: 'jump' }]);
    expect(jumped.crash?.kind).toBe('gate');
  });

  it('obstacles in other lanes are not hit', () => {
    const sim = simOn([{ z: 30, lanes: ['slab', null, 'slab'] }]);
    driveTo(sim, 100);
    expect(sim.phase).toBe('playing');
  });

  it('pickups count once each and add the bonus to the score', () => {
    const pickups = [10, 13, 16].map((z) => ({ lane: 0 as const, z, y: cfg.generator.pickupHeight }));
    const other = { lane: 1 as const, z: 19, y: cfg.generator.pickupHeight };
    const sim = simOn([{ z: 40, lanes: [null, null, null], pickups: [...pickups, other] }]);
    driveTo(sim, 30);
    expect(sim.pickups).toBe(3);
    expect(sim.score).toBe(Math.floor(sim.distance) + 3 * cfg.score.pickupBonus);
  });
});

describe('fixed step clock', () => {
  it('the first frame only sets the clock; frames give steps by elapsed time; alpha is the remainder', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(1000)).toEqual({ steps: 0, alpha: 0 });
    expect(clock.advance(1000 + 1000 / 60).steps).toBe(2);
    const t = clock.advance(1000 + 1000 / 60 + 1000 / 240);
    expect(t.steps).toBe(0);
    expect(t.alpha).toBeCloseTo(0.5, 6);
  });

  it('clamps a long frame and caps the steps; reset forgets the last timestamp', () => {
    const clock = new FixedStepClock();
    clock.advance(0);
    expect(clock.advance(2000).steps).toBe(cfg.maxStepsPerFrame);
    expect(clock.advance(2000 + 1000 / 120).steps).toBe(1); // nothing carried over from the stall
    clock.reset();
    expect(clock.advance(9000).steps).toBe(0);
    expect(clock.advance(8000).steps, 'time going backwards resets').toBe(0);
  });
});

/**
 * Frame-rate independence. The same course and the same inputs are played with frames at 30, 60, 120 and 240 Hz, and at 60 Hz
 * with a 2-second stall. Inputs are given the way a player gives them: when the frame shows the rover past a point. The
 * steps are identical in every run; only when an input lands can move, by at most one frame. So the outcome must match.
 */
describe('frame-rate independence', () => {
  const contact = (z: number, kind: 'slab' | 'barrier' | 'gate') =>
    z - cfg.hitbox[kind].length / 2 - cfg.hitbox.rover.length / 2;
  const course: (Omit<Row, 'pickups'> & { pickups?: Row['pickups'] })[] = [
    { z: 60, lanes: ['slab', 'barrier', 'slab'] },
    { z: 120, lanes: ['slab', 'gate', 'slab'], pickups: [100, 103, 106, 109].map((z) => ({ lane: 0, z, y: 0.6 })) },
    { z: 180, lanes: ['slab', 'slab', null] },
    { z: 240, lanes: [null, 'barrier', 'slab'] },
    { z: 300, lanes: ['slab', null, 'slab'] },
  ];
  const script: { at: number; intent: Intent }[] = [
    { at: contact(60, 'barrier') - 2.8, intent: 'jump' },
    { at: contact(120, 'gate') - 3.2, intent: 'slide' },
    { at: 150, intent: 'right' },
    // Nothing for the slab at 240 in the right lane: the run ends there.
  ];

  function play(frameMs: number, stallAt?: number) {
    const sim = new RunnerSim({ seed: 9, course: () => fixedCourse(course) });
    const clock = new FixedStepClock();
    sim.start(true);
    let now = 5000;
    clock.advance(now);
    const todo = [...script];
    let stalled = false;
    let maxSteps = 0;
    let lastPlayingDistance = 0;
    for (let frame = 0; frame < 1e6 && sim.phase === 'playing'; frame++) {
      while (todo.length && sim.distance >= todo[0].at) sim.input(todo.shift()!.intent);
      const stall = stallAt !== undefined && !stalled && sim.time >= stallAt;
      if (stall) stalled = true;
      now += stall ? 2000 : frameMs;
      const { steps } = clock.advance(now);
      maxSteps = Math.max(maxSteps, steps);
      for (let i = 0; i < steps; i++) {
        sim.step();
        if (sim.phase === 'playing') lastPlayingDistance = sim.distance;
      }
    }
    return {
      crash: sim.crash,
      distance: sim.distance,
      pickups: sim.pickups,
      score: sim.score,
      lastPlayingDistance,
      maxSteps,
      steps: sim.steps,
    };
  }

  const reference = play(1000 / 120);

  it('the reference run passes the barrier and the gate, takes the pickups and hits the slab at 240', () => {
    expect(reference.crash).toMatchObject({ kind: 'slab', z: 240, lane: 1 });
    expect(reference.pickups).toBe(4);
  });

  for (const [label, frameMs, stallAt] of [
    ['30 Hz', 1000 / 30],
    ['60 Hz', 1000 / 60],
    ['240 Hz', 1000 / 240],
    ['144 Hz', 1000 / 144],
    ['60 Hz with a 2 s stall mid-run', 1000 / 60, 8],
  ] as [string, number, number?][]) {
    it(`${label}: same distance, same crash, same pickups`, () => {
      const run = play(frameMs, stallAt);
      expect(run.crash).toEqual(reference.crash);
      expect(run.pickups).toBe(reference.pickups);
      expect(Math.abs(run.distance - reference.distance)).toBeLessThan(0.01);
      expect(run.score).toBe(reference.score);
      expect(run.maxSteps).toBeLessThanOrEqual(cfg.maxStepsPerFrame);
    });
  }

  it('equal play time covers equal distance at any frame rate', () => {
    const distanceAfter = (frameMs: number, seconds: number) => {
      const sim = new RunnerSim({ seed: 2, course: () => fixedCourse([]) });
      const clock = new FixedStepClock();
      sim.start(true);
      clock.advance(0);
      for (let now = frameMs; now <= seconds * 1000 + 1e-6; now += frameMs) {
        const { steps } = clock.advance(now);
        for (let i = 0; i < steps; i++) sim.step();
      }
      return sim.distance;
    };
    const ref = distanceAfter(1000 / 120, 20);
    for (const hz of [30, 60, 144, 240]) {
      // Within one step of movement at the cap (the last partial step waits for the next frame).
      expect(Math.abs(distanceAfter(1000 / hz, 20) - ref)).toBeLessThan(cfg.speed.max * STEP * 1.01);
    }
  });

  it('a 2 s stall slows the game for a moment; it never skips ahead through an obstacle', () => {
    const sim = new RunnerSim({ seed: 2, course: () => fixedCourse([{ z: 40, lanes: [null, 'slab', null] }]) });
    const clock = new FixedStepClock();
    sim.start(true);
    clock.advance(0);
    // Stall just before the slab: the frame after it advances at most maxStepsPerFrame steps, and the slab still ends the run.
    let now = 0;
    while (sim.distance < 36) {
      now += 1000 / 60;
      for (let i = clock.advance(now).steps; i > 0; i--) sim.step();
    }
    const before = sim.distance;
    now += 2000;
    for (let i = clock.advance(now).steps; i > 0; i--) sim.step();
    expect(sim.distance - before).toBeLessThanOrEqual(cfg.speed.max * STEP * cfg.maxStepsPerFrame + 1e-9);
    while (sim.phase === 'playing') {
      now += 1000 / 60;
      for (let i = clock.advance(now).steps; i > 0; i--) sim.step();
    }
    expect(sim.crash?.kind).toBe('slab');
  });

  it('a slower config is honoured in metres per second (the step size never changes the speed)', () => {
    const slow = withConfig({ speed: { start: 6, max: 6 } });
    const sim = new RunnerSim({ seed: 1, config: slow, course: () => fixedCourse([]) });
    sim.start(true);
    for (let i = 0; i < stepsFor(2); i++) sim.step();
    expect(sim.distance).toBeCloseTo(12, 6);
  });
});
