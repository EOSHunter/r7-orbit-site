// The rover (docs/RUNNER.md, "The rover"): the model from assets/rover.glb (built by tools/runner/build_rover.py), its
// animation, its brass dust trail and the crash burst. Read-only over the sim: every motion here is drawn from the sim's
// interpolated state and the frame's dt, and nothing is written back.
//
// The model loads after the game starts (the file is a hashed asset next to the lazy chunk). Until it arrives, or if it
// never does, a primitive rover with the same node names stands in, so the animation code is the same for both.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import roverUrl from './assets/rover.glb?url';
import { RUNNER_COLORS as C, RUNNER_CONFIG, jumpPhysics, type RunnerConfig } from './config';
import { mulberry32 } from './random';
import type { RunnerSim } from './sim';

// ---- the model (numbers from build_rover.py) -------------------------------------------------------------------------
/** Width of rover.glb across the wheels, in its own metres. */
const MODEL_WIDTH = 1.69;
/** Wheel radius in the model, to the tread blocks. */
const MODEL_WHEEL_RADIUS = 0.33;
/** The rover is drawn this share of a lane wide (it fits the lane with room either side). */
const WIDTH_OF_LANE = 0.6;
/** Rear wheels' contact patches in the model (x, z), where the dust trail starts. */
const MODEL_REAR_WHEEL = { x: 0.7, z: 0.95 };
/** The nose in the model (z), where a crash burst starts. */
const MODEL_NOSE_Z = -1.25;
const WHEELS = ['wheel_FL', 'wheel_ML', 'wheel_RL', 'wheel_FR', 'wheel_MR', 'wheel_RR'];

// ---- motion (world metres, radians, seconds) --------------------------------------------------------------------------
const deg = Math.PI / 180;
/** Suspension: how far the body bobs at the cap, how often per metre driven. */
const BOB_AMPLITUDE = 0.012;
const BOB_PER_METRE = 2.6;
/** Rockers and bogies rock this much at the cap (the wheels follow the ground). */
const ROCKER_SWING = 0.9 * deg;
const BOGIE_SWING = 1.4 * deg;
/** The body's spring on its suspension: stiffness (1/s²) and damping ratio (1 = no overshoot). */
const BODY_STIFFNESS = 420;
const BODY_DAMPING = 0.45;
/** Landing: the body dips at this speed (m/s); harder when the landing slams into a slide. */
const LAND_KICK = 0.55;
const SLAM_KICK = 0.8;
/** Slide: the body sinks this far and tips forward; the antenna folds back flat. */
const SLIDE_DROP = 0.08;
const SLIDE_PITCH = 2.5 * deg;
const SLAM_PITCH_KICK = 0.35;
const ANTENNA_FOLD = 78 * deg;
const ANTENNA_RATE = 22;
/** In the air the whole rover tips back up to this much while rising, forward a little while falling. */
const AIR_PITCH = 4 * deg;
const PITCH_STIFFNESS = 160;
const PITCH_DAMPING = 0.7;
/** Lane change: the rover yaws towards the new lane and the body rolls away from the turn, then both ease back. */
const LANE_YAW = 7 * deg;
const LANE_YAW_RATE = 14;
const LANE_ROLL = 3 * deg;
const ROLL_STIFFNESS = 180;
const ROLL_DAMPING = 0.55;
/** The beacon: emissive intensity at rest and at the top of a pulse, and the pulse rate at the start speed and the cap. */
const BEACON_BASE = 0.75;
const BEACON_PULSE = 0.75;
const BEACON_HZ_MIN = 0.6;
const BEACON_HZ_MAX = 2.4;
const BEACON_FLASH = 2.5;
const HALO_SIZE = 0.62;
const HALO_OPACITY = 0.32;
/** The dust trail: pool size, particles per second (base + per m/s), lifetime, size, brightness. */
const TRAIL_POOL = 120;
const TRAIL_RATE = 26;
const TRAIL_RATE_PER_SPEED = 2.2;
const TRAIL_LIFE = 0.42;
const TRAIL_SIZE = 0.13;
const TRAIL_INTENSITY = 0.4;
const CRASH_DUST = 36;
/** The crash: shards in the burst, how long it lasts, and the rover's tumble (push back, hop, pitch, roll, yaw). */
const BURST_SHARDS = 22;
const BURST_TIME = 0.55;
const TUMBLE_PUSH = 0.45;
const TUMBLE_HOP = 0.22;
const TUMBLE_HOP_TIME = 0.32;
const TUMBLE_PITCH = 5 * deg;
const TUMBLE_PITCH_PEAK = 10 * deg;
const TUMBLE_ROLL = 7 * deg;
const TUMBLE_YAW = 9 * deg;

