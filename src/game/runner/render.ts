// The Three.js view: placeholder primitives that only READ the sim's state (docs/RUNNER.md, "Architecture"). The look pass
// (step 2) replaces the art in this file; nothing in the game logic depends on it. The rover sits at the origin and the world
// moves towards the camera: an object `rel` metres ahead of the rover is drawn at z = -rel.

import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  Fog,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { createEnvironment, type EnvironmentInfo } from './environment'; // environment (step 2b)
import { RUNNER_COLORS as C, RUNNER_CONFIG, type RunnerConfig } from './config';
import type { ObstacleKind } from './generator';
import type { RunnerSim } from './sim';

export interface View {
  /** The drawing size in CSS pixels and the device pixel ratio to use (already capped by the caller). */
  resize(width: number, height: number, pixelRatio: number): void;
  /** Draw the sim `alpha` of the way from its previous step to its current one. */
  render(sim: RunnerSim, alpha: number): void;
  /** Free every geometry, material, texture and the WebGL context. */
  dispose(): void;
  /** environment (step 2b): the world's scroll and renderer.info for the last frame (the fixture's readout, the tests). */
  info?(): EnvironmentInfo;
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

const PICKUP_CAPACITY = 96;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The view, drawing into `canvas`; null when no WebGL context can be made (the caller shows the fallback). */
export function createView(canvas: HTMLCanvasElement, cfg: RunnerConfig = RUNNER_CONFIG): View | null {
  if (!hasWebGL(canvas.ownerDocument)) return null;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setClearColor(C.obsidian, 1);

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const geo = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const mat = <T extends Material>(m: T) => (materials.push(m), m);

  const lw = cfg.track.laneWidth;
  const r = cfg.render;
  const scene = new Scene();
  scene.fog = new Fog(C.obsidian, r.fog.near, r.fog.far);
  const camera = new PerspectiveCamera(r.fov, 16 / 9, 0.1, r.fog.far + 20);
  scene.add(new AmbientLight(C.ivory, 1.1));
  const sun = new DirectionalLight(C.ivory, 1.6);
  sun.position.set(-3, 8, 6);
  scene.add(sun);

  const ivory = mat(new MeshLambertMaterial({ color: C.ivory }));
  const shade = mat(new MeshLambertMaterial({ color: C.shade }));
  const brass = mat(new MeshBasicMaterial({ color: C.brass }));

  // environment (step 2b): the sky, planet, stars, ring tunnel, track, rocks, glows, lights and fog (environment.ts). It
  // replaces the lights and fog made above; delete those lines once steps 2a and 2b are merged.
  const env = createEnvironment({ renderer, scene, cfg, doc: canvas.ownerDocument });
  // end environment (step 2b)

  // The rover: a box body, six wheels and a brass beacon on the roof.
  const rover = new Group();
  const body = new Mesh(geo(new BoxGeometry(1.1, 0.6, 1.5)), ivory);
  body.position.y = 0.55;
  rover.add(body);
  const wheelGeo = geo(new BoxGeometry(0.22, 0.44, 0.44));
  for (const side of [-1, 1]) {
    for (const z of [-0.55, 0, 0.55]) {
      const wheel = new Mesh(wheelGeo, shade);
      wheel.position.set(side * 0.62, 0.22, z);
      rover.add(wheel);
    }
  }
  const mast = new Mesh(geo(new BoxGeometry(0.05, 0.18, 0.05)), shade);
  mast.position.set(0, 0.94, 0.2);
  rover.add(mast);
  const beacon = new Mesh(
    geo(new SphereGeometry(0.12, 16, 12)),
    mat(new MeshBasicMaterial({ color: C.brassHighlight })),
  );
  beacon.position.set(0, 1.08, 0.2);
  rover.add(beacon);
  scene.add(rover);

  // Obstacles, drawn at their hitbox sizes. The slab carries 404 on the face that looks at the rover.
  const hb = cfg.hitbox;
  const numerals = numeralTexture(canvas.ownerDocument);
  if (numerals) textures.push(numerals);
  const slabFace = numerals ? mat(new MeshLambertMaterial({ color: C.ivory, map: numerals })) : ivory;
  const slabGeo = geo(new BoxGeometry(hb.slab.width, hb.slab.top, hb.slab.length));
  const barrierGeo = geo(new BoxGeometry(hb.barrier.width, hb.barrier.top, hb.barrier.length));
  const beamHeight = 0.55;
  const beamGeo = geo(new BoxGeometry(hb.gate.width + 0.3, beamHeight, hb.gate.length));
  const postGeo = geo(new BoxGeometry(0.16, hb.gate.bottom + beamHeight, hb.gate.length));

  const build: Record<ObstacleKind, () => Object3D> = {
    slab: () => {
      // BoxGeometry's faces: +x, -x, +y, -y, +z (towards the camera), -z.
      const m = new Mesh(slabGeo, [ivory, ivory, ivory, ivory, slabFace, ivory]);
      m.position.y = hb.slab.top / 2;
      return wrap(m);
    },
    barrier: () => {
      const m = new Mesh(barrierGeo, ivory);
      m.position.y = hb.barrier.top / 2;
      return wrap(m);
    },
    gate: () => {
      const g = new Group();
      const beam = new Mesh(beamGeo, ivory);
      beam.position.y = hb.gate.bottom + beamHeight / 2;
      g.add(beam);
      for (const side of [-1, 1]) {
        const post = new Mesh(postGeo, ivory);
        post.position.set(side * (hb.gate.width / 2 + 0.07), (hb.gate.bottom + beamHeight) / 2, 0);
        g.add(post);
      }
      return g;
    },
  };
  const pools: Record<ObstacleKind, Object3D[]> = { slab: [], barrier: [], gate: [] };
  const live = new Map<number, { kind: ObstacleKind; obj: Object3D }>();

  const pickups = new InstancedMesh(geo(new SphereGeometry(0.2, 12, 8)), brass, PICKUP_CAPACITY);
  pickups.count = 0;
  pickups.frustumCulled = false;
  scene.add(pickups);
  const dummy = new Object3D();

  return {
    resize(width, height, pixelRatio) {
      if (width <= 0 || height <= 0) return;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },

    render(sim, alpha) {
      const d = lerp(sim.prev.distance, sim.distance, alpha);
      const x = lerp(sim.prev.x, sim.x, alpha);
      const y = lerp(sim.prev.y, sim.y, alpha);

      rover.position.set(x, y, 0);
      rover.scale.y = sim.sliding ? 0.5 : 1;
      rover.rotation.z = (x - sim.lane * lw) * 0.06; // a small lean into a lane change

      const cam = r.camera;
      camera.position.set(x * cam.follow, cam.height, cam.back);
      camera.lookAt(x * cam.follow * 0.5, cam.lookHeight, -cam.lookAhead);

      env.update(sim, alpha); // environment (step 2b)

      const seen = new Set<number>();
      for (const o of sim.obstacles) {
        const rel = o.z - d;
        if (rel > r.fog.far + 10) continue;
        let entry = live.get(o.id);
        if (!entry) {
          const pooled = pools[o.kind].pop();
          const obj = pooled ?? build[o.kind]();
          if (!pooled) scene.add(obj);
          entry = { kind: o.kind, obj };
          live.set(o.id, entry);
        }
        entry.obj.visible = true;
        entry.obj.position.set(o.lane * lw, 0, -rel);
        seen.add(o.id);
      }
      for (const [id, entry] of live) {
        if (seen.has(id)) continue;
        entry.obj.visible = false;
        pools[entry.kind].push(entry.obj);
        live.delete(id);
      }

      let n = 0;
      for (const p of sim.items) {
        if (p.taken) continue;
        const rel = p.z - d;
        if (rel > r.fog.far + 10 || n >= PICKUP_CAPACITY) break;
        dummy.position.set(p.lane * lw, p.y, -rel);
        dummy.updateMatrix();
        pickups.setMatrixAt(n++, dummy.matrix);
      }
      pickups.count = n;
      pickups.instanceMatrix.needsUpdate = true;

      env.drawSky(camera); // environment (step 2b): clears, then the sky pass
      renderer.render(scene, camera);
    },

    info: () => env.info(), // environment (step 2b)

    dispose() {
      env.dispose(); // environment (step 2b)
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      pickups.dispose();
      scene.clear();
      live.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

/** An obstacle mesh in a group, so every kind is positioned the same way (its base on the track at the group's origin). */
function wrap(mesh: Mesh): Group {
  const g = new Group();
  g.add(mesh);
  return g;
}

/** "404" in the shade colour on ivory, for the slab's face. Null when a 2D canvas is unavailable. */
function numeralTexture(doc: Document): CanvasTexture | null {
  const canvas = doc.createElement('canvas');
  canvas.width = 256;
  canvas.height = 370;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = hex(C.ivory);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = hex(C.shade);
  ctx.font = '700 92px "JetBrains Mono Variable", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('404', canvas.width / 2, canvas.height * 0.38);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
