/**
 * Sound effects, synthesized with the Web Audio API: no audio files to
 * download or license. A "wooden clack" is a short burst of noise through
 * a band-pass filter plus a quick low thump.
 */
import type { Status } from './solver';

export type Sound = 'move' | 'capture' | 'mate' | 'wrong';

const PREF_KEY = 'chess-mates:sound';

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // not saved; applies for this visit only
  }
}

/** Which sound fits a position change (pure, so it's testable). */
export function soundFor(prevFen: string, nextFen: string, status: Status): Sound | null {
  if (prevFen === nextFen) return null;
  if (status === 'solved') return 'mate';
  if (status === 'failed') return 'wrong';
  return pieceCount(nextFen) < pieceCount(prevFen) ? 'capture' : 'move';
}

function pieceCount(fen: string): number {
  return fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // no Web Audio (very old browser): stay silent
  }
}

/** Phones only allow sound after a tap; call this from any tap to unlock it early. */
export function primeAudio(): void {
  if (soundEnabled()) audio();
}

export function play(sound: Sound): void {
  if (!soundEnabled()) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  switch (sound) {
    case 'move':
      clack(ac, t, 0.5);
      break;
    case 'capture':
      clack(ac, t, 0.6);
      clack(ac, t + 0.07, 0.45);
      break;
    case 'mate':
      clack(ac, t, 0.6);
      // a soft rising arpeggio: C5 E5 G5 C6
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, f, t + 0.12 + i * 0.09, 0.5, 'triangle', 0.16));
      break;
    case 'wrong':
      clack(ac, t, 0.5);
      tone(ac, 311.13, t + 0.1, 0.18, 'triangle', 0.14);
      tone(ac, 233.08, t + 0.26, 0.3, 'triangle', 0.14);
      break;
  }
}

function clack(ac: AudioContext, at: number, volume: number): void {
  // Noise burst through a band-pass filter: the "click" of wood on stone.
  const length = Math.floor(ac.sampleRate * 0.06);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1700;
  band.Q.value = 3;
  const gain = ac.createGain();
  gain.gain.value = volume;
  noise.connect(band).connect(gain).connect(ac.destination);
  noise.start(at);

  // A quick low thump gives it body.
  tone(ac, 150, at, 0.07, 'sine', volume * 0.6);
}

function tone(ac: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, volume: number): void {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}
