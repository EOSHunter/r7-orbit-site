// mountAscent: puts the game in a container and takes it out again. This module is the lazy chunk: a page imports it with a
// dynamic import() when Play is pressed, so three.js is never in a page's main bundle (docs/ASCENT.md, "Code").
//
// The host supplies the container: positioned (the game fills it), focusable (tabindex="0"), with an accessible name and its
// instructions as text (aria-describedby). The game adds its canvas, the altitude, a message and a live region inside it,
// and destroy() removes all of it, every listener, the animation frame, the observer and the WebGL context.
//
// Time: the rAF timestamp drives a fixed-step clock (clock.ts); the camera follows on the frame's real time. The game pauses
// when the tab is hidden, the window loses focus, focus leaves the game, Escape is pressed, or the pointer lock is let go.

import { OrbitCamera } from './camera';
import { FixedStepClock } from './clock';
import { readTokenColors } from './colors';
import { ASCENT_CONFIG, type AscentConfig } from './config';
import { createInput, moveVector, turnInput } from './input';
import { PROTOTYPE_LEVEL, type Level } from './level';
import { createView, type View, type ViewInfo, type ViewOptions } from './render';
import { AscentSim } from './sim';
import { ASCENT_TEXT } from './text';

export { ASCENT_TEXT };
export { withConfig } from './config';

export type AscentState = 'ready' | 'playing' | 'unsupported';

export interface AscentStats {
  /** Frames per second, smoothed. */
  fps: number;
  /** Fixed steps run in the last frame. */
  steps: number;
  state: AscentState;
  paused: boolean;
  locked: boolean;
  x: number;
  y: number;
  z: number;
  /** Speed across the ground, and up (negative: falling). */
  speed: number;
  vy: number;
  grounded: boolean;
  coyote: number;
  buffer: number;
  altitude: number;
  best: number;
  falls: number;
  jumps: number;
  time: number;
  cameraYaw: number;
  cameraPitch: number;
  cameraDistance: number;
  view: ViewInfo;
}

export interface AscentOptions {
  config?: AscentConfig;
  level?: Level;
  /** Move keyboard focus to the container on mount (default true). */
  focus?: boolean;
  /** Ask for pointer lock when a climb starts or resumes, and on a click (default true). Without it, drag to look. */
  pointerLock?: boolean;
  /** Called after every frame (the prototype page's debug readout and its tests). */
  onStats?: (stats: AscentStats) => void;
}

export interface AscentHandle {
  /** Start the climb (or resume it when paused). */
  start(): void;
  pause(): void;
  resume(): void;
  /** Back to the start of the course, time and best height reset. */
  restart(): void;
  destroy(): void;
}

/** What mountAscent builds on; a test can replace the view (no WebGL in Node). */
export interface AscentDeps {
  createView: (canvas: HTMLCanvasElement, options: ViewOptions) => View | null;
}

