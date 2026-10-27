// Keys and the mouse to what the player asked for. No rendering and no game state.
//
// Keys are read by their place on the keyboard (KeyboardEvent.code), so WASD is the same four keys on any layout. They are
// read on the game's container (it has keyboard focus while playing), so the game never takes keys from the rest of the page;
// Space and the arrows would scroll the page, so their default is prevented then. Key repeat is ignored: holding Space is one
// jump. The mouse looks around while the pointer is locked (after a click on the game), or while a button is held and dragged.
// release() forgets every held key (the host calls it on pause, blur and when the tab hides: a keyup that happens while the
// page is not listening is never heard, and a key must never stay held). Keys pressed on the game's own buttons and fields
// (the pause menu) are theirs: Space on Restart presses Restart, it does not jump. Touch pointers are left to touch.ts.

export type Action = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'turnLeft' | 'turnRight' | 'pause';

/** The action for a key (KeyboardEvent.code), or null for a key the game does not use. */
export function keyAction(code: string): Action | null {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      return 'forward';
    case 'KeyS':
    case 'ArrowDown':
      return 'back';
    case 'KeyA':
    case 'ArrowLeft':
      return 'left';
    case 'KeyD':
    case 'ArrowRight':
      return 'right';
    case 'Space':
      return 'jump';
    case 'KeyQ':
      return 'turnLeft';
    case 'KeyE':
      return 'turnRight';
    case 'Escape':
      return 'pause';
    default:
      return null;
  }
}

/** Keys whose default action (scrolling the page) the game prevents while it has focus. */
export function preventsDefault(code: string): boolean {
  return code === 'Space' || code.startsWith('Arrow');
}

/**
 * Where the held keys (and a touch stick: x right, y forward) steer, in world space (x, z), at most 1 long, for a camera
 * turned `yaw` radians about +Y (0 looks towards -Z). Forward is away from the camera; right is the screen's right. The keys
 * are full speed; a stick pushed part way is slower.
 */
export function moveVector(
  held: ReadonlySet<Action>,
  yaw: number,
  stick: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; z: number } {
  const ahead = (held.has('forward') ? 1 : 0) - (held.has('back') ? 1 : 0) + stick.y;
  const side = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0) + stick.x;
  if (!ahead && !side) return { x: 0, z: 0 };
  const len = Math.max(1, Math.hypot(ahead, side));
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  return { x: (side * cos - ahead * sin) / len, z: (-side * sin - ahead * cos) / len };
}

/** Q and E: +1 turns the camera left, -1 right, 0 neither (or both). */
export function turnInput(held: ReadonlySet<Action>): number {
  return (held.has('turnLeft') ? 1 : 0) - (held.has('turnRight') ? 1 : 0);
}

export interface InputHandlers {
  /** Space went down (true) or up (false). */
  onJump: (down: boolean) => void;
  /** The mouse moved this many CSS pixels while looking. */
  onLook: (dx: number, dy: number) => void;
  /** Escape (the browser also leaves pointer lock on Escape; the host hears that separately). */
  onPause: () => void;
  /** Any pointer press on the game (the host moves focus to it and asks for pointer lock). */
  onPointerDown?: (event: PointerEvent) => void;
}

export interface InputHandle {
  /** The movement and turning keys held now. */
  readonly held: ReadonlySet<Action>;
  /** Forget every held key and drag, and let go of Space. */
  release(): void;
  destroy(): void;
}

/**
 * Listens for keys on `keyTarget` and for the mouse on `pointerTarget` (the canvas), and says what they mean. `locked()`
 * tells it whether the pointer is locked to the game now. destroy() removes every listener it added.
 */
export function createInput(
  keyTarget: EventTarget,
  pointerTarget: EventTarget,
  locked: () => boolean,
  handlers: InputHandlers,
): InputHandle {
  const held = new Set<Action>();
  let drag: { id: number; x: number; y: number } | null = null;
  const doc = (pointerTarget as Node).ownerDocument ?? null;

  // A key typed on one of the game's buttons or fields belongs to it (Escape still pauses).
  const onControl = (e: Event) => {
    const t = e.target as Element | null;
    return !!t && t !== keyTarget && !!t.closest?.('button, input, select, textarea, a');
  };

  const onKeyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (onControl(e) && e.code !== 'Escape') return;
    const action = keyAction(e.code);
    if (!action) return;
    if (preventsDefault(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (action === 'pause') return handlers.onPause();
    if (action === 'jump') {
      if (!held.has('jump')) handlers.onJump(true);
    }
    held.add(action);
  };

  const onKeyUp = (event: Event) => {
    const e = event as KeyboardEvent;
    const action = keyAction(e.code);
    if (!action || !held.has(action)) return;
    held.delete(action);
    if (action === 'jump') handlers.onJump(false);
  };

  const onPointerDown = (event: Event) => {
    const e = event as PointerEvent;
    handlers.onPointerDown?.(e);
    if (e.pointerType === 'touch') return; // touch.ts: a stick on the left, a look drag on the right
    if (!locked()) drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (event: Event) => {
    const e = event as PointerEvent;
    if (!drag || e.pointerId !== drag.id || locked()) return;
    handlers.onLook(e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX;
    drag.y = e.clientY;
  };

  const onPointerEnd = (event: Event) => {
    if (drag && (event as PointerEvent).pointerId === drag.id) drag = null;
  };

  // While locked, the pointer does not move: only the movement counts. Heard on the document, because a locked pointer's
  // events go to the locked element and its ancestors, and the host may lock something other than the canvas.
  const onMouseMove = (event: Event) => {
    if (!locked()) return;
    const e = event as MouseEvent;
    handlers.onLook(e.movementX, e.movementY);
  };

  const listeners: [EventTarget, string, EventListener][] = [
    [keyTarget, 'keydown', onKeyDown],
    [keyTarget, 'keyup', onKeyUp],
    [pointerTarget, 'pointerdown', onPointerDown],
    [pointerTarget, 'pointermove', onPointerMove],
    [pointerTarget, 'pointerup', onPointerEnd],
    [pointerTarget, 'pointercancel', onPointerEnd],
  ];
  if (doc) listeners.push([doc, 'mousemove', onMouseMove]);
  for (const [target, type, fn] of listeners) target.addEventListener(type, fn);

  return {
    held,
    release() {
      const jumping = held.has('jump');
      held.clear();
      drag = null;
      if (jumping) handlers.onJump(false);
    },
    destroy() {
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      held.clear();
      drag = null;
    },
  };
}