export interface RoverOptions {
  /** Prefers-reduced-motion, read each frame: no bounce, pitch, roll or tumble (wheel spin and the trail stay). */
  reducedMotion?: () => boolean;
  /** Where the model is (default: the hashed rover.glb). The tests point it at a missing file. */
  url?: string;
}

export interface Rover {
  /** Add this to the scene: the rover, its trail and its crash burst. */
  readonly object: Group;
  /** True once the model has replaced the stand-in, false if it failed (the stand-in stays). */
  readonly loaded: Promise<boolean>;
  /** Pose and animate from the sim. `dt` is 0 during the hit-stop; `impact` is the frame the crash effects start. */
  update(sim: RunnerSim, alpha: number, dt: number, impact: boolean): void;
  dispose(): void;
}

interface Rig {
  model: Object3D;
  body: Object3D | null;
  bodyRestY: number;
  wheels: Object3D[];
  rockers: Object3D[];
  bogies: Object3D[];
  antenna: Object3D | null;
}

/** A damped spring, stepped in small fixed slices so it behaves the same at any frame rate. */
class Spring {
  value = 0;
  velocity = 0;
  constructor(
    private readonly stiffness: number,
    public damping: number,
  ) {}
  step(target: number, dt: number): void {
    const c = 2 * Math.sqrt(this.stiffness) * this.damping;
    for (let left = dt; left > 1e-6; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      this.velocity += (-this.stiffness * (this.value - target) - c * this.velocity) * h;
      this.value += this.velocity * h;
    }
  }
  reset(): void {
    this.value = 0;
    this.velocity = 0;
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const damp = (cur: number, target: number, rate: number, dt: number) => target + (cur - target) * Math.exp(-rate * dt);

export function createRover(cfg: RunnerConfig = RUNNER_CONFIG, opts: RoverOptions = {}): Rover {
  const reducedMotion = opts.reducedMotion ?? (() => false);
  const scale = (cfg.track.laneWidth * WIDTH_OF_LANE) / MODEL_WIDTH;
  const lw = cfg.track.laneWidth;
  const { takeoff } = jumpPhysics(cfg);
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(thing: T) => (owned.push(thing), thing);

  const object = new Group();
  object.name = 'rover_view';
  const holder = new Group(); // posed each frame: lane, height, yaw, tumble
  holder.scale.setScalar(scale);
  holder.rotation.order = 'YXZ'; // yaw on the track first, then pitch and roll
  object.add(holder);

  const glowTexture = makeGlowTexture();
  if (glowTexture) own(glowTexture);
  const beaconMaterial = own(
    new MeshStandardMaterial({
      color: C.brass,
      emissive: C.brassHighlight,
      emissiveIntensity: BEACON_BASE,
      roughness: 0.4,
      metalness: 0,
      flatShading: true,
    }),
  );
  const halo = glowTexture
    ? new Sprite(
        own(
          new SpriteMaterial({
            map: glowTexture,
            color: C.brass,
            transparent: true,
            opacity: HALO_OPACITY,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
        ),
      )
    : null;
  halo?.scale.setScalar(HALO_SIZE);

  let rig = rigOf(buildStandIn(own, beaconMaterial));
  holder.add(rig.model);
  attachHalo(rig.model);

  // ---- loading -------------------------------------------------------------------------------------------------------
  let disposed = false;
  const loaded = new GLTFLoader()
    .loadAsync(opts.url ?? roverUrl)
    .then((gltf) => {
      const model = gltf.scene;
      const paint = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, flatShading: true });
      const replaced = new Set<Material>();
      model.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        for (const m of Array.isArray(node.material) ? node.material : [node.material]) replaced.add(m);
        node.material = node.name === 'beacon' ? beaconMaterial : paint;
      });
      for (const m of replaced) m.dispose();
      if (disposed) {
        disposeTree(model);
        paint.dispose();
        return false;
      }
      own(paint);
      model.traverse((node) => {
        if (node instanceof Mesh) own(node.geometry);
      });
      const old = rig.model;
      holder.remove(old);
      disposeTree(old);
      rig = rigOf(model);
      holder.add(model);
      attachHalo(model);
      return true;
    })
    .catch(() => false); // a missing or broken file: the stand-in stays, and nothing is thrown

