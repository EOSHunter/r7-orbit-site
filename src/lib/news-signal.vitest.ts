import { describe, expect, it } from 'vitest';
import { NEWS_TOPICS, beamPath, hash, signal } from './news-signal';

describe('news pictures (Pulsar\'s signals)', () => {
  it('has the seven topics', () => {
    expect(Object.keys(NEWS_TOPICS)).toEqual(['models', 'tools', 'trends', 'games', 'home', 'policy', 'orbit']);
  });

  it('is the same picture for the same address, and a different one for another', () => {
    expect(signal('/news/a/')).toEqual(signal('/news/a/'));
    const a = signal('/news/a/'), b = signal('/news/b/');
    expect([a.beam.from, a.dot.x, a.dot.y]).not.toEqual([b.beam.from, b.dot.x, b.dot.y]);
    expect(hash('x')).toBe(hash('x'));
  });

  it('keeps the dot on a ring and out of the beam', () => {
    for (const seed of ['/news/a/', '/news/b/', '/news/c/', '/news/a-longer-address/', '/news/2026/']) {
      const s = signal(seed);
      const d = Math.hypot(s.dot.x - s.cx, s.dot.y - s.cy);
      expect(s.rings.some((r) => Math.abs(r.r - d) < 0.5)).toBe(true);
      const ang = ((Math.atan2(s.dot.y - s.cy, s.dot.x - s.cx) * 180) / Math.PI + 360) % 360;
      const from = ((s.beam.from % 360) + 360) % 360, to = from + (s.beam.to - s.beam.from);
      const inBeam = (ang >= from && ang <= to) || (ang + 360 >= from && ang + 360 <= to);
      expect(inBeam).toBe(false);
    }
  });

  it('has one dashed ring, rings growing outward and fading', () => {
    const { rings } = signal('/news/a/');
    expect(rings.filter((r) => r.dashed)).toHaveLength(1);
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i].r).toBeGreaterThan(rings[i - 1].r);
      expect(rings[i].opacity).toBeLessThan(rings[i - 1].opacity);
    }
  });

  it('draws the banner wide and the card 16:9', () => {
    expect([signal('/x/').width, signal('/x/').height]).toEqual([1600, 900]);
    expect([signal('/x/', 'banner').width, signal('/x/', 'banner').height]).toEqual([2400, 600]);
    expect(beamPath(0, 0, 10, 0, 90)).toBe('M0 0 L10 0 A10 10 0 0 1 0 10 Z');
  });
});
