// The Three.js view: the level, the agent (agent.ts), its blob shadow and the goal ring, drawn from the sim and the camera
// (docs/ASCENT.md, "How it looks"). It only READS them; nothing in the game's logic depends on this file. A level made in
// Blender (gltf-level.ts) is drawn from its scenery meshes and its GOAL; phase 1's level in code, from its boxes and a ring
// made here. Both look the same.
//
// The look, "blueprint noir": the blocks are unlit and shaded by tone alone (tops lightest, then the sides, the two pairs of
// sides a step apart, so a block's shape reads without lights), with thin ivory edge lines over them; fog fades both into the
// background. Brass is the agent's visor and the ring only. Every colour comes from the tokens (colors.ts): a Blender mesh's
// own material is swapped for the tones of its name (LEVEL_MATERIALS). The agent is the one lit thing; its light is its own.
// The test climb and phase 1's level are drawn this way.
//
// The lit look (the full climb, the author's art style of 2026-10-27): a file whose ZONE empty says style = lit is drawn in
// its own materials (colour, roughness, metal, glow), lit by a sun and a sky light, without edge lines. Its still scenery is
// merged into one mesh per material. Each zone has a look (climb.json): a sky shaded from the ground up through the horizon
// to overhead, a sun, a sky light and fog in the horizon's colour, blended from zone to zone as the agent climbs. The sky's
// meshes (SKY_: the Earth, the Moon, the stars) are drawn first, in a scene of their own with a camera that sees much
// further and no fog; then the level; then the agent, in a scene of its own so its lights (which follow the camera) light it
// alone.
//
// three.js is imported from its ES sources (`three/src/Three.js`, one of the package's exports), not from `three`: imported by
// the same name as the runner's, the bundler moves three.js into a chunk the two games share, and the 404 page's idle prefetch
// (which fetches the runner's chunk alone) would no longer fetch it. Apart, each game's chunk carries its own copy and the
// runner's chunk is what it was (docs/DECISIONS.md, "R7: Ascent, phase 1").

import {
  BackSide,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  Vector4,
  WebGLRenderer,
  type Material,
} from 'three/src/Three.js';
import { createAgentView, type AgentModel } from './agent';
import type { AgentAnimation } from './agent-anim';
import type { OrbitCamera } from './camera';
import { LEVEL_MATERIALS, type Rgb, type SceneColors } from './colors';
import { ASCENT_CONFIG, type AscentConfig } from './config';
import type { LevelModel, PartModel, SceneryMesh } from './gltf-level';
import type { Vec3 } from './collision';
import type { Level, LevelBox, ZoneLook } from './level';
import type { AscentSim } from './sim';
import { ambienceMix } from './sound-events';

export interface ViewInfo {
  triangles: number;
  calls: number;
  geometries: number;
  /** What is drawn as the agent, and its animation this frame. */
  agent: 'robot' | 'capsule';
  animation: AgentAnimation;
}

export interface View {
  /** The drawing size in CSS pixels and the device pixel ratio to use (already capped by the caller). */
  resize(width: number, height: number, pixelRatio: number): void;
  /** Draw the sim `alpha` of the way from its previous step to its current one, from the camera; `time` in seconds. */
  render(sim: AscentSim, alpha: number, camera: OrbitCamera, time: number): void;
  /** Draw a part of the level that has just loaded (a zone of the climb); its boxes start at `firstBox` in the level. */
  addPart(part: PartModel, firstBox: number): void;
  /** Free every geometry, material and the WebGL context. */
  dispose(): void;
  info(): ViewInfo;
}

export interface ViewOptions {
  colors: SceneColors;
  level: Level;
  /** The level's meshes, when it was made in Blender; without it the level's boxes are drawn. */
  model?: LevelModel | null;
  /** The agent's model (loadAgent); without it the capsule stands in. */
  agent?: AgentModel | null;
  config?: AscentConfig;
  /** Hold the goal ring still, and leave out the agent's bob, squash and sway (asked each frame: the player can change it). */
  reducedMotion?: () => boolean;
}

