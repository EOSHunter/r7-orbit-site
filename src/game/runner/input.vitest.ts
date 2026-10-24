import { describe, expect, it } from 'vitest';
import { RUNNER_CONFIG } from './config';
import { createInput, isTap, keyIntent, preventsDefault, swipeIntent } from './input';
import type { Intent } from './sim';

const { swipeMinPx, swipeDominance, tapSlopPx, tapMaxMs } = RUNNER_CONFIG.input;

/** A KeyboardEvent-shaped Event (Node has Event and EventTarget, not KeyboardEvent). */
function key(k: string, extra: Record<string, unknown> = {}): Event {
  return Object.assign(new Event('keydown', { cancelable: true }), {
    key: k,
    repeat: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...extra,
  });
}

/** A PointerEvent-shaped Event. timeStamp is a getter on Event, so every field is defined, not assigned. */
function pointer(type: string, x: number, y: number, t: number, extra: Record<string, unknown> = {}): Event {
  const fields = { pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: t, ...extra };
  const event = new Event(type, { cancelable: true });
  for (const [k, value] of Object.entries(fields)) Object.defineProperty(event, k, { value });
  return event;
}

describe('keys', () => {
  it('maps arrows, WASD and Space', () => {
    expect(['ArrowLeft', 'a', 'A'].map(keyIntent)).toEqual(['left', 'left', 'left']);
    expect(['ArrowRight', 'd', 'D'].map(keyIntent)).toEqual(['right', 'right', 'right']);
    expect(['ArrowUp', 'w', 'W'].map(keyIntent)).toEqual(['jump', 'jump', 'jump']);
    expect(['ArrowDown', 's', 'S'].map(keyIntent)).toEqual(['slide', 'slide', 'slide']);
    expect(keyIntent(' ')).toBe('primary');
    expect(['Enter', 'Tab', 'Escape', 'q', 'Shift'].map(keyIntent)).toEqual([null, null, null, null, null]);
  });

  it('prevents scrolling only for Space and the arrows', () => {
    expect([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].every(preventsDefault)).toBe(true);
    expect(['w', 'a', 's', 'd', 'Tab', 'Enter', 'PageDown'].some(preventsDefault)).toBe(false);
  });

  it('createInput: one intent per press, held keys and shortcuts ignored, defaults prevented', () => {
    const target = new EventTarget();
    const got: Intent[] = [];
    const input = createInput(target, new EventTarget(), (i) => got.push(i));

    const space = key(' ');
    target.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    const w = key('w');
    target.dispatchEvent(w);
    expect(w.defaultPrevented).toBe(false);
    const held = key('ArrowLeft', { repeat: true });
    target.dispatchEvent(held);
    expect(held.defaultPrevented, 'a held arrow still does not scroll').toBe(true);
    target.dispatchEvent(key('ArrowLeft', { ctrlKey: true }));
    const tab = key('Tab');
    target.dispatchEvent(tab);
    expect(tab.defaultPrevented, 'Tab still moves focus out of the game').toBe(false);
    expect(got).toEqual(['primary', 'jump']);

    input.destroy();
    target.dispatchEvent(key('ArrowRight'));
    expect(got).toEqual(['primary', 'jump']);
  });
});

describe('swipes and taps', () => {
  it('ignores moves shorter than the threshold', () => {
    expect(swipeIntent(swipeMinPx - 1, 0)).toBeNull();
    expect(swipeIntent(0, -(swipeMinPx - 1))).toBeNull();
    expect(swipeIntent(swipeMinPx, 0)).toBe('right');
  });

  it('picks the dominant axis, and ignores diagonals', () => {
    expect(swipeIntent(-60, 10)).toBe('left');
    expect(swipeIntent(60, -20)).toBe('right');
    expect(swipeIntent(10, -60)).toBe('jump');
    expect(swipeIntent(-15, 60)).toBe('slide');
    expect(swipeIntent(60, 60 / swipeDominance + 1)).toBeNull();
    expect(swipeIntent(50, 48)).toBeNull();
  });

  it('a tap is short and still', () => {
    expect(isTap(2, 3, 100)).toBe(true);
    expect(isTap(tapSlopPx, 0, 100)).toBe(false);
    expect(isTap(0, 0, tapMaxMs)).toBe(false);
  });

  it('createInput: a swipe fires once per touch, while the finger moves; a tap starts', () => {
    const surface = new EventTarget();
    const got: Intent[] = [];
    let touches = 0;
    const input = createInput(new EventTarget(), surface, (i) => got.push(i), { onTouch: () => touches++ });

    surface.dispatchEvent(pointer('pointerdown', 100, 100, 0));
    surface.dispatchEvent(pointer('pointermove', 80, 102, 16));
    expect(got).toEqual([]);
    surface.dispatchEvent(pointer('pointermove', 50, 104, 32));
    expect(got).toEqual(['left']);
    surface.dispatchEvent(pointer('pointermove', 10, 40, 48)); // the same touch keeps moving: no second intent
    surface.dispatchEvent(pointer('pointerup', 10, 40, 60));
    expect(got).toEqual(['left']);

    surface.dispatchEvent(pointer('pointerdown', 100, 100, 100));
    surface.dispatchEvent(pointer('pointerup', 103, 101, 180));
    expect(got).toEqual(['left', 'start']);

    // A quick flick with no move event in between is judged on release.
    surface.dispatchEvent(pointer('pointerdown', 100, 100, 200));
    surface.dispatchEvent(pointer('pointerup', 100, 40, 230));
    expect(got).toEqual(['left', 'start', 'jump']);

    // A slow, small drag is neither.
    surface.dispatchEvent(pointer('pointerdown', 100, 100, 300));
    surface.dispatchEvent(pointer('pointerup', 115, 110, 900));
    expect(got).toEqual(['left', 'start', 'jump']);

    // Another finger's events do not hijack the gesture; a cancelled touch does nothing.
    surface.dispatchEvent(pointer('pointerdown', 100, 100, 1000));
    surface.dispatchEvent(pointer('pointermove', 200, 100, 1010, { pointerId: 2 }));
    surface.dispatchEvent(pointer('pointercancel', 100, 100, 1020));
    surface.dispatchEvent(pointer('pointerup', 100, 100, 1030));
    expect(got).toEqual(['left', 'start', 'jump']);
    expect(touches, 'onTouch fires on the first touch only').toBe(1);

    // A right or middle mouse button does nothing.
    surface.dispatchEvent(pointer('pointerdown', 100, 100, 2000, { pointerType: 'mouse', button: 2 }));
    surface.dispatchEvent(pointer('pointerup', 100, 100, 2050, { pointerType: 'mouse', button: 2 }));
    expect(got).toEqual(['left', 'start', 'jump']);

    input.destroy();
    surface.dispatchEvent(pointer('pointerdown', 100, 100, 3000));
    surface.dispatchEvent(pointer('pointerup', 100, 100, 3010));
    expect(got).toEqual(['left', 'start', 'jump']);
  });
});
