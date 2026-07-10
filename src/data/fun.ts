// Wave 1 遊戲化資料：御神籤＋布丁圖鑑
import { HIRAGANA, KATAKANA } from './kana.ts';

// ── 御神籤 ──

export interface Luck {
  id: string;
  label: string;
  weight: number;
  xp: number; // 抽到即得
}

export const LUCKS: Luck[] = [
  { id: 'daikichi', label: '大吉', weight: 8, xp: 10 },
  { id: 'kichi', label: '吉', weight: 22, xp: 6 },
  { id: 'chukichi', label: '中吉', weight: 30, xp: 4 },
  { id: 'shokichi', label: '小吉', weight: 28, xp: 3 },
  { id: 'suekichi', label: '末吉', weight: 12, xp: 2 },
];

// 籤詩（店長流解籤，30 句）
export const OMIKUJI_LINES: Record<string, string[]> = {
  daikichi: [
    '今天的你，連片假名都會怕',
    '運氣好到布丁都多一層焦糖，快去練習收割',
    '諸事皆宜。宜背單字、宜下戰帖、宜囂張',
    '今日之運，百年一遇（明天重抽）',
    '大吉！今天答錯的題目都只是謙虛',
    '天時地利人和，缺你按開始',
  ],
  kichi: [
    '吉。放心衝，錯了算我的（算你的）',
    '今天適合挑戰新東西，例如濁音',
    '好運在題目裡等你，去領',
    '吉日宜學習，忌拖延（每天都忌）',
    '貓咪今天對你眨了眼，是好兆頭',
    '穩穩的好運，像布丁的底層',
  ],
  chukichi: [
    '中吉。不好不壞，跟我的營業態度一樣',
    '中間偏上的一天，適合中間偏上的努力',
    '今天的運勢像溫布丁：不驚豔，但舒服',
    '平常心，平常練，平常棒',
    '中吉之日，適合複習舊字（新字明天再說）',
    '運勢普通，但你不普通，扯平',
  ],
  shokichi: [
    '小吉。小小的運，配小小的進步，剛好',
    '今天適合安靜地變強',
    '小吉：會有小確幸，例如一次答對',
    '運氣小小的，題目挑軟的捏沒關係',
    '慢慢來，小吉最持久',
    '今天的幸運要自己創造（練就對了）',
  ],
  suekichi: [
    '末吉。跌到底就是漲，練起來',
    '今天手滑答錯不算實力，安心',
    '末吉之日，店長陪你，怕什麼',
    '運勢在充電中，用努力先頂著',
    '越是末吉，越要練——這叫逆天改命',
    '沒關係，布丁還是甜的',
  ],
};

/** 抽籤：回傳運勢＋今日幸運假名（基礎 92 音隨機） */
export function drawOmikuji(rng: () => number = Math.random): { luck: string; kana: string; line: string } {
  const total = LUCKS.reduce((n, l) => n + l.weight, 0);
  let r = rng() * total;
  let luck = LUCKS[LUCKS.length - 1];
  for (const l of LUCKS) {
    r -= l.weight;
    if (r <= 0) {
      luck = l;
      break;
    }
  }
  const base = [...HIRAGANA.slice(0, 46), ...KATAKANA.slice(0, 46)];
  const kana = base[Math.floor(rng() * base.length)].kana;
  const lines = OMIKUJI_LINES[luck.id];
  return { luck: luck.id, kana, line: lines[Math.floor(rng() * lines.length)] };
}

export const luckOf = (id: string): Luck => LUCKS.find((l) => l.id === id) ?? LUCKS[2];

// ── 布丁圖鑑（E17：24→100 味，資料源 docs/puddings.json → puddings.gen.ts；改內容重跑 build-puddings.py）──

import { PUDDINGS_GEN, type PuddingGen, type RarityGen } from './puddings.gen.ts';
export type { PuddingVariant } from './puddings.gen.ts';

export type Rarity = RarityGen; // 'N' | 'R' | 'SR' | 'UR'（E17 新增 UR 5 款，權重要含 UR 否則抽不到）
export type Pudding = PuddingGen; // 舊 24 款已逐字驗證與 gen 一致，存檔相容

export const PUDDINGS: Pudding[] = PUDDINGS_GEN;

export const PUDDING_BY_ID: Record<string, Pudding> = Object.fromEntries(PUDDINGS.map((p) => [p.id, p]));

