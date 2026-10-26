// The world around the track (docs/RUNNER.md, "The world" and "Atmosphere"): the sky with its twinkling stars, a slowly
// turning ringed planet and the odd shooting star, the tunnel of glowing brass rings, the track, a few low rocks, the brass
// glows, the lights and the fog. Everything is made here in code (no files, no downloaded assets); the only textures are five
// tiny canvases (glow, ring glow, dashes, the planet's ring bands, the track's sheen).
//
// Two passes, one frame: drawSky() clears to obsidian (the page's --bg) and draws the sky scene with a camera that copies the
// game camera's rotation but (almost) none of its position, so the planet and stars sit at any distance, never move with the
// lanes and are never cut by the game camera's far plane. Then the game's own render draws the world over it; the obsidian
// ground hides the sky below the horizon, and a haze band in the sky softens the line where they meet.
//
// Budget (docs/RUNNER.md): about 8,900 triangles and 21 draw calls for the whole environment, 22 while a shooting star flies
// (under 25,000 and 40), no allocation per frame (instances and uniforms are written in place), everything disposed in
// dispose(). The stars twinkle in their shader: no loop over them in JavaScript.

import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DodecahedronGeometry,
  DoubleSide,
  Fog,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Light,
  type Material,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { RUNNER_COLORS as C, type RunnerConfig } from './config';
import { mulberry32 } from './random';
import type { RunnerSim } from './sim';
import {
  SKY_MOTION,
  CometClock,
  cometEnvelope,
  cometPath,
  glowWave,
  glowWaveMean,
  planetAngles,
  ringGlow,
  twinkleFor,
  type CometPath,
} from './sky';
import { WORLD, WorldMotion, distanceFade, lerp, planetPlacement, slotZ, wrap } from './world';

export interface EnvironmentInfo {
  /** The world's scroll offset in metres (moves in the idle scene while the sim's distance stays 0). */
  scroll: number;
  /** The world's scroll speed, m/s. */
  worldSpeed: number;
  reducedMotion: boolean;
  /** renderer.info for the last whole frame (both passes): triangles, draw calls, points, and what is on the GPU. */
  triangles: number;
  calls: number;
  points: number;
  geometries: number;
  textures: number;
  /** Seconds on the sky's clock (the twinkle, the glow's wave, the planet's turn): it stands still under reduced motion. */
  skyTime: number;
  /** Shooting stars started since mount, and whether one is crossing now. */
  comets: number;
  cometFlying: boolean;
}

export interface Environment {
  /** Move the world for the sim's new steps and place everything for this frame (`alpha` as in View.render). */
  update(sim: RunnerSim, alpha: number): void;
  /** Clear the canvas and draw the sky for `camera`. Call it right before the game scene is rendered. */
  drawSky(camera: PerspectiveCamera): void;
  info(): EnvironmentInfo;
  dispose(): void;
}

export interface EnvironmentOptions {
  renderer: WebGLRenderer;
  scene: Scene;
  cfg: RunnerConfig;
  doc: Document;
}

const PICKUP_GLOWS = 96;
const RING_WIDTH = 0.045;
const RING_HEIGHT = 2;
/** Half the width of a ring's glow, metres (its hairline core is RING_WIDTH). */
const RING_GLOW = 0.55;
const DASH_PERIOD = 6;
const SKY = { stars: 360, starRadius: 1800, planetDistance: 1000, hazeRadius: 1500, starSize: 1.6, brightSize: 2.6 };
/** Where the planet's light comes from (world space): above, to the right, in front: a gibbous planet lit from the tunnel's side. */
const PLANET_LIGHT = new Vector3(0.75, 0.45, 0.5).normalize();

