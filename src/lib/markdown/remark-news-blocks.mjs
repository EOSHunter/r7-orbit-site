// Visual blocks for news (and any post), written in plain Markdown so news items stay Markdown (docs/WRITING_GUIDE.md, "Key
// numbers", "Chart", "Source cards"):
//   > [!NUMBERS]                       a row of two to four key numbers, each `- **948** with working exploits`, then an optional
//                                      source line
//   > [!CHART] ExploitGym score        a bar chart redrawn from a source's figures, each `- GPT-6 Cyber: 48.5%` (bold = the bar the
//                                      story is about), then a source line
//   > [!TIMELINE]                      dated steps of a story, each `- **Oct 25** The agent first gets in`, then a source line
//   ## Sources + a list of links       each `[Title (Publisher)](https://…)` becomes a source card; the first is the primary source
// A wrong line stops the build with the reason, like the post card. Pure: no Astro.
import { initials } from '../post-card.mjs';

const NUMBERS = /^\[!NUMBERS\][ \t]*/i;
const CHART = /^\[!CHART\][ \t]*/i;
const TIMELINE = /^\[!TIMELINE\][ \t]*/i;

/** A hast element. */
const el = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });
const tx = (value) => ({ type: 'text', value });
/** An mdast node that turns into the element `tagName` and keeps its Markdown children (links, emphasis). */
const wrap = (tagName, className, children) => ({ type: 'paragraph', children, data: { hName: tagName, hProperties: className ? { className: [className] } : {}, newsBlock: true } });
/** An mdast node that turns into a ready hast element. */
const raw = (element) => ({ type: 'paragraph', children: [], data: { hName: element.tagName, hProperties: element.properties, hChildren: element.children, newsBlock: true } });

/** The text of inline nodes, as written. */
function inlineText(nodes) {
  return nodes.map((n) => (n.type === 'text' || n.type === 'inlineCode' ? n.value : inlineText(n.children ?? []))).join('');
}

/** Takes `[!MARKER] rest of line` off the first paragraph; returns the rest of the line, or undefined without the marker. */
function takeHeader(node, marker) {
  const first = node.children[0];
  if (!first || first.type !== 'paragraph') return undefined;
  const head = first.children[0];
  if (!head || head.type !== 'text' || !marker.test(head.value)) return undefined;
  head.value = head.value.replace(marker, '');
  const line = [];
  while (first.children.length) {
    const child = first.children[0];
    if (child.type === 'text' && child.value.includes('\n')) {
      const at = child.value.indexOf('\n');
      line.push(tx(child.value.slice(0, at)));
      child.value = child.value.slice(at + 1);
      if (child.value === '') first.children.shift();
      break;
    }
    if (child.type === 'break') {
      first.children.shift();
      break;
    }
    line.push(first.children.shift());
  }
  if (first.children.length === 0) node.children.shift();
  return inlineText(line).trim();
}

/** The list in a block, and the paragraphs after it (the source line). */
function listAndNote(node, what) {
  const at = node.children.findIndex((c) => c.type === 'list');
  if (at === -1) throw new Error(`${what}: write its lines as a list, one "- " line each`);
  const note = node.children.slice(at + 1).filter((c) => c.type === 'paragraph');
  return { items: node.children[at].children, note };
}

const firstParagraph = (item) => item.children.find((c) => c.type === 'paragraph') ?? { children: [] };

// ---- [!NUMBERS] ---------------------------------------------------------------------------------------------------------

function asNumbers(node) {
  const title = takeHeader(node, NUMBERS);
  if (title === undefined) return false;
  const { items, note } = listAndNote(node, '[!NUMBERS]');
  if (items.length < 2 || items.length > 4) throw new Error(`[!NUMBERS]: two to four numbers, not ${items.length}`);
  const rows = items.map((item) => {
    const kids = [...firstParagraph(item).children];
    const value = kids[0]?.type === 'strong' ? inlineText(kids.shift().children).trim() : '';
    if (!value) throw new Error(`[!NUMBERS]: start each line with the number in bold, e.g. "- **948** with working exploits" (got "${inlineText(kids)}")`);
    if (kids[0]?.type === 'text') kids[0] = tx(kids[0].value.replace(/^\s+/, ''));
    if (!inlineText(kids).trim()) throw new Error(`[!NUMBERS]: "${value}" needs a few words saying what it counts`);
    return wrap('div', 'key-number', [wrap('dt', null, kids), wrap('dd', null, [tx(value)])]);
  });
  node.data = { hName: 'figure', hProperties: { className: ['key-numbers'] }, newsBlock: true };
  node.children = [
    ...(title ? [wrap('p', 'key-numbers-title', [tx(title)])] : []),
    wrap('dl', 'key-numbers-list', rows),
    ...(note.length ? [wrap('figcaption', 'key-numbers-source', note.flatMap((p, i) => (i ? [tx(' '), ...p.children] : p.children)))] : []),
  ];
  return true;
}

