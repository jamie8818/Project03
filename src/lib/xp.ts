import type { UserState } from '../types.ts';
import { HIRAGANA, KATAKANA } from '../data/kana.ts';
import { isMastered } from './srs.ts';

// XP 來源：每日完成 +20、複習答對 +1、測驗答對 +2、衝刺分÷10、對決勝 +30
export const XP = { daily: 20, flash: 1, quiz: 2, duelWin: 30 } as const;

// 喫茶店員晉升路線（配合布丁喫茶風）
const TITLES = ['見習店員', '店員', '資深店員', '副店長', '店長', '傳說店長'];

/** level = floor(sqrt(xp/40))+1；升級門檻 40·(n-1)² */
export function levelInfo(xp: number): { level: number; title: string; cur: number; need: number; pct: number } {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
  const base = 40 * (level - 1) ** 2;
  const next = 40 * level ** 2;
  const cur = xp - base;
  const need = next - base;
  return {
    level,
    title: TITLES[Math.min(Math.floor((level - 1) / 3), TITLES.length - 1)],
    cur,
    need,
    pct: Math.min(100, Math.round((cur / need) * 100)),
  };
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  desc: string;
  check: (s: UserState) => boolean;
}

const wordCount = (s: UserState) => Object.keys(s.cards).filter((id) => id.startsWith('w:') || id.startsWith('v:')).length;
const allMastered = (s: UserState, prefix: string, total: number) =>
  Object.values(s.cards).filter((c) => c.id.startsWith(prefix) && isMastered(c)).length >= total;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-clear', icon: '⚔️', name: '初陣', desc: '完成第一次每日練習', check: (s) => s.sessionsDone >= 1 },
  { id: 'streak-7', icon: '🔥', name: '七日連鎖', desc: '連續 7 天', check: (s) => s.streak >= 7 },
  { id: 'streak-30', icon: '🌋', name: '三十日連鎖', desc: '連續 30 天', check: (s) => s.streak >= 30 },
  { id: 'hira-master', icon: '🌸', name: '平假名制霸', desc: '平假名全部精熟', check: (s) => allMastered(s, 'h:', HIRAGANA.length) },
  { id: 'kata-master', icon: '⚡', name: '片假名制霸', desc: '片假名全部精熟', check: (s) => allMastered(s, 'k:', KATAKANA.length) },
  { id: 'words-50', icon: '📖', name: '單字五十', desc: '累積學習 50 個單字', check: (s) => wordCount(s) >= 50 },
  { id: 'words-100', icon: '🗡️', name: '單字百人斬', desc: '累積學習 100 個單字', check: (s) => wordCount(s) >= 100 },
  { id: 'sprint-300', icon: '🏃', name: '衝刺300', desc: '限時衝刺單場 300 分', check: (s) => (s.sprintBest ?? 0) >= 300 },
  { id: 'combo-10', icon: '🎯', name: '十連COMBO', desc: '衝刺中連對 10 題', check: (s) => (s.maxCombo ?? 0) >= 10 },
  { id: 'duel-first-win', icon: '🏆', name: '初勝利', desc: '對決首勝', check: (s) => (s.duel?.w ?? 0) >= 1 },
  { id: 'duel-5streak', icon: '👑', name: '五連勝', desc: '對決連勝 5 場', check: (s) => (s.duel?.streak ?? 0) >= 5 },
  { id: 'song-collector', icon: '🎤', name: '歌詞收藏家', desc: '從歌詞加入 10 個單字', check: (s) => Object.keys(s.vocab ?? {}).length >= 10 },
];

/** 回傳這次新解鎖的成就 id（不改 state，呼叫端自己寫回） */
export function newlyUnlocked(s: UserState): string[] {
  const have = new Set(s.achievements ?? []);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(s)).map((a) => a.id);
}

/** 衝刺 combo 係數：連對 0–2 → ×1，3–5 → ×2，6+ → ×3 */
export function comboMultiplier(combo: number): number {
  return combo >= 6 ? 3 : combo >= 3 ? 2 : 1;
}
