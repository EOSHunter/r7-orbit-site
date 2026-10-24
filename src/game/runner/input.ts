// Keyboard, swipe and tap to intents. No rendering and no game state: it only says what the player asked for.
//
// Keys are read on the game's container (it has keyboard focus while playing), so the game never takes keys from the rest of
// the page. Space and the arrows would scroll the page; their default is prevented, and only while the container has focus,
// because that is the only time its listener hears them.

import { RUNNER_CONFIG, type RunnerConfig } from './config';
import type { Intent } from './sim';

/** The intent for a key (KeyboardEvent.key), or null for a key the game does not use. */
export function keyIntent(key: string): Intent | null {
  switch (key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'jump';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'slide';
    case ' ':
    case 'Spacebar':
      return 'primary';
    default:
      return null;
  }
}

/** Keys whose default action (scrolling) the game prevents while it has focus. */
export function preventsDefault(key: string): boolean {
  return key === ' ' || key === 'Spacebar' || key.startsWith('Arrow');
}

/**
 * The intent of a finger's movement so far (CSS pixels; y grows downwards), or null while it is too short or too diagonal to
 * tell. A swipe must travel swipeMinPx along one axis, and that axis must dominate the other by swipeDominance.
 */
export function swipeIntent(dx: number, dy: number, cfg: RunnerConfig = RUNNER_CONFIG): Intent | null {
  const { swipeMinPx, swipeDominance } = cfg.input;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < swipeMinPx) return null;
  if (ax >= ay * swipeDominance) return dx < 0 ? 'left' : 'right';
  if (ay >= ax * swipeDominance) return dy < 0 ? 'jump' : 'slide';
  return null;
}

/** A tap: a short press that barely moved. */
export function isTap(dx: number, dy: number, ms: number, cfg: RunnerConfig = RUNNER_CONFIG): boolean {
  return Math.hypot(dx, dy) < cfg.input.tapSlopPx && ms < cfg.input.tapMaxMs;
}

export interface InputOptions {
  config?: RunnerConfig;
  /** Called on the first touch, so the host can switch its words from "Press space" to "Tap". */
  onTouch?: () => void;
  /** Called on every pointer press (the host moves keyboard focus to the game). */
  onPointerDown?: () => void;
}

export interface InputHandle {
  destroy(): void;
}

interface Gesture {
  id: number;
  x: number;
  y: number;
  t: number;
  swiped: boolean;
}

/**
 * Listens for keys on `keyTarget` and for swipes and taps on `pointerTarget`, and calls `onIntent` with what they mean.
 * destroy() removes every listener it added.
 */
export function createInput(
  keyTarget: EventTarget,
  pointerTarget: EventTarget,
  onIntent: (intent: Intent) => void,
  opts: InputOptions = {},
): InputHandle {
  const cfg = opts.config ?? RUNNER_CONFIG;
  let gesture: Gesture | null = null;
  let touched = false;

  const onKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const intent = keyIntent(e.key);
    if (!intent) return;
    if (preventsDefault(e.key)) e.preventDefault();
    if (e.repeat) return; // holding a key is one press
    onIntent(intent);
  };

  const onPointerDown = (event: Event) => {
    const e = event as PointerEvent;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'touch' && !touched) {
      touched = true;
      opts.onTouch?.();
    }
    opts.onPointerDown?.();
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, swiped: false };
  };

  const onPointerMove = (event: Event) => {
    const e = event as PointerEvent;
    if (!gesture || gesture.swiped || e.pointerId !== gesture.id) return;
    const intent = swipeIntent(e.clientX - gesture.x, e.clientY - gesture.y, cfg);
    if (!intent) return;
    gesture.swiped = true; // one swipe per touch
    onIntent(intent);
  };

  const onPointerUp = (event: Event) => {
    const e = event as PointerEvent;
    if (!gesture || e.pointerId !== gesture.id) return;
    const g = gesture;
    gesture = null;
    if (g.swiped) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    // A quick flick can end before a move event crosses the threshold: judge it on release too.
    const intent = swipeIntent(dx, dy, cfg);
    if (intent) onIntent(intent);
    else if (isTap(dx, dy, e.timeStamp - g.t, cfg)) onIntent('start');
  };

  const onPointerCancel = () => {
    gesture = null;
  };

  const listeners: [EventTarget, string, EventListener][] = [
    [keyTarget, 'keydown', onKeyDown],
    [pointerTarget, 'pointerdown', onPointerDown],
    [pointerTarget, 'pointermove', onPointerMove],
    [pointerTarget, 'pointerup', onPointerUp],
    [pointerTarget, 'pointercancel', onPointerCancel],
  ];
  for (const [target, type, fn] of listeners) target.addEventListener(type, fn);

  return {
    destroy() {
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      gesture = null;
    },
  };
}
