import { describe, expect, it, vi } from 'vitest';
import { createInput, keyAction, moveVector, preventsDefault, turnInput, type Action } from './input';

const held = (...a: Action[]) => new Set<Action>(a);

describe('keys', () => {
  it('maps WASD by place and the arrows to the same moves', () => {
    expect(keyAction('KeyW')).toBe('forward');
    expect(keyAction('ArrowUp')).toBe('forward');
    expect(keyAction('KeyA')).toBe('left');
    expect(keyAction('ArrowRight')).toBe('right');
    expect(keyAction('KeyS')).toBe('back');
    expect(keyAction('Space')).toBe('jump');
    expect(keyAction('KeyQ')).toBe('turnLeft');
    expect(keyAction('KeyE')).toBe('turnRight');
    expect(keyAction('Escape')).toBe('pause');
    expect(keyAction('KeyZ')).toBeNull();
  });

  it('stops Space and the arrows from scrolling, nothing else', () => {
    expect(preventsDefault('Space')).toBe(true);
    expect(preventsDefault('ArrowDown')).toBe(true);
    expect(preventsDefault('KeyW')).toBe(false);
  });
});

describe('moveVector', () => {
  it('forward is away from the camera, right is the screen right (camera at yaw 0 looks to -Z)', () => {
    const f = moveVector(held('forward'), 0);
    expect(f.x).toBeCloseTo(0, 9);
    expect(f.z).toBeCloseTo(-1, 9);
    const r = moveVector(held('right'), 0);
    expect(r.x).toBeCloseTo(1, 9);
    expect(r.z).toBeCloseTo(0, 9);
  });

  it('turns with the camera', () => {
    // Camera at yaw π/2 sits on +X looking to -X: forward is -X, right is -Z.
    const f = moveVector(held('forward'), Math.PI / 2);
    expect(f.x).toBeCloseTo(-1, 9);
    expect(f.z).toBeCloseTo(0, 9);
    const r = moveVector(held('right'), Math.PI / 2);
    expect(r.x).toBeCloseTo(0, 9);
    expect(r.z).toBeCloseTo(-1, 9);
  });

  it('a diagonal is as fast as a straight line; opposite keys cancel', () => {
    const d = moveVector(held('forward', 'left'), 0.7);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 9);
    expect(moveVector(held('forward', 'back'), 0)).toEqual({ x: 0, z: 0 });
  });

  it('Q turns left, E right, both cancel', () => {
    expect(turnInput(held('turnLeft'))).toBe(1);
    expect(turnInput(held('turnRight'))).toBe(-1);
    expect(turnInput(held('turnLeft', 'turnRight'))).toBe(0);
  });
});

describe('createInput', () => {
  const key = (type: string, code: string, extra: Partial<KeyboardEvent> = {}) =>
    Object.assign(new Event(type, { cancelable: true }), { code, repeat: false, ...extra });

  function setup(isLocked = false) {
    const keys = new EventTarget();
    const pointer = new EventTarget();
    const calls = { onJump: vi.fn(), onLook: vi.fn(), onPause: vi.fn() };
    const input = createInput(keys, pointer, () => isLocked, calls);
    return { keys, pointer, calls, input };
  }

  it('holds movement keys, says Space down and up once, and ignores repeats', () => {
    const { keys, calls, input } = setup();
    const down = key('keydown', 'Space');
    keys.dispatchEvent(down);
    keys.dispatchEvent(key('keydown', 'Space', { repeat: true }));
    keys.dispatchEvent(key('keydown', 'KeyW'));
    expect(down.defaultPrevented).toBe(true);
    expect(calls.onJump).toHaveBeenCalledTimes(1);
    expect(input.held.has('forward')).toBe(true);
    keys.dispatchEvent(key('keyup', 'Space'));
    keys.dispatchEvent(key('keyup', 'KeyW'));
    expect(calls.onJump).toHaveBeenLastCalledWith(false);
    expect(input.held.size).toBe(0);
  });

  it('Escape pauses; a key with Ctrl is left to the browser', () => {
    const { keys, calls, input } = setup();
    keys.dispatchEvent(key('keydown', 'Escape'));
    expect(calls.onPause).toHaveBeenCalledTimes(1);
    keys.dispatchEvent(key('keydown', 'KeyW', { ctrlKey: true }));
    expect(input.held.size).toBe(0);
  });

  it('release() lets go of every key (and of Space), destroy() stops listening', () => {
    const { keys, calls, input } = setup();
    keys.dispatchEvent(key('keydown', 'Space'));
    keys.dispatchEvent(key('keydown', 'KeyD'));
    input.release();
    expect(input.held.size).toBe(0);
    expect(calls.onJump).toHaveBeenLastCalledWith(false);
    input.destroy();
    keys.dispatchEvent(key('keydown', 'KeyD'));
    expect(input.held.size).toBe(0);
  });

  it('a drag with a button held looks around when the pointer is not locked', () => {
    const { pointer, calls } = setup(false);
    const ptr = (type: string, x: number, y: number) =>
      Object.assign(new Event(type), { pointerId: 1, clientX: x, clientY: y });
    pointer.dispatchEvent(ptr('pointerdown', 10, 10));
    pointer.dispatchEvent(ptr('pointermove', 25, 4));
    pointer.dispatchEvent(ptr('pointerup', 25, 4));
    pointer.dispatchEvent(ptr('pointermove', 90, 90));
    expect(calls.onLook).toHaveBeenCalledTimes(1);
    expect(calls.onLook).toHaveBeenCalledWith(15, -6);
  });
});
