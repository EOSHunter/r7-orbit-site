// News images ("Pulsar's signals", docs/DECISIONS.md): a topic's object from R7 Orbit Studio (public/media/news/topics/<topic>.webp,
// authored/news-topics in the studio) inside pulse rings, a scanning beam and a dot, drawn by NewsSignal.astro. This works out the
// geometry: the same for every item of a topic except what the item's address (the seed) varies, so no two items match.
// Pure and deterministic: unit-tested in news-signal.vitest.ts.

let signalCount = 0;
/** A number for each news picture drawn, so the ids of its gradients stay unique when one item is shown twice on a page (a
 *  related card and the older/newer link, the feed and a list block). */
export function nextSignalNumber(): number {
  signalCount += 1;
  return signalCount;
}

export const NEWS_TOPICS = {
  models: 'New models',
  tools: 'Tools and things to try',
  trends: 'Trends',
  games: 'Games and creative tools',
  home: 'Smart home',
  policy: 'Rules and policy',
  orbit: 'R7 Orbit',
  security: 'Security',
  business: 'Business',
} as const;
export type NewsTopic = keyof typeof NEWS_TOPICS;
export const NEWS_TOPIC_KEYS = Object.keys(NEWS_TOPICS) as [NewsTopic, ...NewsTopic[]];
export type NewsVariant = 'card' | 'banner';

export interface Ring {
  r: number;
  opacity: number;
  dashed: boolean;
}
export interface Signal {
  width: number;
  height: number;
  cx: number;
  cy: number;
  rings: Ring[];
  beam: { from: number; to: number; r: number }; // degrees, 0 = right, clockwise
  dot: { x: number; y: number; r: number };
  object: number; // the sprite's size
}

/** FNV-1a: a small stable hash of the seed (the item's address). */
export function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const rnd = (h: number, salt: number) => (hash(`${h}:${salt}`) % 10000) / 10000;
const r1 = (v: number) => Math.round(v * 10) / 10;

export function signal(seed: string, variant: NewsVariant = 'card'): Signal {
  const h = hash(seed);
  const [width, height] = variant === 'card' ? [1600, 900] : [2400, 600];
  const cx = variant === 'card' ? 800 : 1200 + (rnd(h, 1) - 0.5) * 600;
  const cy = height / 2;
  const base = variant === 'card' ? 170 : 150;
  const step = variant === 'card' ? 115 + rnd(h, 2) * 20 : 120 + rnd(h, 2) * 25;
  const dashedAt = 1 + Math.floor(rnd(h, 3) * 3); // one of the outer rings is dashed
  const rings: Ring[] = Array.from({ length: 5 }, (_, i) => ({
    r: r1(base + i * step),
    opacity: r1((0.7 - i * 0.12) * 100) / 100,
    dashed: i === dashedAt,
  }));
  const beamAt = rnd(h, 4) * 360;
  const beamWidth = 14 + rnd(h, 5) * 10;
  const dotRing = rings[2 + Math.floor(rnd(h, 6) * 2)];
  const dotAt = ((beamAt + 40 + rnd(h, 7) * 220) * Math.PI) / 180; // never inside the beam
  return {
    width,
    height,
    cx: r1(cx),
    cy,
    rings,
    beam: { from: r1(beamAt), to: r1(beamAt + beamWidth), r: r1(rings[rings.length - 1].r + step) },
    dot: { x: r1(cx + dotRing.r * Math.cos(dotAt)), y: r1(cy + dotRing.r * Math.sin(dotAt)), r: variant === 'card' ? 10 : 9 },
    object: variant === 'card' ? 600 : 470,
  };
}

/** SVG path data for a pie slice (the beam) from `from` to `to` degrees. */
export function beamPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const p = (deg: number) => [r1(cx + r * Math.cos((deg * Math.PI) / 180)), r1(cy + r * Math.sin((deg * Math.PI) / 180))];
  const [x0, y0] = p(from);
  const [x1, y1] = p(to);
  return `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`;
}
