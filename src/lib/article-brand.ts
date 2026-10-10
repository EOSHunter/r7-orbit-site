// The markup of the brand pieces an article can use (docs/ARTICLE_COMPONENTS.md, docs/IMAGE_STYLE.md section 8.3): agent cards,
// the orbit diagram, the stat dial, the orbit divider and the ring around words in a pull quote. One source for both places that
// draw them: the Astro components in src/components/article/ (on the site) and the editor's preview (src/admin/preview-html.ts),
// so the preview is the component's own markup, not a copy of it. Pure strings; every value is escaped. Unit-tested.
//
// The editor's preview sanitises HTML with DOMPurify, which removes <use>: every shape here is drawn inline.
import { orbit } from './orbit';

export type AgentState = 'finished' | 'working' | 'needs' | 'interrupted';

/** A state's label (as the app prints it) and the status mark it shows (the `.mark` classes in components.css). */
export const AGENT_STATES: Record<AgentState, { label: string; mark: 'done' | 'working' | 'needs' | 'idle' }> = {
  finished: { label: 'Finished', mark: 'done' },
  working: { label: 'Working', mark: 'working' },
  needs: { label: 'Needs you', mark: 'needs' },
  interrupted: { label: 'Interrupted', mark: 'idle' },
};

/** One agent's card, as the R7 Orbit canvas shows it. Copy what the app showed; never write a report for an agent. */
export interface AgentCardData {
  /** The task, as its card is titled. */
  task: string;
  /** The agent's name (Quasar, Atlas...). */
  agent: string;
  /** Claude, Codex, PowerShell... */
  tool?: string;
  /** Sonnet 5.5, Opus 5.5... */
  model?: string;
  /** Low, Medium, High. */
  effort?: string;
  state?: AgentState;
  /** The line the app adds in brass when something stopped it ("Orbit closed while this ran..."). */
  note?: string;
  /** What the agent reported. `code` in backticks is shown as code. */
  report?: string;
}

export interface OrbitAgent {
  agent: string;
  task: string;
  tool?: string;
  state?: AgentState;
}

