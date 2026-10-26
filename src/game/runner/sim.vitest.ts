import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './clock';
import { RUNNER_CONFIG, jumpPhysics, speedAt, timeAtDistance, touchMinCrouch, withConfig } from './config';
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
    sim.input('crouch');
    sim.input('left');
    for (let i = 0; i < n; i++) sim.step();
    expect(sim.crouching).toBe(true);
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

describe('crouch (hold to crouch)', () => {
  const hold = (sim: RunnerSim, seconds: number) => {
    for (let i = 0; i < stepsFor(seconds); i++) sim.step();
  };

  it('is held exactly as long as the key is: the amount eases to 1 and stays there for 10 simulated seconds', () => {
    const sim = simOn([]);
    sim.input('crouch');
    sim.step();
    expect(sim.crouching).toBe(true);
    expect(sim.crouch).toBeGreaterThan(0);
    hold(sim, cfg.crouch.inTime + 0.02);
    expect(sim.crouch).toBe(1);
    expect(sim.roverHeight).toBeCloseTo(cfg.hitbox.rover.crouchHeight, 9);
    for (let i = 0; i < stepsFor(10); i++) {
      sim.step();
      if (sim.crouch !== 1 || !sim.crouching) throw new Error(`stood up while held at ${sim.time.toFixed(3)} s`);
    }
    expect(sim.phase).toBe('playing');
  });

  it('release stands up over crouch.outTime, starting at the release and not before', () => {
    const sim = simOn([]);
    sim.input('crouch');
    hold(sim, 1);
    sim.input('crouchEnd');
    sim.step();
    expect(sim.crouching).toBe(false);
    expect(sim.crouch).toBeLessThan(1);
    expect(sim.crouch).toBeGreaterThan(0.9);
    hold(sim, cfg.crouch.outTime / 2);
    expect(sim.crouch).toBeGreaterThan(0.3);
    expect(sim.crouch).toBeLessThan(0.7);
    hold(sim, cfg.crouch.outTime);
    expect(sim.crouch).toBe(0);
    expect(sim.roverHeight).toBe(cfg.hitbox.rover.height);
  });

  it('key repeat does not retrigger, and a press while crouched changes nothing', () => {
    const sim = simOn([]);
    sim.input('crouch');
    hold(sim, 0.5);
    const before = { crouch: sim.crouch, held: sim.crouchHeld, min: sim.crouchMin };
    for (let i = 0; i < 10; i++) sim.input('crouch'); // the same press again and again
    hold(sim, 0.5);
    expect({ crouch: sim.crouch, held: sim.crouchHeld, min: sim.crouchMin }).toEqual(before);
  });

  it('a jump cancels the crouch (jump wins; the key must be pressed again), and a crouch pressed in the air slams', () => {
    const sim = simOn([]);
    sim.input('crouch');
    hold(sim, 0.3);
    sim.input('jump');
    sim.step();
    expect(sim.grounded).toBe(false);
    expect(sim.crouchHeld).toBe(false);
    hold(sim, 1);
    expect(sim.grounded).toBe(true);
    expect(sim.crouching, 'landed standing: the cancelled hold does not come back').toBe(false);

    // Crouch pressed in the air: drop at slamSpeed, and crouched on landing for as long as it is held.
    const s2 = simOn([]);
    s2.input('jump');
    hold(s2, 0.15);
    s2.input('crouch');
    let steps = 0;
    while (!s2.grounded) {
      s2.step();
      steps++;
    }
    expect(steps * STEP).toBeLessThanOrEqual(cfg.jump.height / cfg.crouch.slamSpeed + STEP);
    expect(s2.crouching).toBe(true);
    hold(s2, 3);
    expect(s2.crouch).toBe(1);
    // A jump pressed during the slam does not undo it.
    const s3 = simOn([]);
    s3.input('jump');
    hold(s3, 0.15);
    s3.input('crouch');
    s3.input('jump');
    while (!s3.grounded) s3.step();
    expect(s3.crouching).toBe(true);
    // Let go in the air: the slam still lands, and the rover stands.
    const s4 = simOn([]);
    s4.input('jump');
    hold(s4, 0.15);
    s4.input('crouch');
    s4.step();
    s4.input('crouchEnd');
    while (!s4.grounded) s4.step();
    expect(s4.crouching).toBe(false);
  });

  it('lane changes work while crouched and do not end the crouch', () => {
    const sim = simOn([]);
    sim.input('crouch');
    hold(sim, 0.2);
    sim.input('right');
    hold(sim, 0.3);
    expect(sim.lane).toBe(1);
    expect(sim.x).toBeCloseTo(cfg.track.laneWidth, 9);
    expect(sim.crouching).toBe(true);
  });

  it('is cleared by a crash and a restart (a key still down does not carry over), and ignored when not playing', () => {
    const ready = new RunnerSim({ seed: 1 });
    ready.input('crouch');
    ready.step();
    expect(ready.crouchHeld).toBe(false);

    const sim = simOn([{ z: 30, lanes: [null, 'slab', null] }]);
    sim.input('crouch');
    driveTo(sim, 1000);
    expect(sim.phase).toBe('over');
    expect(sim.crouchHeld).toBe(false);
    expect(sim.crouchMin).toBe(0);
    sim.input('crouch'); // pressed on the game-over screen: nothing
    sim.step();
    expect(sim.crouchHeld).toBe(false);
    hold(sim, cfg.score.restartDelay + 0.1);
    sim.input('primary');
    sim.step();
    expect(sim.phase).toBe('playing');
    expect(sim.crouching).toBe(false);
    expect(sim.crouch).toBe(0);
  });

  it('crouchCancel (blur, pause) forgets the hold and the touch minimum; crouchEnd keeps the minimum', () => {
    const sim = simOn([]);
    sim.input('crouchTouch');
    hold(sim, 0.05);
    sim.input('crouchCancel');
    sim.step();
    expect(sim.crouching).toBe(false);
    expect(sim.crouchMin).toBe(0);

    const touch = simOn([]);
    touch.input('crouchTouch');
    touch.step();
    touch.input('crouchEnd');
    touch.step();
    expect(touch.crouching, 'the minimum still holds it').toBe(true);
  });

  it('touch: a swipe down crouches while the finger stays down, and at least touchMinCrouch after a quick flick', () => {
    const sim = simOn([]);
    const min = touchMinCrouch(sim.speed, cfg);
    expect(min).toBeCloseTo(cfg.crouch.touchMinTime, 6); // at the start speed it is the config value
    sim.input('crouchTouch');
    sim.step();
    sim.input('crouchEnd'); // a flick: the finger is up at once
    hold(sim, min - 0.05);
    expect(sim.crouching, 'still crouched inside the minimum').toBe(true);
    hold(sim, 0.1);
    expect(sim.crouching, 'stood up once it ran out').toBe(false);

    // Finger down for 5 s: crouched the whole time, no timer.
    const held = simOn([]);
    held.input('crouchTouch');
    for (let i = 0; i < stepsFor(5); i++) {
      held.step();
      if (!held.crouching) throw new Error('stood up under a finger');
    }
    held.input('crouchEnd');
    hold(held, 0.2);
    expect(held.crouching).toBe(false);

    // A jump swipe while holding releases the crouch.
    const jumped = simOn([]);
    jumped.input('crouchTouch');
    hold(jumped, 0.1);
    jumped.input('jump');
    jumped.step();
    expect(jumped.grounded).toBe(false);
    expect(jumped.crouchHeld).toBe(false);
    expect(jumped.crouchMin).toBe(0);
  });

  it('the touch minimum covers the longest gate at every speed: speed in, a flick still gets under', () => {
    const gate = cfg.hitbox.gate;
    const rover = cfg.hitbox.rover;
    for (const v of [cfg.speed.start, 18, 25, 32, 40, 60]) {
      const min = touchMinCrouch(v, cfg);
      // Distance driven while crouched covers the rover passing under the whole beam.
      expect(min * v, `at ${v} m/s`).toBeGreaterThanOrEqual(rover.length + gate.length);
      expect(min).toBeLessThanOrEqual(cfg.crouch.touchMinTime + 1e-9);
    }
  });

  it('a gate is passed only while crouched: running, jumping, or standing up under it ends the run', () => {
    const rows: Parameters<typeof simOn>[0] = [{ z: 40, lanes: [null, 'gate', null] }];
    const through = (release: (z: number) => number | null, press = 40 - 8) => {
      const sim = simOn(rows);
      const acts: { at: number; intent: Intent }[] = [{ at: press, intent: 'crouch' }];
      const r = release(40);
      if (r !== null) acts.push({ at: r, intent: 'crouchEnd' });
      driveTo(sim, 70, acts);
      return sim;
    };
    const rearClear = 40 + cfg.hitbox.gate.length / 2 + cfg.hitbox.rover.length / 2;
    expect(through(() => rearClear + 1).phase, 'held through, released after').toBe('playing');
    expect(through(() => null).phase, 'held for ever').toBe('playing');
    expect(through((z) => z - 0.5).crash?.kind, 'released before the beam').toBe('gate');
    expect(through((z) => z - 0.6).crash?.kind, 'released under the beam').toBe('gate');
    expect(through(() => rearClear + 1, 100).crash?.kind, 'never crouched').toBe('gate');
  });
});

