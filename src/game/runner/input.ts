// Keyboard, swipe and tap to intents. No rendering and no game state: it only says what the player asked for.
//
// Crouch is a HELD state, so this file also says when it ends: a key's keyup, a finger's pointerup or pointercancel, the
// container losing focus, or release() (the host calls it on pause, blur and visibility changes, because a keyup that happens
// while the page is not listening is never heard). Key repeat is ignored, so holding a key is one press. After release() the
// key has to be pressed again; that is what keeps the rover from ever being stuck low.
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
      return 'crouch';
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
  if (ay >= ax * swipeDominance) return dy < 0 ? 'jump' : 'crouch';
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
  /** Forget every held key and finger and say `crouchCancel`. Called when the game pauses, blurs or hides. */
  release(): void;
}

interface Gesture {
  id: number;
  /** Where the current swipe is measured from. After a swipe down it moves to the finger, so the next swipe is its own. */
  x: number;
  y: number;
  t: number;
  /** Where the finger went down, for the tap test. */
  x0: number;
  y0: number;
  swiped: boolean;
  /** A swipe down is holding the crouch: the finger lifting (or the touch being cancelled) ends it. */
  crouching: boolean;
}

/** One name per crouch key, so Shift or Caps Lock changing the letter between keydown and keyup cannot leave one held. */
const heldName = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

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
  const heldKeys = new Set<string>();

  const onKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const intent = keyIntent(e.key);
    if (!intent) return;
    if (preventsDefault(e.key)) e.preventDefault();
    if (e.repeat) return; // holding a key is one press
    if (intent === 'crouch') heldKeys.add(heldName(e.key));
    onIntent(intent);
  };

  const onKeyUp = (event: Event) => {
    const e = event as KeyboardEvent;
    if (keyIntent(e.key) !== 'crouch') return;
    // Two crouch keys can be down together (S and Down): the crouch ends when the last one is let go.
    if (heldKeys.delete(heldName(e.key)) && heldKeys.size === 0 && !gesture?.crouching) onIntent('crouchEnd');
  };

  const endTouchCrouch = () => {
    if (gesture?.crouching && heldKeys.size === 0) onIntent('crouchEnd');
  };

  const release = () => {
    const had = heldKeys.size > 0 || !!gesture?.crouching;
    heldKeys.clear();
    gesture = null;
    if (had) onIntent('crouchCancel');
  };

  const onPointerDown = (event: Event) => {
    const e = event as PointerEvent;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType === 'touch' && !touched) {
      touched = true;
      opts.onTouch?.();
    }
    opts.onPointerDown?.();
    if (gesture?.crouching) endTouchCrouch(); // a new finger replaces one whose pointerup was never heard
    gesture = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      x0: e.clientX,
      y0: e.clientY,
      t: e.timeStamp,
      swiped: false,
      crouching: false,
    };
    // Keep hearing this finger even if it leaves the game's box, so its pointerup always arrives.
    try {
      (pointerTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // A pointer that is already gone cannot be captured; the cancel and lostpointercapture listeners cover it.
    }
  };

  const onPointerMove = (event: Event) => {
    const e = event as PointerEvent;
    if (!gesture || e.pointerId !== gesture.id) return;
    if (gesture.swiped && !gesture.crouching) return; // one swipe per touch, unless a finger is holding a crouch
    const intent = swipeIntent(e.clientX - gesture.x, e.clientY - gesture.y, cfg);
    if (!intent) return;
    gesture.swiped = true;
    if (intent === 'crouch') {
      gesture.crouching = true; // pressing again (after a jump swiped away from it) crouches again
      gesture.x = e.clientX;
      gesture.y = e.clientY;
      onIntent('crouchTouch');
      return;
    }
    // Swiping another way while holding: a lane change or a jump (a jump ends the crouch in the sim), then a fresh start.
    gesture.x = e.clientX;
    gesture.y = e.clientY;
    onIntent(intent);
  };

  const onPointerUp = (event: Event) => {
    const e = event as PointerEvent;
    if (!gesture || e.pointerId !== gesture.id) return;
    const g = gesture;
    endTouchCrouch();
    gesture = null;
    if (g.swiped) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    // A quick flick can end before a move event crosses the threshold: judge it on release too.
    const intent = swipeIntent(dx, dy, cfg);
    if (intent === 'crouch') {
      // A flick down that ends the moment the finger lifts: a crouch of the minimum length, no more.
      onIntent('crouchTouch');
      onIntent('crouchEnd');
    } else if (intent) onIntent(intent);
    else if (isTap(dx, dy, e.timeStamp - g.t, cfg)) onIntent('start');
  };

  const onPointerCancel = (event: Event) => {
    const e = event as PointerEvent;
    if (gesture && e.pointerId !== undefined && e.pointerId !== gesture.id) return;
    endTouchCrouch();
    gesture = null;
  };

  const listeners: [EventTarget, string, EventListener][] = [
    [keyTarget, 'keydown', onKeyDown],
    [keyTarget, 'keyup', onKeyUp],
    [keyTarget, 'blur', release],
    [pointerTarget, 'pointerdown', onPointerDown],
    [pointerTarget, 'pointermove', onPointerMove],
    [pointerTarget, 'pointerup', onPointerUp],
    [pointerTarget, 'pointercancel', onPointerCancel],
    [pointerTarget, 'lostpointercapture', onPointerCancel],
  ];
  for (const [target, type, fn] of listeners) target.addEventListener(type, fn);

  return {
    destroy() {
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      heldKeys.clear();
      gesture = null;
    },
    release,
  };
}
