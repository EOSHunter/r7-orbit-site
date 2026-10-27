// The robot as the game reads it (agent.ts): the committed assets/agent.glb through GLTFLoader (its parts, materials, size and
// fit in the agent's box), the checks on a model's parts, the view built from it or from the capsule, and the light's aim.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  Box3,
  BoxGeometry,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Vector3,
  type Object3D,
} from 'three/src/Three.js';
import {
  AGENT_PARTS,
  AGENT_ROOT,
  agentModelFromScene,
  createAgentView,
  lightDirection,
  parseAgentModel,
} from './agent';
import { LEVEL_MATERIALS, type SceneColors } from './colors';
import { ASCENT_CONFIG } from './config';
import type { Level } from './level';
import { AscentSim } from './sim';

/** A wide empty floor: room to run in any direction without bumping into a block. */
const FLAT: Level = {
  spawn: { x: 0, y: 0, z: 0 },
  spawnYaw: 0,
  boxes: [{ kind: 'ground', min: { x: -200, y: -1, z: -200 }, max: { x: 200, y: 0, z: 200 } }],
  route: [],
  goal: { x: 0, y: 50, z: 0 },
  beacons: [],
};

const glb = await readFile(new URL('./assets/agent.glb', import.meta.url));
const load = () => parseAgentModel(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), 'agent.glb');

const grey = { r: 0.5, g: 0.5, b: 0.5 };
const COLORS = Object.fromEntries(
  ['background', 'face1', 'face2', 'face3', 'shadow', 'ivory', 'dim', 'brass'].map((k) => [k, grey]),
) as SceneColors;

const meshesOf = (root: Object3D) => {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
};

describe('the robot (assets/agent.glb)', async () => {
  const model = await load();

  it('has every part agent.ts moves, under the agent node', () => {
    expect(model.root.name).toBe(AGENT_ROOT);
    for (const name of AGENT_PARTS) expect(model.root.getObjectByName(name), name).toBeTruthy();
  });

  it('uses only the named materials, and brass only on the visor', () => {
    const meshes = meshesOf(model.root);
    expect(meshes.length).toBe(AGENT_PARTS.length);
    for (const m of meshes) {
      const name = (m.material as MeshBasicMaterial).name;
      expect(Object.keys(LEVEL_MATERIALS), m.name).toContain(name);
      expect(name === 'brass', m.name).toBe(m.name === 'visor');
    }
  });

  it('fits the agent box seen from behind (0.56 m wide, 1.2 m tall, feet at 0) and faces -Z', () => {
    model.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(model.root, true);
    const { width, height } = ASCENT_CONFIG.agent;
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(width + 1e-3);
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-3);
    expect(box.max.y).toBeLessThanOrEqual(height + 1e-3);
    expect(box.max.y).toBeGreaterThan(height - 0.05);
    const centre = (name: string) =>
      new Box3().setFromObject(model.root.getObjectByName(name)!, true).getCenter(new Vector3());
    expect(centre('visor').z, 'the visor is at the front').toBeLessThan(0);
    expect(centre('pack').z, 'the pack is on the back').toBeGreaterThan(0);
  });

  it('puts each pivot where the animation turns it: hips, shoulders, neck, the antenna on the head', () => {
    const at = (name: string) => model.root.getObjectByName(name)!.getWorldPosition(new Vector3());
    expect(at('leg_L').y).toBeCloseTo(at('leg_R').y, 5);
    expect(at('leg_L').x).toBeLessThan(0);
    expect(at('arm_R').x).toBeGreaterThan(0);
    expect(at('arm_L').y).toBeGreaterThan(at('leg_L').y);
    expect(at('head').y).toBeGreaterThan(at('arm_L').y);
    expect(at('antenna').y).toBeGreaterThan(at('head').y);
  });

  it('stays small (docs/ASCENT.md, "Size targets": the character under 150 kB)', () => {
    expect(glb.byteLength).toBeLessThan(150 * 1024);
  });
});

