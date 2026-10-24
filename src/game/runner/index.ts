// mountRunner: puts the game in a container and takes it out again. This module is the lazy chunk: a page imports it with a
// dynamic import() on the first click, tap or key, so three.js is never in a page's main bundle (docs/RUNNER.md).
//
// The host supplies the container: positioned (the game fills it), focusable (tabindex="0"), with an accessible name and its
// instructions as text (aria-describedby). The game adds its canvas, the score, a message and a live region inside it, and
// destroy() removes all of it, every listener, the animation frame, the observer and the WebGL context.
//
// Time: the rAF timestamp drives a fixed-step clock (clock.ts). The clock resets on the first frame, on resume and when the
// tab comes back; the game pauses when the tab is hidden, the window loses focus, or focus leaves the game while playing.

import { RUNNER_CONFIG, type RunnerConfig } from './config';
import { FixedStepClock } from './clock';
import { createInput } from './input';
import type { EnvironmentInfo } from './environment';
import { createView, type View } from './render';
import { RunnerSim, type Intent, type Phase } from './sim';
import { loadBest, saveBest } from './storage';
import { RUNNER_TEXT } from './text';

// The words moved to text.ts (404 page step: the page prints them at build time without loading three.js); still exported here.
export { RUNNER_TEXT };

export interface RunnerStats {
  /** Frames per second, smoothed. */
  fps: number;
  /** Fixed steps run in the last frame. */
  steps: number;
  speed: number;
  distance: number;
  lane: number;
  phase: Phase;
  paused: boolean;
  score: number;
  /** The view's world scroll and renderer counts (environment.ts), when the view reports them. */
  view?: EnvironmentInfo;
}

/**
 * How the game meets its page. `blended` (the default, the 404 page): the scene melts into the page's background at the top
 * and the sides, with no edge. `framed`: the scene runs to the container's edges (the fixture draws a hairline frame round it).
 */
export type RunnerVariant = 'blended' | 'framed';

export interface RunnerOptions {
  /** Seed of the first course (default Date.now()). The fixture page passes ?seed= so its tests can repeat a run. */
  seed?: number;
  config?: RunnerConfig;
  /** Use the touch words ("Tap to play") from the start. Otherwise they switch on a coarse pointer or the first touch. */
  touch?: boolean;
  /** Move keyboard focus to the container on mount (default true). */
  focus?: boolean;
  /** See RunnerVariant (default `blended`). */
  variant?: RunnerVariant;
  /** Called after every frame (the fixture page's debug readout). */
  onStats?: (stats: RunnerStats) => void;
}

export interface RunnerHandle {
  /** Start a run now (restarts after a game over; resumes when paused). */
  start(): void;
  destroy(): void;
  pause(): void;
  resume(): void;
}

/** What mountRunner builds on; the unit tests replace the view (no WebGL in Node). */
export interface RunnerDeps {
  createView: (canvas: HTMLCanvasElement, cfg: RunnerConfig) => View | null;
}

const pad5 = (n: number) => String(Math.max(0, Math.min(99999, Math.floor(n)))).padStart(5, '0');

