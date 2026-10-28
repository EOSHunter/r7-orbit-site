// The full climb (docs/ASCENT.md, "Phase 3"): five zones, one .glb each (tools/ascent/build_climb.py), loaded in order as the
// agent nears them, and joined into one Level (joinParts, level.ts). climb.json, written by the same script and bundled with
// the game, names the zones and their heights and says where the ring is, so the altimeter and the goal are known before the
// top zones have loaded. A zone loads when the agent enters the one below it: there is always a zone above it ready.

import manifest from './assets/climb.json';
import zone1 from './assets/zone-1.glb?url';
import zone2 from './assets/zone-2.glb?url';
import zone3 from './assets/zone-3.glb?url';
import zone4 from './assets/zone-4.glb?url';
import zone5 from './assets/zone-5.glb?url';
import { loadPartModel, type PartModel } from './gltf-level';
import { joinParts, type Level, type LevelZone } from './level';

export interface ClimbManifest {
  zones: (LevelZone & { file: string })[];
  goal: { x: number; y: number; z: number };
}

// A JSON import types an array as number[]: a look's sun_dir is checked to be three numbers here.
export const CLIMB: ClimbManifest = {
  ...manifest,
  zones: manifest.zones.map(({ look, ...zone }) => {
    const [x, y, z, ...rest] = look.sun_dir;
    if (z === undefined || rest.length)
      throw new Error(`R7: Ascent's climb.json: zone ${zone.n}'s sun_dir is not 3 numbers`);
    return { ...zone, look: { ...look, sun_dir: [x, y, z] as [number, number, number] } };
  }),
};
const URLS = [zone1, zone2, zone3, zone4, zone5];

/** The name a saved climb goes by (save.ts): a new layout of the climb would change it, so an old save is not offered. */
export const CLIMB_SAVE_NAME = 'climb-1';

export interface Climb {
  readonly manifest: ClimbManifest;
  /** The zones loaded so far, bottom up. */
  readonly parts: readonly PartModel[];
  /** Those zones joined, every zone of the manifest named (for the altimeter), the goal from the manifest until zone 5. */
  readonly level: Level;
  /** Load the zones up to the n-th (1-based), in order; resolves with the zones that were added, bottom up. */
  loadTo(n: number): Promise<PartModel[]>;
  /** The zone (1-based) a height is in. */
  zoneAt(y: number): number;
}

/** Zone n's model from its URL (the tests load the files from disk instead). */
export type ZoneLoader = (n: number) => Promise<PartModel>;

const fromNetwork: ZoneLoader = (n) => loadPartModel(URLS[n - 1]);

/** The climb with its first `upTo` zones loaded. Rejects when one of them cannot be loaded or used. */
export async function loadClimb(upTo = 2, load: ZoneLoader = fromNetwork, info: ClimbManifest = CLIMB): Promise<Climb> {
  const parts: PartModel[] = [];
  let pending: Promise<PartModel[]> | null = null;
  const join = (): Level => ({
    ...joinParts(
      parts.map((p) => p.part),
      info.goal,
      'the climb',
    ),
    zones: info.zones.map(({ n, title, base, top, look }) => ({ n, title, base, top, ...(look ? { look } : {}) })),
  });
  let level: Level;
  const zoneAt = (y: number) => {
    let n = 1;
    for (const z of info.zones) if (y >= z.base) n = z.n;
    return n;
  };
  const climb: Climb = {
    manifest: info,
    parts,
    get level() {
      return level;
    },
    async loadTo(n: number) {
      const target = Math.min(n, info.zones.length);
      if (parts.length >= target) return [];
      if (pending) {
        await pending;
        return climb.loadTo(n);
      }
      const added: PartModel[] = [];
      pending = (async () => {
        // In parallel, then added in order: the boxes' order in the level must be the zones' order.
        const loaded = await Promise.all(
          Array.from({ length: target - parts.length }, (_, k) => load(parts.length + k + 1)),
        );
        parts.push(...loaded);
        added.push(...loaded);
        level = join();
        return added;
      })();
      try {
        return await pending;
      } finally {
        pending = null;
      }
    },
    zoneAt,
  };
  await climb.loadTo(Math.max(1, upTo));
  return climb;
}
