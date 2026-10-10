// Shared by the two article-imagery prototypes (index.astro, v2.astro; docs/IMAGE_STYLE.md): the ring geometry, the specimen
// posts and the markup of a treated picture, card, hero and share image. The leading underscore keeps it out of the routes.
// Prototype code, not part of the site. The markup is built as strings because one .astro file cannot hold small components;
// every value from content goes through esc().
import { site } from '../../../data/site';
import type { CardData, Kind } from '../../../lib/cards';
import type { CollectionName } from '../../../lib/content';
import { getPosts } from '../../../lib/content-queries';
import { SIZES, publicSrcset } from '../../../lib/media-srcset';
import { variantPath } from '../../../lib/media-rules.mjs';
import { toCard } from '../../../lib/post-cards';
import { isoDate, plainTitle, shortDate, titleParts } from '../../../lib/text';

// ------------------------------------------------------------------------------------------------------------------ Geometry
// The brand ring is the logo's: an ellipse 2.94 times as wide as it is tall, tilted -24 degrees (src/scripts/orbit.js, RING).
// Every overlay draws in a 320 x 180 box (a 16:9 card at 1x). The dot is a zero-length dash with round caps on the ring path
// (pathLength 100), so moving it is a change of stroke-dashoffset: it slides along the exact curve, with CSS only.
interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
}
const RATIO = 2.94;
const TILT = -24;

export function orbit(e: Ellipse) {
  const ry = e.rx / RATIO;
  const r = (TILT * Math.PI) / 180;
  const point = (deg: number): [number, number] => {
    const t = (deg * Math.PI) / 180;
    const x = e.rx * Math.cos(t);
    const y = ry * Math.sin(t);
    return [e.cx + x * Math.cos(r) - y * Math.sin(r), e.cy + x * Math.sin(r) + y * Math.cos(r)];
  };
  const xy = (deg: number) => point(deg).map((n) => n.toFixed(2)).join(' ');
  const arc = `${e.rx} ${ry.toFixed(2)} ${TILT} 0 1`;
  // Arc length from angle 0, sampled every degree, so a position on the ring can be given as an angle.
  const lengths = [0];
  for (let deg = 1; deg <= 360; deg++) {
    const [ax, ay] = point(deg - 1);
    const [bx, by] = point(deg);
    lengths.push(lengths[deg - 1] + Math.hypot(bx - ax, by - ay));
  }
  return {
    /** The whole ring from angle 0, clockwise on screen. */
    d: `M${xy(0)}A${arc} ${xy(180)}A${arc} ${xy(0)}Z`,
    /** The far half (180 to 360 degrees: the upper arc), drawn behind what the ring circles. */
    back: `M${xy(180)}A${arc} ${xy(0)}`,
    /** The near half (0 to 180 degrees: the lower arc), drawn in front of it. */
    front: `M${xy(0)}A${arc} ${xy(180)}`,
    /** Where an angle falls along the path, out of 100. */
    at: (deg: number) => +((lengths[Math.round(((deg % 360) + 360) % 360)] / lengths[360]) * 100).toFixed(2),
    /** The point at an angle, rounded for markup. */
    point: (deg: number) => point(deg).map((n) => +n.toFixed(2)) as [number, number],
  };
}
type Orbit = ReturnType<typeof orbit>;

// A, Transit: a big ring whose left tip curls inside the bottom-right of the frame; the rest of it is outside.
export const transit = orbit({ cx: 372, cy: 80, rx: 190 });
// B, Eclipse: a ring around a circular crop. The picture is the planet; the ring passes behind it and in front of it.
export const eclipse = orbit({ cx: 160, cy: 90, rx: 112 });
// C, Dial: three rings on one centre, etched over the graded picture. The middle one carries the dot.
export const dial = [orbit({ cx: 160, cy: 90, rx: 64 }), orbit({ cx: 160, cy: 90, rx: 116 }), orbit({ cx: 160, cy: 90, rx: 176 })];

// Dot position (an angle on the ring) at rest and on hover/focus, and the spacing of the tail, as custom properties.
const motionVars = (o: Orbit, from: number, to: number, gap: number) =>
  `--ix-from:${o.at(from)};--ix-to:${o.at(to)};--ix-gap:${gap}`;
export const MOTION = {
  transit: motionVars(transit, 196, 218, 1.1),
  eclipse: motionVars(eclipse, 30, 64, 1.5),
  dial: motionVars(dial[1], 18, 42, 1.3),
};

