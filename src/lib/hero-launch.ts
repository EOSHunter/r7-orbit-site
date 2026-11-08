// The home page hero's moving layer, as one standalone SVG file (/media/home/hero-launch.svg, built by
// src/pages/media/home/hero-launch.svg.ts and shown by HeroLaunch.astro through a <picture> that only wide screens load, so phones
// fetch none of it). Everything it needs is inside it: the sprites as data: URLs (an SVG shown as an image may not load other
// files) and the colours from the design tokens (CSS variables do not reach inside it).
//
// When it opens: an agent launches from the hub to each project, drawing its brass trail (CSS) along its arc (animateMotion);
// when all have docked, the trails fade and the projects, each with its agent above it, go round the ring, one lap in `lap`
// seconds, for as long as it is shown. The still version (/media/home/hero-launch-still.svg) has every project with its agent
// docked and nothing moving: the page picks it for reduced motion with a <picture> media query (a media query inside an SVG shown
// as an image is not reliably given the reader's setting). Pure: unit-tested in hero-launch.vitest.ts.

export interface HeroProject {
  project: string;
  size: number;
  offset: number[]; // [x, y]
  start: number[]; // [x, y]
  loop: string;
  hover: number;
  launch: string;
}
export interface HeroData {
  canvas: number[]; // [width, height]
  hub: number[]; // [x, y]
  projects: HeroProject[];
}
export interface HeroTiming {
  start: number; // seconds after it opens
  gap: number; // between launches
  flight: number; // each agent's flight
  settle: number; // after the last agent docks, before the projects move
  lap: number; // seconds for one lap of the ring
}
export const HERO_TIMING: HeroTiming = { start: 0.5, gap: 0.35, flight: 1.7, settle: 0.4, lap: 90 };
const AGENT = 120; // the agent sprite's size on the canvas

/** sprites: project name (and "agent") -> data: URL. colors: brass for the trails. still: the reduced-motion version. */
export function heroLaunchSvg(
  data: HeroData,
  sprites: Record<string, string>,
  colors: { brass: string },
  { still: stillOnly = false, timing: t = HERO_TIMING }: { still?: boolean; timing?: HeroTiming } = {},
): string {
  const [W, H] = data.canvas;
  const n = (v: number) => Math.round(v * 10) / 10;
  const orbitBegin = t.start + (data.projects.length - 1) * t.gap + t.flight + t.settle;
  for (const p of data.projects) if (!sprites[p.project]) throw new Error(`hero-launch: no sprite for ${p.project}`);
  if (!sprites.agent) throw new Error('hero-launch: no agent sprite');
  // Each sprite is in the file once (<defs>) and drawn with <use>: the agent alone is drawn fifteen times.
  const defs =
    `<image id="agent" href="${sprites.agent}" x="${-AGENT / 2}" y="${-AGENT / 2}" width="${AGENT}" height="${AGENT}"/>` +
    data.projects
      .map((p) => `<image id="p-${p.project}" href="${sprites[p.project]}" x="${n(p.offset[0] - p.size / 2)}" y="${n(p.offset[1] - p.size / 2)}" width="${p.size}" height="${p.size}"/>`)
      .join('');
  const agentAt = (x: number, y: number, extra = '/>') => `<use href="#agent" x="${n(x)}" y="${n(y)}"${extra}`;
  const body = (p: HeroProject) => `<use href="#p-${p.project}"/>`;

  const moving = data.projects.map((p, i) => {
    const begin = t.start + i * t.gap;
    const docked = begin + t.flight;
    return {
      trail: `<path id="l${i}" class="trail" d="${p.launch}" pathLength="1" style="animation-delay:${n(begin)}s,${n(orbitBegin)}s"/>`,
      project:
        `<g transform="translate(${p.start[0]} ${p.start[1]})">` +
        `<animateMotion path="${p.loop}" begin="${n(orbitBegin)}s" dur="${t.lap}s" repeatCount="indefinite"/>` +
        body(p) +
        agentAt(0, -p.hover, ` opacity="0"><set attributeName="opacity" to="1" begin="${n(docked)}s" fill="freeze"/></use>`) +
        `</g>`,
      agent:
        agentAt(0, 0, ' opacity="0">') +
        `<set attributeName="opacity" to="1" begin="${n(begin)}s"/>` +
        `<set attributeName="opacity" to="0" begin="${n(docked)}s" fill="freeze"/>` +
        `<animateMotion dur="${t.flight}s" begin="${n(begin)}s" fill="freeze" calcMode="spline" keyTimes="0;1" keyPoints="0;1" keySplines="0.45 0 0.2 1"><mpath href="#l${i}"/></animateMotion>` +
        `</use>`,
    };
  });
  const still = data.projects
    .map((p) => `<g transform="translate(${p.start[0]} ${p.start[1]})">${body(p)}${agentAt(0, -p.hover)}</g>`)
    .join('');
  const css =
    `.trail{fill:none;stroke:${colors.brass};stroke-width:3;stroke-linecap:round;opacity:.85;stroke-dasharray:1;stroke-dashoffset:1;` +
    `animation:draw ${t.flight}s cubic-bezier(.45,0,.2,1) forwards,fade 1.2s ease forwards}` +
    `@keyframes draw{to{stroke-dashoffset:0}}@keyframes fade{to{opacity:0}}`;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  if (stillOnly) return `${head}<defs>${defs}</defs><g class="still">${still}</g></svg>`;
  return (
    `${head}<style>${css}</style><defs>${defs}</defs>` +
    `<g class="moving">${moving.map((m) => m.trail).join('')}${moving.map((m) => m.project).join('')}${moving.map((m) => m.agent).join('')}</g>` +
    `</svg>`
  );
}
