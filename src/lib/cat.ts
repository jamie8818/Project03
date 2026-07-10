// 粉圓好感度系統（E19）：每人獨立 0-100，決定摸頭 pet/dodge 分支＋長期關係階級。
// 全部數值做常數方便調參；資料存 UserState.catAffection 隨既有管道同步。
import type { UserId } from '../types.ts';

export interface CatAffection {
  value: number; // 0-100
  lastPetAt: number; // 上次「有效摸」時間戳 ms（冷卻判定）
  pets: number[]; // 60s 滑動視窗內的點擊時間戳（連摸懲罰判定）
  sulkUntil: number; // 賭氣結束時間戳 ms（期間必拒）
}

// 起始值（JJ 待覆核：先照單亞軒 15／JJ 5，要改直接動這裡）
export const AFFECTION_START: Record<UserId, number> = { yaxuan: 15, jj: 5 };
export const AFFECTION_COOLDOWN_MS = 1800e3; // 30 分內只有一次「有效摸」
export const PET_ACCEPT_BASE = 0.3; // 好感 0 的接受率
export const PET_ACCEPT_PER_POINT = 0.006; // 每點好感 +0.6%（好感 100 → 90%）
export const TEASER_BONUS = 0.05; // E21：teaser_stand 擺出時的被動加成（+5%）
export const PET_ACCEPT_CAP = 0.95; // 接受率上限（好感 100＋逗貓棒＝90%+5% 剛好頂到）
export const PET_GAIN = 2; // 接受後好感增量
export const ANGRY_PENALTY = 3; // 生氣扣分
export const SPAM_WINDOW_MS = 60e3; // 連摸懲罰視窗
export const SPAM_LIMIT = 3; // 視窗內第 3 次（含）＝生氣
export const SULK_MS = 300e3; // 賭氣時長

export type PetOutcome =
  | 'pet' // 接受：爽臉＋❤＋好感 +2
  | 'dodge' // 拒絕：撇頭（不扣分、冷卻不重置，可再試手氣）
  | 'angry' // 連摸生氣：撇頭＋💢＋好感 −3＋賭氣
  | 'sulk' // 賭氣期間必拒（不擲骰）
  | 'cooldown'; // 冷卻內的無效摸（不擲骰不加分；視覺給輕量回饋）

export const initAffection = (user: UserId): CatAffection => ({
  value: AFFECTION_START[user] ?? 0,
  lastPetAt: 0,
  pets: [],
  sulkUntil: 0,
});

/** 摸頭判定（純函式）：回傳結果分支＋新狀態。判定順序＝賭氣 → 連摸 → 冷卻 → 擲骰。
 *  teaser＝場上擺了 teaser_stand（E21 被動 +5%，呼叫端查 layout 傳入）。 */
export function petCat(
  cur: CatAffection | undefined,
  user: UserId,
  now: number = Date.now(),
  rng: () => number = Math.random,
  teaser = false,
): { outcome: PetOutcome; next: CatAffection } {
  const a = cur ?? initAffection(user);
  const pets = [...a.pets.filter((t) => now - t < SPAM_WINDOW_MS), now];

  if (now < a.sulkUntil) return { outcome: 'sulk', next: { ...a, pets } };
  if (pets.length >= SPAM_LIMIT) {
    return {
      outcome: 'angry',
      next: { ...a, pets: [], value: Math.max(0, a.value - ANGRY_PENALTY), sulkUntil: now + SULK_MS },
    };
  }
  if (now - a.lastPetAt < AFFECTION_COOLDOWN_MS) return { outcome: 'cooldown', next: { ...a, pets } };

  const accept = rng() < Math.min(PET_ACCEPT_CAP, PET_ACCEPT_BASE + a.value * PET_ACCEPT_PER_POINT + (teaser ? TEASER_BONUS : 0));
  if (!accept) return { outcome: 'dodge', next: { ...a, pets } }; // 不更新 lastPetAt＝馬上可再試
  return { outcome: 'pet', next: { ...a, pets, value: Math.min(100, a.value + PET_GAIN), lastPetAt: now } };
}

/** 好感階級（顯示用）：0-24 生疏／25-49 熟悉／50-74 親近／75-100 家人 */
export function affectionTier(value: number): { name: string; badge: string } {
  if (value >= 75) return { name: '家人', badge: '❤❤❤' };
  if (value >= 50) return { name: '親近', badge: '❤❤♪' };
  if (value >= 25) return { name: '熟悉', badge: '❤' };
  return { name: '生疏', badge: '' };
}
