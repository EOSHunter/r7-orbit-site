// Touch controls (docs/ASCENT.md, "Phone controls"): a virtual stick under the left thumb, a drag on the right half to look,
// a jump button and a pause button. Shown once the player touches the game (or from the start on a device whose main pointer
// is coarse); a mouse never sees them. The stick's maths is pure (stickVector, unit-tested); the rest is DOM and pointer
// events on the canvas, each touch followed by its pointerId so two thumbs work at once.

import { ASCENT_TEXT } from './text';

/** How far (CSS pixels) a thumb moves the stick to full speed, and the share of that which counts as resting. */
export const STICK = { radius: 56, dead: 0.14 } as const;

/**
 * A thumb `dx`, `dy` pixels from where it went down, as a move: x to the right, y forward (a thumb pushed up is forward), at
 * most 1 long, 0 inside the dead zone and rising from there, so a small push is a slow walk.
 */
export function stickVector(dx: number, dy: number, radius: number = STICK.radius, dead: number = STICK.dead) {
  const len = Math.hypot(dx, dy);
  if (len <= dead * radius || len === 0) return { x: 0, y: 0 };
  const amount = Math.min(1, (len / radius - dead) / (1 - dead));
  return { x: (dx / len) * amount, y: (-dy / len) * amount };
}

export interface TouchHandlers {
  onJump: (down: boolean) => void;
  /** The look drag, in CSS pixels (the host scales it). */
  onLook: (dx: number, dy: number) => void;
  onPause: () => void;
  /** The controls were shown by a first touch (not when shown from the start). */
  onShow?: () => void;
}

export interface TouchControls {
  /** The stick now: x right, y forward, at most 1 long. */
  readonly stick: { x: number; y: number };
  readonly shown: boolean;
  show(): void;
  /** Let go of every thumb (pause, blur). */
  release(): void;
  destroy(): void;
}

export function createTouchControls(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  handlers: TouchHandlers,
  options: { show?: boolean } = {},
): TouchControls {
  const doc = root.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
    const node = doc.createElement(tag);
    node.className = className;
    return node;
  };
  const layer = el('div', 'ascent-touch');
  layer.hidden = true;
  const base = el('div', 'ascent-stick');
  base.setAttribute('aria-hidden', 'true');
  const knob = el('div', 'ascent-stick-knob');
  base.append(knob);
  base.hidden = true;
  const jump = el('button', 'ascent-jump');
  jump.type = 'button';
  jump.textContent = ASCENT_TEXT.jump;
  const pause = el('button', 'ascent-pause-button');
  pause.type = 'button';
  pause.setAttribute('aria-label', ASCENT_TEXT.pause);
  layer.append(base, jump, pause);
  const rotate = el('p', 'ascent-rotate');
  rotate.textContent = ASCENT_TEXT.rotate;
  root.append(layer, rotate);

  const stick = { x: 0, y: 0 };
  let stickId: number | null = null;
  let origin = { x: 0, y: 0 };
  let lookId: number | null = null;
  let last = { x: 0, y: 0 };
  let jumpId: number | null = null;
  let shown = false;

  const reveal = () => {
    shown = true;
    layer.hidden = false;
    root.dataset.ascentTouch = 'true';
  };
  const show = () => {
    if (shown) return;
    reveal();
    handlers.onShow?.();
  };
  if (options.show) reveal(); // shown from the start: no onShow while the host is still setting up

  const setKnob = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy);
    const k = len > STICK.radius ? STICK.radius / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };

  const onDown = (event: Event) => {
    const e = event as PointerEvent;
    if (e.pointerType !== 'touch') return;
    show();
    const rect = canvas.getBoundingClientRect();
    const left = e.clientX - rect.left < rect.width / 2;
    if (left && stickId === null) {
      stickId = e.pointerId;
      origin = { x: e.clientX, y: e.clientY };
      base.style.left = `${e.clientX - rect.left}px`;
      base.style.top = `${e.clientY - rect.top}px`;
      base.hidden = false;
      setKnob(0, 0);
    } else if (!left && lookId === null) {
      lookId = e.pointerId;
      last = { x: e.clientX, y: e.clientY };
    }
  };
  const onMove = (event: Event) => {
    const e = event as PointerEvent;
    if (e.pointerId === stickId) {
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;
      Object.assign(stick, stickVector(dx, dy));
      setKnob(dx, dy);
    } else if (e.pointerId === lookId) {
      handlers.onLook(e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
    }
  };
  const onUp = (event: Event) => {
    const e = event as PointerEvent;
    if (e.pointerId === stickId) {
      stickId = null;
      stick.x = stick.y = 0;
      base.hidden = true;
    } else if (e.pointerId === lookId) {
      lookId = null;
    }
  };

  // The buttons answer at once (pointerdown, not click), and hold the jump while the thumb stays down.
  const onJumpDown = (event: Event) => {
    const e = event as PointerEvent;
    e.preventDefault();
    if (jumpId !== null) return;
    jumpId = e.pointerId;
    try {
      jump.setPointerCapture?.(e.pointerId); // the thumb may slide off the button and still hold the jump
    } catch {
      // a pointer the browser no longer knows: the jump still counts
    }
    handlers.onJump(true);
  };
  const onJumpUp = (event: Event) => {
    if ((event as PointerEvent).pointerId !== jumpId) return;
    jumpId = null;
    handlers.onJump(false);
  };
  const onPause = (event: Event) => {
    event.preventDefault();
    handlers.onPause();
  };

  const listeners: [EventTarget, string, EventListener][] = [
    [canvas, 'pointerdown', onDown],
    [canvas, 'pointermove', onMove],
    [canvas, 'pointerup', onUp],
    [canvas, 'pointercancel', onUp],
    [jump, 'pointerdown', onJumpDown],
    [jump, 'pointerup', onJumpUp],
    [jump, 'pointercancel', onJumpUp],
    [pause, 'pointerdown', onPause],
  ];
  for (const [target, type, fn] of listeners) target.addEventListener(type, fn);

  const release = () => {
    stickId = lookId = null;
    stick.x = stick.y = 0;
    base.hidden = true;
    if (jumpId !== null) {
      jumpId = null;
      handlers.onJump(false);
    }
  };

  return {
    stick,
    get shown() {
      return shown;
    },
    show,
    release,
    destroy() {
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      layer.remove();
      rotate.remove();
    },
  };
}
