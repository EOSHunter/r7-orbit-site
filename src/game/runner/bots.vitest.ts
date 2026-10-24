import { describe, expect, it } from 'vitest';
import { BOT_PROFILES, formatTable, playMany, playRun } from './bots';
import { RUNNER_CONFIG } from './config';

// The bots (bots.ts) play the real sim. These tests keep their numbers inside wide bands around the targets in docs/RUNNER.md
// ("Difficulty and bots"): a first-time player (novice) lasts 25 to 45 s, a good one a few minutes, the oracle never dies.
// The bands are wider than the targets because the runs are fewer than the 300 of `npm run runner:bots`.

describe('bots', () => {
  it('a run is a pure function of the bot, the seed and the config', () => {
    for (const name of ['novice', 'average', 'expert'] as const) {
      const a = playRun(BOT_PROFILES[name], 4242, { maxTime: 120 });
      const b = playRun(BOT_PROFILES[name], 4242, { maxTime: 120 });
      expect(a).toEqual(b);
    }
    expect(playMany(BOT_PROFILES.novice, 25)).toEqual(playMany(BOT_PROFILES.novice, 25));
    const other = playRun(BOT_PROFILES.novice, 4243, { maxTime: 120 });
    expect(other).not.toEqual(playRun(BOT_PROFILES.novice, 4242, { maxTime: 120 }));
  });

  it('idle does nothing and dies on the first obstacle, in the middle lane, within 12 s', () => {
    const idle = playMany(BOT_PROFILES.idle, 60);
    expect(idle.survivors).toBe(0);
    expect(idle.time.p90).toBeLessThan(12);
    expect(idle.time.median).toBeGreaterThan(5);
    // The first row is the same distance away every run; what differs is the obstacle (a slab or a barrier).
    expect(Object.keys(idle.byKind).sort()).toEqual(['barrier', 'slab']);
    expect(idle.distance.median).toBeLessThan(RUNNER_CONFIG.spawn.firstRowAt);
  });

  it('novice, average and expert land in their bands, and the better the bot the longer it lasts', () => {
    const novice = playMany(BOT_PROFILES.novice, 80);
    const average = playMany(BOT_PROFILES.average, 80);
    const expert = playMany(BOT_PROFILES.expert, 60);
    expect(novice.time.median, 'a first-time player: about 30 to 45 s').toBeGreaterThan(22);
    expect(novice.time.median).toBeLessThan(52);
    expect(average.time.median, 'a decent player: a minute or two').toBeGreaterThan(50);
    expect(average.time.median).toBeLessThan(135);
    expect(expert.time.median, 'an expert: well past 150 s').toBeGreaterThan(130);
    expect(expert.time.p90, 'with a long tail of runs that last for minutes').toBeGreaterThan(250);
    expect(novice.time.median).toBeLessThan(average.time.median);
    expect(average.time.median).toBeLessThan(expert.time.median);
    expect(novice.distance.median).toBeLessThan(average.distance.median);
    // They die on obstacles, and the new hazards are among them for those who get that far.
    expect(Object.keys(expert.byKind).length).toBeGreaterThanOrEqual(3);
    expect(expert.bySpeed.reduce((n, b) => n + b.deaths, 0)).toBe(expert.runs - expert.survivors);
  }, 120_000);

  it('the perfect oracle survives at the cap for a very long run: the course can be beaten', () => {
    // 900 s: the cap (40 m/s) is reached at 180 s, so 12 minutes of it.
    const perfect = playMany(BOT_PROFILES.perfect, 6, { maxTime: 900 });
    expect(perfect.survivors).toBe(6);
    expect(perfect.time.median).toBeGreaterThanOrEqual(900);
    expect(perfect.distance.median).toBeGreaterThan(30_000);
  }, 120_000);

  it('formatTable gives the table of docs/RUNNER.md', () => {
    const table = formatTable([playMany(BOT_PROFILES.novice, 10)]);
    expect(table).toContain('| novice | 10 |');
    expect(table).toContain('Deaths by obstacle');
  });
});
