// Galaxy: a starfield the hero flies slowly through, stars in ivory and brass, arriving with a short warp. Ported from React
// Bits' Galaxy (https://reactbits.dev/backgrounds/galaxy; licence: LICENSE-react-bits.md) without React, with the site's
// colours from the tokens and only what the hero uses: the palette and the arrival warp. It does not follow the mouse (no
// parallax, click warp or repulsion): it stays where it is and keeps moving on its own. Under reduced motion it draws one still
// frame.
import { link, reducedMotion, run, tokenRgb, type Pointer, type Scene } from './shared';

const INTRO_SECONDS = 2.2;
const LAYERS = 4;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uFocal;
uniform float uGloss;
uniform float uDepth;
uniform float uDensity;
uniform float uSpeed;
uniform float uStarGlow;
uniform float uFlareGain;
uniform float uSquash;
uniform float uTwinkle;
uniform float uAngle;
uniform vec3 uColors[4];
uniform float uWarp;
uniform float uReveal;
uniform float uOpacity;
out vec4 outColor;

#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float tri(float x) { return abs(fract(x) * 2.0 - 1.0); }
float tris(float x) { return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * fract(x) - 1.0)); }
float trisn(float x) { return 2.0 * tris(x) - 1.0; }

float Star(vec2 uv, float flare, vec2 radial) {
  float along = dot(uv, radial);
  float d = sqrt(max(dot(uv, uv) - uSquash * along * along, 0.0));
  float m = uStarGlow / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uFlareGain;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uFlareGain;
  m *= smoothstep(1.0, 0.2, d);
  m *= mix(1.0, smoothstep(1.0, 0.55, length(uv)), min(uWarp * 4.0, 1.0));
  return m;
}

vec3 StarLayer(vec2 uv, vec2 radial) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + offset;
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float flareSize = smoothstep(0.9, 1.0, size) * tri(uGloss / (PERIOD * seed + 1.0));
      vec3 base = uColors[int(min(floor(Hash21(si + 7.0) * 4.0), 3.0))];
      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;
      float star = Star(gv - offset - pad, flareSize, radial);
      float twinkle = mix(1.0, trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0, uTwinkle);
      col += star * twinkle * size * base;
    }
  }
  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution;
  vec2 uv = (gl_FragCoord.xy - focalPx) / uResolution.y;
  vec2 radial = length(uv) > 0.0001 ? normalize(uv) : vec2(1.0, 0.0);
  mat2 turn = mat2(cos(uAngle), -sin(uAngle), sin(uAngle), cos(uAngle));
  uv = turn * uv;
  radial = turn * radial;
  vec3 col = vec3(0.0);
  for (int k = 0; k < ${LAYERS}; k++) {
    float i = float(k) / ${LAYERS.toFixed(1)};
    float depth = fract(i + uDepth);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += StarLayer(uv * scale + vec2(i * 453.32), radial) * fade;
  }
  col *= uReveal;
  float alpha = min(smoothstep(0.0, 0.3, length(col)), 1.0) * uOpacity;
  outColor = vec4(col * alpha, alpha);
}`;

export interface GalaxyOptions {
  /** Where the stars stream from, 0-1 across and up the hero (behind the orbit mark on a wide screen). */
  focal: [number, number];
}

export function mountGalaxy(host: HTMLElement, { focal }: GalaxyOptions): (() => void) | null {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  const linked = gl && link(gl, VERTEX, FRAGMENT);
  if (!gl || !linked) return null;
  host.append(canvas);

  const { program, uniforms: u } = linked;
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Ivory and three brasses: the site's one accent, from dim to the brightest point of light.
  const colors = new Float32Array([...tokenRgb('--text'), ...tokenRgb('--brass'), ...tokenRgb('--brass-highlight'), ...tokenRgb('--brass-leaf')]);
  const still = reducedMotion();
  const pointer: Pointer = { x: 0, y: 0, nx: 0, ny: 0, inside: false }; // run() tracks it; the galaxy does not use it
  const state = { time: 0, gloss: 0, depth: 0, angle: 0, boost: 0, reveal: still ? 1 : 0 };

  const draw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    const stretch = 1 + state.boost * 5;
    const fade = Math.min(1, state.reveal / 0.35);
    gl.uniform1f(u.uTime, state.time);
    gl.uniform2f(u.uResolution, canvas.width, canvas.height);
    gl.uniform2f(u.uFocal, focal[0], focal[1]);
    gl.uniform1f(u.uGloss, state.gloss);
    gl.uniform1f(u.uDepth, state.depth);
    gl.uniform1f(u.uDensity, 1.1);
    gl.uniform1f(u.uSpeed, 0.6);
    gl.uniform1f(u.uStarGlow, (0.05 * 0.3) / Math.pow(stretch, 0.6));
    gl.uniform1f(u.uFlareGain, 0.3);
    gl.uniform1f(u.uSquash, 1 - 1 / (stretch * stretch));
    gl.uniform1f(u.uTwinkle, 0.4);
    gl.uniform1f(u.uAngle, state.angle);
    gl.uniform3fv(u.uColors, colors);
    gl.uniform1f(u.uWarp, state.boost);
    gl.uniform1f(u.uReveal, fade * fade * (3 - 2 * fade));
    gl.uniform1f(u.uOpacity, 0.85);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const scene: Scene = {
    resize() {
      draw();
    },
    frame(dt) {
      if (still) {
        draw();
        return false;
      }
      if (state.reveal < 1) {
        state.reveal = Math.min(1, state.reveal + dt / INTRO_SECONDS);
        state.boost = Math.max(state.boost, Math.pow(1 - state.reveal, 2) * 1.4);
      }
      const flight = 0.3 / 10;
      state.time += dt;
      state.gloss += dt * flight;
      state.depth += dt * flight * 0.6 * (1 + state.boost * 14);
      state.angle += dt * 0.02;
      state.boost *= Math.exp(-dt * 1.3);
      if (state.boost < 0.001) state.boost = 0;
      draw();
      return true;
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
  return run(host, canvas, scene, pointer);
}
