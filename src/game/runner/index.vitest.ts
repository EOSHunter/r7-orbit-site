// mountRunner in Node: a small fake DOM (EventTargets with just what index.ts uses) and a fake view in place of WebGL.
// The point is the lifecycle: what mount adds, destroy() removes (listeners, the animation frame, the observer, the view).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNNER_TEXT, mountRunner, type RunnerDeps } from './index';
import type { View } from './render';
import type { RunnerSim } from './sim';

class FakeNode extends EventTarget {
  className = '';
  textContent: string | null = '';
  hidden = false;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  children: (FakeNode | string)[] = [];
  parent: FakeNode | null = null;
  clientWidth = 800;
  clientHeight = 450;
  focused = 0;
  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument,
  ) {
    super();
  }
  setAttribute(k: string, v: string) {
    this.attributes.set(k, v);
  }
  getAttribute(k: string) {
    return this.attributes.get(k) ?? null;
  }
  append(...nodes: (FakeNode | string)[]) {
    for (const n of nodes) {
      if (typeof n !== 'string') n.parent = this;
      this.children.push(n);
    }
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  contains(node: unknown): boolean {
    return node === this || this.children.some((c) => typeof c !== 'string' && c.contains(node));
  }
  focus() {
    this.focused++;
  }
  /** Every descendant with this class. */
  find(className: string): FakeNode | undefined {
    for (const c of this.children) {
      if (typeof c === 'string') continue;
      if (c.className.split(' ').includes(className)) return c;
      const deeper = c.find(className);
      if (deeper) return deeper;
    }
    return undefined;
  }
  get text(): string {
    return (this.textContent ?? '') + this.children.map((c) => (typeof c === 'string' ? c : c.text)).join('');
  }
}

class FakeDocument extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible';
  defaultView: FakeWindow;
  constructor() {
    super();
    this.defaultView = new FakeWindow();
  }
  createElement(tag: string) {
    return new FakeNode(tag, this);
  }
}

class FakeWindow extends EventTarget {
  devicePixelRatio = 3;
  frames = new Map<number, (t: number) => void>();
  private nextFrame = 1;
  observers: FakeResizeObserver[] = [];
  matchMedia = () => ({ matches: false });
  requestAnimationFrame = (cb: (t: number) => void) => {
    const id = this.nextFrame++;
    this.frames.set(id, cb);
    return id;
  };
  cancelAnimationFrame = (id: number) => {
    this.frames.delete(id);
  };
  ResizeObserver: unknown;
  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const win = this;
    this.ResizeObserver = class extends FakeResizeObserver {
      constructor(cb: () => void) {
        super(cb);
        win.observers.push(this);
      }
    };
  }
  /** Run the pending animation frames at time `t` (they may schedule the next). */
  tick(t: number) {
    const due = [...this.frames];
    this.frames.clear();
    for (const [, cb] of due) cb(t);
  }
}

class FakeResizeObserver {
  observed: unknown[] = [];
  connected = true;
  constructor(readonly cb: () => void) {}
  observe(el: unknown) {
    this.observed.push(el);
  }
  disconnect() {
    this.connected = false;
    this.observed = [];
  }
}

function fakeView() {
  return { resize: vi.fn(), render: vi.fn(), dispose: vi.fn() } satisfies View;
}

/** Every listener added to and not yet removed from any EventTarget during the test. */
const active = new Set<string>();
const ids = new WeakMap<object, number>();
let nextId = 1;
const idOf = (o: object) => ids.get(o) ?? (ids.set(o, nextId++), nextId - 1);
const add = EventTarget.prototype.addEventListener;
const remove = EventTarget.prototype.removeEventListener;

