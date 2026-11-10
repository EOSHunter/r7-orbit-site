import { describe, expect, it } from 'vitest';
import { stepHref, teamCardId, teamGroups, teamLevels } from './team';

const m = (author: string, group?: string) => ({ author, group });

describe('teamGroups', () => {
  it('is one run with no name when no member has a group (one grid, as before groups)', () => {
    expect(teamGroups([m('a'), m('b')])).toEqual([{ name: '', members: [m('a'), m('b')] }]);
  });

  it('cuts the members into runs of the same group, in order, trimming the names', () => {
    const groups = teamGroups([m('r7', 'Lead'), m('pulsar', 'Writers'), m('orion', ' Writers '), m('pictor', 'Studio')]);
    expect(groups.map((g) => [g.name, g.members.map((x) => x.author)])).toEqual([
      ['Lead', ['r7']],
      ['Writers', ['pulsar', 'orion']],
      ['Studio', ['pictor']],
    ]);
  });

  it('keeps the order the author set: the same group twice, apart, is two runs', () => {
    expect(teamGroups([m('a', 'X'), m('b', 'Y'), m('c', 'X')]).map((g) => g.name)).toEqual(['X', 'Y', 'X']);
  });

  it('is empty for no members', () => {
    expect(teamGroups([])).toEqual([]);
  });
});

describe('stepHref', () => {
  it("links to the member's card on the page, or to the author page of someone without a card", () => {
    const onTeam = new Set(['pulsar']);
    expect(stepHref('pulsar', onTeam, '/authors/pulsar/')).toBe(`#${teamCardId('pulsar')}`);
    expect(stepHref('hunter-newton', onTeam, '/authors/hunter-newton/')).toBe('/authors/hunter-newton/');
  });
});

describe('teamLevels', () => {
  it('puts headings one under the section heading above the block, and names one under those once a heading is drawn', () => {
    expect(teamLevels(true, true)).toEqual({ section: 3, name: 4 });
    expect(teamLevels(true, false)).toEqual({ section: 3, name: 3 });
    expect(teamLevels(false, true)).toEqual({ section: 2, name: 3 });
    expect(teamLevels(false, false)).toEqual({ section: 2, name: 2 });
  });
});