// ---- [!CHART] -----------------------------------------------------------------------------------------------------------

const BAR = /^(.+?):\s*([$€£]?)(-?[\d,]*\.?\d+)\s*(%|[^\d\s:][^:]*)?$/;

/** One `- Label: 48.5%` line: its label, value, unit and whether it is the story's bar (the whole line in bold). */
export function chartLine(item) {
  const kids = firstParagraph(item).children.filter((c) => !(c.type === 'text' && !c.value.trim()));
  const key = kids.length === 1 && kids[0].type === 'strong';
  const line = inlineText(key ? kids[0].children : kids).trim();
  const match = BAR.exec(line);
  if (!match) throw new Error(`[!CHART]: write each bar as "- Label: 48.5%" (got "${line}")`);
  const [, label, currency, number, unit = ''] = match;
  const value = Number(number.replace(/,/g, ''));
  if (value < 0) throw new Error(`[!CHART]: "${line}": bars start at zero, so negative values cannot be drawn`);
  const shown = `${currency}${number}${unit === '%' ? '%' : unit ? ` ${unit.trim()}` : ''}`;
  return { label: label.trim(), value, shown, unit: `${currency}${unit.trim()}`, key };
}

/** Bar widths: a share of 100 for percentages, of the largest value otherwise. Rounded to a tenth. */
export function barWidths(bars) {
  const percent = bars.every((b) => b.unit === '%');
  const scale = Math.max(percent ? 100 : 0, ...bars.map((b) => b.value)) || 1;
  return bars.map((b) => Math.round((b.value / scale) * 1000) / 10);
}

function asChart(node) {
  const title = takeHeader(node, CHART);
  if (title === undefined) return false;
  if (!title) throw new Error('[!CHART]: give it a title on the [!CHART] line, e.g. "[!CHART] ExploitGym score"');
  const { items, note } = listAndNote(node, `[!CHART] ${title}`);
  if (items.length < 2 || items.length > 8) throw new Error(`[!CHART] ${title}: two to eight bars, not ${items.length}`);
  if (!note.length) throw new Error(`[!CHART] ${title}: end it with a source line, e.g. "Source: [OpenAI](https://…)"`);
  const bars = items.map(chartLine);
  const units = new Set(bars.map((b) => b.unit));
  if (units.size > 1) throw new Error(`[!CHART] ${title}: every bar needs the same unit (got ${[...units].map((u) => u || 'none').join(', ')})`);
  const widths = barWidths(bars);
  const rows = bars.map((b, i) =>
    el('tr', b.key ? { className: ['is-key'] } : {}, [
      el('th', { scope: 'row' }, [tx(b.label)]),
      el('td', {}, [
        el('span', { className: ['bar-track'], ariaHidden: 'true' }, [el('span', { className: ['bar'], style: `--bar: ${widths[i]}%` }, [])]),
        el('span', { className: ['bar-value'] }, [tx(b.shown)]),
      ]),
    ]),
  );
  node.data = { hName: 'figure', hProperties: { className: ['bar-chart'] }, newsBlock: true };
  node.children = [
    raw(el('figcaption', { className: ['bar-chart-title'] }, [tx(title)])),
    raw(el('table', { className: ['bar-chart-rows'] }, [el('tbody', {}, rows)])),
    wrap('p', 'bar-chart-source', note.flatMap((p, i) => (i ? [tx(' '), ...p.children] : p.children))),
  ];
  return true;
}

// ---- [!TIMELINE] --------------------------------------------------------------------------------------------------------