describe('collisions', () => {
  const contact = (z: number, kind: 'slab' | 'barrier' | 'gate') =>
    z - cfg.hitbox[kind].length / 2 - cfg.hitbox.rover.length / 2;
  // The rover reaches the row a little over 2 s in, at about 13 m/s; a press this far before contact is mid-window.
  const jumpAt = (z: number) => contact(z, 'barrier') - 2.6;
  const crouchAt = (z: number) => contact(z, 'gate') - 3;
  const standAt = (z: number) => z + 2;

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

  it('a barrier: jumping over it succeeds, driving or crouching into it ends the run', () => {
    const ok = simOn([{ z: 30, lanes: [null, 'barrier', null] }]);
    driveTo(ok, 100, [{ at: jumpAt(30), intent: 'jump' }]);
    expect(ok.phase).toBe('playing');

    const ran = simOn([{ z: 30, lanes: [null, 'barrier', null] }]);
    driveTo(ran, 100);
    expect(ran.crash?.kind).toBe('barrier');

    const crouched = simOn([{ z: 30, lanes: [null, 'barrier', null] }]);
    driveTo(crouched, 100, [{ at: crouchAt(30), intent: 'crouch' }]);
    expect(crouched.crash?.kind).toBe('barrier');
  });

  it('a gate: crouching under it succeeds, driving or jumping into it ends the run', () => {
    const ok = simOn([{ z: 30, lanes: [null, 'gate', null] }]);
    driveTo(ok, 100, [
      { at: crouchAt(30), intent: 'crouch' },
      { at: standAt(30), intent: 'crouchEnd' },
    ]);
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

describe('the wall with one opening and the sweeper', () => {
  const lw = cfg.track.laneWidth;
  const hit = (sim: RunnerSim, kind: string) => sim.crash?.kind === kind;

  it('a wall: the open lane is the way through; a panel ends the run; a gate or barrier in the opening is passed as usual', () => {
    const wall = [{ z: 30, lanes: ['wall', null, 'wall'] as Row['lanes'] }];
    const through = simOn(wall);
    driveTo(through, 60, [{ at: 0, intent: 'left' }, { at: 1, intent: 'right' }]);
    expect(through.phase, 'drove through the opening').toBe('playing');
    const crashed = simOn(wall);
    driveTo(crashed, 60, [{ at: 5, intent: 'left' }]);
    expect(hit(crashed, 'wall')).toBe(true);
    const jumped = simOn(wall);
    driveTo(jumped, 60, [{ at: 5, intent: 'left' }, { at: 29 - 2.6, intent: 'jump' }]);
    expect(hit(jumped, 'wall'), 'a wall is full height: jumping does not clear it').toBe(true);

    const gate = [{ z: 30, lanes: ['wall', 'gate', 'wall'] as Row['lanes'] }];
    const ok = simOn(gate);
    driveTo(ok, 60, [
      { at: 20, intent: 'crouch' },
      { at: 34, intent: 'crouchEnd' },
    ]);
    expect(ok.phase).toBe('playing');
    const ran = simOn(gate);
    driveTo(ran, 60);
    expect(hit(ran, 'gate')).toBe(true);
  });

  it('a wall is thin: at the cap the rover cannot step through it between two steps', () => {
    const fast = withConfig({ speed: { start: 40, max: 40 } });
    const sim = simOn([{ z: 60, lanes: ['wall', 'wall', 'wall'] }], fast);
    driveTo(sim, 100);
    expect(hit(sim, 'wall')).toBe(true);
    expect(cfg.hitbox.wall.length + cfg.hitbox.rover.length).toBeGreaterThan(40 * STEP);
  });

  /** A sweeper over lanes -1 and 0 that is `where` ('lower', 'upper' or 'between') when the rover arrives at z = 60. */
  const sweeper = (where: 'lower' | 'upper' | 'between') => {
    const z = 60;
    const arrive = timeAtDistance(z);
    const period = 3.4;
    const t0 = arrive - (where === 'upper' ? period / 2 : where === 'between' ? period / 4 : 0);
    return [{ z, lanes: ['sweeper', 'sweeper', null] as Row['lanes'], sweep: { lane: -1 as const, period, t0 } }];
  };
  const passWith = (rows: ReturnType<typeof sweeper>, lane: 'left' | 'none' | 'right') => {
    const sim = simOn(rows);
    const todo: { at: number; intent: Intent }[] = [];
    if (lane === 'left') todo.push({ at: 0, intent: 'left' });
    if (lane === 'right') todo.push({ at: 0, intent: 'right' });
    driveTo(sim, 90, todo);
    return sim;
  };

  it('a sweeper at one end of its swing when the rover arrives leaves the other lane open, and the third lane is always open', () => {
    // Over the lower lane (-1): the middle lane is open.
    expect(hit(passWith(sweeper('lower'), 'left'), 'sweeper')).toBe(true);
    expect(passWith(sweeper('lower'), 'none').phase).toBe('playing');
    expect(passWith(sweeper('lower'), 'right').phase).toBe('playing');
    // Over the upper lane (0): the left lane is open.
    expect(hit(passWith(sweeper('upper'), 'none'), 'sweeper')).toBe(true);
    const left = simOn(sweeper('upper'));
    driveTo(left, 90, [{ at: 0, intent: 'left' }]);
    expect(left.phase).toBe('playing');
    expect(passWith(sweeper('upper'), 'right').phase).toBe('playing');
  });

  it('halfway through its swing a sweeper blocks both its lanes (the third is the safe one)', () => {
    expect(hit(passWith(sweeper('between'), 'none'), 'sweeper')).toBe(true);
    expect(hit(passWith(sweeper('between'), 'left'), 'sweeper')).toBe(true);
    expect(passWith(sweeper('between'), 'right').phase).toBe('playing');
  });

  it('a sweeper moves smoothly with the play time: slow at the ends, over each lane in turn, never jumping', () => {
    const rows = sweeper('lower');
    const sim = simOn(rows);
    const o = sim.obstacles.find((x) => x.kind === 'sweeper')!;
    const { period, t0 } = rows[0].sweep;
    expect(sim.obstacleX(o, t0)).toBeCloseTo(-lw, 9);
    expect(sim.obstacleX(o, t0 + period / 2)).toBeCloseTo(0, 9);
    expect(sim.obstacleX(o, t0 + period)).toBeCloseTo(-lw, 9);
    let fastest = 0;
    let last = sim.obstacleX(o, t0);
    for (let t = t0 + STEP; t <= t0 + period; t += STEP) {
      const x = sim.obstacleX(o, t);
      fastest = Math.max(fastest, Math.abs(x - last) / STEP);
      last = x;
    }
    // Its top speed is pi/2 lanes per half period: slow compared with the rover's lane change (laneWidth / laneChangeTime).
    expect(fastest).toBeLessThan(lw / cfg.track.laneChangeTime / 4);
    expect(fastest).toBeCloseTo((Math.PI * lw) / period, 1);
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
    { at: contact(120, 'gate') - 3.2, intent: 'crouch' },
    { at: 124, intent: 'crouchEnd' }, // the key held for about 8 m (0.4 s) through the gate and let go after it
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

  it('held keys: the crouch amount at the gate and at the end of the run match at every frame rate', () => {
    // The state the held key left behind, not just the outcome: the same steps, so the same crouch amount to the bit.
    const state = (frameMs: number) => {
      const sim = new RunnerSim({ seed: 9, course: () => fixedCourse(course) });
      const clock = new FixedStepClock();
      sim.start(true);
      let now = 5000;
      clock.advance(now);
      const todo = [...script];
      let wasCrouched = 0;
      let longest = 0;
      let run = 0;
      for (let f = 0; f < 1e6 && sim.phase === 'playing'; f++) {
        while (todo.length && sim.distance >= todo[0].at) sim.input(todo.shift()!.intent);
        now += frameMs;
        for (let i = clock.advance(now).steps; i > 0; i--) {
          sim.step();
          run = sim.crouching ? run + 1 : 0;
          longest = Math.max(longest, run);
          if (sim.crouching) wasCrouched++;
        }
      }
      return { wasCrouched, longest };
    };
    const ref = state(1000 / 120);
    expect(ref.longest * STEP).toBeGreaterThan(0.3);
    for (const hz of [30, 60, 144, 240]) {
      const got = state(1000 / hz);
      // The input lands on the first frame past a point: at most one frame (in steps) of difference in the hold.
      expect(Math.abs(got.wasCrouched - ref.wasCrouched), `${hz} Hz`).toBeLessThanOrEqual(Math.ceil(120 / hz) + 1);
    }
  });

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

  it('a held crouch lasts as long as the key is held at 30, 60 and 240 Hz, through a 2 s stall, and ends on release', () => {
    for (const [frameMs, stall] of [
      [1000 / 30, false],
      [1000 / 60, false],
      [1000 / 240, false],
      [1000 / 60, true],
    ] as const) {
      const sim = new RunnerSim({ seed: 2, course: () => fixedCourse([]) });
      const clock = new FixedStepClock();
      sim.start(true);
      let now = 0;
      clock.advance(now);
      sim.input('crouch');
      let crouchedSteps = 0;
      let stalled = false;
      while (sim.time < 10) {
        now += stall && !stalled && sim.time >= 5 ? ((stalled = true), 2000) : frameMs;
        for (let i = clock.advance(now).steps; i > 0; i--) {
          sim.step();
          if (sim.time > cfg.crouch.inTime + STEP) {
            if (!sim.crouching || sim.crouch !== 1) throw new Error(`stood up while held at ${sim.time.toFixed(2)} s`);
            crouchedSteps++;
          }
        }
      }
      expect(crouchedSteps * STEP).toBeGreaterThan(9.5 - (stall ? 0.8 : 0));
      sim.input('crouchEnd');
      for (let i = clock.advance(now + 1000).steps; i > 0; i--) sim.step();
      for (let i = clock.advance(now + 2000).steps; i > 0; i--) sim.step();
      expect(sim.crouching).toBe(false);
      expect(sim.crouch).toBe(0);
    }
  });

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