describe('agentModelFromScene', () => {
  const part = (name: string, material = 'ivory') => {
    const m = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    m.name = name;
    (m.material as MeshBasicMaterial).name = material;
    return m;
  };
  const whole = () => {
    const root = new Group();
    root.name = AGENT_ROOT;
    for (const name of AGENT_PARTS) root.add(part(name));
    const scene = new Group();
    scene.add(root);
    return scene;
  };

  it('takes a scene with every part in a known material', () => {
    expect(agentModelFromScene(whole(), 'x.glb').root.name).toBe(AGENT_ROOT);
  });
  it('names a missing root or part', () => {
    expect(() => agentModelFromScene(new Group(), 'x.glb')).toThrow(/no "agent" node/);
    const scene = whole();
    const arm = scene.getObjectByName('arm_L')!;
    arm.removeFromParent();
    expect(() => agentModelFromScene(scene, 'x.glb')).toThrow(/has no arm_L/);
  });
  it('names a mesh in a material the game does not know', () => {
    const scene = whole();
    scene.getObjectByName(AGENT_ROOT)!.add(part('badge', 'gold'));
    expect(() => agentModelFromScene(scene, 'x.glb')).toThrow(/badge has the material "gold"/);
  });
});

describe('createAgentView', () => {
  it('draws the robot lit in token colours, the obsidian parts outlined, and poses it from the sim', async () => {
    const view = createAgentView({ colors: COLORS, model: await load() });
    expect(view.kind).toBe('robot');
    const meshes = meshesOf(view.object);
    expect(meshes.every((m) => m.material instanceof MeshLambertMaterial)).toBe(true);
    const outlined = meshes.filter((m) => m.children.some((c) => c instanceof LineSegments)).map((m) => m.name);
    expect(outlined).toContain('pack');
    expect(outlined).not.toContain('head');

    const sim = new AscentSim(FLAT);
    sim.setMove(0, -1);
    for (let i = 0; i < 120; i++) sim.step();
    const camera = { x: sim.pos.x, y: sim.pos.y + 3, z: sim.pos.z + 6 };
    for (let i = 0; i < 20; i++) {
      sim.step();
      sim.step();
      view.update(sim, 1, 1 / 60, camera);
    }
    expect(view.pose.animation).toBe('run');
    const legs = ['leg_L', 'leg_R'].map((n) => view.object.getObjectByName(n)!.rotation.x);
    expect(legs[0]).toBeCloseTo(-legs[1], 1);
    const feet = view.object.getObjectByName(AGENT_ROOT)!.getWorldPosition(new Vector3());
    expect(feet.z).toBeCloseTo(sim.pos.z, 3);
    view.dispose();
  });

  it('stands the capsule in without a model', () => {
    const view = createAgentView({ colors: COLORS, model: null });
    expect(view.kind).toBe('capsule');
    expect(meshesOf(view.object)).toHaveLength(2);
    view.update(new AscentSim(FLAT), 0, 1 / 60, { x: 0, y: 3, z: 16 });
    view.dispose();
  });
});

describe('lightDirection', () => {
  const camera = { x: 0, y: 3, z: 6 };
  const agent = { x: 0, y: 0, z: 0 };
  it('comes from the camera at yaw 0, from its left at +90, from behind the agent at 180', () => {
    const front = lightDirection(camera, agent, 0, 0);
    expect([front.x, front.y, front.z].map((v) => +v.toFixed(6))).toEqual([0, 0, 1]);
    // The camera at +Z looks along -Z, so its left is -X.
    expect(lightDirection(camera, agent, 90, 0).x).toBeCloseTo(-1);
    expect(lightDirection(camera, agent, 180, 0).z).toBeCloseTo(-1);
  });
  it('rises with the pitch and stays one long', () => {
    const d = lightDirection({ x: 3, y: 1, z: -4 }, agent, -60, 35);
    expect(d.y).toBeCloseTo(Math.sin((35 * Math.PI) / 180));
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
  });
  it('turns with the camera', () => {
    const a = lightDirection({ x: 0, y: 0, z: 5 }, agent, -60, 0);
    const b = lightDirection({ x: 5, y: 0, z: 0 }, agent, -60, 0);
    // The camera a quarter turn round: the light a quarter turn round with it.
    expect(b.x).toBeCloseTo(a.z);
    expect(b.z).toBeCloseTo(-a.x);
  });
});