function asTimeline(node) {
  const title = takeHeader(node, TIMELINE);
  if (title === undefined) return false;
  const { items, note } = listAndNote(node, '[!TIMELINE]');
  if (items.length < 2 || items.length > 8) throw new Error(`[!TIMELINE]: two to eight dated steps, not ${items.length}`);
  if (!note.length) throw new Error('[!TIMELINE]: end it with a source line, e.g. "Source: [WorkOS](https://…)"');
  const steps = items.map((item) => {
    const kids = [...firstParagraph(item).children];
    const when = kids[0]?.type === 'strong' ? inlineText(kids.shift().children).trim() : '';
    if (!when) throw new Error(`[!TIMELINE]: start each step with its date in bold, e.g. "- **Oct 25** The agent first gets in" (got "${inlineText(kids)}")`);
    if (kids[0]?.type === 'text') kids[0] = tx(kids[0].value.replace(/^[\s:–—-]+/, ''));
    if (!inlineText(kids).trim()) throw new Error(`[!TIMELINE]: "${when}" needs a few words saying what happened`);
    return wrap('li', 'timeline-step', [wrap('span', 'timeline-date', [tx(when)]), wrap('span', 'timeline-text', kids)]);
  });
  node.data = { hName: 'figure', hProperties: { className: ['timeline'] }, newsBlock: true };
  node.children = [
    ...(title ? [wrap('p', 'timeline-title', [tx(title)])] : []),
    wrap('ol', 'timeline-steps', steps),
    wrap('figcaption', 'timeline-source', note.flatMap((p, i) => (i ? [tx(' '), ...p.children] : p.children))),
  ];
  return true;
}

// ---- Source cards -------------------------------------------------------------------------------------------------------

const ARROW = el('svg', { className: ['source-card-arrow'], viewBox: '0 0 24 24', width: '16', height: '16', ariaHidden: 'true', fill: 'none', stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round' }, [
  el('path', { d: 'M7 17 17 7M9 7h8v8' }, []),
]);

/** `Title (Publisher)` from a link's text; the address's host when there is no publisher in brackets. */
export function sourceParts(textOfLink, url) {
  const match = /^(.*\S)\s+\(([^()]+)\)$/.exec(textOfLink.trim());
  if (match) return { title: match[1], publisher: match[2].trim() };
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* not an address: no publisher */
  }
  return { title: textOfLink.trim(), publisher: host };
}

function asSourceCards(list) {
  const links = list.children.map((item) => {
    const kids = firstParagraph(item).children.filter((c) => !(c.type === 'text' && !c.value.trim()));
    return item.children.length === 1 && kids.length === 1 && kids[0].type === 'link' ? kids[0] : undefined;
  });
  if (!links.length || links.some((l) => !l)) return;
  list.data = { hName: 'ul', hProperties: { className: ['source-cards'] }, newsBlock: true };
  list.children = links.map((link, i) => {
    const { title, publisher } = sourceParts(inlineText(link.children), link.url);
    const meta = [publisher, i === 0 ? 'Primary source' : ''].filter(Boolean).join(' · ');
    return {
      type: 'listItem',
      children: [],
      data: {
        hChildren: [
          el('a', { className: ['source-card'], href: link.url, ...(/^https?:/.test(link.url) ? { rel: 'noopener' } : {}) }, [
            el('span', { className: ['source-card-mark'], ariaHidden: 'true' }, [tx(initials(publisher || title))]),
            el('span', { className: ['source-card-text'] }, [
              el('span', { className: ['source-card-title'] }, [tx(title)]),
              ...(meta ? [el('span', { className: ['source-card-meta'] }, [tx(meta)])] : []),
            ]),
            ARROW,
          ]),
        ],
      },
    };
  });
}

// ---- The plugin ---------------------------------------------------------------------------------------------------------

/** @returns {(tree: import('mdast').Root) => void} */
export default function remarkNewsBlocks() {
  return (tree) => {
    const visit = (node) => {
      if (!Array.isArray(node.children) || node.data?.newsBlock) return;
      node.children.forEach((child, i) => {
        if (child.type === 'blockquote' && (asNumbers(child) || asChart(child) || asTimeline(child))) return;
        if (child.type === 'heading' && child.depth === 2 && inlineText(child.children).trim().toLowerCase() === 'sources') {
          const next = node.children[i + 1];
          if (next?.type === 'list') asSourceCards(next);
        }
        visit(child);
      });
    };
    visit(tree);
  };
}
