// The agent the player climbs as (docs/ASCENT.md, "How it looks"): the small robot from assets/agent.glb (built by
// tools/ascent/build_agent.py), its light and its animation (agent-anim.ts). Read-only over the sim, like rover.ts in the
// runner: every motion is drawn from the sim's state and the frame's time, and nothing is written back.
//
// The model is loaded beside the level (index.ts, loadAgent) and handed to the view. Without it (it failed to load, or a test
// mounts the game without it) the phase 1 capsule with its brass visor stands in. Collision does not care which is drawn: the
// agent's box is cfg.agent, and the robot fits inside it seen from behind (0.55 by 1.2 m).
//
// Colours are the material names, as in a level (LEVEL_MATERIALS, colors.ts): each becomes a lit material in its token colour,
// and the obsidian parts get the ivory edge lines the level has. The robot is the one lit thing in the scene, so its light
// lives here: an ambient, and a key, a fill and a rim that turn with the camera (cfg.render.agentLight).
//
// three.js comes from its ES sources, as in render.ts (Ascent's own copy; the runner's chunk stays whole).

import {
  AmbientLight,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three/src/Three.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AgentAnimator, type AgentPose } from './agent-anim';
import { isLevelMaterial, type LevelMaterial, type Rgb, type SceneColorName, type SceneColors } from './colors';
import { ASCENT_CONFIG, type AscentConfig } from './config';
import type { Vec3 } from './collision';
import type { AscentSim } from './sim';

/** The root node, and the parts agent.ts moves or colours: the contract with build_agent.py. */
export const AGENT_ROOT = 'agent';
export const AGENT_PARTS = [
  'body',
  'pack',
  'joints',
  'neck',
  'head',
  'visor',
  'antenna',
  'antenna_tip',
  'antenna_base',
  'arm_L',
  'arm_R',
  'leg_L',
  'leg_R',
  'foot_L',
  'foot_R',
] as const;

/** The token each material is drawn in on the agent (lit, unlike a level's tones). */
export const AGENT_TONES: Record<LevelMaterial, SceneColorName> = {
  ivory: 'ivory',
  brass: 'brass',
  obsidian: 'face3',
  'obsidian-dark': 'face2',
};

/** The parts outlined with ivory edge lines, as the level's blocks are. */
const OUTLINED: ReadonlySet<LevelMaterial> = new Set(['obsidian', 'obsidian-dark']);
/** Edges between faces meeting more sharply than this are drawn (render.ts's angle). */
const EDGE_ANGLE = 30;

export interface AgentModel {
  /** The `agent` node: its origin at the feet, facing -Z. */
  root: Object3D;
  source: string;
}

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true;
const materialName = (mesh: Mesh): string => {
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return m?.name ?? '';
};

/** The model in an already-parsed glTF scene; throws, naming the part, when a part or a material is not what the game expects. */
export function agentModelFromScene(scene: Object3D, source: string): AgentModel {
  const root = scene.getObjectByName(AGENT_ROOT);
  if (!root) throw new Error(`R7: Ascent could not use ${source}: it has no "${AGENT_ROOT}" node`);
  const missing = AGENT_PARTS.filter((name) => !root.getObjectByName(name));
  if (missing.length) throw new Error(`R7: Ascent could not use ${source}: it has no ${missing.join(', ')}`);
  root.traverse((o) => {
    if (!isMesh(o)) return;
    const name = materialName(o);
    if (!isLevelMaterial(name)) {
      throw new Error(
        `R7: Ascent could not use ${source}: ${o.name} has the material "${name}", which the game does not know`,
      );
    }
  });
  return { root, source };
}

/** The model in a .glb file's bytes. */
export async function parseAgentModel(data: ArrayBuffer, source = 'the agent file'): Promise<AgentModel> {
  const gltf = await new GLTFLoader().parseAsync(data, '');
  return agentModelFromScene(gltf.scene, source);
}

