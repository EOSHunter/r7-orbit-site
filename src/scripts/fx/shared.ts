// What a hero background (galaxy.ts) needs around its shader: the token colours, linking a WebGL2 program, and the frame loop
// with its rules (no frames while the hero is off screen or the tab is hidden, the canvas sized to its box). Ported from React
// Bits (https://reactbits.dev); the licence is LICENSE-react-bits.md beside this file. A second background would share it.

export type Rgb = [number, number, number];

/** A colour token (`--brass`) as 0-1 RGB. The tokens are hex; anything else falls back to ivory-ish white. */
export function tokenRgb(name: string): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
  if (!hex) return [0.93, 0.9, 0.85];
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as Rgb;
}

export const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export interface Program {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export function link(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): Program | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms: Program['uniforms'] = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name.replace('[0]', '')] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** The pointer over the host, in the host's own pixels (y up, as WebGL draws) and as -1..1 from its middle. */
export interface Pointer {
  x: number;
  y: number;
  nx: number;
  ny: number;
  inside: boolean;
}

export interface Scene {
  /** The canvas was resized: `width` and `height` in CSS pixels, `ratio` device pixels per CSS pixel. */
  resize(width: number, height: number, ratio: number): void;
  /** Draw one frame `dt` seconds after the last. Return false when nothing moves any more (the loop then sleeps). */
  frame(dt: number): boolean;
  /** Free the GPU objects. */
  dispose(): void;
}

/**
 * Runs a scene in `canvas`, sized to `host`: frames only while the host is on screen and the tab is visible, at most 2 device
 * pixels per CSS pixel. `pointer` follows the mouse over the host. Returns a function that stops it and frees everything.
 */
export function run(host: HTMLElement, canvas: HTMLCanvasElement, scene: Scene, pointer: Pointer): () => void {
  let raf = 0;
  let last = 0;
  let visible = true;

  const frame = (now: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
    last = now;
    if (scene.frame(dt)) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const wake = () => {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  };
  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    scene.resize(width, height, canvas.width / width);
    last = 0;
    wake();
  };
  const onPointerMove = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    pointer.inside = event.pointerType === 'mouse' && x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    pointer.x = x;
    pointer.y = rect.height - y;
    pointer.nx = (x / Math.max(1, rect.width)) * 2 - 1;
    pointer.ny = -((y / Math.max(1, rect.height)) * 2 - 1);
    wake();
  };
  const onLeave = () => {
    pointer.inside = false;
  };
  const onVisibility = () => {
    last = 0;
    wake();
  };

  const sizes = new ResizeObserver(resize);
  sizes.observe(host);
  const seen = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) {
      last = 0;
      wake();
    }
  });
  seen.observe(host);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVisibility);
  resize();

  return () => {
    cancelAnimationFrame(raf);
    sizes.disconnect();
    seen.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    scene.dispose();
  };
}
