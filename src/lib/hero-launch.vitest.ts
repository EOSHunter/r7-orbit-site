import { describe, expect, it } from 'vitest';
import data from '../data/home-hero.json';
import { HERO_TIMING, heroLaunchSvg, type HeroData } from './hero-launch';

const names = [...data.projects.map((p) => p.project), 'agent'];
const sprites = Object.fromEntries(names.map((n) => [n, `data:image/webp;base64,${n}`]));
const svg = heroLaunchSvg(data as HeroData, sprites, { brass: '#c9a96a' });

describe('the home hero moving layer', () => {
  it('is self-contained: every picture is a data: URL (an SVG shown as an image cannot load files)', () => {
    const hrefs = [...svg.matchAll(/<image [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((h) => h.startsWith('data:'))).toBe(true);
    expect(hrefs).toHaveLength(names.length); // each sprite once, reused with <use>
  });

  it('launches one agent per project, then loops every project round the ring for good', () => {
    expect(svg.match(/class="trail"/g)).toHaveLength(data.projects.length);
    const loops = svg.match(/repeatCount="indefinite"/g) ?? [];
    expect(loops).toHaveLength(data.projects.length);
    const lastDock = HERO_TIMING.start + (data.projects.length - 1) * HERO_TIMING.gap + HERO_TIMING.flight;
    const orbitBegin = Number(svg.match(/repeatCount="indefinite"/) && svg.match(/<animateMotion path="[^"]+" begin="([\d.]+)s"/)?.[1]);
    expect(orbitBegin).toBeGreaterThan(lastDock); // the projects move only once every agent has docked
  });

  it('has a still version for reduced motion: every project with its agent docked, nothing moving', () => {
    const still = heroLaunchSvg(data as HeroData, sprites, { brass: '#c9a96a' }, { still: true });
    expect(still.match(/<use /g)).toHaveLength(data.projects.length * 2);
    expect(still).not.toMatch(/animate|<set |animation/);
  });

  it('refuses to build without a sprite', () => {
    expect(() => heroLaunchSvg(data as HeroData, { agent: 'data:x' }, { brass: '#000' })).toThrow(/no sprite/);
  });
});
