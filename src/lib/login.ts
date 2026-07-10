// 每日登入結算（熊貓店長來信）：純函式，App 首登觸發、Shop 進店補發家具。
import type { UserState } from '../types.ts';
import { ABSENT_TIERS, GIFT_COIN_FALLBACK, LOGIN_COINS, MAIL_MISSED_YESTERDAY, PANDA_GIFTS, giftsEarned, isGiftDay, letterFor } from '../data/panda-mail.ts';
import { daysBetween } from './dates.ts';

/** 依實際行為挑信：第一天開場 > 缺席分級（幾天沒練，由重到輕）> 昨天沒練 > 日常輪替。
 *  gap＝最後完成練習距今天數（登入時還沒練，昨天有練＝gap 1）；池內用累積天數輪替、同池不連兩天同封。 */
export function pickLetter(s: Pick<UserState, 'lastDoneDate'>, today: string, days: number): string {
  if (days <= 1 || !s.lastDoneDate) return letterFor(days); // 還沒開始上課＝不情勒，走日常/開場
  const gap = daysBetween(s.lastDoneDate, today);
  const tier = ABSENT_TIERS.find((t) => gap >= t.min);
  if (tier) return tier.letters[days % tier.letters.length];
  if (gap === 2) return MAIL_MISSED_YESTERDAY[days % MAIL_MISSED_YESTERDAY.length];
  return letterFor(days);
}

export interface LoginResult {
  state: UserState;
  days: number; // 累積登入天數（含今天）
  letter: string;
  coins: number; // 本次入帳金幣（零用錢；家具送完後的家具日再加轉蛋基金）
  gift?: { id: string; name: string }; // 今天剛好賺到的家具（實際入庫等進店，素材到貨才發）
}

/** 每日首登結算：同日冪等（回 null）。累積天數 +1、發零用錢；家具日回傳 gift 或發轉蛋基金。 */
export function applyLogin(s: UserState, today: string): LoginResult | null {
  if (s.login?.last === today) return null;
  const days = (s.login?.days ?? 0) + 1;
  const giftIdx = giftsEarned(days) - 1;
  const gift = isGiftDay(days) && giftIdx < PANDA_GIFTS.length && giftsEarned(days) > giftsEarned(days - 1) ? PANDA_GIFTS[giftIdx] : undefined;
  const coins = LOGIN_COINS + (isGiftDay(days) && !gift ? GIFT_COIN_FALLBACK : 0);
  return {
    state: {
      ...s,
      coins: s.coins + coins,
      login: { last: today, days, furn: s.login?.furn ?? 0 },
    },
    days,
    letter: pickLetter(s, today, days),
    coins,
    gift,
  };
}

/** 已賺到但還沒入庫的家具，照順序、只到第一件還沒進 catalog 的為止（素材未到貨＝先掛帳）。
 *  catalogIds＝現有家具 id 集合（呼叫端餵 CAFE_ITEMS，測試餵假的）。 */
export function grantableGifts(s: UserState, catalogIds: Set<string>): { id: string; name: string }[] {
  const earned = giftsEarned(s.login?.days ?? 0);
  const out: { id: string; name: string }[] = [];
  for (let i = s.login?.furn ?? 0; i < earned; i++) {
    if (!catalogIds.has(PANDA_GIFTS[i].id)) break;
    out.push(PANDA_GIFTS[i]);
  }
  return out;
}
