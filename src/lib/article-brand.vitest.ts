import { describe, expect, it } from 'vitest';
import {
  AGENT_STATES,
  DIAGRAM_SLOTS,
  agentCardsHtml,
  agentCardsProblems,
  orbitDiagramHtml,
  orbitDiagramProblems,
  orbitDividerHtml,
  ringPhrase,
  statDialHtml,
  statDialProblems,
  statusMarkHtml,
  withCode,
} from './article-brand';

const card = { task: 'Add a dark mode', agent: 'Quasar', tool: 'Claude', model: 'Sonnet 5.5', effort: 'Medium', state: 'finished' as const };

describe('agent cards', () => {
  it('draw the card as the app does: mark, task, name, tool, chips, state, report', () => {
    const html = agentCardsHtml({ cards: [{ ...card, report: 'I added a toggle.' }], caption: 'From the video.' });
    expect(html).toContain('<figure class="art-agents" data-count="1"><ul class="art-agents-list" role="list">');
    expect(html).toContain('<li class="art-agent" data-state="finished">');
    expect(html).toContain('<span class="mark done" aria-hidden="true">');
    expect(html).toContain('<span>Add a dark mode</span>');
    expect(html).toContain('<span class="art-agent-name">Quasar</span>');
    expect(html).toContain('<span class="art-agent-tool">Claude</span><span class="chip mono">Sonnet 5.5</span><span class="chip mono">Medium</span>');
    expect(html).toContain('<p class="art-agent-state">Finished</p>');
    expect(html).toContain('<p class="art-agent-report">I added a toggle.</p>');
    expect(html).toContain('<figcaption>From the video.</figcaption>');
  });

  it('leaves out what is not given', () => {
    const html = agentCardsHtml({ cards: [{ task: 'T', agent: 'A' }] });
    expect(html).not.toContain('art-agent-tool');
    expect(html).not.toContain('chip');
    expect(html).not.toContain('art-agent-report');
    expect(html).not.toContain('figcaption');
  });

  it('shows each state with its label and the app\'s mark', () => {
    for (const [state, { label }] of Object.entries(AGENT_STATES)) {
      expect(agentCardsHtml({ cards: [{ task: 'T', agent: 'A', state }] })).toContain(`>${label}</p>`);
    }
    expect(statusMarkHtml('working')).toContain('class="arc"');
    expect(statusMarkHtml('needs')).toContain('mark needs');
    expect(statusMarkHtml('interrupted')).toContain('mark idle');
    expect(statusMarkHtml('interrupted')).not.toContain('class="dot"');
  });

  it('escapes everything and shows `code` in backticks as code', () => {
    const html = agentCardsHtml({ cards: [{ task: '<b>x</b>', agent: '"A"', report: 'fixed `dayOf` in <src>' }] });
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('fixed <code>dayOf</code> in &lt;src&gt;');
    expect(withCode('one ` tick')).toBe('one ` tick');
  });

  it('are refused at build time when a card is missing its task or agent, or there are more than three', () => {
    expect(agentCardsProblems([card])).toEqual([]);
    expect(agentCardsProblems([])).toHaveLength(1);
    expect(agentCardsProblems([{ agent: 'A' }]).join(' ')).toContain('task is required');
    expect(agentCardsProblems([card, card, card, card]).join(' ')).toContain('at most three');
    expect(agentCardsProblems([{ ...card, state: 'done' }]).join(' ')).toContain('state must be one of');
  });
});

describe('the orbit diagram', () => {
  const agents = (n: number) => Array.from({ length: n }, (_, i) => ({ agent: `A${i}`, task: `Task ${i}`, tool: 'Claude' }));

  it('places one to eight agents in distinct slots round the hub, each joined to it by a hairline', () => {
    for (let n = 1; n <= 8; n++) {
      expect(new Set(DIAGRAM_SLOTS[n]).size).toBe(n);
      const html = orbitDiagramHtml({ hub: 'lumen', agents: agents(n) });
      expect(html.match(/data-slot="/g)).toHaveLength(n);
      expect(html.match(/M50 50L/g)).toHaveLength(n);
    }
  });

  it('draws the hub with the R7 mark (the file the header already loads), the project and the line under it', () => {
    const html = orbitDiagramHtml({ hub: 'lumen', meta: 'main · 9 agents', agents: agents(2), caption: 'Cap' });
    expect(html).toContain('<img src="/assets/r7-mark.svg" alt=""');
    expect(html).toContain('<p class="art-orbit-name">lumen</p><p class="art-orbit-meta">main · 9 agents</p>');
    expect(html).toContain('<ul class="art-orbit-agents" role="list">');
    expect(html).toContain('<figcaption>Cap</figcaption>');
    expect(html).toContain('aria-hidden="true"');
  });

  it('is refused at build time without a hub, or with no agents or more than eight', () => {
    expect(orbitDiagramProblems('lumen', agents(8))).toEqual([]);
    expect(orbitDiagramProblems('', agents(1)).join(' ')).toContain('hub is required');
    expect(orbitDiagramProblems('lumen', [])).toHaveLength(1);
    expect(orbitDiagramProblems('lumen', agents(9)).join(' ')).toContain('at most 8');
  });
});

describe('the stat dial', () => {
  it('hides the dial from screen readers and keeps the caption, which says the number in words', () => {
    const html = statDialHtml({ value: '17', unit: 's', caption: 'It finished in 17 seconds.', source: 'From the video' });
    expect(html).toContain('<div class="art-stat-dial" aria-hidden="true">');
    expect(html).toContain('<p class="art-stat-value">17<span class="art-stat-unit">s</span></p>');
    expect(html).toContain('<span class="art-stat-caption">It finished in 17 seconds.</span><span class="art-stat-source">From the video</span>');
    // The far half of the ring before the number, the near half and the dot after it.
    expect(html.indexOf('data-part="back"')).toBeLessThan(html.indexOf('art-stat-value'));
    expect(html.indexOf('data-part="front"')).toBeGreaterThan(html.indexOf('art-stat-value'));
  });

  it('is refused at build time without a number or a caption', () => {
    expect(statDialProblems('17', 'Seventeen seconds.')).toEqual([]);
    expect(statDialProblems('', 'x').join(' ')).toContain('value is required');
    expect(statDialProblems('17', '').join(' ')).toContain('caption is required');
  });
});

describe('the ring and the divider', () => {
  it('wraps the first occurrence of the words, matching the HTML-escaped text', () => {
    expect(ringPhrase('basically mission control for you', 'mission control')).toMatch(
      /^basically <span class="art-ring">mission control<svg class="art-ring-line"[^]*<\/span> for you$/,
    );
    expect(ringPhrase('a &amp; b', 'a & b')).toContain('<span class="art-ring">a &amp; b');
    expect(ringPhrase('nothing here', 'missing')).toBeUndefined();
    expect(ringPhrase('same', '  ')).toBe('same');
  });

  it('draws the orbit divider as a separator with the small ring and dot', () => {
    const html = orbitDividerHtml();
    expect(html).toMatch(/^<div class="art-divider" role="separator" data-variant="orbit"><svg class="art-orbit-mark"/);
    expect(html).toContain('<circle');
  });
});
