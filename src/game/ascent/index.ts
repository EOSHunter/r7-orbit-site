// mountAscent: puts the game in a container and takes it out again. This module is the lazy chunk: a page imports it with a
// dynamic import() when Play is pressed, so three.js is never in a page's main bundle (docs/ASCENT.md, "Code"). The level and
// the agent are the host's to load first, side by side (loadTestClimb and loadAgent, both built in Blender), so mounting
// stays synchronous; without them the game plays phase 1's level in code, as phase 1's capsule.
//
// The host supplies the container: positioned (the game fills it), focusable (tabindex="0"), with an accessible name and its
// instructions as text (aria-describedby). The game adds its canvas, the HUD, a message with the menu and a live region
// inside it, and destroy() removes all of it, every listener, the animation frame, the observer and the WebGL
// context.
//
// Time: the rAF timestamp drives a fixed-step clock (clock.ts); the camera follows on the frame's real time. The game pauses
// when the tab is hidden, the window loses focus, focus leaves the game, Escape is pressed, the pointer lock is let go, or
// full screen ends. It is played with a keyboard and a mouse (desktop only: the host pages offer Play only where there is a
// mouse, gesture.ts hasKeyboardAndMouse).
//
// Full screen and the pointer lock belong to the container (gesture.ts): the host asks for them in its Play click, before
// this module has loaded, and the game asks again on the click or Space that resumes. Paused, the game stays in full screen;
// Escape again (the browser's own key for it) leaves it.
//
// The HUD (docs/ASCENT.md, "HUD"): the altitude, the best, the falls and the zone top left, the time top right, an altimeter
// down the left edge (a tick per zone, a brass marker for where the agent is), and the controls hint for the first minute.
// Paused, the message holds the menu: resume, restart, assist mode, settings, leave. The settings (settings.ts) and the climb
// in progress (save.ts) are kept in the browser; a saved climb is offered back on the ready screen.

import { loadAgentModel, type AgentModel } from './agent';
import { OrbitCamera } from './camera';
import { CLIMB_SAVE_NAME, loadClimb, type Climb } from './climb';
import { FixedStepClock } from './clock';
import { readTokenColors } from './colors';
import { ASCENT_CONFIG, type AscentConfig } from './config';
import { enterPlay, leavePlay } from './gesture';
import { createInput, moveVector, turnInput } from './input';
import { loadLevelModel, type LevelModel } from './gltf-level';
import { PROTOTYPE_LEVEL, zonesOf, type Level } from './level';
import { createView, type View, type ViewInfo, type ViewOptions } from './render';
import { clearSave, formatTime, loadSave, writeSave, type AscentSave } from './save';
import {
  SENSITIVITY_RANGE,
  loadSettings,
  reducesMotion,
  saveSettings,
  storage,
  type AscentSettings,
  type GraphicsSetting,
  type MotionSetting,
} from './settings';
import { AscentSim } from './sim';
import { ASCENT_TEXT } from './text';
import { createAudio, type AudioEngine } from './audio';
import { SoundTracker, ambienceMix } from './sound-events';
import agentUrl from './assets/agent.glb?url';
import testClimbUrl from './assets/test-climb.glb?url';

export { ASCENT_TEXT, CLIMB_SAVE_NAME, loadClimb };
export type { AgentModel, Climb, LevelModel };

/** The test climb built in Blender (tools/ascent/build_test_climb.py). Rejects when it cannot be loaded or used. */
export const loadTestClimb = (): Promise<LevelModel> => loadLevelModel(testClimbUrl);
/** The robot built in Blender (tools/ascent/build_agent.py). Rejects when it cannot be loaded or used. */
export const loadAgent = (): Promise<AgentModel> => loadAgentModel(agentUrl);
export { withConfig } from './config';

export type AscentState = 'ready' | 'playing' | 'finished' | 'unsupported';

export interface AscentStats {
  /** Frames per second, smoothed. */
  fps: number;
  /** Fixed steps run in the last frame. */
  steps: number;
  state: AscentState;
  paused: boolean;
  locked: boolean;
  x: number;
  y: number;
  z: number;
  /** Speed across the ground, and up (negative: falling). */
  speed: number;
  vy: number;
  grounded: boolean;
  coyote: number;
  buffer: number;
  altitude: number;
  best: number;
  falls: number;
  jumps: number;
  time: number;
  assist: boolean;
  checkpoint: number | null;
  /** The ring was touched. */
  finished: boolean;
  /** Zones of the climb loaded so far (0 for a level that is not the climb). */
  zones: number;
  cameraYaw: number;
  cameraPitch: number;
  cameraDistance: number;
  view: ViewInfo;
}