/** Whether this browser can give a WebGL 2 context (three.js needs one). Asked on a throwaway canvas, then released. */
export function hasWebGL(doc: Document): boolean {
  try {
    const probe = doc.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** A token colour (sRGB, 0-1) as a three.js colour in its linear working space. */
const toColor = (c: Rgb) => new Color().setRGB(c.r, c.g, c.b, SRGBColorSpace);

/**
 * Every box as one mesh with a colour per face, and every box's twelve edges as one set of lines: two draw calls for the
 * whole level.
 */
function levelGeometry(boxes: readonly LevelBox[], colors: SceneColors) {
  const top = toColor(colors.face3);
  const sideX = toColor(colors.face2);
  const sideZ = toColor(colors.face1);
  const groundTop = toColor(colors.face2);
  const bottom = toColor(colors.shadow);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const edges: number[] = [];

  for (const b of boxes) {
    const [x0, y0, z0] = [b.min.x, b.min.y, b.min.z];
    const [x1, y1, z1] = [b.max.x, b.max.y, b.max.z];
    // Each face as four corners, counter-clockwise seen from outside.
    const faces: [number[][], Color][] = [
      [
        [
          [x0, y1, z1],
          [x1, y1, z1],
          [x1, y1, z0],
          [x0, y1, z0],
        ],
        b.kind === 'ground' ? groundTop : top,
      ],
      [
        [
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y0, z1],
          [x0, y0, z1],
        ],
        bottom,
      ],
      [
        [
          [x1, y0, z1],
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
        ],
        sideX,
      ],
      [
        [
          [x0, y0, z0],
          [x0, y0, z1],
          [x0, y1, z1],
          [x0, y1, z0],
        ],
        sideX,
      ],
      [
        [
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ],
        sideZ,
      ],
      [
        [
          [x1, y0, z0],
          [x0, y0, z0],
          [x0, y1, z0],
          [x1, y1, z0],
        ],
        sideZ,
      ],
    ];
    for (const [corners, c] of faces) {
      const base = pos.length / 3;
      for (const p of corners) {
        pos.push(p[0], p[1], p[2]);
        col.push(c.r, c.g, c.b);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const corner = (i: number) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
    for (const [a, c] of [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7], // along x
      [0, 2],
      [1, 3],
      [4, 6],
      [5, 7], // along y
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7], // along z
    ]) {
      edges.push(...corner(a), ...corner(c));
    }
  }

  const faces = new BufferGeometry();
  faces.setAttribute('position', new Float32BufferAttribute(pos, 3));
  faces.setAttribute('color', new Float32BufferAttribute(col, 3));
  faces.setIndex(idx);
  const lines = new BufferGeometry();
  lines.setAttribute('position', new Float32BufferAttribute(edges, 3));
  return { faces, lines };
}

/** Edges between faces that meet at a sharper angle than this are drawn (a round mesh's facets are not; its rims are). */
const EDGE_ANGLE = 30;

/**
 * Every scenery mesh of a Blender level in world space, as one mesh with a colour per face (its material's tones, mixed by
 * the way the face points) and one set of edge lines: two draw calls for the whole level, like the boxes above.
 */
function sceneryGeometry(scenery: readonly SceneryMesh[], colors: SceneColors) {
  const pos: number[] = [];
  const col: number[] = [];
  const edges: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const n = new Vector3();
  for (const { mesh, material } of scenery) {
    const tones = LEVEL_MATERIALS[material === 'lit' ? 'obsidian' : material];
    const [top, sideX, sideZ, bottom] = [tones.top, tones.sideX, tones.sideZ, tones.bottom].map((t) =>
      toColor(colors[t]),
    );
    const tris = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    tris.applyMatrix4(mesh.matrixWorld);
    const p = tris.getAttribute('position');
    for (let i = 0; i + 2 < p.count; i += 3) {
      a.fromBufferAttribute(p, i);
      b.fromBufferAttribute(p, i + 1);
      c.fromBufferAttribute(p, i + 2);
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      const w = [Math.abs(n.x), Math.abs(n.z), Math.max(n.y, 0), Math.max(-n.y, 0)];
      const sum = w[0] + w[1] + w[2] + w[3] || 1;
      const r = (sideX.r * w[0] + sideZ.r * w[1] + top.r * w[2] + bottom.r * w[3]) / sum;
      const g = (sideX.g * w[0] + sideZ.g * w[1] + top.g * w[2] + bottom.g * w[3]) / sum;
      const bl = (sideX.b * w[0] + sideZ.b * w[1] + top.b * w[2] + bottom.b * w[3]) / sum;
      for (const v of [a, b, c]) {
        pos.push(v.x, v.y, v.z);
        col.push(r, g, bl);
      }
    }
    tris.dispose();
    if (tones.edges) {
      const lines = new EdgesGeometry(mesh.geometry, EDGE_ANGLE);
      lines.applyMatrix4(mesh.matrixWorld);
      edges.push(...(lines.getAttribute('position').array as Float32Array));
      lines.dispose();
    }
  }
  const faces = new BufferGeometry();
  faces.setAttribute('position', new Float32BufferAttribute(pos, 3));
  faces.setAttribute('color', new Float32BufferAttribute(col, 3));
  const lines = new BufferGeometry();
  lines.setAttribute('position', new Float32BufferAttribute(edges, 3));
  return { faces, lines };
}

/**
 * Lit scenery (a lit file's): every mesh in world space, merged into one geometry per material, each drawn in that material
 * (the file's own; flat shaded, as the file has no normals). One draw call per material for the whole set.
 */
function litGeometry(scenery: readonly SceneryMesh[]) {
  const byMaterial = new Map<string, { material: Material; parts: BufferGeometry[] }>();
  for (const { mesh } of scenery) {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const key = material.name || material.uuid;
    const entry = byMaterial.get(key) ?? { material, parts: [] };
    byMaterial.set(key, entry);
    const tris = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    tris.applyMatrix4(mesh.matrixWorld);
    entry.parts.push(tris);
  }
  const out: { geometry: BufferGeometry; material: Material }[] = [];
  for (const { material, parts } of byMaterial.values()) {
    const size = parts.reduce((n, g) => n + g.getAttribute('position').array.length, 0);
    const positions = new Float32Array(size);
    let at = 0;
    for (const g of parts) {
      const a = g.getAttribute('position').array as Float32Array;
      positions.set(a, at);
      at += a.length;
      g.dispose();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    (material as Material & { flatShading?: boolean }).flatShading = true;
    out.push({ geometry, material });
  }
  return out;
}

/** The sky's dome: the ground's colour below, the horizon's at eye level, overhead's above; and a soft glow round the sun. */
const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAGMENT = /* glsl */ `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 ground;
uniform vec3 sun;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 c = d.y >= 0.0
    ? mix(horizon, top, pow(smoothstep(0.0, 1.0, d.y), 0.55))
    : mix(horizon, ground, smoothstep(0.0, 0.2, -d.y));
  float s = max(dot(d, sunDir), 0.0);
  c += sun * (pow(s, 900.0) * 1.6 + pow(s, 12.0) * 0.12);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

/** How many tops the blob shadow can lie across at once (the agent at a corner where blocks meet). */
const SHADOW_TOPS = 4;

/**
 * The blob shadow: dark in the middle, fading out to its rim, and drawn only inside the tops it lies on (each as min x, min
 * z, max x, max z), so it never hangs past an edge.
 */
const SHADOW_VERTEX = /* glsl */ `
varying vec3 vWorld;
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const SHADOW_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform float opacity;
uniform float radius;
uniform vec4 tops[${SHADOW_TOPS}];
uniform int count;
varying vec3 vWorld;
varying vec2 vLocal;
void main() {
  bool inside = false;
  for (int i = 0; i < ${SHADOW_TOPS}; i++) {
    if (i >= count) break;
    vec4 t = tops[i];
    if (vWorld.x >= t.x && vWorld.x <= t.z && vWorld.z >= t.y && vWorld.z <= t.w) inside = true;
  }
  if (!inside) discard;
  float r = length(vLocal) / radius;
  float a = opacity * (1.0 - smoothstep(0.25, 1.0, r));
  gl_FragColor = vec4(color, a);
  #include <colorspace_fragment>
}`;

/** A zone's look as three.js colours (linear) and numbers, ready to blend. */
interface Look {
  top: Color;
  horizon: Color;
  ground: Color;
  sun: Color;
  strength: number;
  ambient: number;
  sunDir: Vector3;
  stars: number;
}
const toLook = (l: ZoneLook): Look => ({
  top: new Color(l.top),
  horizon: new Color(l.horizon),
  ground: new Color(l.ground),
  sun: new Color(l.sun),
  strength: l.strength,
  ambient: l.ambient,
  sunDir: new Vector3(...l.sun_dir).normalize(),
  stars: l.stars,
});
/** `out` = the looks mixed by `weights` (one per look, summing to 1). */
function blendLooks(out: Look, looks: readonly Look[], weights: readonly number[]) {
  out.top.setRGB(0, 0, 0);
  out.horizon.setRGB(0, 0, 0);
  out.ground.setRGB(0, 0, 0);
  out.sun.setRGB(0, 0, 0);
  out.sunDir.set(0, 0, 0);
  out.strength = out.ambient = out.stars = 0;
  for (let i = 0; i < looks.length; i++) {
    const w = weights[i] ?? 0;
    if (!w) continue;
    const l = looks[i];
    out.top.r += l.top.r * w;
    out.top.g += l.top.g * w;
    out.top.b += l.top.b * w;
    out.horizon.r += l.horizon.r * w;
    out.horizon.g += l.horizon.g * w;
    out.horizon.b += l.horizon.b * w;
    out.ground.r += l.ground.r * w;
    out.ground.g += l.ground.g * w;
    out.ground.b += l.ground.b * w;
    out.sun.r += l.sun.r * w;
    out.sun.g += l.sun.g * w;
    out.sun.b += l.sun.b * w;
    out.sunDir.addScaledVector(l.sunDir, w);
    out.strength += l.strength * w;
    out.ambient += l.ambient * w;
    out.stars += l.stars * w;
  }
  if (out.sunDir.lengthSq() < 1e-6) out.sunDir.set(0, 1, 0);
  out.sunDir.normalize();
}

/** The view, drawing into `canvas`; null when no WebGL context can be made (the caller shows the fallback). */
export function createView(canvas: HTMLCanvasElement, options: ViewOptions): View | null {
  if (!hasWebGL(canvas.ownerDocument)) return null;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const cfg = options.config ?? ASCENT_CONFIG;
  const { colors, level } = options;
  const r = cfg.render;
  const bg = toColor(colors.background);
  renderer.setClearColor(bg, 1);

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const geo = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const mat = <T extends Material>(m: T) => (materials.push(m), m);

  // A lit climb: its zones' looks, bottom up (a zone without one borrows the zone below's, or the first one's).
  const zones = level.zones ?? [];
  const firstLook = zones.find((z) => z.look)?.look;
  const lit = firstLook !== undefined;
  let carried = firstLook;
  const looks = lit ? zones.map((z) => toLook((carried = z.look ?? carried) as ZoneLook)) : [];
  const look = lit ? toLook(firstLook) : null;
  const fog = lit ? r.lit.fog : r.fog;

  const scene = new Scene();
  scene.fog = new Fog(bg, fog.near, fog.far);
  const camera = new PerspectiveCamera(r.fov, 16 / 9, 0.05, fog.far + 30);
  // The agent draws after the level, in a scene of its own: its lights follow the camera, and must light it alone.
  const agentScene = new Scene();
  agentScene.fog = scene.fog;

  // The sky (lit only): the dome, the sky's meshes, and the same sun and sky light as the level's.
  const sky = new Scene();
  const skyCamera = new PerspectiveCamera(r.fov, 16 / 9, 1, r.lit.skyFar);
  const sun = new DirectionalLight(0xffffff, 0);
  const skySun = new DirectionalLight(0xffffff, 0);
  const skyLight = new HemisphereLight(0xffffff, 0xffffff, 0);
  const skySkyLight = new HemisphereLight(0xffffff, 0xffffff, 0);
  const dome = new Mesh(
    geo(new SphereGeometry(r.lit.skyFar * 0.5, 48, 24)),
    mat(
      new ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        uniforms: {
          top: { value: new Color() },
          horizon: { value: new Color() },
          ground: { value: new Color() },
          sun: { value: new Color() },
          sunDir: { value: new Vector3(0, 1, 0) },
        },
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    ),
  );
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  const starMaterials: Material[] = [];
  if (lit) {
    scene.add(sun, skyLight);
    sky.add(dome, skySun, skySkyLight);
  }
  renderer.autoClear = false;
  renderer.info.autoReset = false;

  // The level: tone-shaded faces pushed back a little so the edge lines on them never flicker.
  const model = options.model ?? null;
  const faceMaterial = mat(
    new MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  );
  const lineMaterial = mat(
    new LineBasicMaterial({ color: toColor(colors.ivory), transparent: true, opacity: r.edgeOpacity }),
  );
  /** Faces and their edge lines as one group: the merged scenery of a part, or one moving box's. */
  const drawn = ({ faces, lines }: { faces: BufferGeometry; lines: BufferGeometry }) => {
    const group = new Group();
    group.add(new Mesh(geo(faces), faceMaterial), new LineSegments(geo(lines), lineMaterial));
    return group;
  };
  /** Scenery as one group: lit (one mesh per material) for a lit file, else in tones with edge lines. */
  const drawScenery = (items: readonly SceneryMesh[], style: PartModel['style']) => {
    if (style === 'tones') return drawn(sceneryGeometry(items, colors));
    const group = new Group();
    for (const { geometry, material } of litGeometry(items)) group.add(new Mesh(geo(geometry), mat(material)));
    return group;
  };
  if (!model) scene.add(drawn(levelGeometry(level.boxes, colors)));

  // Each drifting or crumbling box's scenery, by the box's index in the level, with where the box starts.
  const moving = new Map<number, { group: Group; rest: Vec3 }>();
  // Each fan's streaks: short ivory lines rising through its updraft, so a fan reads as one before it is tried.
  const streakMaterial = mat(
    new LineBasicMaterial({ color: toColor(colors.ivory), transparent: true, opacity: r.fanStreaks.opacity }),
  );
  const streaks: { box: number; height: number; lines: LineSegments; seeds: number[] }[] = [];

  /** A part's scenery, moving boxes, beacons, fans and goal; its boxes start at `firstBox` in the level. */
  const addPart = (part: PartModel, firstBox: number) => {
    scene.add(drawScenery(part.scenery, part.style));
    for (const mesh of part.sky) {
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const m = new Mesh(geo(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)), mat(material));
      m.frustumCulled = false;
      if (mesh.name.startsWith('SKY_stars')) {
        material.transparent = true;
        starMaterials.push(material);
      }
      sky.add(m);
    }
    for (const [i, items] of part.moving) {
      const group = drawScenery(items, part.style);
      scene.add(group);
      moving.set(firstBox + i, { group, rest: { ...part.part.boxes[i].min } });
    }
    for (const b of part.part.beacons) beacons.push(addBeacon(b));
    for (const f of part.part.fans) {
      const n = r.fanStreaks.count;
      const seeds = Array.from(
        { length: n * 3 },
        (_, k) => (Math.sin((firstBox + f.box) * 12.9898 + k * 78.233) + 1) / 2,
      );
      const g = geo(new BufferGeometry());
      g.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 6), 3));
      const lines = new LineSegments(g, streakMaterial);
      lines.frustumCulled = false;
      scene.add(lines);
      streaks.push({ box: firstBox + f.box, height: f.height, lines, seeds });
    }
    if (part.goal) setRing(part.goal, part.part.goal ?? level.goal);
  };

  // The agent: the robot when its model loaded, else the capsule; with its own light (agent.ts).
  const agent = createAgentView({ colors, model: options.agent, config: cfg, reducedMotion: options.reducedMotion });
  agentScene.add(agent.object);
  let lastTime: number | null = null;

  // The blob shadow: a soft dark patch on whatever is under the agent, fading with the height, so a landing spot is always
  // clear; cut to the tops it lies on.
  const shadowTops = Array.from({ length: SHADOW_TOPS }, () => new Vector4());
  const shadowMaterial = mat(
    new ShaderMaterial({
      vertexShader: SHADOW_VERTEX,
      fragmentShader: SHADOW_FRAGMENT,
      uniforms: {
        color: { value: toColor(colors.shadow) },
        opacity: { value: 0 },
        radius: { value: r.shadow.radius },
        tops: { value: shadowTops },
        count: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const shadow = new Mesh(geo(new CircleGeometry(r.shadow.radius, 32)), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // The goal ring: brass, tilted like the ring in the logo, turning slowly about the vertical through its middle. From
  // Blender, its GOAL mesh keeps its tilt and size (and a climb draws it once its top zone has loaded); in code, a ring is
  // made here.
  const ring = new Group();
  const brass = mat(new MeshBasicMaterial({ color: toColor(colors.brass) }));
  scene.add(ring);
  function setRing(goal: Mesh, at: Vec3) {
    // Lit, the ring is drawn in its own material (brass, a little glow); else in the token's brass.
    const own = Array.isArray(goal.material) ? goal.material[0] : goal.material;
    const torus = new Mesh(geo(goal.geometry), lit ? mat(own) : brass);
    goal.updateWorldMatrix(true, false);
    goal.matrixWorld.decompose(new Vector3(), torus.quaternion, torus.scale);
    ring.clear();
    ring.add(torus);
    ring.position.set(at.x, at.y, at.z);
  }
  if (!model) {
    const torus = new Mesh(geo(new TorusGeometry(2.2, 0.07, 8, 72)), brass);
    torus.rotation.x = Math.PI / 2 - 0.42;
    ring.add(torus);
    ring.position.set(level.goal.x, level.goal.y, level.goal.z);
  }

  // The beacons (assist mode's checkpoints): a brass ring on the block and a small brass diamond over it. Brass is for the
  // goal, the visor and these alone (docs/ASCENT.md, "How it looks").
  const beaconRing = geo(new TorusGeometry(0.5, 0.035, 6, 32));
  const beaconMark = geo(new OctahedronGeometry(0.13));
  function addBeacon(b: Vec3) {
    const group = new Group();
    const flat = new Mesh(beaconRing, brass);
    flat.rotation.x = Math.PI / 2;
    flat.position.y = 0.04;
    const mark = new Mesh(beaconMark, brass);
    mark.position.y = 1.9;
    group.add(flat, mark);
    group.position.set(b.x, b.y, b.z);
    group.visible = false;
    scene.add(group);
    return group;
  }
  const beacons: Group[] = model ? [] : level.beacons.map(addBeacon);

  // A level from Blender: each of its parts (one for the test climb, the zones loaded so far for the climb).
  if (model) {
    let first = 0;
    for (const p of model.parts) {
      addPart(p, first);
      first += p.part.boxes.length;
    }
  }

  return {
    resize(w, h, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      skyCamera.aspect = camera.aspect;
      skyCamera.updateProjectionMatrix();
    },
    render(sim, alpha, cam, time) {
      const feet = sim.lerpPos(alpha);
      agent.update(sim, alpha, lastTime === null ? 0 : time - lastTime, cam.position);
      lastTime = time;

      const ground = sim.groundUnder(feet);
      if (ground === null) {
        shadow.visible = false;
      } else {
        const h = feet.y - ground;
        const fade = Math.max(0, 1 - h / r.shadow.fadeHeight);
        const scale = 0.75 + 0.25 * fade;
        const reach = r.shadow.radius * scale;
        // The tops at the ground's height that the patch reaches.
        let count = 0;
        for (const s of sim.solids) {
          if (count === SHADOW_TOPS) break;
          if (Math.abs(s.max.y - ground) > 0.01) continue;
          if (feet.x + reach <= s.min.x || feet.x - reach >= s.max.x) continue;
          if (feet.z + reach <= s.min.z || feet.z - reach >= s.max.z) continue;
          shadowTops[count++].set(s.min.x, s.min.z, s.max.x, s.max.z);
        }
        shadow.visible = fade > 0 && count > 0;
        shadow.position.set(feet.x, ground + 0.01, feet.z);
        shadow.scale.setScalar(scale);
        shadowMaterial.uniforms.count.value = count;
        shadowMaterial.uniforms.opacity.value = (lit ? r.shadow.litOpacity : r.shadow.opacity) * fade;
      }

      if (!options.reducedMotion?.()) ring.rotation.y = ((time % r.ringTurn) / r.ringTurn) * Math.PI * 2;

      // Assist mode's beacons: shown only in assist mode, the checkpoint larger.
      for (let i = 0; i < beacons.length; i++) {
        beacons[i].visible = sim.assist;
        beacons[i].scale.setScalar(i === sim.checkpoint ? 1.35 : 1);
      }

      // Moving boxes: drawn where the sim has them. A crumbling one shakes while it waits to break, drops away when it
      // does, and is back in its place when it comes back.
      const still = options.reducedMotion?.() ?? false;
      for (const [i, { group, rest }] of moving) {
        const b = sim.solids[i];
        if (!b) continue;
        group.position.set(b.min.x - rest.x, b.min.y - rest.y, b.min.z - rest.z);
        group.visible = true;
      }
      const crumbles = sim.level.crumbles ?? [];
      for (let k = 0; k < crumbles.length; k++) {
        const m = moving.get(crumbles[k].box);
        const state = sim.crumbles[k];
        if (!m || !state) continue;
        if (state.broke !== null) {
          const t = sim.time - state.broke;
          m.group.position.y -= 0.5 * 30 * t * t;
          m.group.visible = t < 1.2;
        } else if (state.touched !== null && !still) {
          const a = cfg.crumble.shake;
          m.group.position.x += Math.sin(time * 71) * a;
          m.group.position.z += Math.cos(time * 53) * a;
        }
      }

      // Fan streaks rise through the updraft (they stand still under reduced motion).
      for (const s of streaks) {
        const b = sim.solids[s.box];
        if (!b) continue;
        const p = s.lines.geometry.getAttribute('position') as Float32BufferAttribute;
        const n = p.count / 2;
        const len = r.fanStreaks.length;
        for (let k = 0; k < n; k++) {
          const x = b.min.x + (b.max.x - b.min.x) * (0.15 + 0.7 * s.seeds[k * 3]);
          const z = b.min.z + (b.max.z - b.min.z) * (0.15 + 0.7 * s.seeds[k * 3 + 1]);
          const run = s.height - len;
          const y = b.max.y + ((s.seeds[k * 3 + 2] * run + (still ? 0 : time * r.fanStreaks.speed)) % run);
          p.setXYZ(k * 2, x, y, z);
          p.setXYZ(k * 2 + 1, x, y + len, z);
        }
        p.needsUpdate = true;
      }

      camera.position.set(cam.position.x, cam.position.y, cam.position.z);
      camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
      renderer.info.reset();
      if (look) {
        // The zones' looks, blended by the agent's height: the sky, the sun, the sky light, the fog, the stars.
        blendLooks(look, looks, ambienceMix(feet.y, zones, r.lit.fade));
        const u = (dome.material as ShaderMaterial).uniforms;
        (u.top.value as Color).copy(look.top);
        (u.horizon.value as Color).copy(look.horizon);
        (u.ground.value as Color).copy(look.ground);
        (u.sun.value as Color).copy(look.sun);
        (u.sunDir.value as Vector3).copy(look.sunDir);
        for (const [s, h] of [
          [sun, skyLight],
          [skySun, skySkyLight],
        ] as const) {
          s.color.copy(look.sun);
          s.intensity = look.strength;
          s.position.copy(look.sunDir);
          h.color.copy(look.horizon);
          h.groundColor.copy(look.ground);
          h.intensity = look.ambient * Math.PI;
        }
        (scene.fog as Fog).color.copy(look.horizon);
        for (const m of starMaterials) {
          m.opacity = look.stars;
          m.visible = look.stars > 0.01;
        }
        renderer.setClearColor(look.horizon, 1);
        renderer.clear();
        skyCamera.position.copy(camera.position);
        skyCamera.quaternion.copy(camera.quaternion);
        dome.position.copy(camera.position);
        renderer.render(sky, skyCamera);
        renderer.clearDepth();
      } else {
        renderer.clear();
      }
      renderer.render(scene, camera);
      renderer.render(agentScene, camera);
    },
    addPart,
    info: () => ({
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      geometries: renderer.info.memory.geometries,
      agent: agent.kind,
      animation: agent.pose.animation,
    }),
    dispose() {
      agent.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