/** The ring paths and the glow filter, once per page; every overlay draws them with <use>. */
export const defsSvg = () =>
  `<svg class="ix-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>` +
  `<path id="ix-transit-ring" d="${transit.d}" vector-effect="non-scaling-stroke"></path>` +
  `<path id="ix-transit-track" d="${transit.d}" pathLength="100"></path>` +
  `<path id="ix-eclipse-back" d="${eclipse.back}" vector-effect="non-scaling-stroke"></path>` +
  `<path id="ix-eclipse-front" d="${eclipse.front}" vector-effect="non-scaling-stroke"></path>` +
  `<path id="ix-eclipse-track" d="${eclipse.d}" pathLength="100"></path>` +
  dial.map((o, i) => `<path id="ix-dial-ring-${i}" d="${o.d}" vector-effect="non-scaling-stroke"></path>`).join('') +
  `<path id="ix-dial-track" d="${dial[1].d}" pathLength="100"></path>` +
  `<filter id="ix-glow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="4"></feGaussianBlur></filter>` +
  `</defs></svg>`;

// ------------------------------------------------------------------------------------------------------------------ Specimens
// The real posts named in the brief. A post the author has since removed is left out.
export interface Focus {
  /** object-position and transform-origin: where the subject is. */
  at: string;
  /** How far to crop in: a busy screenshot gets a tighter crop so its subject reads at card size. */
  zoom: number;
}
export interface Specimen {
  card: CardData;
  focus: Focus;
  srcset?: string;
  /** The 160px copy, for Eclipse's blurred plate (the original in `astro dev`, where the copies do not exist). */
  tiny?: string;
}
async function find(collection: CollectionName, id: string, focus: Focus): Promise<Specimen | undefined> {
  const post = (await getPosts(collection)).find((p) => p.id === id);
  if (!post) return undefined;
  const card = await toCard(post);
  const src = 'cover' in card ? card.cover?.src : undefined;
  const srcset = await publicSrcset(src);
  return { card, focus, srcset, tiny: src && (srcset ? variantPath(src, 160) : src) };
}

const TEN = 'so-youve-got-an-ai-that-writes-code-cool-what-if-you-had-ten';
export async function loadSpecimens() {
  return {
    pinned: await find('blog', TEN, { at: '48% 40%', zoom: 1.5 }),
    builtBlog: await find('blog', 'test', { at: '50% 60%', zoom: 1.3 }),
    vlogGame: await find('vlogs', 'building-a-browser-game-with-ai-agents-in-r7-orbit', { at: '50% 52%', zoom: 1.15 }),
    vlogTen: await find('vlogs', TEN, { at: '45% 44%', zoom: 1.6 }),
    vesper: await find('projects', 'vesper-drift', { at: '50% 54%', zoom: 1.15 }),
  };
}
// The one specimen that is not a real post: every published post has a picture.
export const noImage: Specimen = {
  card: {
    kind: 'news',
    href: '/styleguide/imagery/#no-image',
    title: 'Sample: a news item with *no picture*',
    summary: 'Placeholder text for the prototype. Every published post has a cover, so this card is made up.',
    date: '2026-10-10',
    readTime: 2,
  },
  focus: { at: '50% 50%', zoom: 1 },
};
export const withoutCover = (s: Specimen): Specimen => ({ ...s, card: { ...s.card, cover: undefined } as CardData, srcset: undefined, tiny: undefined });
export const host = new URL(site.url).host;

// ------------------------------------------------------------------------------------------------------------------ Markup
export const KIND_LABEL: Record<Kind, string> = { news: 'News', blog: 'Blog', vlog: 'Vlog', project: 'Project', repo: 'Repo' };
const STATUS_LABEL: Record<string, string> = { idea: 'Idea', building: 'Building', shipped: 'Shipped', paused: 'Paused', archived: 'Archived' };