/** The model of the .glb at `url`. Rejects when it cannot be fetched or used. */
export async function loadAgentModel(url: string): Promise<AgentModel> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`R7: Ascent could not load ${url} (${response.status})`);
  return parseAgentModel(await response.arrayBuffer(), url);
}

/**
 * The direction from the agent towards one of its lights (unit, three.js axes): `yaw` degrees round from the camera's side
 * (positive to the camera's left), `pitch` degrees up. The camera straight above has no side: the light then comes from +Z.
 */
export function lightDirection(camera: Vec3, target: Vec3, yaw: number, pitch: number): Vec3 {
  let bx = camera.x - target.x;
  let bz = camera.z - target.z;
  const len = Math.hypot(bx, bz);
  if (len < 1e-6) {
    bx = 0;
    bz = 1;
  } else {
    bx /= len;
    bz /= len;
  }
  // The camera's side (bx, bz) turned by yaw towards the camera's left.
  const a = (yaw * Math.PI) / 180;
  const sx = bx * Math.cos(a) - bz * Math.sin(a);
  const sz = bx * Math.sin(a) + bz * Math.cos(a);
  const p = (pitch * Math.PI) / 180;
  return { x: sx * Math.cos(p), y: Math.sin(p), z: sz * Math.cos(p) };
}

export interface AgentView {
  /** Add this to the scene: the agent and its lights. */
  readonly object: Group;
  /** 'robot' when the model is drawn, 'capsule' for the stand-in. */
  readonly kind: 'robot' | 'capsule';
  /** The last pose (the debug readout shows its animation). */
  readonly pose: AgentPose;
  /** Place, pose and light it from the sim, `dt` seconds after the last frame, seen from `camera`. */
  update(sim: AscentSim, alpha: number, dt: number, camera: Vec3): void;
  dispose(): void;
}

export interface AgentViewOptions {
  colors: SceneColors;
  model?: AgentModel | null;
  config?: AscentConfig;
  /** Leave out the bob, the squash and stretch and the antenna's sway. */
  reducedMotion?: boolean;
}

/** A token colour (sRGB, 0-1) as a three.js colour in its linear working space. */
const toColor = (c: Rgb) => new Color().setRGB(c.r, c.g, c.b, SRGBColorSpace);

