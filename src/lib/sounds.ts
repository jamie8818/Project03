// 合成音效（Web Audio，零素材）。iOS 需使用者手勢：第一次互動時 resume。
// 開關存 localStorage nng:sound（預設開）。
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  return localStorage.getItem('nng:sound') !== '0';
}

export function setSoundOn(on: boolean): void {
  localStorage.setItem('nng:sound', on ? '1' : '0');
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 單音：square/triangle 波＋短衰減，8-bit 味 */
function beep(freq: number, dur = 0.09, at = 0, type: OscillatorType = 'square', vol = 0.16): void {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  correct(combo = 0) {
    if (!soundOn()) return;
    // 連對音高遞增（封頂 +12 半音）
    const base = 660 * Math.pow(2, Math.min(combo, 12) / 12);
    beep(base, 0.07);
    beep(base * 1.5, 0.09, 0.07);
  },
  wrong() {
    if (!soundOn()) return;
    beep(196, 0.15, 0, 'sawtooth', 0.12);
    beep(147, 0.2, 0.12, 'sawtooth', 0.12);
  },
  clear() {
    if (!soundOn()) return;
    [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, i * 0.11, 'square', 0.14));
  },
  levelup() {
    if (!soundOn()) return;
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.1, i * 0.08, 'triangle', 0.18));
  },
  win() {
    if (!soundOn()) return;
    [523, 523, 784, 1047].forEach((f, i) => beep(f, 0.13, i * 0.12));
  },
  lose() {
    if (!soundOn()) return;
    [330, 294, 262, 220].forEach((f, i) => beep(f, 0.16, i * 0.14, 'triangle', 0.14));
  },
  tick() {
    if (!soundOn()) return;
    beep(880, 0.03, 0, 'square', 0.06);
  },
  unlock() {
    if (!soundOn()) return;
    [784, 988, 1175].forEach((f, i) => beep(f, 0.1, i * 0.09, 'triangle', 0.16));
  },
};