export interface AscentOptions {
  config?: AscentConfig;
  /** The full climb (loadClimb): its first zones; the rest load as the agent nears them. Wins over `model` and `level`. */
  climb?: Climb | null;
  /** A level made in Blender (loadTestClimb): its level and its meshes. Wins over `level`. */
  model?: LevelModel | null;
  level?: Level;
  /** The robot (loadAgent); without it the capsule stands in. */
  agent?: AgentModel | null;
  /** The level's name in a saved climb (a save is only offered back on the same level). Default: none, nothing is saved. */
  saveAs?: string | null;
  /** Move keyboard focus to the container on mount (default true). */
  focus?: boolean;
  /** Ask for pointer lock when a climb starts or resumes, and on a click (default true). Without it, drag to look. */
  pointerLock?: boolean;
  /** Put the container in full screen when a climb starts or resumes (default false: the host decides). */
  fullscreen?: boolean;
  /** The menu's Leave: the host takes the game away (without it, the menu has no Leave). */
  onLeave?: () => void;
  /** Lines for the finish screen's credits (the host's words; without them, no credits). */
  credits?: readonly string[];
  /** Called after every frame (the prototype page's debug readout and its tests). */
  onStats?: (stats: AscentStats) => void;
}

export interface AscentHandle {
  /** Start the climb (or resume it when paused). */
  start(): void;
  pause(): void;
  resume(): void;
  /** Back to the start of the course, time and best height reset. */
  restart(): void;
  destroy(): void;
}

/** What mountAscent builds on; a test can replace the view (no WebGL in Node). */
export interface AscentDeps {
  createView: (canvas: HTMLCanvasElement, options: ViewOptions) => View | null;
  /** The sound (audio.ts); a test can leave it out. */
  createAudio?: (win: Window) => AudioEngine | null;
}

/** Save the climb this often while playing (and on every pause). */
const SAVE_EVERY = 5;

