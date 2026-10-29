// A level made in Blender (tools/ascent/, docs/ASCENT.md "Blender is the level editor"), read from its .glb with three.js's
// GLTFLoader: the COL_ boxes, SPAWN, GOAL, BEACON_ and ZONE_ objects become a LevelPart (partFromObjects, level.ts) for the
// sim, and every other mesh is scenery for the view, which draws it in the token colours of its material's name
// (LEVEL_MATERIALS, colors.ts). Scenery named after a drifting or crumbling box (COL_<name>: <name> and <name>__...) is kept
// apart, so the view can move it with its box. A material the game does not know is an error, so a typo in a Blender script
// fails the unit test that loads the file.
//
// A whole level in one file (the test climb) is a LevelModel; one zone of the climb is a PartModel, and the climb joins them
// (index.ts, loadClimb).
//
// three.js comes from its ES sources here as in render.ts, and so does the GLTFLoader's own `three` (astro.config.mjs,
// ascentOwnThree): Ascent's chunk carries its own copy, and the runner's chunk is left whole for the 404 page's prefetch.

import { Box3, Texture, type Mesh, type Object3D } from 'three/src/Three.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { isLevelMaterial, type LevelMaterial } from './colors';
import { LEVEL_NAMES, joinParts, partFromObjects, type Level, type LevelObject, type LevelPart } from './level';

/**
 * A piece of scenery: a mesh (placed in the world by its matrixWorld) and how it is drawn: in the tones of a material name
 * (LEVEL_MATERIALS, the test climb's look), or `lit` (a lit climb's: the mesh's own material, lit and coloured).
 */
export interface SceneryMesh {
  mesh: Mesh;
  material: LevelMaterial | 'lit';
  /** Whether it casts a shadow (a lit file's mesh with the custom property shadow = 0 does not: the workshop's walls). */
  shadow: boolean;
}

/** One level file and what the view draws for it. */
export interface PartModel {
  part: LevelPart;
  /** Every mesh that stays where it is: not a collision box, the goal, or a moving box's scenery. */
  scenery: SceneryMesh[];
  /** The scenery of each drifting or crumbling box, by the box's index in `part.boxes`. */
  moving: Map<number, SceneryMesh[]>;
  /** The goal ring's mesh, when the file has GOAL (the view turns it about the vertical through `goal`). */
  goal: Mesh | null;
  /** The sky's meshes (named SKY_...: the Earth, the Moon, the stars): far away, drawn without fog. Lit files only. */
  sky: Mesh[];
  /** `lit`: the file's own materials, lit (its ZONE empty says style = lit); `tones`: the material names' token tones. */
  style: 'lit' | 'tones';
  /** Where it came from, for messages. */
  source: string;
}

/** A whole level and what the view draws for it: its parts (one for a level in one file), joined. */
export interface LevelModel {
  level: Level;
  parts: PartModel[];
  /** Where it came from, for messages. */
  source: string;
}

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true;

/** The names of a lit file's sky meshes start with this. */
export const SKY_PREFIX = 'SKY_';

const materialName = (mesh: Mesh): string => {
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return m?.name ?? '';
};