export function mountAscent(
  container: HTMLElement,
  options: AscentOptions = {},
  deps: AscentDeps = { createView },
): AscentHandle {
  const cfg = options.config ?? ASCENT_CONFIG;
  const level = options.level ?? PROTOTYPE_LEVEL;
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('mountAscent: the container is not in a window');

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const root = el('div', 'ascent');
  root.setAttribute('data-ascent', '');
  const canvas = el('canvas', 'ascent-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', ASCENT_TEXT.canvasLabel);
  root.append(canvas);
  container.append(root);

  const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const view = deps.createView(canvas, { colors: readTokenColors(root), level, config: cfg, reducedMotion });
  if (!view) {
    canvas.remove();
    root.dataset.ascentState = 'unsupported';
    root.append(el('p', 'ascent-fallback', ASCENT_TEXT.noWebGL));
    const noop = () => {};
    return { start: noop, pause: noop, resume: noop, restart: noop, destroy: () => root.remove() };
  }

  // The altitude, best and falls (top left), the message (middle), the controls hint (bottom), a live region for falls.
  const hud = el('div', 'ascent-hud');
  const altLine = el('p', 'ascent-alt');
  const altValue = el('span', undefined, '0');
  altLine.append(el('span', 'visually-hidden', `${ASCENT_TEXT.altitude} `), altValue, ' m');
  const bestLine = el('p', 'ascent-sub', `${ASCENT_TEXT.best} `);
  const bestValue = el('span', undefined, '0');
  bestLine.append(bestValue, ' m');
  const fallsLine = el('p', 'ascent-sub', `${ASCENT_TEXT.falls} `);
  const fallsValue = el('span', undefined, '0');
  fallsLine.append(fallsValue);
  hud.append(altLine, bestLine, fallsLine);
  const message = el('div', 'ascent-message');
  const title = el('p', 'ascent-title', ASCENT_TEXT.title);
  const prompt = el('p', 'ascent-prompt', ASCENT_TEXT.play);
  message.append(title, prompt);
  const hint = el('p', 'ascent-hint', ASCENT_TEXT.hint);
  const live = el('p', 'visually-hidden');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('data-ascent-live', '');
  root.append(hud, message, hint, live);

  const sim = new AscentSim(level, cfg);
  const rig = new OrbitCamera(level.spawnYaw, cfg);
  rig.snap(sim.pos, level.boxes);
  const clock = new FixedStepClock(cfg);
  let state: AscentState = 'ready';
  let paused = false;
  let destroyed = false;
  let raf = 0;
  let fps = 0;
  let lastFrame: number | null = null;
  let lastSteps = 0;
  let seenTeleports = sim.teleports;
  let lastAlpha = 0;
  const shown = { alt: -1, best: -1, falls: -1, state: '', paused: false, locked: false };

  const locked = () => doc.pointerLockElement === canvas;
  const wantsLock = options.pointerLock !== false;
  const requestLock = () => {
    if (!wantsLock || locked() || !canvas.requestPointerLock) return;
    try {
      // A promise in current browsers: refused locks (too soon after Escape, a sandboxed frame) are expected, not errors.
      const p = canvas.requestPointerLock() as unknown;
      if (p instanceof Promise) p.catch(() => {});
    } catch {
      // Older browsers throw instead; dragging still looks around.
    }
  };
  const exitLock = () => {
    if (locked()) doc.exitPointerLock?.();
  };

  const updateHud = () => {
    const alt = Math.max(0, Math.round(sim.altitude));
    if (alt !== shown.alt) altValue.textContent = String((shown.alt = alt));
    const best = Math.round(sim.best);
    if (best !== shown.best) bestValue.textContent = String((shown.best = best));
    if (sim.falls !== shown.falls) fallsValue.textContent = String((shown.falls = sim.falls));
    const isLocked = locked();
    if (state === shown.state && paused === shown.paused && isLocked === shown.locked) return;
    shown.state = state;
    shown.paused = paused;
    shown.locked = isLocked;
    root.dataset.ascentState = state;
    root.dataset.ascentPaused = String(paused);
    root.dataset.ascentLocked = String(isLocked);
    message.hidden = state === 'playing' && !paused;
    title.hidden = state === 'playing';
    prompt.textContent = state === 'playing' ? ASCENT_TEXT.paused : ASCENT_TEXT.play;
  };

  const frame = (now: number) => {
    raf = 0;
    if (destroyed || paused) return;
    const tick = clock.advance(now);
    if (state === 'playing') {
      rig.turn(turnInput(input.held), tick.delta);
      const move = moveVector(input.held, rig.yaw);
      sim.setMove(move.x, move.z);
      for (let i = 0; i < tick.steps; i++) sim.step();
      if (sim.teleports !== seenTeleports) {
        seenTeleports = sim.teleports;
        rig.yaw = level.spawnYaw;
        rig.snap(sim.pos, level.boxes);
        live.textContent = ASCENT_TEXT.fell;
      }
      rig.update(sim.lerpPos(tick.alpha), tick.delta, level.boxes);
    }
    lastSteps = tick.steps;
    lastAlpha = tick.alpha;
    if (lastFrame !== null && now > lastFrame) {
      const instant = 1000 / (now - lastFrame);
      fps = fps ? fps + (instant - fps) * 0.1 : instant;
    }
    lastFrame = now;
    view.render(sim, tick.alpha, rig, now / 1000);
    updateHud();
    if (options.onStats) {
      options.onStats({
        fps,
        steps: lastSteps,
        state,
        paused,
        locked: locked(),
        x: sim.pos.x,
        y: sim.pos.y,
        z: sim.pos.z,
        speed: Math.hypot(sim.vel.x, sim.vel.z),
        vy: sim.vel.y,
        grounded: sim.grounded,
        coyote: sim.coyote,
        buffer: sim.buffer,
        altitude: sim.altitude,
        best: sim.best,
        falls: sim.falls,
        jumps: sim.jumps,
        time: sim.time,
        cameraYaw: rig.yaw,
        cameraPitch: rig.pitch,
        cameraDistance: rig.distance,
        view: view.info(),
      });
    }
    raf = win.requestAnimationFrame(frame);
  };

  const schedule = () => {
    if (!raf && !destroyed && !paused) raf = win.requestAnimationFrame(frame);
  };

  const pause = () => {
    if (destroyed || paused || state !== 'playing') return;
    input.release();
    sim.release();
    paused = true;
    exitLock();
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
    updateHud();
  };

  const resume = () => {
    if (destroyed || !paused) return;
    paused = false;
    input.release();
    sim.release();
    clock.reset();
    lastFrame = null;
    requestLock();
    updateHud();
    schedule();
  };

  const start = () => {
    if (destroyed) return;
    if (state === 'playing') return resume();
    state = 'playing';
    clock.reset();
    requestLock();
    updateHud();
    schedule();
  };

  const input = createInput(container, canvas, locked, {
    onJump: (down) => {
      if (destroyed) return;
      if (state !== 'playing') {
        if (down) start();
        return;
      }
      if (paused) {
        if (down) resume();
        return;
      }
      if (down) sim.jumpPress();
      else sim.jumpRelease();
    },
    onLook: (dx, dy) => {
      if (state === 'playing' && !paused) rig.look(dx, dy);
    },
    onPause: () => pause(),
    onPointerDown: () => {
      container.focus({ preventScroll: true });
      if (state !== 'playing') start();
      else if (paused) resume();
      else requestLock();
    },
  });

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    const coarse = win.matchMedia?.('(pointer: coarse)').matches ?? false;
    const cap = coarse ? cfg.render.maxPixelRatioTouch : cfg.render.maxPixelRatio;
    view.resize(width, height, Math.min(win.devicePixelRatio || 1, cap));
    view.render(sim, lastAlpha, rig, (win.performance?.now() ?? 0) / 1000); // resizing clears the canvas: draw at once
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
    if (!(next && container.contains(next)) && !locked()) pause();
  };
  // The browser lets go of the lock on Escape (the key itself never reaches the page then): that is a pause.
  let wasLocked = false;
  const onLockChange = () => {
    const now = locked();
    if (wasLocked && !now) pause();
    wasLocked = now;
    updateHud();
  };
  const listeners: [EventTarget, string, EventListener][] = [
    [doc, 'visibilitychange', onVisibility],
    [doc, 'pointerlockchange', onLockChange],
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
    start,
    pause,
    resume,
    restart() {
      if (destroyed) return;
      sim.restart();
      seenTeleports = sim.teleports;
      rig.yaw = level.spawnYaw;
      rig.pitch = cfg.camera.pitch.start;
      rig.snap(sim.pos, level.boxes);
      updateHud();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) win.cancelAnimationFrame(raf);
      raf = 0;
      exitLock();
      input.destroy();
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      observer?.disconnect();
      view.dispose();
      root.remove();
    },
  };
}
