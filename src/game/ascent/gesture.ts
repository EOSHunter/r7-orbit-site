// Full screen and the pointer lock: the browser grants both only during a fresh click or key press, so they are asked for
// synchronously inside that event's handler, before anything awaits (the Play button's click comes before the game has even
// loaded). Small and free of three.js: the page imports it for the Play button, and the game for a click or Space that
// resumes. Refusals (a browser or frame that does not allow it, a lock asked for again too soon after Escape) are expected
// and swallowed; the game then says to click to look around.

export interface PlayGesture {
  /** Put `target` in full screen. */
  fullscreen: boolean;
  /** Lock the pointer to `target`, so the mouse turns the camera without leaving the game. */
  lock: boolean;
}

/** Calls a browser API that may return a promise, may throw, or may not exist, and never lets its refusal escape. */
function attempt(call: (() => unknown) | undefined): void {
  if (!call) return;
  try {
    const result = call();
    if (result instanceof Promise) result.catch(() => {});
  } catch {
    // Older browsers throw where newer ones reject.
  }
}

/**
 * Asks for the pointer lock, then full screen, on `target`, skipping what it already has. The lock goes first: entering full
 * screen uses up the click in some browsers, and the lock would then be refused.
 */
/**
 * Whether this device has a keyboard and a mouse (or a trackpad): some pointer that is fine and can hover. The game is played
 * with them (desktop only, 2026-10-28): a phone or a tablet alone is offered a line saying so instead of Play. A laptop with a
 * touch screen still plays.
 */
export function hasKeyboardAndMouse(win: Pick<Window, 'matchMedia'>): boolean {
  try {
    return win.matchMedia('(any-pointer: fine)').matches && win.matchMedia('(any-hover: hover)').matches;
  } catch {
    return true;
  }
}

export function enterPlay(target: HTMLElement, want: PlayGesture): void {
  const doc = target.ownerDocument;
  if (want.lock && doc.pointerLockElement !== target) {
    attempt(target.requestPointerLock && (() => target.requestPointerLock()));
  }
  if (want.fullscreen && doc.fullscreenElement !== target) {
    attempt(target.requestFullscreen && (() => target.requestFullscreen({ navigationUI: 'hide' })));
  }
}

/** Lets go of the pointer lock and full screen, where `target` holds them. */
export function leavePlay(target: HTMLElement): void {
  const doc = target.ownerDocument;
  if (doc.pointerLockElement === target) attempt(doc.exitPointerLock && (() => doc.exitPointerLock()));
  if (doc.fullscreenElement === target) attempt(doc.exitFullscreen && (() => doc.exitFullscreen()));
}
