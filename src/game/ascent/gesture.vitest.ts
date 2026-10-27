import { describe, expect, it, vi } from 'vitest';
import { enterPlay, leavePlay } from './gesture';

/** An element and its document with just the four calls gesture.ts makes, recording their order. */
function fake(opts: { refuse?: boolean; throws?: boolean } = {}) {
  const calls: string[] = [];
  const doc = {
    pointerLockElement: null as unknown,
    fullscreenElement: null as unknown,
    exitPointerLock: vi.fn(() => {
      calls.push('exitPointerLock');
      doc.pointerLockElement = null;
    }),
    exitFullscreen: vi.fn(() => {
      calls.push('exitFullscreen');
      doc.fullscreenElement = null;
      return Promise.resolve();
    }),
  };
  const answer = () => {
    if (opts.throws) throw new Error('not allowed');
    return opts.refuse ? Promise.reject(new Error('refused')) : Promise.resolve();
  };
  const target = {
    ownerDocument: doc,
    requestPointerLock: vi.fn(() => {
      calls.push('lock');
      if (!opts.refuse && !opts.throws) doc.pointerLockElement = target;
      return answer();
    }),
    requestFullscreen: vi.fn(() => {
      calls.push('fullscreen');
      if (!opts.refuse && !opts.throws) doc.fullscreenElement = target;
      return answer();
    }),
  };
  return { target: target as unknown as HTMLElement, doc, calls };
}

describe('enterPlay', () => {
  it('asks for the lock first, then full screen (entering full screen can use up the click)', () => {
    const { target, calls } = fake();
    enterPlay(target, { lock: true, fullscreen: true });
    expect(calls).toEqual(['lock', 'fullscreen']);
  });

  it('asks only for what is wanted and not held already', () => {
    const { target, calls } = fake();
    enterPlay(target, { lock: false, fullscreen: true });
    enterPlay(target, { lock: true, fullscreen: true });
    expect(calls).toEqual(['fullscreen', 'lock']);
    enterPlay(target, { lock: true, fullscreen: true });
    expect(calls).toHaveLength(2);
  });

  it('swallows a refusal, whether it rejects or throws', async () => {
    const rejects = fake({ refuse: true });
    expect(() => enterPlay(rejects.target, { lock: true, fullscreen: true })).not.toThrow();
    const throws = fake({ throws: true });
    expect(() => enterPlay(throws.target, { lock: true, fullscreen: true })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // an unhandled rejection would fail the run here
  });

  it('does nothing where the browser has neither API', () => {
    const { target } = fake();
    const bare = { ownerDocument: (target as unknown as { ownerDocument: unknown }).ownerDocument } as HTMLElement;
    expect(() => enterPlay(bare, { lock: true, fullscreen: true })).not.toThrow();
  });
});

describe('leavePlay', () => {
  it('lets go of what this element holds, and nothing else', () => {
    const { target, doc, calls } = fake();
    leavePlay(target);
    expect(calls).toEqual([]);
    enterPlay(target, { lock: true, fullscreen: true });
    leavePlay(target);
    expect(calls).toEqual(['lock', 'fullscreen', 'exitPointerLock', 'exitFullscreen']);
    expect(doc.pointerLockElement).toBeNull();
    expect(doc.fullscreenElement).toBeNull();
  });
});
