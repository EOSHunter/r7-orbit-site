// The game's sound (docs/ASCENT.md, "Sound"), made in code with Web Audio: no audio files, nothing fetched. One-off sounds
// for what sound-events.ts says happened (a jump, a landing, footsteps, a fall back, a beacon, a creaking and a breaking
// panel, a fan's updraft, the finish), and a bed of sound for each zone, mixed by the agent's height:
//
//   1 workshop      a low room tone
//   2 server stack  the drone of fans, a mains hum, now and then a beep
//   3 cloud         wind gusting unevenly with a faint whistle, and a soft high tone (a slow, even swell sounded like
//                   waves; the high end of the noise alone, like static)
//   4 upper air     stronger, thinner wind over a low rumble
//   5 orbit         a quiet pad, two notes breathing in and out
//
// The volume and mute are the player's settings (settings.ts). The context is made when the game mounts, after the Play
// click, so the browser lets it play; it is suspended while the game is paused and closed when it is taken away. Where Web
// Audio is missing, createAudio returns null and the game is silent.

import type { SoundEvent } from './sound-events';

export interface AudioEngine {
  play(event: SoundEvent): void;
  /** How much of each zone's bed to play (sound-events.ts, ambienceMix), bottom zone first. */
  setMix(weights: readonly number[]): void;
  setVolume(volume: number, muted: boolean): void;
  /** Called every frame: the server stack's beeps are timed here. */
  tick(): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
}

type Ctx = AudioContext;

/** The audio constructors a window may have (Safari's older one is prefixed); `Window`'s type declares neither. */
type AudioWindow = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