/** Where the agents sit round the hub, by how many there are: corners and sides of a 3 x 3 grid, the hub in the middle. */
export const DIAGRAM_SLOTS: Record<number, string[]> = {
  1: ['t'],
  2: ['l', 'r'],
  3: ['t', 'bl', 'br'],
  4: ['t', 'r', 'b', 'l'],
  5: ['tl', 'tr', 'r', 'b', 'l'],
  6: ['tl', 'tr', 'r', 'br', 'bl', 'l'],
  7: ['tl', 't', 'tr', 'r', 'br', 'bl', 'l'],
  8: ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'],
};
export const DIAGRAM_MAX = 8;
/** The centre of each slot on a 100 x 100 map, where its hairline from the hub ends (under the card). */
const SLOT_POINT: Record<string, [number, number]> = {
  tl: [17, 17], t: [50, 17], tr: [83, 17], l: [17, 50], r: [83, 50], bl: [17, 83], b: [50, 83], br: [83, 83],
};

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escaped text with `code` in backticks shown as code (an agent's report is written that way). */
export function withCode(source: string): string {
  const pieces = source.split('`');
  return pieces
    .map((part, i) => (i % 2 === 1 && i < pieces.length - 1 ? `<code>${escapeHtml(part)}</code>` : (i % 2 === 1 ? '`' : '') + escapeHtml(part)))
    .join('');
}

const stateOf = (v: unknown): AgentState => (typeof v === 'string' && v in AGENT_STATES ? (v as AgentState) : 'finished');

/** The app's status mark: a turning arc while working, a ring with a dot when done, a breathing ring when it needs you. */
export function statusMarkHtml(state: AgentState): string {
  const mark = AGENT_STATES[state].mark;
  const inner =
    mark === 'working'
      ? '<circle class="arc" cx="7" cy="7" r="5.5"></circle>'
      : mark === 'idle'
        ? ''
        : '<circle class="dot" cx="7" cy="7" r="2"></circle>';
  return `<span class="${mark === 'working' ? 'mark' : `mark ${mark}`}" aria-hidden="true"><svg viewBox="0 0 14 14"><circle class="track" cx="7" cy="7" r="5.5"></circle>${inner}</svg></span>`;
}

/** "Quasar · Claude · Sonnet 5.5 · Medium" as the card writes it: the name in brass, the tool in small capitals, chips after. */
function whoHtml(agent: string, tool: string, chips: string[] = []): string {
  return (
    `<p class="art-agent-who"><span class="art-agent-name">${escapeHtml(agent)}</span>` +
    (tool ? `<span aria-hidden="true">·</span><span class="art-agent-tool">${escapeHtml(tool)}</span>` : '') +
    chips.filter(Boolean).map((c) => `<span class="chip mono">${escapeHtml(c)}</span>`).join('') +
    `</p>`
  );
}

export function agentCardHtml(c: Partial<AgentCardData>): string {
  const state = stateOf(c.state);
  return (
    `<li class="art-agent" data-state="${state}">` +
    `<p class="art-agent-task">${statusMarkHtml(state)}<span>${escapeHtml(str(c.task))}</span></p>` +
    whoHtml(str(c.agent), str(c.tool), [str(c.model), str(c.effort)]) +
    `<p class="art-agent-state">${AGENT_STATES[state].label}</p>` +
    (str(c.note) ? `<p class="art-agent-note">${escapeHtml(str(c.note))}</p>` : '') +
    (str(c.report) ? `<p class="art-agent-report">${withCode(str(c.report))}</p>` : '') +
    `</li>`
  );
}

/** One to three agent cards, side by side, with an optional caption. */
export function agentCardsHtml(d: { cards?: unknown; caption?: unknown }): string {
  const cards = (Array.isArray(d.cards) ? d.cards : []) as Partial<AgentCardData>[];
  const caption = str(d.caption);
  return (
    `<figure class="art-agents" data-count="${cards.length}"><ul class="art-agents-list" role="list">${cards.map(agentCardHtml).join('')}</ul>` +
    (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '') +
    `</figure>`
  );
}

/** The canvas as a figure: the project in the middle with the R7 mark, its agents round it, joined by hairlines. */
export function orbitDiagramHtml(d: { hub?: unknown; meta?: unknown; agents?: unknown; caption?: unknown }): string {
  const agents = ((Array.isArray(d.agents) ? d.agents : []) as Partial<OrbitAgent>[]).slice(0, DIAGRAM_MAX);
  const slots = DIAGRAM_SLOTS[agents.length] ?? [];
  const lines = slots.map((s) => `M50 50L${SLOT_POINT[s][0]} ${SLOT_POINT[s][1]}`).join('');
  const caption = str(d.caption);
  return (
    `<figure class="art-orbit" data-count="${agents.length}"><div class="art-orbit-map">` +
    (lines ? `<svg class="art-orbit-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${lines}" vector-effect="non-scaling-stroke"></path></svg>` : '') +
    `<div class="art-orbit-hub"><img src="/assets/r7-orbit-mark-transparent.svg" alt="" width="88" height="88" loading="lazy" decoding="async" />` +
    `<p class="art-orbit-name">${escapeHtml(str(d.hub))}</p>` +
    (str(d.meta) ? `<p class="art-orbit-meta">${escapeHtml(str(d.meta))}</p>` : '') +
    `</div>` +
    `<ul class="art-orbit-agents" role="list">` +
    agents
      .map((a, i) => {
        const state = stateOf(a.state);
        return (
          `<li class="art-orbit-agent" data-slot="${slots[i]}" data-state="${state}">` +
          `<p class="art-agent-task">${statusMarkHtml(state)}<span>${escapeHtml(str(a.task))}</span></p>` +
          whoHtml(str(a.agent), str(a.tool)) +
          `</li>`
        );
      })
      .join('') +
    `</ul></div>` +
    (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '') +
    `</figure>`
  );
}

// The ring round the number: the far half behind it, the near half and the dot in front, like the R7 inside the logo.
const STAT = orbit({ cx: 120, cy: 60, rx: 100 });
const [statX, statY] = STAT.point(38);

/**
 * One number inside the brand ring. The dial is decorative (aria-hidden): the caption says the number in words, so it is what a
 * screen reader reads.
 */
export function statDialHtml(d: { value?: unknown; unit?: unknown; caption?: unknown; source?: unknown }): string {
  const unit = str(d.unit);
  const source = str(d.source);
  return (
    `<figure class="art-stat"><div class="art-stat-dial" aria-hidden="true">` +
    `<svg class="art-stat-ring" data-part="back" viewBox="0 0 240 120" focusable="false"><path d="${STAT.back}"></path></svg>` +
    `<p class="art-stat-value">${escapeHtml(str(d.value))}${unit ? `<span class="art-stat-unit">${escapeHtml(unit)}</span>` : ''}</p>` +
    `<svg class="art-stat-ring" data-part="front" viewBox="0 0 240 120" focusable="false"><path d="${STAT.front}"></path><circle cx="${statX}" cy="${statY}" r="4.5"></circle></svg>` +
    `</div><figcaption><span class="art-stat-caption">${escapeHtml(str(d.caption))}</span>` +
    (source ? `<span class="art-stat-source">${escapeHtml(source)}</span>` : '') +
    `</figcaption></figure>`
  );
}

// The logo's small orbit: the divider's mark.
const MINI = orbit({ cx: 24, cy: 12, rx: 20 });
const [miniX, miniY] = MINI.point(18);
export const orbitMarkSvg = `<svg class="art-orbit-mark" viewBox="0 0 48 24" aria-hidden="true" focusable="false"><path d="${MINI.d}"></path><circle cx="${miniX}" cy="${miniY}" r="2.4"></circle></svg>`;

export const orbitDividerHtml = (): string => `<div class="art-divider" role="separator" data-variant="orbit">${orbitMarkSvg}</div>`;

/** The ring drawn round words: an ellipse a little tilted, with the dot at its right end. Decorative. */
const RING_SVG =
  '<svg class="art-ring-line" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><ellipse cx="50" cy="20" rx="48" ry="17" transform="rotate(-3 50 20)" pathLength="100" vector-effect="non-scaling-stroke"></ellipse></svg><span class="art-ring-dot" aria-hidden="true"></span>';

/**
 * `html` with the first occurrence of `phrase` (as text, escaped the way the HTML has it) wrapped in the ring. Undefined when the
 * phrase is not in the text, so the caller can say so.
 */
export function ringPhrase(html: string, phrase: string): string | undefined {
  const needle = escapeHtml(phrase.trim()).replace(/&quot;/g, '"');
  if (!needle) return html;
  for (const form of [needle, escapeHtml(phrase.trim())]) {
    const at = html.indexOf(form);
    if (at >= 0) return `${html.slice(0, at)}<span class="art-ring">${form}${RING_SVG}</span>${html.slice(at + form.length)}`;
  }
  return undefined;
}

// ---- Checks the components make at build time (the editor's preview draws whatever it is given) ----------------------

export function agentCardsProblems(cards: unknown): string[] {
  if (!Array.isArray(cards) || cards.length === 0) return ['cards: give one to three cards.'];
  const out: string[] = [];
  if (cards.length > 3) out.push(`cards: at most three side by side, got ${cards.length}.`);
  cards.forEach((c: Partial<AgentCardData>, i) => {
    if (!str(c?.task)) out.push(`cards[${i}].task is required.`);
    if (!str(c?.agent)) out.push(`cards[${i}].agent is required.`);
    if (c?.state !== undefined && !(String(c.state) in AGENT_STATES)) out.push(`cards[${i}].state must be one of ${Object.keys(AGENT_STATES).join(', ')}.`);
  });
  return out;
}

export function orbitDiagramProblems(hub: unknown, agents: unknown): string[] {
  const out: string[] = [];
  if (!str(hub)) out.push('hub is required (the project in the middle).');
  if (!Array.isArray(agents) || agents.length === 0) return [...out, `agents: give one to ${DIAGRAM_MAX}.`];
  if (agents.length > DIAGRAM_MAX) out.push(`agents: at most ${DIAGRAM_MAX}, got ${agents.length}.`);
  agents.forEach((a: Partial<OrbitAgent>, i) => {
    if (!str(a?.agent) || !str(a?.task)) out.push(`agents[${i}] needs an agent and a task.`);
    if (a?.state !== undefined && !(String(a.state) in AGENT_STATES)) out.push(`agents[${i}].state must be one of ${Object.keys(AGENT_STATES).join(', ')}.`);
  });
  return out;
}

export function statDialProblems(value: unknown, caption: unknown): string[] {
  const out: string[] = [];
  if (!str(value)) out.push('value is required.');
  if (!str(caption)) out.push('caption is required: it says the number in words, and it is what a screen reader reads.');
  return out;
}