/** 稀有率隨 streak 提升：素人 → 一週 → 一個月。UR＝比 SR 更稀：streak≥7 才開一絲機率 */
export function rarityWeights(streak: number): Record<Rarity, number> {
  if (streak >= 30) return { N: 45, R: 39, SR: 15, UR: 1 };
  if (streak >= 7) return { N: 60, R: 32, SR: 7.5, UR: 0.5 };
  return { N: 80, R: 18, SR: 2, UR: 0 };
}

const RARITY_ORDER = ['N', 'R', 'SR', 'UR'] as const;
function rollRarity(w: Record<Rarity, number>, rng: () => number): Rarity {
  const total = RARITY_ORDER.reduce((s, k) => s + w[k], 0);
  let r = rng() * total;
  for (const k of RARITY_ORDER) {
    r -= w[k];
    if (r <= 0) return k;
  }
  return 'N';
}

function pickByRarity(rarity: Rarity, rng: () => number): Pudding {
  const pool = PUDDINGS.filter((p) => p.rarity === rarity);
  return pool[Math.floor(rng() * pool.length)];
}

/** 每日完成掉一顆 */
export function dropPudding(streak: number, rng: () => number = Math.random): Pudding {
  return pickByRarity(rollRarity(rarityWeights(streak), rng), rng);
}

// ── 神秘客（Wave 2）：隨機日子上門，答對 3 題特別題掉好貨 ──

import { hashSeed, mulberry32 } from '../lib/seeded.ts';

/** 今天有沒有神秘客（依 user+date 決定，兩人各自約 35% 的日子） */
export function mysteryToday(user: string, date: string): boolean {
  return mulberry32(hashSeed(`mc:${user}:${date}`))() < 0.35;
}

/** 神秘客獎勵：全對保底 R 起跳（R70/SR30） */
export function mysteryReward(rng: () => number = Math.random): Pudding {
  return pickByRarity(rollRarity({ N: 0, R: 68, SR: 28, UR: 4 }, rng), rng);
}

export const MYSTERY_XP = { perfect: 15, partial: 5 } as const;

// ── 扭蛋機（Wave 2）：金幣換布丁，機率比每日掉落好 ──

export const GACHA_COST = 30;
export const COINS = {
  daily: 50, // JJ 2026-07-09 調升（原 10）：每日完課是最該獎勵的行為
  duelWin: 15, // 原 5
  mysteryPerfect: 15,
  minigame: 10, // 聽寫/翻牌/挖空 過關（原 3）
  achievement: 20, // 每解一個成就
  bossClaim: 20,
} as const; // 衝刺另計 score/50、打工另計營業額÷5（Games.tsx SHIFT_COIN_DIVISOR）、里程碑另計、背單字另計（lib/cram.ts）

// 連續天數里程碑一次性獎金（達到當天結算，防重複由 store 記 claimedStreaks）
export const STREAK_MILESTONES: { day: number; coins: number }[] = [
  { day: 3, coins: 15 },
  { day: 7, coins: 40 },
  { day: 14, coins: 80 },
  { day: 30, coins: 200 },
  { day: 60, coins: 400 },
  { day: 100, coins: 800 },
];

/** 回傳這個 streak 值剛好命中、且還沒領過的里程碑 */
export function dueStreakMilestone(streak: number, claimed: number[]): { day: number; coins: number } | null {
  return STREAK_MILESTONES.find((m) => m.day === streak && !claimed.includes(m.day)) ?? null;
}

export interface GachaResult {
  puddings: Pudding[]; // 大當たり會有兩顆
  jackpot: boolean;
}

export function gachaRoll(rng: () => number = Math.random): GachaResult {
  const first = pickByRarity(rollRarity({ N: 49, R: 34, SR: 15, UR: 2 }, rng), rng);
  const jackpot = rng() < 0.1; // 10% 大當たり再送一顆（第二顆 UR 率更高＝大當たり才有的期待感）
  return jackpot ? { puddings: [first, pickByRarity(rollRarity({ N: 38, R: 39, SR: 20, UR: 3 }, rng), rng)], jackpot } : { puddings: [first], jackpot };
}

// ── 週間 Boss（Wave 3）──

export function weekId(date: string): string {
  // 以週一為週界：回傳該週週一日期字串
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 週一=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

const BOSS_NAMES = ['霧之漢字獸', '拗音大王', '濁點魔人', '片假名幻影', '長音龍', '促音小鬼眾', '五十音守門人', '曖昧發音怪'];

export function bossOfWeek(wid: string): { name: string; maxHp: number } {
  const rng = mulberry32(hashSeed(`boss:${wid}`));
  return { name: BOSS_NAMES[Math.floor(rng() * BOSS_NAMES.length)], maxHp: 300 };
}

export const BOSS_REWARD_XP = 50;