export function createEnvironment({ renderer, scene, cfg, doc }: EnvironmentOptions): Environment {
  const r = cfg.render;
  const lw = cfg.track.laneWidth;
  const trackWidth = lw * 3 + 1.2;
  const far = r.fog.far;

  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T): T => (owned.push(x), x);
  const textures: (Texture | null)[] = [];
  const tex = (t: CanvasTexture | null) => (t && own(t), textures.push(t), t);

  renderer.autoClear = false; // drawSky() clears; the game's render draws over the sky
  renderer.info.autoReset = false; // reset once a frame in drawSky(), so info counts both passes

  // ---------------------------------------------------------------------------------------------- lights and fog
  // The environment owns the scene's light: whatever lights the scene had are replaced.
  for (const child of [...scene.children]) if ((child as Light).isLight) scene.remove(child);
  const fog = new Fog(C.obsidian, WORLD.closedFog.near, WORLD.closedFog.far);
  scene.fog = fog;
  const world = new Group();
  world.name = 'environment';
  scene.add(world);
  const key = new DirectionalLight(C.ivory, 1.7); // soft key, above and behind the camera
  key.position.set(-3, 9, 7);
  const rimLight = new DirectionalLight(C.ivory, 0.6); // from far ahead: rims the tops of rocks and obstacles
  rimLight.position.set(2, 6, -12);
  const fill = new DirectionalLight(C.brass, 0.4); // low brass fill from the side
  fill.position.set(7, 1.2, 2);
  world.add(new AmbientLight(C.ivory, 0.55), key, rimLight, fill);

  const glowTex = tex(glowTexture(doc));
  const dashTex = tex(dashTexture(doc));
  const sheenTex = tex(sheenTexture(doc));
  const bandTex = tex(ringBandTexture(doc));

  const basic = (params: ConstructorParameters<typeof MeshBasicMaterial>[0]) => {
    const m = own(new MeshBasicMaterial(params));
    if (params && 'map' in params && !params.map) m.visible = false; // no 2D canvas: leave the decoration out
    return m;
  };
  const additive = (map: Texture | null, color: number = 0xffffff, opacity = 1) =>
    basic({ map, color, opacity, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false });

  // ---------------------------------------------------------------------------------------------- the sky (own pass)
  const sky = new Scene();
  const skyCam = new PerspectiveCamera(r.fov, 16 / 9, 1, 4000);

  // The stars: the sparse field, plus a few brighter ones. Each twinkles at its own phase and rate (sky.ts, twinkleFor) in the
  // star shader, from one clock uniform: no loop over the stars in JavaScript.
  const starGeo = own(new BufferGeometry());
  {
    const S = SKY_MOTION.stars;
    const count = SKY.stars + S.bright;
    const pos = new Float32Array(count * 3);
    const tone = new Float32Array(count);
    const size = new Float32Array(count);
    const twinkle = new Float32Array(count * 3);
    const place = (i: number, y: number, a: number, brightness: number, px: number) => {
      const h = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * h * SKY.starRadius, y * SKY.starRadius, Math.sin(a) * h * SKY.starRadius], i * 3);
      tone[i] = brightness;
      size[i] = px;
    };
    const rand = mulberry32(0x5ca1ab1e);
    for (let i = 0; i < SKY.stars; i++) {
      // Uniform over the sky from just under the horizon (the haze hides those) to straight up.
      place(i, lerp(-0.03, 1, rand()), rand() * Math.PI * 2, 0.1 + 0.5 * rand() ** 2.2, SKY.starSize);
    }
    const brightRand = mulberry32(0xb51647);
    for (let i = SKY.stars; i < count; i++) {
      const y = Math.sin(lerp(8, 55, brightRand()) * (Math.PI / 180)); // well clear of the haze
      place(i, y, brightRand() * Math.PI * 2, lerp(0.68, 0.9, brightRand()), SKY.brightSize);
    }
    const twinkleRand = mulberry32(0x7e1e5c09);
    for (let i = 0; i < count; i++) {
      const t = twinkleFor(twinkleRand);
      twinkle.set([t.phase, t.rate, t.amplitude], i * 3);
    }
    starGeo.setAttribute('position', new BufferAttribute(pos, 3));
    starGeo.setAttribute('tone', new BufferAttribute(tone, 1));
    starGeo.setAttribute('starSize', new BufferAttribute(size, 1));
    starGeo.setAttribute('twinkle', new BufferAttribute(twinkle, 3));
  }
  const starMat = own(
    new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(C.ivory) },
        uTime: { value: 0 },
        uMotion: { value: 1 },
        uPixelRatio: { value: 1 },
      },
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  const stars = new Points(starGeo, starMat);
  sky.add(stars);

  // The planet: a low-poly sphere with latitude bands, shaded flat (per facet) by its own light, and a tilted ring system.
  const planetSystem = new Group();
  planetSystem.rotation.set(0.3, 0, -0.36); // tilt: its spin axis is the group's y
  const planetGeo = own(planetGeometry());
  const planetMat = own(
    new ShaderMaterial({
      uniforms: {
        uLight: { value: new Vector3() },
        uNight: { value: new Color(C.night) },
        uLit: { value: new Color(C.stone) },
        uTint: { value: new Color(C.brassDeep) },
        uRim: { value: new Color(C.ivory) },
      },
      vertexShader: PLANET_VERTEX,
      fragmentShader: PLANET_FRAGMENT,
    }),
  );
  const planet = new Mesh(planetGeo, planetMat);
  const planetRing = new Mesh(
    own(annulusGeometry(1.4, 2.1, 160)),
    basic({ map: bandTex, transparent: true, side: DoubleSide, depthWrite: false, fog: false }),
  );
  planetRing.rotation.x = -Math.PI / 2; // RingGeometry lies in xy; lay it in the planet's equator (xz)
  planetRing.renderOrder = 1;
  planetSystem.add(planet, planetRing);
  sky.add(planetSystem);

  // The haze: a band round the sky camera, opaque obsidian below the horizon and clear a few degrees above it, drawn over
  // the planet and the stars so the horizon has no edge.
  const haze = new Mesh(
    own(hazeGeometry(SKY.hazeRadius, 48)),
    own(
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: DoubleSide,
        fog: false,
      }),
    ),
  );
  haze.renderOrder = 2;
  sky.add(haze);

  // A shooting star now and then (sky.ts): one reusable quad, placed straight in device coordinates by its shader, with a
  // thin ivory head and a long brass-tinted tail fading to nothing. Over the stars and the haze, under the world. Hidden
  // between crossings, so it costs a draw call only while one flies.
  const cometGeo = own(new BufferGeometry());
  cometGeo.setAttribute('position', new BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  cometGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const cometMat = own(
    new ShaderMaterial({
      uniforms: {
        uHead: { value: new Vector2() },
        uDir: { value: new Vector2(1, 0) },
        uTail: { value: 0 },
        uAspect: { value: 16 / 9 },
        uPx: { value: 360 },
        uDpr: { value: 1 },
        uAlpha: { value: 0 },
        uHeadColor: { value: new Color(C.ivory) },
        uTailColor: { value: new Color(C.brass) },
      },
      vertexShader: COMET_VERTEX,
      fragmentShader: COMET_FRAGMENT,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  );
  const comet = new Mesh(cometGeo, cometMat);
  comet.frustumCulled = false;
  comet.visible = false;
  comet.renderOrder = 3;
  sky.add(comet);

  // ---------------------------------------------------------------------------------------------- the ground and the track
  const ground = new Mesh(own(stripsGeometry([[0, 900]], 40, -far - 300, -0.02)), basic({ color: C.obsidian }));
  const trackNear = 12;
  const trackFar = -far - 20;
  const track = new Mesh(own(stripsGeometry([[0, trackWidth]], trackNear, trackFar, 0)), basic({ color: C.track }));
  const laneX = lw / 2;
  const hairlineMat = (color: number, opacity: number) =>
    basic({ color, opacity, transparent: true, depthWrite: false });
  const laneLines = new Mesh(
    own(
      stripsGeometry(
        [
          [-laneX, 0.03],
          [laneX, 0.03],
        ],
        trackNear,
        trackFar,
        0.004,
      ),
    ),
    hairlineMat(C.ivory, 0.12),
  );
  if (dashTex) dashTex.repeat.set(1, (trackNear - trackFar) / DASH_PERIOD);
  const dashes = new Mesh(
    own(
      stripsGeometry(
        [
          [-laneX, 0.07],
          [laneX, 0.07],
        ],
        trackNear,
        trackFar,
        0.006,
      ),
    ),
    basic({ map: dashTex, color: C.ivory, opacity: 0.5, transparent: true, depthWrite: false }),
  );
  const edge = trackWidth / 2;
  const curbs = new Mesh(
    own(
      stripsGeometry(
        [
          [-edge, 0.06],
          [edge, 0.06],
        ],
        trackNear,
        trackFar,
        0.01,
      ),
    ),
    hairlineMat(C.ivory, 0.3),
  );
  const curbBrass = new Mesh(
    own(
      stripsGeometry(
        [
          [-edge + 0.22, 0.035],
          [edge - 0.22, 0.035],
        ],
        trackNear,
        trackFar,
        0.01,
      ),
    ),
    basic({ color: C.brass, opacity: 0.55, transparent: true, blending: AdditiveBlending, depthWrite: false }),
  );
  // The sheen: the vanishing point's light on the track, a soft streak brightest halfway to the horizon.
  const sheenMat = additive(sheenTex, C.brass, 0.1);
  const sheen = new Mesh(own(stripsGeometry([[0, trackWidth * 0.7]], -4, -120, 0.008)), sheenMat);
  world.add(ground, track, laneLines, dashes, curbs, curbBrass, sheen);

  // ---------------------------------------------------------------------------------------------- the ring tunnel
  const ringCount = r.ringCount;
  const ringMat = basic({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: DoubleSide,
    forceSinglePass: true, // additive: one pass looks the same as three's back-then-front pair, at half the triangles
  });
  const rings = own(
    new InstancedMesh(
      own(new RingGeometry(r.ringRadius - RING_WIDTH / 2, r.ringRadius + RING_WIDTH / 2, 96, 1)),
      ringMat,
      ringCount,
    ),
  );
  // Each ring's glow: a wider band round the hairline, soft across, additive brass at no more than half strength, brighter
  // towards the vanishing point, with a slow wave of light running down the tunnel (sky.ts, ringGlow). Depth-tested like the
  // hairline, so the obstacles and the rover hide it; it fades out over the last metres above the ground, so the ground does
  // not cut it square.
  const glows = own(
    new InstancedMesh(
      own(groundFade(annulusGeometry(r.ringRadius - RING_GLOW, r.ringRadius + RING_GLOW, 96), RING_HEIGHT, 2.5)),
      basic({
        map: tex(ringGlowTexture(doc)),
        vertexColors: true,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: DoubleSide,
        forceSinglePass: true,
      }),
      ringCount,
    ),
  );
  // Each ring's faint reflection on the track: a soft band across it, under the ring.
  const reflections = own(
    new InstancedMesh(own(stripsGeometry([[0, trackWidth * 0.95]], 0.4, -0.4, 0.009)), additive(glowTex), ringCount),
  );
  const black = new Color(0, 0, 0);
  for (const mesh of [rings, glows, reflections]) {
    mesh.frustumCulled = false;
    for (let i = 0; i < ringCount; i++) mesh.setColorAt(i, black); // makes instanceColor now, not in a frame
  }
  world.add(glows, rings, reflections);

  // ---------------------------------------------------------------------------------------------- the vanishing point
  const vpGlow = new Mesh(own(new PlaneGeometry(1, 1)), additive(glowTex, C.brass, 0.4));
  vpGlow.position.set(0, RING_HEIGHT + 0.4, -far + 6);
  vpGlow.scale.set(60, 22, 1);
  const vpCore = new Mesh(vpGlow.geometry, additive(glowTex, C.brassHighlight, 0.5));
  vpCore.position.set(0, RING_HEIGHT - 0.2, -far + 5);
  vpCore.scale.set(16, 7, 1);
  for (const m of [vpGlow, vpCore]) {
    (m.material as Material).depthTest = false;
    m.renderOrder = -1;
  }
  world.add(vpGlow, vpCore);

  // ---------------------------------------------------------------------------------------------- pickup glows
  const pickupGlows = own(new InstancedMesh(vpGlow.geometry, additive(glowTex), PICKUP_GLOWS));
  pickupGlows.count = 0;
  pickupGlows.frustumCulled = false;
  for (let i = 0; i < PICKUP_GLOWS; i++) pickupGlows.setColorAt(i, black);
  world.add(pickupGlows);

  // ---------------------------------------------------------------------------------------------- rocks
  const R = WORLD.rocks;
  const rockMat = own(new MeshLambertMaterial({ color: C.shade, flatShading: true }));
  const rimUniform = { value: new Color(C.ivory).multiplyScalar(0.22) };
  rockMat.onBeforeCompile = (shader) => {
    // A faint ivory rim on the edges that turn away from the camera and face up.
    shader.uniforms.uRim = rimUniform;
    shader.fragmentShader = `uniform vec3 uRim;\n${shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
      outgoingLight += uRim * pow(1.0 - facing, 3.0) * smoothstep(-0.1, 0.8, normal.y);
      #include <opaque_fragment>`,
    )}`;
  };
  rockMat.customProgramCacheKey = () => 'runner-rock-rim';
  const variants = 4;
  const rockMeshes: InstancedMesh[] = [];
  const rock = {
    variant: new Uint8Array(R.count),
    slot: new Uint8Array(R.count),
    x: new Float32Array(R.count),
    z: new Float32Array(R.count),
    size: new Float32Array(R.count),
    flat: new Float32Array(R.count),
    yaw: new Float32Array(R.count),
    tilt: new Float32Array(R.count),
  };
  {
    const rand = mulberry32(0x404);
    const perVariant = new Uint8Array(variants);
    for (let i = 0; i < R.count; i++) {
      const v = i % variants;
      rock.variant[i] = v;
      rock.slot[i] = perVariant[v]++;
      const side = rand() < 0.5 ? -1 : 1;
      const out = rand() ** 1.4;
      rock.x[i] = side * lerp(R.minX, R.maxX, out);
      rock.z[i] = ((i + rand() * 0.85) * R.loop) / R.count; // stratified: no clumps, no long empty stretches
      rock.size[i] = (0.7 + 1.6 * rand() ** 2) * (1 + out * 2.2); // bigger further out
      rock.flat[i] = 0.6 + 0.35 * rand();
      rock.yaw[i] = rand() * Math.PI * 2;
      rock.tilt[i] = (rand() - 0.5) * 0.4;
    }
    for (let v = 0; v < variants; v++) {
      const mesh = own(new InstancedMesh(own(rockGeometry(v)), rockMat, perVariant[v]));
      mesh.frustumCulled = false;
      rockMeshes.push(mesh);
      world.add(mesh);
    }
  }

  // ---------------------------------------------------------------------------------------------- motion
  const motion = new WorldMotion();
  const media = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  let reduced = media?.matches ?? false;
  const onMotionPref = () => {
    reduced = media?.matches ?? false;
  };
  media?.addEventListener?.('change', onMotionPref);
  let lastSteps = -1;
  const dummy = new Object3D();
  const m4 = new Matrix4();
  const tint = new Color();
  const brass = new Color(C.brass);
  const placed = { aspect: 0, fov: 0, planetR: 0 };

  // The shooting stars' own random generator: never the course's, so they cannot change a run.
  const atm = cfg.render.atmosphere;
  const skyRand = mulberry32(atm.seed || (Math.random() * 2 ** 32) >>> 0);
  const comets = new CometClock(skyRand, atm.firstComet);
  let path: CometPath | null = null;
  const waveMean = glowWaveMean();
  const v3 = new Vector3();
  const buffer = new Vector2();
  /** A new comet's path, fitted to the sky as the sky camera saw it in the last frame (its horizon, the planet). */
  const launch = () => {
    path = null;
    if (placed.planetR > 0) {
      const horizon = v3.set(0, 0, -SKY.planetDistance).add(skyCam.position).project(skyCam).y;
      v3.copy(planetSystem.position).project(skyCam);
      path = cometPath(skyRand, { aspect: skyCam.aspect, horizon, planet: { x: v3.x, y: v3.y, r: placed.planetR } });
    }
    if (!path) comets.cancel();
  };

  return {
    update(sim, alpha) {
      if (lastSteps < 0) lastSteps = sim.steps;
      const n = Math.min(WORLD.maxCatchUpSteps, Math.max(0, sim.steps - lastSteps));
      lastSteps = sim.steps;
      // Shooting stars only in the idle scene and a run: never after a crash (the scene dims) or under reduced motion.
      const cometsAllowed = !reduced && sim.phase !== 'over';
      for (let i = 0; i < n; i++) {
        motion.step(cfg.step, sim.phase, sim.speed, reduced);
        if (comets.step(cfg.step, cometsAllowed)) launch();
      }
      const offset = motion.offsetAt(alpha);
      const bright = 1 - motion.dim;
      fog.near = lerp(r.fog.near, WORLD.closedFog.near, motion.veil);
      fog.far = lerp(far, WORLD.closedFog.far, motion.veil);
      const pulse = motion.pulse();

      // Rings and their reflections: recycled slots, faded in from the fog and out before the camera.
      const W = WORLD.rings;
      for (let i = 0; i < ringCount; i++) {
        const z = slotZ(i, r.ringSpacing, ringCount, offset, W.zNear);
        const fade = distanceFade(-z, W.fadeNear, W.fadeFar) * bright;
        const wave = reduced ? waveMean : glowWave(-z, motion.time);
        m4.makeTranslation(0, RING_HEIGHT, z);
        rings.setMatrixAt(i, m4);
        rings.setColorAt(i, tint.copy(brass).multiplyScalar(fade * (0.62 + 0.2 * pulse + SKY_MOTION.glow.core * wave)));
        glows.setMatrixAt(i, m4);
        glows.setColorAt(i, tint.copy(brass).multiplyScalar(fade * ringGlow(-z, motion.time, reduced)));
        reflections.setMatrixAt(i, m4.makeTranslation(0, 0, z));
        reflections.setColorAt(i, tint.copy(brass).multiplyScalar(fade * (0.14 + 0.08 * wave)));
      }
      for (const mesh of [rings, glows, reflections]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }

      if (dashTex) dashTex.offset.y = wrap(offset / DASH_PERIOD, 1);
      sheenMat.opacity = (0.09 + 0.05 * pulse) * bright;
      (vpGlow.material as MeshBasicMaterial).opacity = (0.32 + 0.14 * pulse) * bright;
      (vpCore.material as MeshBasicMaterial).opacity = (0.45 + 0.2 * pulse) * bright;

      // Rocks scroll round their loop with the world.
      for (let i = 0; i < R.count; i++) {
        const s = rock.size[i];
        const h = s * rock.flat[i];
        dummy.position.set(rock.x[i], -h * 0.18, R.zNear - wrap(rock.z[i] - offset, R.loop));
        dummy.rotation.set(rock.tilt[i], rock.yaw[i], rock.tilt[i] * 0.5);
        dummy.scale.set(s, h, s * 0.85);
        dummy.updateMatrix();
        rockMeshes[rock.variant[i]].setMatrixAt(rock.slot[i], dummy.matrix);
      }
      for (const mesh of rockMeshes) mesh.instanceMatrix.needsUpdate = true;

      // A soft glow behind each pickup dot, from the sim's own list (drawn as render.ts draws the dots).
      const d = lerp(sim.prev.distance, sim.distance, alpha);
      let g = 0;
      for (const p of sim.items) {
        if (p.taken) continue;
        const ahead = p.z - d;
        if (ahead > far + 10 || g >= PICKUP_GLOWS) break;
        dummy.position.set(p.lane * lw, p.y, -ahead - 0.25);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1.5, 1.5, 1);
        dummy.updateMatrix();
        pickupGlows.setMatrixAt(g, dummy.matrix);
        const fade = distanceFade(ahead, [-4, 0], [fog.near, fog.far]);
        pickupGlows.setColorAt(g, tint.copy(brass).multiplyScalar(0.55 * bright * fade));
        g++;
      }
      pickupGlows.count = g;
      pickupGlows.instanceMatrix.needsUpdate = true;
      if (pickupGlows.instanceColor) pickupGlows.instanceColor.needsUpdate = true;

      // The sky's clock: the stars' twinkle, the planet's and its rings' turn (all still under reduced motion).
      starMat.uniforms.uTime.value = wrap(motion.time, SKY_MOTION.stars.loop);
      starMat.uniforms.uMotion.value = reduced ? 0 : 1;
      const turn = planetAngles(motion.time);
      planet.rotation.y = turn.body;
      planetRing.rotation.z = turn.rings; // about the ring's own normal: the planet's spin axis

      // The shooting star in flight: its head along the path, its tail growing to full length behind it.
      const u = path ? comets.progress(alpha) : -1;
      comet.visible = u >= 0 && !!path;
      if (path && comet.visible) {
        const cu = cometMat.uniforms;
        const aspect = skyCam.aspect;
        cu.uAspect.value = aspect;
        cu.uHead.value.set(lerp(path.x0, path.x1, u), lerp(path.y0, path.y1, u));
        const back = cu.uDir.value.set((path.x0 - path.x1) * aspect, path.y0 - path.y1); // in half-heights
        const length = back.length();
        back.divideScalar(length);
        cu.uTail.value = Math.min(path.tail, length * u);
        cu.uAlpha.value = cometEnvelope(u);
      }
    },

    drawSky(camera) {
      camera.updateMatrixWorld();
      camera.getWorldQuaternion(skyCam.quaternion);
      skyCam.position.copy(camera.position).multiplyScalar(0.02); // barely shifts with the camera
      if (camera.aspect !== placed.aspect || camera.fov !== placed.fov) {
        placed.aspect = skyCam.aspect = camera.aspect;
        placed.fov = skyCam.fov = camera.fov;
        skyCam.updateProjectionMatrix();
        const p = planetPlacement(camera.aspect, camera.fov);
        const D = SKY.planetDistance;
        planetSystem.position.set(
          Math.sin(p.azimuth) * Math.cos(p.elevation) * D,
          Math.sin(p.elevation) * D,
          -Math.cos(p.azimuth) * Math.cos(p.elevation) * D,
        );
        planetSystem.scale.setScalar(Math.tan(p.radius) * D);
        placed.planetR = Math.tan(p.radius) / Math.tan((camera.fov * Math.PI) / 360); // in half-heights of the view
      }
      skyCam.updateMatrixWorld();
      const dpr = renderer.getPixelRatio();
      starMat.uniforms.uPixelRatio.value = dpr;
      if (comet.visible) {
        cometMat.uniforms.uDpr.value = dpr;
        cometMat.uniforms.uPx.value = renderer.getDrawingBufferSize(buffer).y / 2;
      }
      planetMat.uniforms.uLight.value.copy(PLANET_LIGHT).transformDirection(skyCam.matrixWorldInverse);

      renderer.info.reset();
      renderer.clear();
      renderer.render(sky, skyCam);
      renderer.clearDepth();
    },

    info() {
      const { render, memory } = renderer.info;
      return {
        scroll: motion.offset,
        worldSpeed: motion.speed,
        reducedMotion: reduced,
        triangles: render.triangles,
        calls: render.calls,
        points: render.points,
        geometries: memory.geometries,
        textures: memory.textures,
        skyTime: motion.time,
        comets: comets.count,
        cometFlying: comet.visible,
      };
    },

    dispose() {
      media?.removeEventListener?.('change', onMotionPref);
      scene.remove(world);
      world.clear();
      sky.clear();
      for (const x of owned) x.dispose();
      owned.length = 0;
    },
  };
}

// ------------------------------------------------------------------------------------------------ geometry

/** Flat strips on the ground, one quad each ([centre x, width]), from zNear to zFar at height y. UV: u across, v along. */
function stripsGeometry(strips: [number, number][], zNear: number, zFar: number, y: number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  strips.forEach(([x, w], i) => {
    const a = x - w / 2;
    const b = x + w / 2;
    pos.push(a, y, zNear, b, y, zNear, b, y, zFar, a, y, zFar);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const o = i * 4;
    index.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(index);
  return g;
}

/** A unit low-poly sphere (320 facets) with a `band` value per facet: latitude bands, a little uneven. Spin axis: y. */
function planetGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(1, 2); // non-indexed: three corners per facet
  const pos = g.getAttribute('position');
  const band = new Float32Array(pos.count);
  const rand = mulberry32(0x91a7e7);
  for (let f = 0; f < pos.count; f += 3) {
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const lat = Math.asin(Math.max(-1, Math.min(1, cy / 0.95)));
    const wave = 0.5 + 0.5 * Math.sin(lat * 9 + 1.4 * Math.sin(lat * 3.3));
    const value = Math.max(0, Math.min(1, wave * 0.85 + (rand() - 0.5) * 0.3));
    band.fill(value, f, f + 3);
  }
  g.setAttribute('band', new BufferAttribute(band, 1));
  return g;
}

/**
 * A flat annulus whose u runs from the inner edge (0) to the outer (1) and v once round (0 to 1, no seam: the last column of
 * vertices is its own copy of the first). The planet's rings and the tunnel rings' glow.
 */
function annulusGeometry(inner: number, outer: number, segments: number): BufferGeometry {
  const g = new RingGeometry(inner, outer, segments, 1);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const radius = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (radius - inner) / (outer - inner), (i % (segments + 1)) / segments);
  }
  return g;
}

/** Vertex colours that fade `g` (drawn `lift` metres up) from clear at the ground to full `over` metres above it. */
function groundFade<T extends BufferGeometry>(g: T, lift: number, over: number): T {
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) + lift) / over));
    col.fill(t * t * (3 - 2 * t), i * 3, i * 3 + 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

/** The horizon haze: an open band round the origin, obsidian, opaque up to just above the horizon, then clear. */
function hazeGeometry(radius: number, segments: number): BufferGeometry {
  const rows: [number, number][] = [
    [-2, 1], // the ground covers everything under about -0.4 degrees; a thin band keeps the overdraw small
    [-0.4, 1],
    [1, 0.72],
    [2.6, 0.32],
    [4.6, 0.08],
    [7, 0],
  ]; // [elevation in degrees, opacity]
  const bg = new Color(C.obsidian);
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  rows.forEach(([deg, a]) => {
    const y = Math.tan((deg * Math.PI) / 180) * radius;
    for (let s = 0; s <= segments; s++) {
      const t = (s / segments) * Math.PI * 2;
      pos.push(Math.cos(t) * radius, y, Math.sin(t) * radius);
      col.push(bg.r, bg.g, bg.b, a);
    }
  });
  const stride = segments + 1;
  for (let row = 0; row < rows.length - 1; row++) {
    for (let s = 0; s < segments; s++) {
      const a = row * stride + s;
      const b = a + stride;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 4));
  g.setIndex(index);
  return g;
}

/** A unit rock, faceted: a polyhedron with its corners pushed in and out (shared corners move together, faces stay closed). */
function rockGeometry(variant: number): BufferGeometry {
  const g = variant % 2 ? new IcosahedronGeometry(1, 0) : new DodecahedronGeometry(1, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = (Math.round(x * 997) * 73856093) ^ (Math.round(y * 997) * 19349663) ^ (Math.round(z * 997) * 83492791);
    const rand = mulberry32((key ^ (variant * 0x9e3779b9)) >>> 0);
    const k = 0.72 + 0.5 * rand();
    pos.setXYZ(i, x * k, Math.max(-0.35, y * k), z * k); // a flattish base
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------------------------------------ textures (tiny canvases)

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function canvasTexture(
  doc: Document,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): CanvasTexture | null {
  const canvas = doc.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A soft round glow, white with a gaussian-like falloff to clear (the material's colour tints it). */
function glowTexture(doc: Document): CanvasTexture | null {
  return canvasTexture(doc, 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    const stops = [1, 0.62, 0.32, 0.14, 0.05, 0];
    stops.forEach((a, i) => g.addColorStop(i / (stops.length - 1), `rgba(255,255,255,${a})`));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Lane dashes: half dash, half gap, repeated along the track and scrolled by the world's offset. */
function dashTexture(doc: Document): CanvasTexture | null {
  const t = canvasTexture(doc, 4, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 2, 4, 28);
  });
  if (t) t.wrapT = RepeatWrapping;
  return t;
}

/** The track's sheen: clear at both ends, brightest a little past halfway, soft across. */
function sheenTexture(doc: Document): CanvasTexture | null {
  return canvasTexture(doc, 64, 128, (ctx) => {
    const img = ctx.createImageData(64, 128);
    for (let y = 0; y < 128; y++) {
      const v = 1 - y / 127; // canvas rows run top (far, v = 1) to bottom (near)
      const along = Math.sin(Math.PI * v ** 1.3) ** 2;
      for (let x = 0; x < 64; x++) {
        const u = (x - 31.5) / 32;
        const a = along * Math.exp(-u * u * 5);
        img.data.set([255, 255, 255, Math.round(a * 255)], (y * 64 + x) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** A tunnel ring's glow across its width: white, brightest on the hairline (the middle), a soft gaussian falloff to clear. */
function ringGlowTexture(doc: Document): CanvasTexture | null {
  return canvasTexture(doc, 64, 1, (ctx) => {
    const img = ctx.createImageData(64, 1);
    for (let i = 0; i < 64; i++) {
      const x = (i + 0.5) / 32 - 1; // -1 at the inner edge, 1 at the outer
      const a = Math.exp(-((x / 0.5) ** 2));
      img.data.set([255, 255, 255, Math.round(a * 255)], i * 4);
    }
    ctx.putImageData(img, 0, 0);
  });
}

/**
 * The planet's rings across their width (u): a few bands of ivory and faint brass, with gaps; and round them (v), a gentle
 * unevenness, denser and thinner arcs, so their slow turn can be seen.
 */
function ringBandTexture(doc: Document): CanvasTexture | null {
  const rows = 64;
  return canvasTexture(doc, 256, rows, (ctx) => {
    const bands: [number, number, number, number][] = [
      // [start, end, colour, alpha], u from the inner edge (0) to the outer (1)
      [0.0, 0.12, C.ivory, 0.06],
      [0.14, 0.34, C.ivory, 0.18],
      [0.36, 0.42, C.brass, 0.26],
      [0.47, 0.7, C.ivory, 0.13],
      [0.72, 0.76, C.brass, 0.3],
      [0.8, 0.97, C.ivory, 0.07],
    ];
    for (let row = 0; row < rows; row++) {
      // Whole waves round the circle, so the first row meets the last with no seam.
      const v = (row / rows) * Math.PI * 2;
      const density = 1 + 0.22 * (0.6 * Math.sin(2 * v + 0.7) + 0.4 * Math.sin(5 * v + 2.1));
      for (const [a, b, color, alpha] of bands) {
        ctx.globalAlpha = Math.min(1, alpha * density);
        ctx.fillStyle = hex(color);
        ctx.fillRect(Math.round(a * 256), row, Math.max(1, Math.round((b - a) * 256)), 1);
      }
    }
  });
}

// ------------------------------------------------------------------------------------------------ the planet's shader

const PLANET_VERTEX = /* glsl */ `
attribute float band;
varying vec3 vViewPos;
varying float vBand;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vBand = band;
  gl_Position = projectionMatrix * mv;
}`;

// Flat shading from the screen-space derivatives (one normal per facet), a soft terminator, and a thin ivory limb on the lit
// side. Colours are uniforms in linear space; the last two includes convert to the canvas's output, as three's own do.
const PLANET_FRAGMENT = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uNight;
uniform vec3 uLit;
uniform vec3 uTint;
uniform vec3 uRim;
varying vec3 vViewPos;
varying float vBand;
void main() {
  vec3 n = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
  vec3 v = normalize(-vViewPos);
  float light = dot(n, uLight);
  float day = smoothstep(-0.15, 0.85, light);
  vec3 surface = mix(uLit, uTint, vBand * 0.75) * 0.5;
  vec3 color = mix(uNight, surface, day);
  float limb = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0) * smoothstep(0.0, 0.5, light);
  color += uRim * limb * 0.2;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------------------------------------ the stars' shader

// Each star's brightness swings round its own (sky.ts, twinkleFor): 1 + amplitude · sin(phase + rate · time), never a loop in
// JavaScript. uMotion is 0 under reduced motion (every star at its average). The field's stars are the same 1.6 px squares
// as before; the few bright ones are larger and round, with a soft edge. Added over the obsidian sky.
const STAR_VERTEX = /* glsl */ `
attribute float tone;
attribute float starSize;
attribute vec3 twinkle;
uniform float uTime;
uniform float uMotion;
uniform float uPixelRatio;
varying float vTone;
varying float vSoft;
void main() {
  vTone = tone * (1.0 + uMotion * twinkle.z * sin(twinkle.x + twinkle.y * uTime));
  vSoft = step(2.0, starSize);
  gl_PointSize = starSize * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const STAR_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vTone;
varying float vSoft;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float mask = mix(1.0, 1.0 - smoothstep(0.3, 1.0, d), vSoft);
  gl_FragColor = vec4(uColor * vTone, mask);
  #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------------------------------------ the shooting star's shader

// The quad is placed in device coordinates, not by the camera: position.x runs from just ahead of the head (0) to just past
// the tail's end (1), position.y across (-1 to 1). Lengths are in half-heights of the view (uPx device pixels each), so the
// streak keeps its angle at any aspect. The fragment draws, in device pixels: a thin ivory core that tapers and fades down
// the tail into brass, and a small round head.
const COMET_VERTEX = /* glsl */ `
uniform vec2 uHead;
uniform vec2 uDir;
uniform float uTail;
uniform float uAspect;
uniform float uPx;
uniform float uDpr;
varying vec2 vPx;
varying float vT;
void main() {
  float pad = 6.0 * uDpr / uPx;
  float along = mix(-pad, uTail + pad, position.x);
  float across = position.y * pad;
  vec2 p = uHead * vec2(uAspect, 1.0) + uDir * along + vec2(-uDir.y, uDir.x) * across;
  vPx = vec2(along, across) * uPx;
  vT = along / max(uTail, 1e-4);
  gl_Position = vec4(p.x / uAspect, p.y, 0.0, 1.0);
}`;

const COMET_FRAGMENT = /* glsl */ `
uniform float uAlpha;
uniform float uDpr;
uniform vec3 uHeadColor;
uniform vec3 uTailColor;
varying vec2 vPx;
varying float vT;
void main() {
  float t = clamp(vT, 0.0, 1.0);
  float width = mix(0.75, 0.35, t) * uDpr;
  float core = exp(-0.5 * vPx.y * vPx.y / (width * width));
  float tail = core * pow(1.0 - t, 2.0) * smoothstep(-uDpr, 0.0, vPx.x);
  float head = exp(-dot(vPx, vPx) / (2.6 * uDpr * uDpr));
  vec3 color = mix(uHeadColor, uTailColor, smoothstep(0.02, 0.35, t)) * tail * 0.55 + uHeadColor * head * 0.9;
  gl_FragColor = vec4(color * uAlpha, 1.0);
  #include <colorspace_fragment>
}`;