export function createAudio(win: Window): AudioEngine | null {
  const w = win as unknown as AudioWindow;
  const Context = w.AudioContext ?? w.webkitAudioContext;
  if (!Context) return null;
  let ctx: Ctx;
  try {
    ctx = new Context();
  } catch {
    return null;
  }

  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);
  const sfx = ctx.createGain();
  sfx.gain.value = 1;
  sfx.connect(master);
  const beds = ctx.createGain();
  beds.gain.value = 0.9;
  beds.connect(master);

  // Two seconds of white noise, looped or cut short by every noisy sound.
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  let seed = 1;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647; // a fixed sequence, so the sound is the same every time
    data[i] = (seed / 2147483647) * 2 - 1;
  }

  const now = () => ctx.currentTime;

  /** A gain that rises to `peak` in `attack` s and dies away over `decay` s, from `at`. */
  const envelope = (at: number, attack: number, decay: number, peak: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  };

  /** A tone sliding from f0 to f1 Hz. */
  const tone = (
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    peak: number,
    at = now(),
    out: AudioNode = sfx,
  ) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur);
    const g = envelope(at, Math.min(0.01, dur / 4), dur, peak);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };

  /** A burst of filtered noise, its filter sliding from f0 to f1 Hz. */
  const hiss = (type: BiquadFilterType, f0: number, f1: number, q: number, dur: number, peak: number, at = now()) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur);
    const g = envelope(at, Math.min(0.01, dur / 4), dur, peak);
    src.connect(filter).connect(g).connect(sfx);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.05);
  };

  /** A struck bell: a sine and its octave, ringing out. */
  const bell = (f: number, at: number, peak: number, ring = 1.4) => {
    tone('sine', f, f, ring, peak, at);
    tone('triangle', f * 2, f * 2, ring * 0.6, peak * 0.3, at);
  };

  const play = (event: SoundEvent) => {
    const t = now();
    switch (event.kind) {
      case 'jump':
        tone('triangle', 260, 540, 0.14, 0.16, t);
        hiss('highpass', 2500, 4000, 0.7, 0.06, 0.04, t);
        break;
      case 'land': {
        const k = 0.35 + 0.65 * event.strength;
        tone('sine', 150, 50, 0.16 + 0.12 * event.strength, 0.3 * k, t);
        hiss('lowpass', 1200, 250, 0.8, 0.1 + 0.15 * event.strength, 0.14 * k, t);
        break;
      }
      case 'step':
        hiss('bandpass', event.foot ? 2400 : 2900, 1800, 3, 0.04, 0.05, t);
        tone('sine', 95, 70, 0.05, 0.035, t);
        break;
      case 'respawn':
        hiss('bandpass', 2200, 160, 1.2, 0.7, 0.16, t);
        tone('sine', 420, 110, 0.6, 0.08, t);
        break;
      case 'checkpoint':
        bell(660, t, 0.12, 0.6);
        bell(990, t + 0.12, 0.12, 0.9);
        break;
      case 'creak':
        tone('sawtooth', 95, 70, 0.45, 0.04, t);
        hiss('bandpass', 600, 400, 6, 0.4, 0.05, t);
        break;
      case 'crumble':
        hiss('highpass', 1800, 900, 0.7, 0.09, 0.22, t);
        hiss('lowpass', 600, 120, 0.7, 0.6, 0.14, t + 0.03);
        tone('sine', 120, 45, 0.35, 0.12, t);
        break;
      case 'lift':
        hiss('bandpass', 400, 1600, 1.4, 0.7, 0.12, t);
        break;
      case 'finish': {
        // A rising chord: C, E, G, C.
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, t + i * 0.13, 0.14, 1.8));
        break;
      }
    }
  };

  // ---- the zones' beds: each a gain fed by sources that run all the time ----------------------------------------------------
  const bedGains: GainNode[] = [];
  const running: AudioScheduledSourceNode[] = [];

  const bed = () => {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(beds);
    bedGains.push(g);
    return g;
  };
  const noiseLoop = (type: BiquadFilterType, f: number, q: number, level: number, out: AudioNode) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = f;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    src.connect(filter).connect(g).connect(out);
    src.start();
    running.push(src);
    return { filter, gain: g };
  };
  const hum = (f: number, level: number, out: AudioNode, type: OscillatorType = 'sine') => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(out);
    osc.start();
    running.push(osc);
    return g;
  };
  /** A slow wobble added to a parameter: `depth` either way, `rate` times a second. */
  const wobble = (param: AudioParam, rate: number, depth: number) => {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const g = ctx.createGain();
    g.gain.value = depth;
    lfo.connect(g).connect(param);
    lfo.start();
    running.push(lfo);
  };

  // 1 workshop: a low room tone.
  const workshop = bed();
  noiseLoop('lowpass', 220, 0.7, 0.07, workshop);
  // 2 server stack: the fans' drone, a mains hum (beeps in tick()).
  const server = bed();
  noiseLoop('bandpass', 190, 0.8, 0.16, server);
  hum(60, 0.02, server);
  hum(120, 0.008, server);
  // 3 cloud: wind. A band of noise in the middle that gusts on two uneven wobbles (one slow, even swell is what the sea sounds
  // like), a faint whistle drifting in pitch over it, a little weight underneath, and two soft high notes. Not the high end
  // of the noise alone: the author heard that as static.
  const cloud = bed();
  const wind = noiseLoop('bandpass', 520, 1.1, 0.06, cloud);
  wobble(wind.gain.gain, 0.13, 0.022);
  wobble(wind.gain.gain, 0.31, 0.012);
  wobble(wind.filter.frequency, 0.09, 180);
  wobble(wind.filter.frequency, 0.23, 80);
  const whistle = noiseLoop('bandpass', 950, 9, 0.02, cloud);
  wobble(whistle.filter.frequency, 0.17, 260);
  wobble(whistle.gain.gain, 0.11, 0.012);
  noiseLoop('lowpass', 140, 0.7, 0.03, cloud);
  const airA = hum(523.25, 0.006, cloud);
  const airB = hum(783.99, 0.0035, cloud);
  wobble(airA.gain, 0.06, 0.002);
  wobble(airB.gain, 0.045, 0.0015);
  // 4 upper air: thinner, stronger wind over a low rumble.
  const upper = bed();
  const gust = noiseLoop('bandpass', 1150, 0.5, 0.1, upper);
  wobble(gust.gain.gain, 0.21, 0.06);
  wobble(gust.filter.frequency, 0.11, 400);
  noiseLoop('lowpass', 80, 0.7, 0.08, upper);
  // 5 orbit: a quiet pad, two notes breathing in and out, and a faint shimmer.
  const orbit = bed();
  const padA = hum(110, 0.03, orbit, 'triangle');
  const padB = hum(164.81, 0.022, orbit, 'triangle');
  wobble(padA.gain, 0.07, 0.015);
  wobble(padB.gain, 0.09, 0.011);
  noiseLoop('highpass', 6500, 0.7, 0.008, orbit);

  let weights: readonly number[] = [];
  let nextBeep = 0;

  return {
    play,
    setMix(next) {
      weights = next;
      const t = now();
      bedGains.forEach((g, i) => g.gain.setTargetAtTime(next[i] ?? 0, t, 0.6));
    },
    setVolume(volume, muted) {
      master.gain.setTargetAtTime(muted ? 0 : Math.max(0, Math.min(1, volume)), now(), 0.05);
    },
    tick() {
      // Now and then, a beep from a rack, as loud as the server stack's share of the mix.
      const share = weights[1] ?? 0;
      const t = now();
      if (share < 0.05 || t < nextBeep) return;
      nextBeep = t + 1 + Math.random() * 3;
      tone('sine', 1800 + Math.random() * 900, 1800 + Math.random() * 900, 0.07, 0.025 * share, t);
    },
    suspend() {
      if (ctx.state === 'running') void ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {});
    },
    dispose() {
      for (const s of running) {
        try {
          s.stop();
        } catch {
          // already stopped
        }
      }
      void ctx.close().catch(() => {});
    },
  };
}