  function attachHalo(model: Object3D) {
    const beacon = model.getObjectByName('beacon');
    if (halo && beacon) beacon.add(halo);
  }

  // ---- trail: a fixed pool of additive brass points; a dead point is black (adds nothing) --------------------------------
  const rand = mulberry32(0x5eed);
  const trailPos = new Float32Array(TRAIL_POOL * 3);
  const trailCol = new Float32Array(TRAIL_POOL * 3);
  const trailVel = new Float32Array(TRAIL_POOL * 3);
  const trailAge = new Float32Array(TRAIL_POOL).fill(1);
  const trailLife = new Float32Array(TRAIL_POOL).fill(1);
  const trailGeo = own(new BufferGeometry());
  trailGeo.setAttribute('position', new BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new BufferAttribute(trailCol, 3));
  const trail = new Points(
    trailGeo,
    own(
      new PointsMaterial({
        size: TRAIL_SIZE,
        ...(glowTexture ? { map: glowTexture } : {}),
        vertexColors: true,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  trail.frustumCulled = false;
  object.add(trail);
  const brass = new Color(C.brass);
  let nextParticle = 0;
  let emitDebt = 0;

  const spawn = (px: number, py: number, pz: number, vx: number, vy: number, vz: number, life: number) => {
    const i = nextParticle;
    nextParticle = (nextParticle + 1) % TRAIL_POOL;
    trailPos.set([px, py, pz], i * 3);
    trailVel.set([vx, vy, vz], i * 3);
    trailAge[i] = 0;
    trailLife[i] = life;
  };

  // ---- crash burst: angular brass shards (thin triangles) flying out from the nose ---------------------------------------
  const burstPos = new Float32Array(BURST_SHARDS * 9);
  const burstCol = new Float32Array(BURST_SHARDS * 9);
  const burstGeo = own(new BufferGeometry());
  burstGeo.setAttribute('position', new BufferAttribute(burstPos, 3));
  burstGeo.setAttribute('color', new BufferAttribute(burstCol, 3));
  const burst = new Mesh(
    burstGeo,
    own(
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    ),
  );
  burst.frustumCulled = false;
  burst.visible = false;
  object.add(burst);
  const shards: { dx: number; dy: number; dz: number; reach: number; length: number; width: number }[] = [];
  const burstOrigin = { x: 0, y: 0, z: 0 };
  const highlight = new Color(C.brassHighlight);

  // ---- state ---------------------------------------------------------------------------------------------------------
  const bodySpring = new Spring(BODY_STIFFNESS, BODY_DAMPING);
  const pitchSpring = new Spring(PITCH_STIFFNESS, PITCH_DAMPING);
  const airPitchSpring = new Spring(PITCH_STIFFNESS, PITCH_DAMPING);
  const rollSpring = new Spring(ROLL_STIFFNESS, ROLL_DAMPING);
  let spin = 0;
  let lastD = 0;
  let yaw = 0;
  let fold = 0;
  let pulse = 0;
  let flash = 0;
  let wasAirborne = false;
  let crashT = -1;
  let crashSide = 1;
  let lastRun = -1;
  let burstT = -1;

  const resetRun = () => {
    bodySpring.reset();
    pitchSpring.reset();
    airPitchSpring.reset();
    rollSpring.reset();
    yaw = 0;
    fold = 0;
    flash = 0;
    crashT = -1;
    burstT = -1;
    burst.visible = false;
    wasAirborne = false;
    trailAge.fill(1);
    trailCol.fill(0);
    lastD = 0;
  };

  const startCrash = (sim: RunnerSim, x: number, y: number, rm: boolean) => {
    crashT = 0;
    flash = 1;
    const hit = sim.crash ? sim.crash.lane * lw : x;
    crashSide = x >= hit ? 1 : -1;
    // The burst starts at the nose, at mid height.
    burstOrigin.x = x;
    burstOrigin.y = y + 0.55;
    burstOrigin.z = MODEL_NOSE_Z * scale;
    burstT = 0;
    shards.length = 0;
    for (let i = 0; i < BURST_SHARDS; i++) {
      const a = (i / BURST_SHARDS) * Math.PI * 2 + rand() * 0.3;
      const up = 0.15 + rand() * 0.9;
      const len = Math.hypot(Math.cos(a), up, 0.6);
      shards.push({
        dx: Math.cos(a) / len,
        dy: (up * (Math.sin(a) > -0.5 ? 1 : 0.3)) / len,
        dz: (0.25 + rand() * 0.6) / len,
        reach: 0.7 + rand() * 1.1,
        length: 0.25 + rand() * 0.35,
        width: 0.035 + rand() * 0.03,
      });
    }
    burst.visible = true;
    // Dust thrown up by the impact, in the same pool as the trail.
    for (let i = 0; i < CRASH_DUST; i++) {
      const a = rand() * Math.PI * 2;
      const s = 1 + rand() * 2.5;
      spawn(
        x,
        y + 0.15,
        burstOrigin.z,
        Math.cos(a) * s,
        0.6 + rand() * 1.8,
        Math.abs(Math.sin(a)) * s * 0.6,
        0.5 + rand() * 0.3,
      );
    }
    if (rm) crashT = Infinity; // reduced motion: no tumble, the rover stays where it stopped
  };

  return {
    object,
    loaded,

    update(sim, alpha, dt, impact) {
      const rm = reducedMotion();
      const d = lerp(sim.prev.distance, sim.distance, alpha);
      const x = lerp(sim.prev.x, sim.x, alpha);
      const y = lerp(sim.prev.y, sim.y, alpha);
      if (sim.run !== lastRun) {
        resetRun();
        lastRun = sim.run;
      }
      if (sim.phase !== 'over' && (crashT >= 0 || burstT >= 0)) resetRun();
      const playing = sim.phase === 'playing';
      const speedT = clamp((sim.speed - cfg.speed.start) / (cfg.speed.max - cfg.speed.start), 0, 1);

      // Wheels: the distance driven since the last frame over the wheel's radius. Exact at any frame rate.
      const dd = d - lastD;
      lastD = d;
      if (dd > 0 && dd < 10) spin -= dd / (MODEL_WHEEL_RADIUS * scale);
      for (const w of rig.wheels) w.rotation.x = spin;

      // Air and landing.
      const airborne = y > 1e-3;
      if (wasAirborne && !airborne && playing && !rm) {
        bodySpring.velocity -= sim.sliding ? SLAM_KICK : LAND_KICK;
        if (sim.sliding) pitchSpring.velocity -= SLAM_PITCH_KICK;
      }
      wasAirborne = airborne;

      // Reduced motion: critically damped, so the slide's drop has no bounce.
      bodySpring.damping = rm ? 1 : BODY_DAMPING;
      rollSpring.damping = rm ? 1 : ROLL_DAMPING;
      const bob = rm || !playing || airborne ? 0 : BOB_AMPLITUDE * (0.35 + 0.65 * speedT) * Math.sin(d * BOB_PER_METRE);
      bodySpring.step((sim.sliding ? -SLIDE_DROP : 0) + bob, dt);
      pitchSpring.step(rm || !sim.sliding ? 0 : -SLIDE_PITCH, dt);
      airPitchSpring.step(rm || !airborne ? 0 : AIR_PITCH * clamp(sim.vy / takeoff, -0.5, 1), dt);
      const lane = playing ? clamp((sim.lane * lw - x) / lw, -1, 1) : 0;
      yaw = damp(yaw, -LANE_YAW * lane, LANE_YAW_RATE, dt);
      rollSpring.step(rm ? 0 : LANE_ROLL * lane, dt);
      fold = damp(fold, sim.sliding ? ANTENNA_FOLD : 0, ANTENNA_RATE, dt);

      // The beacon breathes, faster with speed; a crash flashes it.
      pulse += dt * 2 * Math.PI * lerp(BEACON_HZ_MIN, BEACON_HZ_MAX, playing ? speedT : 0);
      const glow = 0.5 + 0.5 * Math.sin(pulse);
      flash = damp(flash, 0, 6, dt);
      beaconMaterial.emissiveIntensity = BEACON_BASE + BEACON_PULSE * glow + BEACON_FLASH * flash;
      if (halo) halo.material.opacity = HALO_OPACITY * (0.55 + 0.45 * glow + flash);

      if (impact) startCrash(sim, x, y, rm);

      // The tumble after a crash: pushed back, a small hop, tipped and turned, settling.
      let tx = 0;
      let ty = 0;
      let tz = 0;
      let tPitch = 0;
      let tRoll = 0;
      let tYaw = 0;
      if (crashT >= 0 && Number.isFinite(crashT)) {
        crashT += dt;
        const hop = Math.sin(Math.PI * Math.min(1, crashT / TUMBLE_HOP_TIME));
        tz = TUMBLE_PUSH * (1 - Math.exp(-9 * crashT));
        tx = crashSide * 0.12 * (1 - Math.exp(-7 * crashT));
        ty = TUMBLE_HOP * hop;
        tPitch = TUMBLE_PITCH * (1 - Math.exp(-8 * crashT)) + TUMBLE_PITCH_PEAK * hop;
        tRoll = crashSide * TUMBLE_ROLL * (1 - Math.exp(-7 * crashT));
        tYaw = crashSide * TUMBLE_YAW * (1 - Math.exp(-6 * crashT));
      }

      holder.position.set(x + tx, y + ty, tz);
      holder.rotation.set(airPitchSpring.value + tPitch, yaw + tYaw, tRoll);
      if (rig.body) {
        rig.body.position.y = rig.bodyRestY + bodySpring.value / scale;
        rig.body.rotation.x = pitchSpring.value;
        rig.body.rotation.z = rollSpring.value;
      }
      const sway = rm || !playing || airborne ? 0 : speedT;
      rig.rockers.forEach((r, i) => (r.rotation.x = ROCKER_SWING * sway * Math.sin(d * 1.9 + i * 2.1)));
      rig.bogies.forEach((b, i) => (b.rotation.x = BOGIE_SWING * sway * Math.sin(d * 2.7 + i * 1.3 + 0.8)));
      if (rig.antenna) rig.antenna.rotation.x = fold;

      // Trail: dust behind the rear wheels while driving on the ground; the world carries it back at the rover's speed.
      if (playing && !airborne) {
        emitDebt += (TRAIL_RATE + TRAIL_RATE_PER_SPEED * sim.speed) * dt;
        while (emitDebt >= 1) {
          emitDebt -= 1;
          const side = nextParticle % 2 ? 1 : -1;
          spawn(
            x + side * MODEL_REAR_WHEEL.x * scale + (rand() - 0.5) * 0.2,
            0.05 + rand() * 0.08,
            MODEL_REAR_WHEEL.z * scale + 0.15,
            side * rand() * 0.5,
            0.3 + rand() * 0.8,
            0.5 + rand() * 1.5,
            TRAIL_LIFE * (0.7 + rand() * 0.6),
          );
        }
      } else {
        emitDebt = 0;
      }
      const carry = playing ? sim.speed : 0;
      for (let i = 0; i < TRAIL_POOL; i++) {
        const k = i * 3;
        if (trailAge[i] >= trailLife[i]) {
          trailCol[k] = trailCol[k + 1] = trailCol[k + 2] = 0;
          continue;
        }
        trailAge[i] += dt;
        trailPos[k] += trailVel[k] * dt;
        trailPos[k + 1] = Math.max(0.02, trailPos[k + 1] + trailVel[k + 1] * dt);
        trailPos[k + 2] += (trailVel[k + 2] + carry) * dt;
        const f = Math.max(0, 1 - trailAge[i] / trailLife[i]);
        const b = TRAIL_INTENSITY * f * f;
        trailCol[k] = brass.r * b;
        trailCol[k + 1] = brass.g * b;
        trailCol[k + 2] = brass.b * b;
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;

      // Burst.
      if (burstT >= 0) {
        burstT += dt;
        const u = Math.min(1, burstT / BURST_TIME);
        const out = 1 - (1 - u) ** 3;
        const fade = (1 - u) ** 1.5;
        shards.forEach((s, i) => {
          const r = s.reach * out;
          const bx = burstOrigin.x + s.dx * r;
          const by = burstOrigin.y + s.dy * r;
          const bz = burstOrigin.z + s.dz * r;
          const l = s.length * (1 - 0.6 * u);
          // A thin triangle along the shard's direction, its width across it (facing the camera, roughly +z).
          const wx = -s.dy * s.width;
          const wy = s.dx * s.width;
          burstPos.set(
            [bx - wx, by - wy, bz, bx + wx, by + wy, bz, bx + s.dx * l, by + s.dy * l, bz + s.dz * l],
            i * 9,
          );
          for (let v = 0; v < 3; v++) {
            const tip = v === 2 ? 1 : 0.55;
            burstCol.set([highlight.r * fade * tip, highlight.g * fade * tip, highlight.b * fade * tip], i * 9 + v * 3);
          }
        });
        burstGeo.attributes.position.needsUpdate = true;
        burstGeo.attributes.color.needsUpdate = true;
        if (u >= 1) {
          burstT = -1;
          burst.visible = false;
        }
      }
    },

    dispose() {
      disposed = true;
      disposeTree(rig.model);
      for (const thing of owned) thing.dispose();
      object.clear();
    },
  };
}

function rigOf(model: Object3D): Rig {
  const find = (name: string) => model.getObjectByName(name) ?? null;
  const body = find('rover_body');
  return {
    model,
    body,
    bodyRestY: body?.position.y ?? 0,
    wheels: WHEELS.map(find).filter((n): n is Object3D => n !== null),
    rockers: ['rocker_L', 'rocker_R'].map(find).filter((n): n is Object3D => n !== null),
    bogies: ['bogie_L', 'bogie_R'].map(find).filter((n): n is Object3D => n !== null),
    antenna: find('antenna'),
  };
}

/** Free the geometries of a model (materials are shared and freed by their owner). */
function disposeTree(root: Object3D) {
  root.traverse((node) => {
    if (node instanceof Mesh) node.geometry.dispose();
  });
}

/**
 * The stand-in, in the model's own metres and with its node names: a chamfered ivory hull on a dark chassis, six dark
 * wheels and the beacon on its mast. Shown while rover.glb loads, and for good if it cannot.
 */
function buildStandIn(own: <T extends { dispose(): void }>(t: T) => T, beaconMaterial: Material): Group {
  const ivory = own(new MeshStandardMaterial({ color: C.ivory, roughness: 0.55, metalness: 0, flatShading: true }));
  const dark = own(new MeshStandardMaterial({ color: C.shade, roughness: 0.7, metalness: 0, flatShading: true }));
  const root = new Group();
  root.name = 'rover';
  const body = new Group();
  body.name = 'rover_body';
  root.add(body);
  const chassis = new Mesh(own(new CylinderGeometry(0.62, 0.5, 0.3, 4, 1).rotateY(Math.PI / 4)), dark);
  chassis.scale.set(1, 1, 1.75);
  chassis.position.y = 0.6;
  const hull = new Mesh(own(new CylinderGeometry(0.62, 0.92, 0.42, 4, 1).rotateY(Math.PI / 4)), ivory);
  hull.scale.set(1, 1, 1.7);
  hull.position.y = 0.96;
  body.add(chassis, hull);
  const wheelGeo = own(new CylinderGeometry(0.33, 0.33, 0.28, 12).rotateZ(Math.PI / 2));
  for (const [name, x, z] of [
    ['wheel_FL', -0.7, -0.95],
    ['wheel_ML', -0.7, 0],
    ['wheel_RL', -0.7, 0.95],
    ['wheel_FR', 0.7, -0.95],
    ['wheel_MR', 0.7, 0],
    ['wheel_RR', 0.7, 0.95],
  ] as const) {
    const wheel = new Mesh(wheelGeo, dark);
    wheel.name = name;
    wheel.position.set(x, 0.33, z);
    root.add(wheel);
  }
  const antenna = new Group();
  antenna.name = 'antenna';
  antenna.position.set(0, 1.18, 0.3);
  body.add(antenna);
  const mast = new Mesh(own(new CylinderGeometry(0.014, 0.014, 0.33, 6).translate(0, 0.165, 0)), dark);
  const beacon = new Mesh(own(new IcosahedronGeometry(0.085, 1)), beaconMaterial);
  beacon.name = 'beacon';
  beacon.position.y = 0.395;
  antenna.add(mast, beacon);
  return root;
}

/** A soft round spot (white at the centre, clear at the edge) for the trail and the beacon's halo; null without a 2D canvas. */
function makeGlowTexture(): Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  // A white alpha mask, not a colour: the materials that use it tint it brass.
  g.addColorStop(0, 'rgb(255 255 255 / 1)');
  g.addColorStop(0.35, 'rgb(255 255 255 / 0.45)');
  g.addColorStop(1, 'rgb(255 255 255 / 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