export function mountAscent(
  container: HTMLElement,
  options: AscentOptions = {},
  deps: AscentDeps = { createView, createAudio },
): AscentHandle {
  const cfg = options.config ?? ASCENT_CONFIG;
  const climb = options.climb ?? null;
  const model: LevelModel | null = climb
    ? { level: climb.level, parts: [...climb.parts], source: 'the climb' }
    : (options.model ?? null);
  const level = model?.level ?? options.level ?? PROTOTYPE_LEVEL;
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('mountAscent: the container is not in a window');
  const store = storage(win);
  const saveAs = options.saveAs ?? null;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const root = el('div', 'ascent');
  root.setAttribute('data-ascent', '');
  const canvas = el('canvas', 'ascent-canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', ASCENT_TEXT.canvasLabel);
  root.append(canvas);
  container.append(root);

  let settings: AscentSettings = loadSettings(store);
  const systemMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduce = () => reducesMotion(settings, systemMotion?.matches ?? false);
  const view = deps.createView(canvas, {
    colors: readTokenColors(root),
    level,
    model,
    agent: options.agent ?? null,
    config: cfg,
    reducedMotion: reduce,
    quality: settings.graphics,
  });
  if (!view) {
    canvas.remove();
    root.dataset.ascentState = 'unsupported';
    root.append(el('p', 'ascent-fallback', ASCENT_TEXT.noWebGL));
    const noop = () => {};
    return { start: noop, pause: noop, resume: noop, restart: noop, destroy: () => root.remove() };
  }

  // The sound: made now (after the Play click, so the browser lets it play), quiet while paused, closed on destroy.
  const audio = (deps.createAudio ?? createAudio)(win);
  const sounds = new SoundTracker();
  audio?.setVolume(settings.volume, settings.muted);

  // ---- the HUD ----------------------------------------------------------------------------------------------------------
  // The altitude, best, falls and zone (top left), the time (top right), the altimeter (left edge), the message (middle), the
  // controls hint (bottom), a live region for falls.
  const zones = zonesOf(level);
  const hud = el('div', 'ascent-hud');
  const altLine = el('p', 'ascent-alt');
  const altValue = el('span', undefined, '0');
  altLine.append(el('span', 'visually-hidden', `${ASCENT_TEXT.altitude} `), altValue, ' m');
  const bestLine = el('p', 'ascent-sub', `${ASCENT_TEXT.best} `);
  const bestValue = el('span', undefined, '0');
  bestLine.append(bestValue, ' m');
  const fallsLine = el('p', 'ascent-sub', `${ASCENT_TEXT.falls} `);
  const fallsValue = el('span', undefined, '0');
  fallsLine.append(fallsValue);
  const zoneLine = el('p', 'ascent-sub ascent-zone');
  hud.append(altLine, bestLine, fallsLine, zoneLine);
  const timeLine = el('p', 'ascent-time');
  const timeValue = el('span', undefined, '0:00');
  timeLine.append(el('span', 'visually-hidden', `${ASCENT_TEXT.time} `), timeValue);
  // The altimeter: a line down the left edge, a tick where each zone starts, the brass marker at the agent's height.
  const bottom = zones[0].base;
  const height = Math.max(1, zones[zones.length - 1].top - bottom);
  const altimeter = el('div', 'ascent-altimeter');
  altimeter.setAttribute('aria-hidden', 'true');
  for (const z of zones.slice(1)) {
    const tick = el('span', 'ascent-altimeter-tick');
    tick.style.bottom = `${((z.base - bottom) / height) * 100}%`;
    altimeter.append(tick);
  }
  const marker = el('span', 'ascent-altimeter-marker');
  altimeter.append(marker);

  // ---- the message and the menu -----------------------------------------------------------------------------------------
  const message = el('div', 'ascent-message');
  const title = el('p', 'ascent-title', ASCENT_TEXT.title);
  const prompt = el('p', 'ascent-prompt', ASCENT_TEXT.play);
  const menu = el('div', 'ascent-menu');
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', ASCENT_TEXT.menuLabel);
  const button = (text: string, cls = 'btn') => {
    const b = el('button', cls, text);
    b.type = 'button';
    return b;
  };
  const continueButton = button(ASCENT_TEXT.continueClimb, 'btn solid');
  const newClimbButton = button(ASCENT_TEXT.newClimb);
  const resumeButton = button(ASCENT_TEXT.resume, 'btn solid');
  const restartButton = button(ASCENT_TEXT.restart);
  const assistButton = button(ASCENT_TEXT.assist);
  assistButton.setAttribute('aria-pressed', 'false');
  const settingsButton = button(ASCENT_TEXT.settings);
  settingsButton.setAttribute('aria-expanded', 'false');
  const leaveButton = button(ASCENT_TEXT.leave, 'btn quiet');
  const assistNote = el('p', 'ascent-note', ASCENT_TEXT.assistNote);
  menu.append(continueButton, newClimbButton, resumeButton, restartButton, assistButton, settingsButton, leaveButton);

  // The settings: look speed, invert, motion.
  const panel = el('div', 'ascent-settings');
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', ASCENT_TEXT.settingsLabel);
  panel.hidden = true;
  const uid = `ascent-${Math.random().toString(36).slice(2, 8)}`;
  const speedField = el('div', 'field');
  const speedLabel = el('label', undefined, ASCENT_TEXT.sensitivity);
  speedLabel.htmlFor = `${uid}-speed`;
  const speed = el('input', 'ascent-range');
  speed.type = 'range';
  speed.id = `${uid}-speed`;
  speed.min = String(SENSITIVITY_RANGE.min);
  speed.max = String(SENSITIVITY_RANGE.max);
  speed.step = String(SENSITIVITY_RANGE.step);
  const speedOut = el('output', 'ascent-range-value');
  speedOut.htmlFor.add(speed.id);
  speedField.append(speedLabel, speed, speedOut);
  const volumeField = el('div', 'field');
  const volumeLabel = el('label', undefined, ASCENT_TEXT.volume);
  volumeLabel.htmlFor = `${uid}-volume`;
  const volume = el('input', 'ascent-range');
  volume.type = 'range';
  volume.id = `${uid}-volume`;
  volume.min = '0';
  volume.max = '1';
  volume.step = '0.05';
  const volumeOut = el('output', 'ascent-range-value');
  volumeOut.htmlFor.add(volume.id);
  volumeField.append(volumeLabel, volume, volumeOut);
  const muteLabel = el('label', 'ascent-check');
  const mute = el('input');
  mute.type = 'checkbox';
  muteLabel.append(mute, ` ${ASCENT_TEXT.mute}`);
  const invertLabel = el('label', 'ascent-check');
  const invert = el('input');
  invert.type = 'checkbox';
  invertLabel.append(invert, ` ${ASCENT_TEXT.invertY}`);
  const motionField = el('div', 'field');
  const motionLabel = el('p', 'ascent-field-label', ASCENT_TEXT.motion);
  motionLabel.id = `${uid}-motion`;
  const motionSeg = el('div', 'seg');
  motionSeg.setAttribute('role', 'group');
  motionSeg.setAttribute('aria-labelledby', motionLabel.id);
  const motionButtons = (
    [
      ['system', ASCENT_TEXT.motionSystem],
      ['reduce', ASCENT_TEXT.motionReduce],
      ['full', ASCENT_TEXT.motionFull],
    ] as [MotionSetting, string][]
  ).map(([value, text]) => {
    const b = button(text, '');
    b.dataset.motion = value;
    motionSeg.append(b);
    return b;
  });
  motionField.append(motionLabel, motionSeg);
  const graphicsField = el('div', 'field');
  const graphicsLabel = el('p', 'ascent-field-label', ASCENT_TEXT.graphics);
  graphicsLabel.id = `${uid}-graphics`;
  const graphicsSeg = el('div', 'seg');
  graphicsSeg.setAttribute('role', 'group');
  graphicsSeg.setAttribute('aria-labelledby', graphicsLabel.id);
  const graphicsButtons = (
    [
      ['high', ASCENT_TEXT.graphicsHigh],
      ['low', ASCENT_TEXT.graphicsLow],
    ] as [GraphicsSetting, string][]
  ).map(([value, text]) => {
    const b = button(text, '');
    b.dataset.graphics = value;
    graphicsSeg.append(b);
    return b;
  });
  graphicsField.append(graphicsLabel, graphicsSeg);
  const backButton = button(ASCENT_TEXT.back);
  panel.append(speedField, invertLabel, motionField, graphicsField, volumeField, muteLabel, backButton);
  // The finish: the time, the falls, whether assist mode was used, the host's credits.
  const finishBox = el('div', 'ascent-finish');
  finishBox.hidden = true;
  const finishStats = el('dl', 'ascent-finish-stats');
  const stat = (label: string) => {
    const row = el('div');
    const value = el('dd');
    row.append(el('dt', undefined, label), value);
    finishStats.append(row);
    return value;
  };
  const finishTime = stat(ASCENT_TEXT.time);
  const finishFalls = stat(ASCENT_TEXT.falls);
  const finishJumps = stat(ASCENT_TEXT.jumps);
  const finishAssist = el('p', 'ascent-note', ASCENT_TEXT.finishAssisted);
  finishBox.append(finishStats, finishAssist);
  if (options.credits?.length) {
    const credits = el('div', 'ascent-credits');
    credits.append(el('p', 'ascent-field-label', ASCENT_TEXT.credits));
    for (const line of options.credits) credits.append(el('p', undefined, line));
    finishBox.append(credits);
  }
  const againButton = button(ASCENT_TEXT.climbAgain, 'btn solid lg');
  menu.prepend(againButton);
  message.append(title, prompt, finishBox, menu, assistNote, panel);

  const hint = el('p', 'ascent-hint', ASCENT_TEXT.hint);
  // Playing without the pointer lock (refused, or let go without pausing): say how to get it, rather than leave the mouse
  // doing nothing.
  const lookHint = el('p', 'ascent-look', ASCENT_TEXT.clickToLook);
  const live = el('p', 'visually-hidden');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('data-ascent-live', '');
  root.append(hud, timeLine, altimeter, message, hint, lookHint, live);

  const showSettings = (open: boolean) => {
    panel.hidden = !open;
    menu.hidden = open;
    assistNote.hidden = open || menu.hidden;
    settingsButton.setAttribute('aria-expanded', String(open));
    (open ? speed : settingsButton).focus({ preventScroll: true });
  };
  const drawSettings = () => {
    speed.value = String(settings.sensitivity);
    speedOut.textContent = `${settings.sensitivity.toFixed(1)}×`;
    invert.checked = settings.invertY;
    volume.value = String(settings.volume);
    volumeOut.textContent = `${Math.round(settings.volume * 100)}%`;
    mute.checked = settings.muted;
    audio?.setVolume(settings.volume, settings.muted);
    for (const b of motionButtons) {
      const on = b.dataset.motion === settings.motion;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    for (const b of graphicsButtons) {
      const on = b.dataset.graphics === settings.graphics;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
  };
  const setSettings = (next: Partial<AscentSettings>) => {
    settings = { ...settings, ...next };
    saveSettings(store, settings);
    drawSettings();
  };
  drawSettings();

  // ---- the sim, the camera, the clock -----------------------------------------------------------------------------------
  const sim = new AscentSim(level, cfg);
  const rig = new OrbitCamera(level.spawnYaw, cfg);
  rig.snap(sim.pos, sim.boxes);
  const clock = new FixedStepClock(cfg);
  let state: AscentState = 'ready';
  let paused = false;
  let destroyed = false;
  let raf = 0;
  let fps = 0;
  let lastFrame: number | null = null;
  let lastSteps = 0;
  let seenTeleports = sim.teleports;
  let lastAlpha = 0;
  let savedAt = 0;
  let confirmRestart = false;
  const shown = {
    alt: -1,
    best: -1,
    falls: -1,
    time: -1,
    zone: '',
    state: '',
    paused: false,
    locked: false,
    full: false,
  };

  // A climb saved earlier, offered back on the ready screen.
  let saved: AscentSave | null = saveAs ? loadSave(store, saveAs) : null;

  const locked = () => doc.pointerLockElement === container;
  const full = () => doc.fullscreenElement === container;
  const wantsLock = options.pointerLock !== false;
  const gesture = { lock: wantsLock, fullscreen: options.fullscreen === true };
  /** Full screen and the lock, as far as the browser grants them now (only during a click or a key press). */
  const grab = () => enterPlay(container, gesture);
  const exitLock = () => {
    if (locked()) doc.exitPointerLock?.();
  };

  const save = () => {
    if (!saveAs || state !== 'playing') return;
    writeSave(store, {
      v: 1,
      level: saveAs,
      pos: { ...sim.pos },
      yaw: sim.yaw,
      time: sim.time,
      best: sim.best,
      falls: sim.falls,
      jumps: sim.jumps,
      assist: sim.assist,
      assisted: sim.assisted,
      checkpoint: sim.checkpoint,
      savedAt: Date.now(),
    });
    savedAt = sim.time;
  };

  const zoneAt = (y: number) => {
    let z = zones[0];
    for (const candidate of zones) if (y >= candidate.base) z = candidate;
    return z;
  };

  const drawMenu = () => {
    const ready = state === 'ready';
    const isPaused = state === 'playing' && paused;
    const finished = state === 'finished';
    continueButton.hidden = !(ready && saved);
    newClimbButton.hidden = !(ready && saved);
    for (const b of [resumeButton, restartButton, assistButton, settingsButton]) b.hidden = !isPaused;
    againButton.hidden = !finished;
    leaveButton.hidden = !((isPaused || finished) && options.onLeave);
    menu.hidden = !(ready ? saved : isPaused || finished) || !panel.hidden;
    assistNote.hidden = !isPaused || menu.hidden;
    assistButton.setAttribute('aria-pressed', String(sim.assist));
    restartButton.textContent = confirmRestart ? ASCENT_TEXT.restartConfirm : ASCENT_TEXT.restart;
    if (ready && saved) {
      continueButton.textContent = `${ASCENT_TEXT.continueClimb} · ${Math.round(saved.best)} m · ${formatTime(saved.time)}`;
    }
  };

  const updateHud = () => {
    const alt = Math.max(0, Math.round(sim.altitude));
    if (alt !== shown.alt) altValue.textContent = String((shown.alt = alt));
    const best = Math.round(sim.best);
    if (best !== shown.best) bestValue.textContent = String((shown.best = best));
    if (sim.falls !== shown.falls) fallsValue.textContent = String((shown.falls = sim.falls));
    const seconds = Math.floor(sim.time);
    if (seconds !== shown.time) timeValue.textContent = formatTime((shown.time = seconds));
    const zone = zoneAt(sim.pos.y);
    if (zone.title !== shown.zone) zoneLine.textContent = shown.zone = zone.title;
    marker.style.bottom = `${Math.min(100, Math.max(0, ((sim.pos.y - bottom) / height) * 100))}%`;
    const isLocked = locked();
    const isFull = full();
    if (state === shown.state && paused === shown.paused && isLocked === shown.locked && isFull === shown.full) return;
    shown.state = state;
    shown.paused = paused;
    shown.locked = isLocked;
    shown.full = isFull;
    root.dataset.ascentState = state;
    root.dataset.ascentPaused = String(paused);
    root.dataset.ascentLocked = String(isLocked);
    root.dataset.ascentFullscreen = String(isFull);
    message.hidden = state === 'playing' && !paused;
    title.hidden = state === 'playing';
    title.textContent = state === 'finished' ? ASCENT_TEXT.finishTitle : ASCENT_TEXT.title;
    prompt.hidden = state === 'finished';
    finishBox.hidden = state !== 'finished';
    prompt.textContent =
      state === 'ready' ? ASCENT_TEXT.play : isFull ? ASCENT_TEXT.pausedFullscreen : ASCENT_TEXT.paused;
    lookHint.hidden = !(wantsLock && state === 'playing' && !paused && !isLocked);
    if (!paused) {
      confirmRestart = false;
      if (!panel.hidden) showSettings(false);
    }
    drawMenu();
  };

  const frame = (now: number) => {
    raf = 0;
    if (destroyed || paused) return;
    const tick = clock.advance(now);
    if (state === 'playing') {
      rig.turn(turnInput(input.held), tick.delta);
      const move = moveVector(input.held, rig.yaw);
      sim.setMove(move.x, move.z);
      for (let i = 0; i < tick.steps; i++) sim.step();
      nearZones();
      if (sim.teleports !== seenTeleports) {
        seenTeleports = sim.teleports;
        const toBeacon = sim.assist && sim.checkpoint !== null;
        if (!toBeacon) rig.yaw = level.spawnYaw;
        rig.snap(sim.pos, sim.boxes);
        live.textContent = toBeacon ? ASCENT_TEXT.fellToBeacon : ASCENT_TEXT.fell;
      }
      rig.update(sim.lerpPos(tick.alpha), tick.delta, sim.boxes);
      if (sim.time - savedAt >= SAVE_EVERY) save();
      if (sim.finished) finish();
    } else if (state === 'finished') {
      rig.update(sim.lerpPos(tick.alpha), tick.delta, sim.boxes);
    }
    lastSteps = tick.steps;
    lastAlpha = tick.alpha;
    if (lastFrame !== null && now > lastFrame) {
      const instant = 1000 / (now - lastFrame);
      fps = fps ? fps + (instant - fps) * 0.1 : instant;
    }
    lastFrame = now;
    view.render(sim, tick.alpha, rig, now / 1000);
    if (audio && (state === 'playing' || state === 'finished')) {
      const crumbles = sim.crumbles;
      for (const e of sounds.update(
        {
          grounded: sim.grounded,
          speed: Math.hypot(sim.vel.x, sim.vel.z),
          vy: sim.vel.y,
          jumps: sim.jumps,
          landings: sim.landings,
          teleports: sim.teleports,
          checkpoint: sim.checkpoint,
          lifted: sim.lifted,
          shaking: crumbles.filter((c) => c.touched !== null).length,
          broken: crumbles.filter((c) => c.broke !== null).length,
          finished: sim.finished,
        },
        tick.delta,
      )) {
        audio.play(e);
      }
      audio.setMix(ambienceMix(sim.pos.y, zones));
      audio.tick();
    }
    updateHud();
    if (options.onStats) {
      options.onStats({
        fps,
        steps: lastSteps,
        state,
        paused,
        locked: locked(),
        x: sim.pos.x,
        y: sim.pos.y,
        z: sim.pos.z,
        speed: Math.hypot(sim.vel.x, sim.vel.z),
        vy: sim.vel.y,
        grounded: sim.grounded,
        coyote: sim.coyote,
        buffer: sim.buffer,
        altitude: sim.altitude,
        best: sim.best,
        falls: sim.falls,
        jumps: sim.jumps,
        time: sim.time,
        assist: sim.assist,
        checkpoint: sim.checkpoint,
        finished: sim.finished,
        zones: climb?.parts.length ?? 0,
        cameraYaw: rig.yaw,
        cameraPitch: rig.pitch,
        cameraDistance: rig.distance,
        view: view.info(),
      });
    }
    raf = win.requestAnimationFrame(frame);
  };

  const schedule = () => {
    if (!raf && !destroyed && !paused) raf = win.requestAnimationFrame(frame);
  };

  const pause = () => {
    if (destroyed || paused || state !== 'playing') return;
    input.release();
    sim.release();
    paused = true;
    audio?.suspend();
    sounds.reset();
    save();
    exitLock();
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
    updateHud();
    // Keyboard users land on Resume; a mouse that clicks the game resumes too.
    resumeButton.focus({ preventScroll: true });
  };

  const resume = () => {
    if (destroyed || !paused) return;
    paused = false;
    audio?.resume();
    input.release();
    sim.release();
    clock.reset();
    lastFrame = null;
    grab();
    container.focus({ preventScroll: true });
    updateHud();
    schedule();
  };

  // The climb's zones: loaded as the agent nears them (the one above the zone it is in), and added to the sim and the view.
  // A zone that fails to load is tried again a few seconds later.
  let loadingZones: Promise<void> | null = null;
  let failedAt = Number.NEGATIVE_INFINITY;
  const loadZones = (need: number): Promise<void> => {
    if (!climb || climb.parts.length >= need) return Promise.resolve();
    if (loadingZones) return loadingZones;
    const first = climb.level.boxes.length;
    loadingZones = climb
      .loadTo(need)
      .then((added) => {
        if (destroyed) return;
        let at = first;
        for (const p of added) {
          view.addPart(p, at);
          at += p.part.boxes.length;
        }
        sim.setLevel(climb.level);
      })
      .catch(() => {
        failedAt = sim.time;
      })
      .finally(() => {
        loadingZones = null;
      });
    return loadingZones;
  };
  const nearZones = () => {
    if (!climb || loadingZones || sim.time - failedAt < 5) return;
    const need = Math.min(climb.manifest.zones.length, climb.zoneAt(sim.pos.y) + 1);
    if (climb.parts.length < need) void loadZones(need);
  };

  /** The ring was touched: the climb is over. The save goes (it is done), the menu offers another climb. */
  const finish = () => {
    state = 'finished';
    input.release();
    sim.release();
    clearSave(store);
    exitLock();
    finishTime.textContent = formatTime(sim.time);
    finishFalls.textContent = String(sim.falls);
    finishJumps.textContent = String(sim.jumps);
    finishAssist.hidden = !sim.assisted;
    live.textContent = `${ASCENT_TEXT.finishTitle}. ${ASCENT_TEXT.time} ${formatTime(sim.time)}.`;
    updateHud();
    againButton.focus({ preventScroll: true });
  };

  const begin = (from: AscentSave | null) => {
    // A climb saved high up needs its zones before the agent can stand there.
    if (climb && from) {
      const need = Math.min(climb.manifest.zones.length, climb.zoneAt(from.pos.y) + 1);
      if (climb.parts.length < need) {
        grab();
        prompt.textContent = ASCENT_TEXT.loading;
        void loadZones(need).then(() => {
          if (!destroyed && climb.parts.length >= need) begin(from);
        });
        return;
      }
    }
    if (from) sim.restore(from);
    seenTeleports = sim.teleports;
    rig.yaw = from ? from.yaw : level.spawnYaw;
    rig.snap(sim.pos, sim.boxes);
    savedAt = sim.time;
    saved = null;
    state = 'playing';
    audio?.resume();
    sounds.reset();
    clock.reset();
    grab();
    container.focus({ preventScroll: true });
    updateHud();
    schedule();
  };

  const start = () => {
    if (destroyed || state === 'finished') return;
    if (state === 'playing') return resume();
    begin(saved);
  };

  const restart = () => {
    if (destroyed) return;
    sim.restart();
    seenTeleports = sim.teleports;
    rig.yaw = level.spawnYaw;
    rig.pitch = cfg.camera.pitch.start;
    rig.snap(sim.pos, sim.boxes);
    savedAt = 0;
    confirmRestart = false;
    clearSave(store);
    updateHud();
  };

  const look = (dx: number, dy: number) => {
    if (state !== 'playing' || paused) return;
    const k = settings.sensitivity;
    rig.look(dx * k, (settings.invertY ? -dy : dy) * k);
  };

  const onJump = (down: boolean) => {
    if (destroyed || state === 'finished') return;
    if (state !== 'playing') {
      if (down) start();
      return;
    }
    if (paused) {
      if (down) resume();
      return;
    }
    if (down) sim.jumpPress();
    else sim.jumpRelease();
  };

  const input = createInput(container, canvas, locked, {
    onJump,
    onLook: (dx, dy) => look(dx, dy),
    onPause: () => pause(),
    onPointerDown: () => {
      container.focus({ preventScroll: true });
      if (state === 'finished') return; // the finish screen's buttons only
      if (state !== 'playing') start();
      else if (paused) resume();
      else grab();
    },
  });

  // ---- the menu's buttons -----------------------------------------------------------------------------------------------
  const onMenu = (event: Event) => {
    const b = (event.target as Element | null)?.closest('button');
    if (!b) return;
    if (b === againButton) {
      restart();
      begin(null);
    } else if (b === continueButton) begin(saved);
    else if (b === newClimbButton) {
      clearSave(store);
      saved = null;
      begin(null);
    } else if (b === resumeButton) resume();
    else if (b === restartButton) {
      if (!confirmRestart) {
        confirmRestart = true;
        drawMenu();
        return;
      }
      restart();
      resume();
    } else if (b === assistButton) {
      sim.setAssist(!sim.assist);
      drawMenu();
    } else if (b === settingsButton) showSettings(true);
    else if (b === leaveButton) {
      save();
      options.onLeave?.();
    } else if (b === backButton) showSettings(false);
    else if (b.dataset.motion) setSettings({ motion: b.dataset.motion as MotionSetting });
    else if (b.dataset.graphics && b.dataset.graphics !== settings.graphics) {
      setSettings({ graphics: b.dataset.graphics as GraphicsSetting });
      view.setQuality(settings.graphics);
      resize();
    }
  };
  const onSpeed = () => setSettings({ sensitivity: Number(speed.value) });
  const onInvert = () => setSettings({ invertY: invert.checked });
  const onVolume = () => setSettings({ volume: Number(volume.value), muted: false });
  const onMute = () => setSettings({ muted: mute.checked });

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    // Low graphics draw one image pixel per CSS pixel, whatever the screen.
    const cap = settings.graphics === 'low' ? 1 : cfg.render.maxPixelRatio;
    view.resize(width, height, Math.min(win.devicePixelRatio || 1, cap));
    view.render(sim, lastAlpha, rig, (win.performance?.now() ?? 0) / 1000); // resizing clears the canvas: draw at once
  };
  const observer = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
  observer?.observe(container);

  const onVisibility = () => {
    clock.reset();
    if (doc.visibilityState === 'hidden') {
      pause();
      save();
    }
  };
  const onBlur = () => pause();
  const onFocusOut = (event: Event) => {
    const next = (event as FocusEvent).relatedTarget as Node | null;
    if (!(next && container.contains(next)) && !locked()) pause();
  };
  // The browser lets go of the lock on Escape (the key itself never reaches the page then): that is a pause. So is leaving
  // full screen. Entering it may let a lock that the click could not get through now (some browsers allow one in full screen).
  // The host may have taken both before this module loaded (its Play click): start from what the document says.
  let wasLocked = locked();
  const onLockChange = () => {
    const now = locked();
    if (wasLocked && !now) pause();
    wasLocked = now;
    updateHud();
  };
  let wasFull = full();
  const onFullscreenChange = () => {
    const now = full();
    if (wasFull && !now) pause();
    if (now && !wasFull && state === 'playing' && !paused) {
      enterPlay(container, { lock: wantsLock, fullscreen: false });
    }
    wasFull = now;
    updateHud();
    resize();
  };
  const onPageHide = () => save();
  const listeners: [EventTarget, string, EventListener][] = [
    [doc, 'visibilitychange', onVisibility],
    [doc, 'pointerlockchange', onLockChange],
    [doc, 'fullscreenchange', onFullscreenChange],
    [win, 'blur', onBlur],
    [win, 'pagehide', onPageHide],
    [container, 'focusout', onFocusOut],
    [message, 'click', onMenu],
    [speed, 'input', onSpeed],
    [invert, 'change', onInvert],
    [volume, 'input', onVolume],
    [mute, 'change', onMute],
  ];
  if (!observer) listeners.push([win, 'resize', resize]);
  for (const [target, type, fn] of listeners) target.addEventListener(type, fn);

  resize();
  updateHud();
  if (options.focus !== false) container.focus({ preventScroll: true });
  if (doc.visibilityState === 'hidden') paused = true;
  schedule();

  return {
    start,
    pause,
    resume,
    restart,
    destroy() {
      if (destroyed) return;
      save();
      destroyed = true;
      if (raf) win.cancelAnimationFrame(raf);
      raf = 0;
      leavePlay(container);
      input.destroy();
      for (const [target, type, fn] of listeners) target.removeEventListener(type, fn);
      observer?.disconnect();
      view.dispose();
      audio?.dispose();
      root.remove();
    },
  };
}