/** The part in an already-parsed glTF scene. */
export function partModelFromScene(root: Object3D, source: string): PartModel {
  root.updateMatrixWorld(true);
  const objects: LevelObject[] = [];
  const meshes: Mesh[] = [];
  let goal: Mesh | null = null;
  const box = new Box3();
  root.traverse((o) => {
    if (o === root) return;
    const position = o.getWorldPosition(o.position.clone());
    const rotation = o.getWorldQuaternion(o.quaternion.clone());
    if (isMesh(o)) box.setFromObject(o, true);
    else box.set(position, position);
    objects.push({
      name: o.name,
      userData: o.userData,
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
    });
    if (!isMesh(o) || o.name.startsWith(LEVEL_NAMES.collision)) return;
    if (o.name === LEVEL_NAMES.goal) {
      goal = o;
      return;
    }
    meshes.push(o);
  });
  const part = partFromObjects(objects, source);
  const zoneObject = objects.find((o) => o.name.startsWith(LEVEL_NAMES.zone));
  const style = zoneObject?.userData.style === 'lit' ? 'lit' : 'tones';

  // The scenery that goes with each drifting or crumbling box: <name> and <name>__... for COL_<name>.
  const owners = new Map<string, number>();
  for (const i of [...part.movers.map((m) => m.box), ...part.crumbles.map((c) => c.box)]) {
    const name = part.boxes[i].name;
    if (name) owners.set(name.slice(LEVEL_NAMES.collision.length), i);
  }
  const scenery: SceneryMesh[] = [];
  const moving = new Map<number, SceneryMesh[]>();
  const sky: Mesh[] = [];
  for (const mesh of meshes) {
    if (style === 'lit' && mesh.name.startsWith(SKY_PREFIX)) {
      sky.push(mesh);
      continue;
    }
    const name = materialName(mesh);
    if (style === 'tones' && !isLevelMaterial(name)) {
      throw new Error(
        `R7: Ascent could not use ${source}: ${mesh.name} has the material "${name}", which the game does not know`,
      );
    }
    const owner = owners.get(mesh.name.split('__')[0]);
    const item: SceneryMesh = {
      mesh,
      material: style === 'lit' ? 'lit' : (name as LevelMaterial),
      shadow: mesh.userData.shadow !== 0,
    };
    if (owner === undefined) scenery.push(item);
    else moving.set(owner, [...(moving.get(owner) ?? []), item]);
  }
  return { part, scenery, moving, goal, sky, style, source };
}

/** How to read a file: `textures: false` leaves its pictures out (an empty texture each), where no image can be decoded (the
 * unit tests, in Node). */
export interface ParseOptions {
  textures?: boolean;
}

/** The part in a .glb file's bytes. */
export async function parsePartModel(
  data: ArrayBuffer,
  source = 'the level file',
  options: ParseOptions = {},
): Promise<PartModel> {
  // The climb's zones are compressed with gltfpack (meshopt; tools/ascent/build_climb.py): the decoder is small and comes with
  // three.js, and it runs in Node too (the unit tests).
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  if (options.textures === false) {
    // Every texture the file asks for is an empty one, before any of the loader's own image handling runs.
    loader.register((parser) => {
      const get = parser.getDependency.bind(parser);
      parser.getDependency = (type: string, index: number) =>
        type === 'texture' ? Promise.resolve(new Texture()) : get(type, index);
      return { name: 'ascent-no-textures' };
    });
  }
  const gltf = await loader.parseAsync(data, '');
  return partModelFromScene(gltf.scene, source);
}

/** The part in the .glb at `url`. Rejects when it cannot be fetched or used. */
export async function loadPartModel(url: string): Promise<PartModel> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`R7: Ascent could not load ${url} (${response.status})`);
  return parsePartModel(await response.arrayBuffer(), url);
}

/** A whole level in one file: its part must have its own SPAWN and GOAL. */
export function levelModelFromPart(model: PartModel): LevelModel {
  const { part, source } = model;
  if (!part.spawn) throw new Error(`R7: Ascent could not use ${source}: it has no SPAWN`);
  if (!part.goal) throw new Error(`R7: Ascent could not use ${source}: it has no GOAL`);
  return { level: joinParts([part], undefined, source), parts: [model], source };
}

/** The model of an already-parsed glTF scene of a whole level. */
export const levelModelFromScene = (root: Object3D, source: string): LevelModel =>
  levelModelFromPart(partModelFromScene(root, source));

/** The model in a .glb file's bytes, a whole level. */
export async function parseLevelModel(data: ArrayBuffer, source = 'the level file'): Promise<LevelModel> {
  return levelModelFromPart(await parsePartModel(data, source));
}

/** The model of the .glb at `url`, a whole level. Rejects when it cannot be fetched or used. */
export async function loadLevelModel(url: string): Promise<LevelModel> {
  return levelModelFromPart(await loadPartModel(url));
}
