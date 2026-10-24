// A small seeded random generator (mulberry32): the same seed always gives the same course, so the tests are deterministic.
// The live game seeds it from Date.now().

export type Random = () => number;

/** A generator of numbers in [0, 1) from a 32-bit seed. */
export function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One of the keys of `weights`, picked with odds proportional to its weight. */
export function pickWeighted<K extends string>(rand: Random, weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  let r = rand() * total;
  for (const [key, w] of entries) {
    r -= Math.max(0, w);
    if (r < 0) return key;
  }
  return entries[entries.length - 1][0];
}
