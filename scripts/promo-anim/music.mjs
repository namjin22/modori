// 홍보 영상의 음악과 효과음을 코드로 만든다(외부 음원이 없어 저작권 걱정이 없다). WAV로 쓴다.
import { writeFileSync } from "node:fs";

import { DURATION, MUSIC, SFX } from "./timeline.mjs";

const SR = 44100;
const N = Math.floor(DURATION * SR);
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function makeMusic(file) {
  const buf = new Float32Array(N);
  let seed = 12345;
  const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  /** t0초부터 dur초 동안 fn(경과 초, 진행 0~1)을 gain으로 더한다. */
  const add = (t0, dur, gain, fn) => {
    const start = Math.floor(t0 * SR), len = Math.floor(dur * SR);
    for (let i = 0; i < len && start + i < N; i += 1) {
      if (start + i < 0) continue;
      buf[start + i] += gain * fn(i / SR, i / len);
    }
  };
  const decay = (p, k) => Math.exp(-p * k);

  const beat = 60 / MUSIC.bpm;
  const bar = beat * 4;
  const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]; // C Am F G
  const roots = [36, 33, 29, 31];

  for (let b = 0; b * bar < DURATION; b += 1) {
    const chord = chords[b % 4];
    const t0 = b * bar;
    // 패드: 한 마디 동안 부드럽게 깔린다.
    chord.forEach((n) => add(t0, bar + 0.3, 0.035, (t, p) => Math.sin(2 * Math.PI * midi(n - 12) * t) * Math.sin(Math.PI * Math.min(1, p * 1.1))));
    // 아르페지오: 8분음표마다 튕긴다. 장면이 앞으로 갈수록 커진다.
    for (let i = 0; i < 8; i += 1) {
      const n = [chord[0], chord[1], chord[2], chord[0] + 12, chord[2], chord[1], chord[0] + 12, chord[2]][i] + 12;
      const at = t0 + i * beat / 2;
      const vol = 0.05 + 0.07 * Math.min(1, at / 9);
      add(at, 0.5, vol, (t, p) => (Math.sin(2 * Math.PI * midi(n) * t) + 0.35 * Math.sin(4 * Math.PI * midi(n) * t)) * decay(p, 6));
    }
    // 베이스: 킥이 들어오는 곳부터.
    if (t0 >= MUSIC.kickFrom - 0.01) {
      [0, 2].forEach((beatIndex) => add(t0 + beatIndex * beat, beat * 1.8, 0.2, (t, p) => Math.sin(2 * Math.PI * midi(roots[b % 4]) * t) * decay(p, 3)));
    }
  }

  for (let k = 0; k * beat < DURATION; k += 1) {
    const at = k * beat;
    if (at >= MUSIC.kickFrom - 0.01) {
      add(at, 0.25, 0.42, (t, p) => Math.sin(2 * Math.PI * (48 + 100 * Math.exp(-t * 22)) * t) * decay(p, 6));
      add(at + beat / 2, 0.06, 0.05, (t, p) => noise() * decay(p, 5));
    }
    if (at >= MUSIC.clapFrom - 0.01 && k % 2 === 1) add(at, 0.14, 0.13, (t, p) => noise() * decay(p, 7));
  }

  for (const { kind, t, pitch = 1 } of SFX) {
    if (kind === "swoosh") {
      let lp = 0;
      add(t, 0.55, 0.22, (tt, p) => { lp += (noise() - lp) * (0.02 + 0.5 * p); return lp * Math.sin(Math.PI * p) * 3; });
    } else if (kind === "pop") {
      add(t, 0.16, 0.3, (tt, p) => Math.sin(2 * Math.PI * (500 * pitch + 500 * pitch * p) * tt) * decay(p, 5));
    } else if (kind === "bloop") {
      add(t, 0.3, 0.28, (tt, p) => Math.sin(2 * Math.PI * (300 * pitch + 320 * pitch * p) * tt) * decay(p, 4));
    } else if (kind === "tick") {
      add(t, 0.035, 0.13, (tt, p) => Math.sin(2 * Math.PI * 1800 * tt) * decay(p, 6));
    } else if (kind === "click") {
      add(t, 0.05, 0.25, (tt, p) => (noise() * 0.6 + Math.sin(2 * Math.PI * 900 * tt)) * decay(p, 7));
    } else if (kind === "bump") {
      add(t, 0.4, 0.5, (tt, p) => Math.sin(2 * Math.PI * (70 + 60 * Math.exp(-tt * 20)) * tt) * decay(p, 4));
      add(t, 0.08, 0.15, (tt, p) => noise() * decay(p, 6));
    } else if (kind === "chime") {
      [1046.5, 1318.5, 1568].forEach((f, i) => add(t + i * 0.06, 1.4, 0.11, (tt, p) => Math.sin(2 * Math.PI * f * tt) * decay(p, 3.5)));
    }
  }

  // 끝을 부드럽게 줄이고, 소리가 깨지지 않게 크기를 맞춘다.
  let peak = 0;
  for (let i = 0; i < N; i += 1) {
    const fadeOut = Math.min(1, (N - i) / (SR * 1.5));
    buf[i] *= fadeOut;
    peak = Math.max(peak, Math.abs(buf[i]));
  }
  const scale = peak > 0 ? 0.85 / peak : 1;
  const pcm = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i += 1) {
    const v = Math.max(-1, Math.min(1, buf[i] * scale)) * 32767;
    pcm.writeInt16LE(v, i * 4);
    pcm.writeInt16LE(v, i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  writeFileSync(file, Buffer.concat([header, pcm]));
}
