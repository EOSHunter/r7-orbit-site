// The Three.js view: the level, the capsule agent, its blob shadow and the goal ring, drawn from the sim and the camera
// (docs/ASCENT.md, "How it looks"). It only READS them; nothing in the game's logic depends on this file. A level made in
// Blender (gltf-level.ts) is drawn from its scenery meshes and its GOAL; phase 1's level in code, from its boxes and a ring
// made here. Both look the same.
//
// The look, "blueprint noir": the blocks are unlit and shaded by tone alone (tops lightest, then the sides, the two pairs of
// sides a step apart, so a block's shape reads without lights), with thin ivory edge lines over them; fog fades both into the
// background. Brass is the visor and the ring only. Every colour comes from the tokens (colors.ts): a Blender mesh's own
// material is swapped for the tones of its name (LEVEL_MATERIALS).
//
// three.js is imported from its ES sources (`three/src/Three.js`, one of the package's exports), not from `three`: imported by
// the same name as the runner's, the bundler moves three.js into a chunk the two games share, and the 404 page's idle prefetch
// (which fetches the runner's chunk alone) would no longer fetch it. Apart, each game's chunk carries its own copy and the
// runner's chunk is what it was (docs/DECISIONS.md, "R7: Ascent, phase 1").

import {
  AmbientLight,
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  Fog,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three/src/Three.js';
import type { OrbitCamera } from './camera';
import { LEVEL_MATERIALS, type Rgb, type SceneColors } from './colors';
import { ASCENT_CONFIG, type AscentConfig } from './config';
import type { LevelModel, SceneryMesh } from './gltf-level';
import type { Level, LevelBox } from './level';
import type { AscentSim } from './sim';

export interface ViewInfo {
  triangles: number;
  calls: number;
  geometries: number;
}

export interface View {
  /** The drawing size in CSS pixels and the device pixel ratio to use (already capped by the caller). */
  resize(width: number, height: number, pixelRatio: number): void;
  /** Draw the sim `alpha` of the way from its previous step to its current one, from the camera; `time` in seconds. */
  render(sim: AscentSim, alpha: number, camera: OrbitCamera, time: number): void;
  /** Free every geometry, material and the WebGL context. */
  dispose(): void;
  info(): ViewInfo;
}

export interface ViewOptions {
  colors: SceneColors;
  level: Level;
  /** The level's meshes, when it was made in Blender; without it the level's boxes are drawn. */
  model?: LevelModel | null;
  config?: AscentConfig;
  /** Hold the goal ring still. */
  reducedMotion?: boolean;
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
    const tones = LEVEL_MATERIALS[material];
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

  const scene = new Scene();
  scene.fog = new Fog(bg, r.fog.near, r.fog.far);
  const camera = new PerspectiveCamera(r.fov, 16 / 9, 0.05, r.fog.far + 30);

  // The level: tone-shaded faces pushed back a little so the edge lines on them never flicker.
  const model = options.model ?? null;
  const { faces, lines } = model ? sceneryGeometry(model.scenery, colors) : levelGeometry(level.boxes, colors);
  const blocks = new Mesh(
    geo(faces),
    mat(
      new MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    ),
  );
  const edges = new LineSegments(
    geo(lines),
    mat(new LineBasicMaterial({ color: toColor(colors.ivory), transparent: true, opacity: r.edgeOpacity })),
  );
  scene.add(blocks, edges);

  // The agent: an ivory capsule with a brass visor, lit (it is the one rounded thing, and the light shows its form). The
  // group's origin is at its feet; the visor is a curved band round the front of the head (-Z, the way it faces at yaw 0).
  const { width, height } = cfg.agent;
  const radius = (width / 2) * 1.08;
  const agent = new Group();
  const body = new Mesh(
    geo(new CapsuleGeometry(radius, height - 2 * radius, 6, 18)),
    mat(new MeshLambertMaterial({ color: toColor(colors.ivory) })),
  );
  body.position.y = height / 2;
  // CylinderGeometry measures its angle from +Z towards +X, so a band centred on π faces -Z.
  const visorArc = 1.9;
  const visor = new Mesh(
    geo(
      new CylinderGeometry(radius * 1.04, radius * 1.04, height * 0.13, 20, 1, true, Math.PI - visorArc / 2, visorArc),
    ),
    mat(new MeshBasicMaterial({ color: toColor(colors.brass) })),
  );
  visor.position.y = height * 0.74;
  agent.add(body, visor);
  scene.add(agent);
  scene.add(new AmbientLight(toColor(colors.ivory), 0.55));
  const sun = new DirectionalLight(toColor(colors.ivory), 0.9);
  sun.position.set(-0.5, 1, 0.35);
  scene.add(sun);

  // The blob shadow: a dark disc on whatever is under the agent, fading with the height, so a landing spot is always clear.
  const shadow = new Mesh(
    geo(new CircleGeometry(r.shadow.radius, 28)),
    mat(
      new MeshBasicMaterial({
        color: toColor(colors.shadow),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    ),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // The goal ring: brass, tilted like the ring in the logo, turning slowly about the vertical through its middle. From
  // Blender, its GOAL mesh keeps its tilt and size; in code, a ring is made here.
  const ring = new Group();
  const brass = mat(new MeshBasicMaterial({ color: toColor(colors.brass) }));
  const torus = model?.goal
    ? new Mesh(geo(model.goal.geometry), brass)
    : new Mesh(geo(new TorusGeometry(2.2, 0.07, 8, 72)), brass);
  if (model?.goal) {
    model.goal.updateWorldMatrix(true, false);
    model.goal.matrixWorld.decompose(new Vector3(), torus.quaternion, torus.scale);
  } else {
    torus.rotation.x = Math.PI / 2 - 0.42;
  }
  ring.add(torus);
  ring.position.set(level.goal.x, level.goal.y, level.goal.z);
  scene.add(ring);

  return {
    resize(w, h, pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },
    render(sim, alpha, cam, time) {
      const feet = sim.lerpPos(alpha);
      agent.position.set(feet.x, feet.y, feet.z);
      agent.rotation.y = sim.lerpYaw(alpha);

      const ground = sim.groundUnder(feet);
      if (ground === null) {
        shadow.visible = false;
      } else {
        const h = feet.y - ground;
        const fade = Math.max(0, 1 - h / r.shadow.fadeHeight);
        shadow.visible = fade > 0;
        shadow.position.set(feet.x, ground + 0.01, feet.z);
        shadow.scale.setScalar(0.75 + 0.25 * fade);
        (shadow.material as MeshBasicMaterial).opacity = 0.9 * fade;
      }

      if (!options.reducedMotion) ring.rotation.y = ((time % r.ringTurn) / r.ringTurn) * Math.PI * 2;

      camera.position.set(cam.position.x, cam.position.y, cam.position.z);
      camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
      renderer.render(scene, camera);
    },
    info: () => ({
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      geometries: renderer.info.memory.geometries,
    }),
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