beforeEach(() => {
  active.clear();
  vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (this: EventTarget, type, fn, opts) {
    if (fn && !(this instanceof AbortSignal)) active.add(`${idOf(this)}:${type}:${idOf(fn)}`); // AbortSignal: Vitest's own
    return add.call(this, type, fn, opts);
  });
  vi.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(function (
    this: EventTarget,
    type,
    fn,
    opts,
  ) {
    if (fn) active.delete(`${idOf(this)}:${type}:${idOf(fn)}`);
    return remove.call(this, type, fn, opts);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setup() {
  const doc = new FakeDocument();
  const win = doc.defaultView;
  const container = new FakeNode('div', doc);
  const view = fakeView();
  const deps: RunnerDeps = { createView: () => view };
  return { doc, win, container, view, deps, host: container as unknown as HTMLElement };
}

const keydown = (key: string, repeat = false) =>
  Object.assign(new Event('keydown', { cancelable: true }), { key, repeat });
const keyup = (key: string) => Object.assign(new Event('keyup', { cancelable: true }), { key, repeat: false });

describe('mountRunner', () => {
  it('adds a canvas (role img, labelled), the HUD and a live region; focuses the container', () => {
    const { container, host, deps } = setup();
    mountRunner(host, { seed: 1 }, deps);
    const root = container.find('runner')!;
    const canvas = root.find('runner-canvas')!;
    expect(canvas.tagName).toBe('canvas');
    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('Endless runner game');
    expect(root.find('runner-prompt')!.textContent).toBe(RUNNER_TEXT.play.keys);
    expect(root.find('runner-score')!.text).toBe('00000 m');
    expect(container.focused).toBe(1);
    const liveRegion = root.children.find((c) => typeof c !== 'string' && c.getAttribute('aria-live') === 'polite');
    expect(liveRegion).toBeTruthy();
  });

  it('destroy() removes every listener, the frame, the observer, the view and its elements', () => {
    const { container, host, win, view, deps } = setup();
    const game = mountRunner(host, { seed: 1 }, deps);
    expect(active.size, 'listeners while mounted').toBeGreaterThanOrEqual(8);
    expect(win.frames.size).toBe(1);
    expect(win.observers[0].observed).toEqual([container]);

    game.start();
    win.tick(1000);
    win.tick(1016);
    game.destroy();

    expect([...active]).toEqual([]);
    expect(win.frames.size, 'no animation frame left').toBe(0);
    expect(win.observers[0].connected).toBe(false);
    expect(view.dispose).toHaveBeenCalledTimes(1);
    expect(container.children).toEqual([]);
    game.destroy(); // twice is harmless
    expect(view.dispose).toHaveBeenCalledTimes(1);
  });

  it('mounting and destroying again and again leaves nothing behind', () => {
    const { container, host, win, deps } = setup();
    for (let i = 0; i < 5; i++) {
      const game = mountRunner(host, { seed: i + 1 }, deps);
      game.start();
      win.tick(i * 100);
      game.destroy();
    }
    expect([...active]).toEqual([]);
    expect(win.frames.size).toBe(0);
    expect(container.children).toEqual([]);
  });

  it('runs on animation frames: keys steer, the score and data attributes follow', () => {
    const { container, host, win, deps } = setup();
    mountRunner(host, { seed: 1 }, deps);
    const root = container.find('runner')!;
    container.dispatchEvent(keydown(' '));
    for (let t = 0; t <= 1000; t += 16) win.tick(t);
    expect(root.dataset.runnerState).toBe('playing');
    expect(root.find('runner-message')!.hidden).toBe(true);
    container.dispatchEvent(keydown('ArrowRight'));
    win.tick(1016);
    win.tick(1032);
    expect(root.dataset.runnerLane).toBe('1');
    for (let t = 1048; t <= 2000; t += 16) win.tick(t);
    expect(Number(root.find('runner-score')!.text.slice(0, 5))).toBeGreaterThan(10);
  });

  it('pauses when the tab is hidden or the window blurs, and Space resumes', () => {
    const { container, host, doc, win, deps } = setup();
    const game = mountRunner(host, { seed: 1 }, deps);
    const root = container.find('runner')!;
    game.start();
    win.tick(0);
    win.tick(16);

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(root.dataset.runnerPaused).toBe('true');
    expect(win.frames.size, 'no frames while paused').toBe(0);
    expect(root.find('runner-prompt')!.textContent).toBe(RUNNER_TEXT.paused.keys);

    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(root.dataset.runnerPaused, 'stays paused until the player is back').toBe('true');
    container.dispatchEvent(keydown(' '));
    expect(root.dataset.runnerPaused).toBe('false');
    expect(win.frames.size).toBe(1);
    win.tick(5000);
    expect(root.dataset.runnerState, 'the Space that resumed did not jump or restart').toBe('playing');

    win.dispatchEvent(new Event('blur'));
    expect(root.dataset.runnerPaused).toBe('true');
    game.resume();
    expect(root.dataset.runnerPaused).toBe('false');
  });

  it('caps the pixel ratio at 2 (the fake screen is 3x)', () => {
    const { host, view, deps } = setup();
    mountRunner(host, { seed: 1 }, deps);
    expect(view.resize).toHaveBeenCalledWith(800, 450, 2);
  });

  it('without WebGL: the neutral message, no listeners, nothing left after destroy', () => {
    const { container, host } = setup();
    const game = mountRunner(host, {}, { createView: () => null });
    const root = container.find('runner')!;
    expect(root.find('runner-fallback')!.textContent).toBe('This game needs WebGL.');
    expect(root.find('runner-canvas')).toBeUndefined();
    expect([...active]).toEqual([]);
    game.start();
    game.destroy();
    expect(container.children).toEqual([]);
  });

  describe('hold to crouch', () => {
    /** A run in progress with S held, and a way to read the sim the view is drawing. */
    function holding(key = 's') {
      const { container, host, doc, win, view, deps } = setup();
      const game = mountRunner(host, { seed: 1 }, deps);
      const sim = () => view.render.mock.calls.at(-1)![0] as RunnerSim;
      game.start();
      let t = 0;
      const run = (ms: number) => {
        for (const end = t + ms; t < end; t += 16) win.tick(t);
      };
      run(200);
      container.dispatchEvent(keydown(key));
      run(300);
      return { container, doc, win, game, sim, run };
    }

    it('crouched while the key is held (key repeat changes nothing), standing after the keyup', () => {
      const { container, sim, run } = holding('ArrowDown');
      expect(sim().crouching).toBe(true);
      for (let i = 0; i < 10; i++) {
        container.dispatchEvent(keydown('ArrowDown', true));
        run(100);
      }
      expect(sim().crouching).toBe(true);
      expect(sim().crouch).toBe(1);
      container.dispatchEvent(keyup('ArrowDown'));
      run(300);
      expect(sim().crouching).toBe(false);
      expect(sim().crouch).toBe(0);
    });

    it('a blur, a hidden tab and a pause clear it, and a keyup lost meanwhile cannot leave the rover low', () => {
      for (const clear of [
        ({ win }: ReturnType<typeof holding>) => win.dispatchEvent(new Event('blur')),
        ({ doc }: ReturnType<typeof holding>) => {
          doc.visibilityState = 'hidden';
          doc.dispatchEvent(new Event('visibilitychange'));
        },
        ({ game }: ReturnType<typeof holding>) => game.pause(),
        ({ container }: ReturnType<typeof holding>) => container.dispatchEvent(new Event('blur')),
      ]) {
        const h = holding();
        expect(h.sim().crouching).toBe(true);
        clear(h);
        h.game.resume();
        h.run(400); // the keyup happened while away and was never heard
        expect(h.sim().crouching).toBe(false);
        expect(h.sim().crouch).toBe(0);
        h.container.dispatchEvent(keyup('s')); // when it does arrive, nothing breaks
        h.container.dispatchEvent(keydown('s'));
        h.run(300);
        expect(h.sim().crouching, 'the next press works').toBe(true);
        h.game.destroy();
      }
    });

    it('a crash and a restart clear it', () => {
      const h = holding();
      h.run(120_000);
      expect(h.sim().phase).toBe('over');
      expect(h.sim().crouchHeld).toBe(false);
      h.run(500);
      h.container.dispatchEvent(keydown(' '));
      h.run(200);
      expect(h.sim().phase).toBe('playing');
      expect(h.sim().crouching).toBe(false);
    });
  });
});
