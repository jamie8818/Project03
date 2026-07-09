import type { CardState } from '../types.ts';
import { addDays } from './dates.ts';

// 簡化版 SM-2：兩檔評分（會/不會）。答對間隔 1→3→×ease，答錯歸零當天重來。
export const NEW_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;

export function newCard(id: string, today: string): CardState {
  return { id, reps: 0, lapses: 0, ease: NEW_EASE, ivl: 0, due: today };
}

/** 已熟字系的種子卡：當作背過，錯開到期日讓它慢慢輪一遍驗證 */
export function seededCard(id: string, today: string, offsetDays: number): CardState {
  return { id, reps: 3, lapses: 0, ease: NEW_EASE, ivl: 10, due: addDays(today, offsetDays) };
}

export function grade(card: CardState, ok: boolean, today: string): CardState {
  if (!ok) {
    return {
      ...card,
      reps: 0,
      lapses: card.lapses + 1,
      ease: Math.max(MIN_EASE, card.ease - 0.2),
      ivl: 0,
      due: today,
    };
  }
  const reps = card.reps + 1;
  const ivl = reps === 1 ? 1 : reps === 2 ? 3 : Math.max(card.ivl + 1, Math.round(card.ivl * card.ease));
  return {
    ...card,
    reps,
    ivl,
    ease: Math.min(MAX_EASE, card.ease + 0.05),
    due: addDays(today, ivl),
  };
}

export function isDue(card: CardState, today: string): boolean {
  return card.due <= today;
}

/** 精熟：間隔 ≥ 14 天視為已掌握（儀表板/五十音表上色用） */
export function isMastered(card: CardState): boolean {
  return card.ivl >= 14;
}

export function isLearning(card: CardState): boolean {
  return card.reps > 0 || card.lapses > 0;
}
