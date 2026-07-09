// 背單字（首頁自選分類速記，JJ 2026-07-09 需求）：挑一類 → 教 10 個 → 小考 → 依分數發金幣。
// 跟每日課程互通：小考評分直接寫 w: 卡 SRS（同 Session gradeQuiz 規則），背過的字進複習池、
// 每日滴漏不會重教（newCardOrder 會跳過已建卡）。
import type { UserState } from '../types.ts';
import { VOCAB_N5, type WordInfo } from '../data/vocab.ts';

export const CRAM_SIZE = 10;
export const CRAM_COIN_RATE = 1.5; // 金幣＝答對數×1.5 無條件捨去（滿分 15；JJ 2026-07-09 嫌 5 太少調高）
export const CRAM_DAILY_COIN_CAP = 45; // 每日背單字金幣上限（防無限刷；約 3 輪滿分的量）

const wid = (w: WordInfo) => `w:${w.jp}`;

export interface CramCategory {
  cat: string;
  total: number;
  learned: number; // 已建卡數（含每日課程學過的）
}

/** 分類清單（依 VOCAB_N5 出現順序）＋各類學習進度 */
export function cramCategories(state: UserState): CramCategory[] {
  const out: CramCategory[] = [];
  const idx = new Map<string, CramCategory>();
  for (const w of VOCAB_N5) {
    let c = idx.get(w.cat);
    if (!c) {
      c = { cat: w.cat, total: 0, learned: 0 };
      idx.set(w.cat, c);
      out.push(c);
    }
    c.total++;
    if (state.cards[wid(w)]) c.learned++;
  }
  return out;
}

/** 抽一輪 10 個：該類「還沒學」的優先（依牌組順序），不足補「最弱的已學」（ease 低、忘記多優先） */
export function cramRound(state: UserState, cat: string): WordInfo[] {
  const pool = VOCAB_N5.filter((w) => w.cat === cat);
  const fresh = pool.filter((w) => !state.cards[wid(w)]);
  const learned = pool
    .filter((w) => state.cards[wid(w)])
    .sort((a, b) => {
      const ca = state.cards[wid(a)], cb = state.cards[wid(b)];
      return ca.ease - cb.ease || cb.lapses - ca.lapses;
    });
  return [...fresh, ...learned].slice(0, CRAM_SIZE);
}

/** 小考選項：正解＋3 干擾。干擾優先取同輪其他字的中文（剛教過＝已教，無教不考），不足從同類補 */
export function cramChoices(w: WordInfo, round: WordInfo[], rng: () => number = Math.random): string[] {
  const opts = new Set<string>([w.zh]);
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  for (const x of shuffle(round)) {
    if (opts.size >= 4) break;
    if (x.zh !== w.zh) opts.add(x.zh);
  }
  if (opts.size < 4) {
    for (const x of shuffle(VOCAB_N5.filter((v) => v.cat === w.cat))) {
      if (opts.size >= 4) break;
      if (x.zh !== w.zh) opts.add(x.zh);
    }
  }
  return shuffle([...opts]);
}

/** 分數→金幣（含每日上限）。earned＝這輪實發；capLeft＝發完後今天還剩的額度 */
export function cramCoins(correct: number, state: UserState, today: string): { earned: number; capLeft: number } {
  const used = state.cram?.date === today ? state.cram.coins : 0;
  const raw = Math.floor(correct * CRAM_COIN_RATE);
  const earned = Math.max(0, Math.min(raw, CRAM_DAILY_COIN_CAP - used));
  return { earned, capLeft: CRAM_DAILY_COIN_CAP - used - earned };
}