export function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export const icon = (name: string, small = false) => `<svg class="ico${small ? ' sm' : ''}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
export const emTitle = (title: string) => titleParts(title).map((p) => (p.em ? `<em>${esc(p.text)}</em>` : esc(p.text))).join('');
export const coverOf = (s: Specimen) => ('cover' in s.card ? s.card.cover : undefined);
export function minutesOf(card: CardData): number | undefined {
  if (card.kind === 'vlog') {
    const parts = card.duration.split(':').map(Number);
    return parts.length === 3 ? parts[0] * 60 + parts[1] : parts[0];
  }
  return 'readTime' in card ? card.readTime : undefined;
}
export const focusStyle = (s: Specimen) => `--ix-at:${s.focus.at};--ix-zoom:${s.focus.zoom}`;

/** The card body, as the live cards write it (BlogCard, VlogCard, NewsCard, ProjectCard). */
export function body(s: Specimen): string {
  const c = s.card;
  const kind = `<span class="kind">${icon(c.kind)}${KIND_LABEL[c.kind]}</span>`;
  const head =
    c.kind === 'project' && c.playable
      ? `<div class="cluster">${kind}<span class="chip playable-badge">${icon('play', true)}Playable</span></div>`
      : kind;
  const chips = (items: string[], mono = false) =>
    items.length ? `<div class="cluster">${items.slice(0, 3).map((t) => `<span class="chip${mono ? ' mono' : ''}">${esc(t)}</span>`).join('')}</div>` : '';
  const extra = c.kind === 'blog' ? chips(c.tags ?? []) : c.kind === 'project' ? chips(c.stack ?? [], true) : '';
  const minutes = minutesOf(c);
  const foot =
    c.kind === 'project'
      ? `<div class="card-foot"><span>${STATUS_LABEL[c.status] ?? ''}</span><span class="spacer"></span>${icon('arrow')}</div>`
      : `<div class="card-foot"><time datetime="${isoDate(c.date)}">${shortDate(c.date)}</time>${
          minutes !== undefined ? `<span aria-hidden="true">&middot;</span><span>${minutes} min</span>` : ''
        }<span class="spacer"></span>${icon('arrow')}</div>`;
  return `<div class="card-body">${head}<h3 class="card-title serif">${esc(plainTitle(c.title))}</h3><p class="card-text">${esc(c.summary)}</p>${extra}${foot}</div>`;
}

export type Context = 'card' | 'pinned' | 'thumb' | 'micro' | 'hero' | 'og';
const SIZES_FOR: Record<Context, string> = {
  card: SIZES.card,
  pinned: SIZES.card,
  thumb: '320px',
  micro: '160px',
  hero: '100vw',
  og: '(min-width: 1280px) 1200px, 92vw',
};

/** The picture, or the branded placeholder when there is none. Pictures in the test strips, hero and share images are duplicates: alt="". */
function picture(s: Specimen, ctx: Context, cls = 'ix-img'): string {
  const cover = coverOf(s);
  if (!cover) return `<div class="ix-ph" aria-hidden="true"><span class="ix-ph-icon">${icon(s.card.kind)}</span></div>`;
  const alt = ctx === 'card' || ctx === 'pinned' ? esc(cover.alt) : '';
  const srcset = s.srcset ? ` srcset="${s.srcset}" sizes="${SIZES_FOR[ctx]}"` : '';
  return `<img class="${cls}" src="${esc(cover.src)}"${srcset} alt="${alt}" width="${cover.width}" height="${cover.height}" loading="lazy" decoding="async" />`;
}

/** The dot, its tail and its glow on a ring track. */
const rider = (track: string, glow = true) =>
  (glow ? `<use href="#${track}" class="ix-glow" filter="url(#ix-glow)"></use>` : '') +
  [3, 2, 1].map((k) => `<use href="#${track}" class="ix-tail" style="--k:${k}"></use>`).join('') +
  `<use href="#${track}" class="ix-dot"></use>`;
const svg = (inner: string, fit: string, cls = '') =>
  `<svg class="ix-orbit${cls}" viewBox="0 0 320 180" preserveAspectRatio="${fit}" aria-hidden="true" focusable="false">${inner}</svg>`;
const seal = (kind: Kind) => `<span class="ix-seal" aria-hidden="true">${icon(kind, true)}</span>`;
const vlogBits = (s: Specimen, ctx: Context) =>
  s.card.kind === 'vlog' && (ctx === 'card' || ctx === 'pinned')
    ? `<div class="play" aria-hidden="true"><span><svg viewBox="0 0 16 16"><use href="#i-play"></use></svg></span></div><span class="duration">${esc(s.card.duration)}</span>`
    : '';

export type DirectionId = 'transit' | 'eclipse' | 'dial';
/** A picture style: one of the three directions, or the picture alone. */
export type Style = DirectionId | 'plain';

/** One style's treatment of a picture, for one context. `flip` mirrors the brand shape: "x", "y" or "x y" (round 2). */
export function media(id: Style, s: Specimen, ctx: Context = 'card', flip = ''): string {
  const wrap = ctx === 'hero' || ctx === 'og' ? 'ix-media' : 'card-media ix-media';
  const empty = coverOf(s) ? '' : ' ix-empty';
  let inner: string;
  if (id === 'transit') {
    inner =
      picture(s, ctx) +
      `<div class="ix-veil" aria-hidden="true"></div>` +
      svg(`<use href="#ix-transit-ring" class="ix-ring"></use>${rider('ix-transit-track')}`, 'xMaxYMax slice') +
      vlogBits(s, ctx);
  } else if (id === 'eclipse') {
    const plate = s.tiny ? `<img class="ix-backdrop" src="${esc(s.tiny)}" alt="" width="160" height="90" loading="lazy" decoding="async" />` : '';
    inner =
      plate +
      `<div class="ix-plate" aria-hidden="true"></div>` +
      `<div class="ix-stage">` +
      svg(`<use href="#ix-eclipse-back" class="ix-ring ix-ring-back"></use>`, 'xMidYMid meet') +
      `<div class="ix-porthole">${picture(s, ctx)}</div>` +
      svg(`<use href="#ix-eclipse-front" class="ix-ring"></use>${rider('ix-eclipse-track')}`, 'xMidYMid meet') +
      `</div>` +
      (ctx === 'micro' ? '' : seal(s.card.kind)) +
      vlogBits(s, ctx);
  } else if (id === 'dial') {
    inner =
      picture(s, ctx) +
      `<div class="ix-tone" aria-hidden="true"></div>` +
      svg(dial.map((_, i) => `<use href="#ix-dial-ring-${i}" class="ix-ring ix-ring-${i}"></use>`).join('') + rider('ix-dial-track'), 'xMidYMid slice') +
      (ctx === 'micro' ? '' : seal(s.card.kind)) +
      vlogBits(s, ctx);
  } else {
    inner = picture(s, ctx) + vlogBits(s, ctx);
  }
  return `<div class="${wrap}${empty}" data-ctx="${ctx}"${flip ? ` data-flip="${flip}"` : ''}>${inner}</div>`;
}

export const card = (id: DirectionId, s: Specimen, extra = '', ctx: Context = 'card', attrs = '') =>
  `<a class="card${extra}" href="${esc(s.card.href)}" style="${focusStyle(s)}"${attrs}>${media(id, s, ctx)}${body(s)}</a>`;

/** The share image: a 1200 x 630 canvas. Its sizes are canvas pixels (--u), so it renders the same at any width. */
export const og = (id: Style, s: Specimen, flip = '') =>
  `<div class="ix-og" style="${focusStyle(s)}">${media(id, s, 'og', flip)}<div class="ix-og-text">` +
  `<p class="ix-og-brand"><img src="/assets/r7-mark.svg" alt="" width="20" height="20" /><span>${esc(site.name)}</span></p>` +
  `<p class="ix-og-kind">${icon(s.card.kind)}${KIND_LABEL[s.card.kind]}</p>` +
  `<p class="ix-og-title">${emTitle(s.card.title)}</p>` +
  `<p class="ix-og-meta">${shortDate(s.card.date)} · ${esc(host)}</p></div></div>`;

export const hero = (id: DirectionId, s: Specimen) =>
  `<div class="ix-hero" style="${focusStyle(s)}">${media(id, s, 'hero')}<div class="container ix-hero-body">` +
  `<span class="kind">${icon(s.card.kind)}${KIND_LABEL[s.card.kind]}</span>` +
  `<p class="ix-hero-title">${emTitle(s.card.title)}</p>` +
  `<p class="ix-hero-lead">${esc(s.card.summary)}</p>` +
  `<p class="ix-hero-meta mono">${shortDate(s.card.date)} · ${minutesOf(s.card) ?? ''} min read</p></div></div>`;

// ------------------------------------------------------------------------------------------------------------------ Round 2
// "Auto": each kind has a default style, and the corner the brand shape sits in comes from the post's address, so a post looks
// the same on its card, its hero and its share image. In a list, a card never repeats its neighbour's style and corner.
export const KIND_STYLE: Record<Kind, DirectionId> = { blog: 'transit', news: 'transit', vlog: 'eclipse', project: 'dial', repo: 'dial' };
export const FLIPS = ['', 'x', 'y', 'x y'] as const;
export type Flip = (typeof FLIPS)[number];
export const FLIP_LABEL: Record<Flip, string> = { '': 'bottom right', x: 'bottom left', y: 'top right', 'x y': 'top left' };

/** A small, stable hash of a string (FNV-1a), so the same address always picks the same corner. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
export const autoFlip = (href: string): Flip => FLIPS[hash(href) % FLIPS.length];

export interface Look {
  style: Style;
  flip: Flip;
  /** Chosen by the post (an override in the editor) rather than by Auto. */
  chosen?: boolean;
}
/** The looks for a list of posts: the post's own choice, or Auto with the neighbour rule. */
export function looksFor(cards: CardData[], chosen: Partial<Record<string, Partial<Look>>> = {}): Look[] {
  const out: Look[] = [];
  for (const c of cards) {
    const own = chosen[c.href];
    const style = own?.style ?? KIND_STYLE[c.kind];
    let flip = own?.flip ?? autoFlip(c.href);
    const prev = out[out.length - 1];
    if (!own?.flip && prev && prev.style === style && prev.flip === flip) flip = FLIPS[(FLIPS.indexOf(flip) + 1) % FLIPS.length];
    out.push({ style, flip, chosen: !!own });
  }
  return out;
}