export function createAgentView(options: AgentViewOptions): AgentView {
  const cfg = options.config ?? ASCENT_CONFIG;
  const { colors } = options;
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const geo = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const mat = <T extends Material>(m: T) => (materials.push(m), m);

  const object = new Group();
  object.name = 'agent_view';
  const holder = new Group(); // at the feet, turned to the agent's yaw, squashed about the feet
  object.add(holder);

  const model = options.model ?? null;
  let kind: AgentView['kind'];
  const parts = new Map<string, Object3D>();
  if (model) {
    kind = 'robot';
    const glow = cfg.render.agentLight.brassGlow;
    const lit = new Map<LevelMaterial, MeshLambertMaterial>();
    const lineMaterial = mat(
      new LineBasicMaterial({ color: toColor(colors.ivory), transparent: true, opacity: cfg.render.edgeOpacity }),
    );
    const replaced = new Set<Material>();
    const meshes: Mesh[] = [];
    model.root.traverse((o) => {
      if (isMesh(o)) meshes.push(o);
    });
    for (const mesh of meshes) {
      const name = materialName(mesh) as LevelMaterial; // checked by agentModelFromScene
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) replaced.add(m);
      let m = lit.get(name);
      if (!m) {
        const color = toColor(colors[AGENT_TONES[name]]);
        m = mat(
          new MeshLambertMaterial(name === 'brass' ? { color, emissive: color, emissiveIntensity: glow } : { color }),
        );
        lit.set(name, m);
      }
      mesh.material = m;
      geo(mesh.geometry);
      if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
      if (OUTLINED.has(name))
        mesh.add(new LineSegments(geo(new EdgesGeometry(mesh.geometry, EDGE_ANGLE)), lineMaterial));
    }
    for (const m of replaced) m.dispose();
    model.root.position.set(0, 0, 0);
    holder.add(model.root);
    for (const name of AGENT_PARTS) {
      const part = model.root.getObjectByName(name);
      if (part) parts.set(name, part);
    }
  } else {
    // The stand-in: an ivory capsule with a brass visor, the group's origin at its feet; the visor faces -Z.
    kind = 'capsule';
    const { width, height } = cfg.agent;
    const radius = (width / 2) * 1.08;
    const body = new Mesh(
      geo(new CapsuleGeometry(radius, height - 2 * radius, 6, 18)),
      mat(new MeshLambertMaterial({ color: toColor(colors.ivory) })),
    );
    body.position.y = height / 2;
    // CylinderGeometry measures its angle from +Z towards +X, so a band centred on π faces -Z.
    const visorArc = 1.9;
    const visor = new Mesh(
      geo(
        new CylinderGeometry(
          radius * 1.04,
          radius * 1.04,
          height * 0.13,
          20,
          1,
          true,
          Math.PI - visorArc / 2,
          visorArc,
        ),
      ),
      mat(new MeshBasicMaterial({ color: toColor(colors.brass) })),
    );
    visor.position.y = height * 0.74;
    holder.add(body, visor);
  }

  // The light: an ambient and three suns aimed at the agent, placed round it each frame from the camera.
  const light = cfg.render.agentLight;
  const ivory = toColor(colors.ivory);
  // A share s of a part's colour on a face square to the light is an intensity of s·π (three.js divides diffuse light by π).
  object.add(new AmbientLight(ivory, light.ambient * Math.PI));
  const suns = (['key', 'fill', 'rim'] as const).map((name) => {
    const sun = new DirectionalLight(ivory, light[name].share * Math.PI);
    sun.target = holder;
    object.add(sun);
    return { sun, ...light[name] };
  });

  const restY = new Map<Object3D, number>();
  for (const part of parts.values()) restY.set(part, part.position.y);
  const animator = new AgentAnimator(cfg);
  const reducedMotion = options.reducedMotion ?? false;

  const pose = (p: AgentPose) => {
    const w = 1 / Math.sqrt(p.squash);
    holder.scale.set(w, p.squash, w);
    if (kind !== 'robot') return;
    const set = (name: string, fn: (o: Object3D) => void) => {
      const o = parts.get(name);
      if (o) fn(o);
    };
    // Forward is -Z: a positive turn about X swings a hanging limb forward, and tips an upright part back.
    set('body', (o) => {
      o.position.y = (restY.get(o) ?? 0) + p.bodyLift;
      o.rotation.x = -p.lean;
    });
    set('head', (o) => (o.rotation.x = -p.headNod));
    set('leg_L', (o) => (o.rotation.x = p.legL));
    set('leg_R', (o) => (o.rotation.x = p.legR));
    set('arm_L', (o) => o.rotation.set(p.armL, 0, -p.armOut));
    set('arm_R', (o) => o.rotation.set(p.armR, 0, p.armOut));
    set('antenna', (o) => o.rotation.set(-p.antennaPitch, 0, p.antennaRoll));
  };

  return {
    object,
    kind,
    get pose() {
      return animator.pose;
    },
    update(sim, alpha, dt, camera) {
      const feet = sim.lerpPos(alpha);
      holder.position.set(feet.x, feet.y, feet.z);
      holder.rotation.y = sim.lerpYaw(alpha);
      pose(
        animator.update(
          {
            grounded: sim.grounded,
            vx: sim.vel.x,
            vy: sim.vel.y,
            vz: sim.vel.z,
            jumps: sim.jumps,
            landings: sim.landings,
            teleports: sim.teleports,
          },
          dt,
          reducedMotion,
        ),
      );
      for (const { sun, yaw, pitch } of suns) {
        const d = lightDirection(camera, feet, yaw, pitch);
        sun.position.set(feet.x + d.x * 10, feet.y + d.y * 10, feet.z + d.z * 10); // aimed at the holder, at the feet
      }
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
