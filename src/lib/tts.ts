// Web Speech API 日文發音。iOS 坑：voices 非同步載入＋必須由使用者手勢觸發，
// 所以只在按鈕 onClick 裡呼叫 speakJa。
let jaVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (jaVoice) return jaVoice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  jaVoice =
    voices.find((v) => v.lang === 'ja-JP' && /Kyoko|O-?Ren|Hattori/i.test(v.name)) ||
    voices.find((v) => v.lang === 'ja-JP') ||
    voices.find((v) => v.lang.startsWith('ja')) ||
    null;
  return jaVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    jaVoice = null;
    pickVoice();
  });
}

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// 語速滑桿（裝置各自記憶）：絕對語速 0.3–1.2，預設 0.6
export const RATE_MIN = 0.3;
export const RATE_MAX = 1.2;
export const RATE_DEFAULT = 0.6;

export function getTtsRate(): number {
  const raw = localStorage.getItem('nng:rate') ?? '';
  const v = parseFloat(raw);
  if (Number.isFinite(v) && v >= RATE_MIN && v <= RATE_MAX) return v;
  // 舊版三段設定遷移
  if (raw === 'slow') return 0.45;
  if (raw === 'fast') return 0.8;
  return RATE_DEFAULT;
}

export function setTtsRate(r: number): void {
  localStorage.setItem('nng:rate', String(Math.min(RATE_MAX, Math.max(RATE_MIN, r))));
}

function makeUtterance(text: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = getTtsRate(); // 語速一律看滑桿設定；iOS 的 rate 非線性，0.6 已明顯放慢
  const v = pickVoice();
  if (v) u.voice = v;
  return u;
}

export function speakJa(text: string): void {
  if (!ttsAvailable()) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(makeUtterance(text));
}

/** 整段連播（對話/歌詞用），句間靠瀏覽器排隊；再叫一次或 stopSpeak 都會打斷 */
export function speakSeqJa(texts: string[]): void {
  if (!ttsAvailable()) return;
  window.speechSynthesis.cancel();
  for (const t of texts) window.speechSynthesis.speak(makeUtterance(t));
}

export function stopSpeak(): void {
  if (ttsAvailable()) window.speechSynthesis.cancel();
}
