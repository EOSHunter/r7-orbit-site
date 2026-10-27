// The scene's colours, read from the design tokens at runtime (docs/ASCENT.md, "How it looks"), so the game has no colour
// values of its own and a token change reaches it without an edit. WebGL cannot use a CSS variable, so each token is put on a
// hidden probe element as its `color` and read back with getComputedStyle, which gives it as rgb() however tokens.css writes
// it. The parsing is pure (unit-tested); readTokenColors needs a DOM.

/** The tokens the scene uses, by what they are for. */
export const SCENE_TOKENS = {
  /** --bg: obsidian, the clear colour and the fog. */
  background: '--bg',
  /** --surface-1, -2, -3: the blocks' faces, darkest to lightest (depth is tone). */
  face1: '--surface-1',
  face2: '--surface-2',
  face3: '--surface-3',
  /** --void: the blob shadow under the agent. */
  shadow: '--void',
  /** --text: ivory, the edge lines and the agent. */
  ivory: '--text',
  /** --text-3: the agent's darker parts (its base). */
  dim: '--text-3',
  /** --brass: the one accent, the agent's visor and the goal ring. */
  brass: '--brass',
} as const;

export type SceneColorName = keyof typeof SCENE_TOKENS;

/**
 * The materials a level made in Blender may use, and the tones each one's faces take in the game: tops, sides facing ±X,
 * sides facing ±Z, undersides (a face at an angle mixes them by how much it faces each way). Blender's own colours are never
 * used; the names are the contract (tools/ascent/, docs/ASCENT.md "How it looks").
 */
export const LEVEL_MATERIALS = {
  /** Anything to climb on or look at: the phase 1 blocks' tones. */
  obsidian: { top: 'face3', sideX: 'face2', sideZ: 'face1', bottom: 'shadow', edges: true },
  /** The floor: a step darker than the blocks on it. */
  'obsidian-dark': { top: 'face2', sideX: 'face1', sideZ: 'face1', bottom: 'shadow', edges: true },
  /** The one accent: the goal ring (and later the beacons). */
  brass: { top: 'brass', sideX: 'brass', sideZ: 'brass', bottom: 'brass', edges: false },
  /** Small ivory details. */
  ivory: { top: 'ivory', sideX: 'ivory', sideZ: 'ivory', bottom: 'ivory', edges: false },
} as const satisfies Record<
  string,
  { top: SceneColorName; sideX: SceneColorName; sideZ: SceneColorName; bottom: SceneColorName; edges: boolean }
>;

export type LevelMaterial = keyof typeof LEVEL_MATERIALS;

export const isLevelMaterial = (name: string): name is LevelMaterial => Object.hasOwn(LEVEL_MATERIALS, name);

/** A colour as sRGB channels from 0 to 1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export type SceneColors = Record<SceneColorName, Rgb>;

/**
 * An rgb() / rgba() colour (commas or spaces, 0-255 channels), a `color(srgb r g b)` colour (0-1 channels; what browsers give
 * for color-mix()), or a #rgb / #rrggbb hex value, as channels from 0 to 1; null for anything else.
 */
export function parseColor(value: string): Rgb | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    const n = Number.parseInt(full, 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  }
  const fn = /^(rgba?|color)\(([^)]*)\)$/.exec(v);
  if (!fn) return null;
  const parts = fn[2]
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (fn[1] === 'color') {
    if (parts[0] !== 'srgb') return null;
    const [r, g, b] = parts.slice(1, 4).map(Number);
    return [r, g, b].every((c) => Number.isFinite(c)) ? { r, g, b } : null;
  }
  const [r, g, b] = parts.slice(0, 3).map(Number);
  if (![r, g, b].every((c) => Number.isFinite(c))) return null;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

/** Each scene colour read from the tokens, through a probe placed in `host` (so it sees the same tokens the page does). */
export function readTokenColors(host: HTMLElement): SceneColors {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const probe = doc.createElement('span');
  probe.hidden = true;
  host.append(probe);
  try {
    const out = {} as SceneColors;
    for (const [name, token] of Object.entries(SCENE_TOKENS) as [SceneColorName, string][]) {
      probe.style.color = `var(${token})`;
      const rgb = parseColor(win?.getComputedStyle(probe).color ?? '');
      if (!rgb) throw new Error(`R7: Ascent could not read the colour of ${token}`);
      out[name] = rgb;
    }
    return out;
  } finally {
    probe.remove();
  }
}