export function mountRunner(
  container: HTMLElement,
  options: RunnerOptions = {},
  deps: RunnerDeps = { createView },
): RunnerHandle {
  const cfg = options.config ?? RUNNER_CONFIG;
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('mountRunner: the container is not in a window');

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const root = el('div', 'runner');
  root.setAttribute('data-runner', '');
  root.dataset.runnerVariant = options.variant ?? 'blended';
  const canvas = el('canvas', 'runner-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', RUNNER_TEXT.canvasLabel);
  root.append(canvas);
  container.append(root);

  const view = deps.createView(canvas, cfg);
  if (!view) {
    canvas.remove();
    root.dataset.runnerState = 'unsupported';
    root.append(el('p', 'runner-fallback', RUNNER_TEXT.noWebGL));
    const noop = () => {};
    return { start: noop, pause: noop, resume: noop, destroy: () => root.remove() };
  }

  // The score, best and pickups (top), the message (middle), and a live region for the end of a run.
  const hud = el('div', 'runner-hud');
  const scoreLine = el('p', 'runner-score');
  const scoreValue = el('span', undefined, '00000');
  scoreLine.append(scoreValue, ' m');
  const bestLine = el('p', 'runner-best', `${RUNNER_TEXT.best} `);
  const bestValue = el('span', undefined, '00000');
  bestLine.append(bestValue, ' m');
  const pickLine = el('p', 'runner-pickups');
  const dot = el('span', 'runner-dot');
  dot.setAttribute('aria-hidden', 'true');
  const pickValue = el('span', undefined, '0');
  pickLine.append(dot, el('span', 'visually-hidden', `${RUNNER_TEXT.pickups} `), pickValue);
  hud.append(scoreLine, bestLine, pickLine);
  const message = el('div', 'runner-message');
  const title = el('p', 'runner-title', RUNNER_TEXT.title);
  const result = el('p', 'runner-result');
  const prompt = el('p', 'runner-prompt');
  message.append(title, result, prompt);
  const live = el('p', 'visually-hidden');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('data-runner-live', '');
  // The page blend: gradients from the page's background over the scene's top and sides (runner.css; blended only).
  const blend = el('div', 'runner-blend');
  blend.setAttribute('aria-hidden', 'true');
  root.append(blend, hud, message, live);

  const coarse = win.matchMedia?.('(pointer: coarse)').matches ?? false;
  let touch = options.touch ?? coarse;
  const sim = new RunnerSim({ seed: options.seed ?? Date.now(), config: cfg });
  const clock = new FixedStepClock(cfg);
  let best = loadBest();
  let paused = false;
  let destroyed = false;
  let raf = 0;
  let lastPhase: Phase = sim.phase;
  let fps = 0;
  let lastFrame: number | null = null;
  let lastSteps = 0;
  const shown = { score: -1, best: -1, pickups: -1, lane: 99, phase: '', paused: false, touch: !touch };

  const updateHud = () => {
    if (sim.score !== shown.score) scoreValue.textContent = pad5((shown.score = sim.score));
    if (best !== shown.best) bestValue.textContent = pad5((shown.best = best));
    if (sim.pickups !== shown.pickups) pickValue.textContent = String((shown.pickups = sim.pickups));
    if (sim.lane !== shown.lane) root.dataset.runnerLane = String((shown.lane = sim.lane));
    if (sim.phase === shown.phase && paused === shown.paused && touch === shown.touch) return;
    shown.phase = sim.phase;
    shown.paused = paused;
    shown.touch = touch;
    root.dataset.runnerState = sim.phase;
    root.dataset.runnerPaused = String(paused);
    const words = touch ? 'touch' : 'keys';
    const showPaused = paused && sim.phase === 'playing';
    message.hidden = sim.phase === 'playing' && !showPaused;
    title.hidden = showPaused;
    result.hidden = sim.phase !== 'over';
    result.textContent = `${RUNNER_TEXT.score} ${pad5(sim.score)} m · ${RUNNER_TEXT.best} ${pad5(best)} m`;
    prompt.textContent = showPaused
      ? RUNNER_TEXT.paused[words]
      : sim.phase === 'over'
        ? RUNNER_TEXT.again[words]
        : RUNNER_TEXT.play[words];
  };

  const onPhaseChange = () => {
    if (sim.phase === lastPhase) return;
    if (sim.phase === 'over') {
      best = Math.max(best, saveBest(sim.score));
      live.textContent = RUNNER_TEXT.gameOver(sim.score);
    } else if (sim.phase === 'playing') {
      live.textContent = '';
    }
    lastPhase = sim.phase;
  };

  const frame = (now: number) => {
    raf = 0;
    if (destroyed || paused) return;
    const tick = clock.advance(now);
    for (let i = 0; i < tick.steps; i++) {
      sim.step();
      onPhaseChange();
    }
    lastSteps = tick.steps;
    if (lastFrame !== null && now > lastFrame) {
      const instant = 1000 / (now - lastFrame);
      fps = fps ? fps + (instant - fps) * 0.1 : instant;
    }
    lastFrame = now;
    view.render(sim, tick.alpha);
    updateHud();
    options.onStats?.({
      fps,
      steps: lastSteps,
      speed: sim.speed,
      distance: sim.distance,
      lane: sim.lane,
      phase: sim.phase,
      paused,
      score: sim.score,
      view: view.info?.(),
    });
    raf = win.requestAnimationFrame(frame);
  };

  const schedule = () => {
    if (!raf && !destroyed && !paused) raf = win.requestAnimationFrame(frame);
  };

  const pause = () => {
    if (destroyed || paused) return;
    paused = true;
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
    updateHud();
  };

  const resume = () => {
    if (destroyed || !paused) return;
    paused = false;
    clock.reset();
    lastFrame = null;
    updateHud();
    schedule();
  };

  const onIntent = (intent: Intent) => {
    if (destroyed) return;
    if (paused) {
      // While paused, Space or a tap only resumes a run; on the ready or game-over screen it also starts one.
      if (intent !== 'primary' && intent !== 'start') return;
      const wasPlaying = sim.phase === 'playing';
      resume();
      if (wasPlaying) return;
    }
    sim.input(intent);
  };

  const input = createInput(container, root, onIntent, {
    config: cfg,
    onTouch: () => {
      touch = true;
      updateHud();
    },
    onPointerDown: () => container.focus({ preventScroll: true }),
  });

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    const cap = touch || coarse ? cfg.render.maxPixelRatioTouch : cfg.render.maxPixelRatio;
    view.resize(width, height, Math.min(win.devicePixelRatio || 1, cap));
    view.render(sim, 1); // resizing clears the canvas: draw at once, even while paused
  };
  const observer = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
  observer?.observe(container);

  const onVisibility = () => {
    clock.reset();
    if (doc.visibilityState === 'hidden') pause();
  };
  const onBlur = () => pause();
  const onFocusOut = (event: Event) => {
    const next = (event as FocusEvent).relatedTarget as Node | null;
    if (sim.phase === 'playing' && !(next && container.contains(next))) pause();
  };
  const listeners: [EventTarget, string, EventListener][] = [
    [doc, 'visibilitychange', onVisibility],
    [win, 'blur', onBlur],
    [container, 'focusout', onFocusOut],
  ];
  if (!observer) listeners.push([win, 'resize', resize]);
  for (const [target, type, fn] of listeners) target.addEventListener(type, fn);

  resize();
  updateHud();
  if (options.focus !== false) container.focus({ preventScroll: true });
  if (doc.visibilityState === 'hidden') paused = true;
  schedule();

  return {
    start() {
      if (destroyed) return;
      resume();
      if (sim.start(true)) onPhaseChange();
      updateHud();
    },
    pause,
    resume,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) win.cancelAnimationFrame(raf);
      raf = 0;
      input.destroy();
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      observer?.disconnect();
      view.dispose();
      root.remove();
    },
  };
}
