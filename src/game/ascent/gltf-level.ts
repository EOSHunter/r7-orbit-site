// A level made in Blender (tools/ascent/, docs/ASCENT.md "Blender is the level editor"), read from its .glb with three.js's
// GLTFLoader: the COL_ boxes, SPAWN and GOAL become a Level (levelFromObjects, level.ts) for the sim, and every other mesh is
// scenery for the view, which draws it in the token colours of its material's name (LEVEL_MATERIALS, colors.ts). A material
// the game does not know is an error, so a typo in a Blender script fails the unit test that loads the file.
//
// three.js comes from its ES sources here as in render.ts, and so does the GLTFLoader's own `three` (astro.config.mjs,
// ascentOwnThree): Ascent's chunk carries its own copy, and the runner's chunk is left whole for the 404 page's prefetch.

import { Box3, type Mesh, type Object3D } from 'three/src/Three.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { isLevelMaterial, type LevelMaterial } from './colors';
import { LEVEL_NAMES, levelFromObjects, type Level, type LevelObject } from './level';

/** A piece of scenery: a mesh (placed in the world by its matrixWorld) and the material it is drawn in. */
export interface SceneryMesh {
  mesh: Mesh;
  material: LevelMaterial;
}

/** A level and what the view draws for it. */
export interface LevelModel {
  level: Level;
  /** Every mesh but the collision boxes and the goal. */
  scenery: SceneryMesh[];
  /** The goal ring's mesh (the view turns it about the vertical through `level.goal`). */
  goal: Mesh | null;
  /** Where it came from, for messages. */
  source: string;
}

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true;

const materialName = (mesh: Mesh): string => {
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return m?.name ?? '';
};

/** The model of an already-parsed glTF scene. */
export function levelModelFromScene(root: Object3D, source: string): LevelModel {
  root.updateMatrixWorld(true);
  const objects: LevelObject[] = [];
  const scenery: SceneryMesh[] = [];
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
    const name = materialName(o);
    if (!isLevelMaterial(name)) {
      throw new Error(
        `R7: Ascent could not use ${source}: ${o.name} has the material "${name}", which the game does not know`,
      );
    }
    scenery.push({ mesh: o, material: name });
  });
  return { level: levelFromObjects(objects, source), scenery, goal, source };
}

/** The model in a .glb file's bytes. */
export async function parseLevelModel(data: ArrayBuffer, source = 'the level file'): Promise<LevelModel> {
  const gltf = await new GLTFLoader().parseAsync(data, '');
  return levelModelFromScene(gltf.scene, source);
}

/** The model of the .glb at `url`. Rejects when it cannot be fetched or used. */
export async function loadLevelModel(url: string): Promise<LevelModel> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`R7: Ascent could not load ${url} (${response.status})`);
  return parseLevelModel(await response.arrayBuffer(), url);
}
