import { describe, expect, it } from 'vitest';
import data from '../data/r7-orbit-patch-notes.json';
import { changeCount, releaseId, summarise, type PatchNotes } from './patch-notes';

const notes = data as PatchNotes;

describe('patch notes', () => {
  it('summarises the real data: 42 releases and 159 changes, newest 0.24.1 on 2026-10-24, first 0.2.1', () => {
    const s = summarise(notes);
    expect(s.releases).toBe(42);
    expect(s.changes).toBe(159);
    expect(s.latest.version).toBe('0.24.1');
    expect(s.latest.date).toBe('2026-10-24');
    expect(s.first.version).toBe('0.2.1');
  });

  it('keeps the data newest first, with a date and at least one change on every release', () => {
    for (let i = 0; i < notes.releases.length; i++) {
      const r = notes.releases[i];
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(changeCount(r)).toBeGreaterThan(0);
      if (i > 0) expect(r.date <= notes.releases[i - 1].date).toBe(true);
    }
  });

  it('takes the latest by date, and on the same day the release listed first', () => {
    const r = (version: string, date: string) => ({
      version,
      date,
      sections: [{ heading: null, items: [{ title: null, body: 'x' }] }],
    });
    const s = summarise({
      source: 't',
      releases: [r('0.2.0', '2026-10-02'), r('0.3.0', '2026-10-05'), r('0.3.1', '2026-10-05')],
    });
    expect(s.latest.version).toBe('0.3.0');
    expect(s.first.version).toBe('0.2.0');
    expect(s.changes).toBe(3);
  });

  it('refuses empty data and makes safe fragment ids', () => {
    expect(() => summarise({ source: 't', releases: [] })).toThrow(/no releases/);
    expect(releaseId('0.14.2')).toBe('patch-0-14-2');
  });
});
