import type { UserState } from '../types.ts';
import { HIRAGANA, KATAKANA } from '../data/kana.ts';
import { isMastered } from './srs.ts';
import { PUDDINGS } from '../data/fun.ts';
import { CAFE_ITEMS } from '../data/cafe.gen.ts';
import type { ShopState } from './shopstate.ts';

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

// ── E16 店鋪型成就：check 需要讀 ShopState（App 的成就偵測只吃 UserState），
//    用模組級 snapshot 橋接——Shop 端 fetch/save 時餵最新店況，沒逛過店＝null＝店鋪型成就一律 false，
//    等進店後任何 state 變動會再評一次。──
let shopSnap: ShopState | null = null;
export function setShopSnapshot(s: ShopState): void {
  shopSnap = s;
}
const placedN = (id: string) => (shopSnap ? shopSnap.layout.filter((p) => p.id === id).length : 0);
const placed = (id: string) => placedN(id) >= 1;
const owned = (id: string) => (shopSnap?.stock[id] ?? 0) >= 1;
const placedFrom = (ids: string[]) => ids.filter((id) => placed(id)).length; // snapshot 缺席時 placed()=false → 0
const gachaComplete = () => !!shopSnap && CAFE_ITEMS.filter((it) => it.category === 'personal').every((it) => (shopSnap!.stock[it.id] ?? 0) >= 1);
const pudsComplete = (s: UserState) => PUDDINGS.every((p) => (s.puddings?.[p.id] ?? 0) >= 1); // 門檻動態綁 PUDDINGS.length（E17 後＝100）

const TAIWAN_IDS = ['rice_cooker_tatung', 'figure_tatung_baby', 'candy_cabinet', 'chair_red_plastic', 'barber_pole', 'pinball_machine_small', 'soda_crate', 'altar_lamp_mini', 'mesh_cupboard', 'soda_fridge_glass', 'round_table_lazy_susan', 'tv_wooden_retro', 'karaoke_jukebox', 'mailbox_green', 'lantern_pair_temple', 'bus_stop_sign', 'thermos_flower', 'fan_standing_retro', 'poke_lottery_box', 'marble_jar', 'snack_box_crate', 'ring_toss_stall', 'bento_stack_steel', 'fortune_stick_tube', 'jiaobei_pair', 'spring_couplet', 'daily_calendar_tear', 'payphone_orange', 'guangming_lamp_tower', 'betel_neon_pole', 'rolling_shutter_half', 'utility_pole', 'school_desk_chair', 'papaya_milk', 'mango_shaved_ice'];
const FOOD_IDS = ['napolitan_spaghetti', 'thick_omelette_sandwich', 'hot_cake', 'cream_soda', 'pudding_parfait', 'iced_coffee', 'lemon_soda', 'papaya_milk', 'mango_shaved_ice'];
const PLANT_IDS = ['potted_plant', 'monstera_floor', 'green_onion_pot', 'inflatable_palm', 'kadomatsu', 'tanabata_bamboo'];

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
  // ── E16 Tier A 店鋪型（讀 shopSnap；沒逛過店前一律未達成）──
  { id: 'first-deco', icon: '🪑', name: '初擺設', desc: '第一次擺出任何家具', check: () => (shopSnap?.layout.length ?? 0) >= 1 },
  { id: 'interior-designer', icon: '🛋️', name: '室內設計師', desc: '同時擺出 30 件家具', check: () => (shopSnap?.layout.length ?? 0) >= 30 },
  { id: 'shark-keeper', icon: '🦈', name: '鯊魚飼育員', desc: '同時擺出 3 隻鯊魚抱枕', check: () => placedN('shark_plush') >= 3 },
  { id: 'gacha-complete', icon: '🎰', name: '完売御礼', desc: '珍藏・私物扭蛋全收集', check: () => gachaComplete() },
  { id: 'pudding-tycoon', icon: '🍮', name: '布丁大亨', desc: `布丁圖鑑集滿 ${PUDDINGS.length} 味`, check: (s) => pudsComplete(s) },
  { id: 'double-perfect', icon: '💯', name: '完食', desc: '布丁圖鑑＋扭蛋雙滿貫', check: (s) => pudsComplete(s) && gachaComplete() },
  { id: 'miser', icon: '💰', name: '守財奴', desc: '金幣存到 1000', check: (s) => s.coins >= 1000 },
  { id: 'pudding-freedom', icon: '🪙', name: '布丁自由', desc: '金幣存到 2000', check: (s) => s.coins >= 2000 },
  { id: 'onion-gravity', icon: '🧅', name: '蔥有引力', desc: '同時擁有蔥抓娃娃機和蔥花盆栽', check: () => owned('claw_machine_onion') && owned('green_onion_pot') },
  { id: 'this-is-taiwan', icon: '🇹🇼', name: '這裡是台灣', desc: '同時擺出 5 件台味家具', check: () => placedFrom(TAIWAN_IDS) >= 5 },
  { id: 'second-best', icon: '🥈', name: '第二名的男人', desc: '擁有萬年第二獎盃', check: () => owned('trophy_second_best') },
  { id: 'under-construction', icon: '🚧', name: '施工中', desc: '同時擺出三角錐、水泥袋、輪胎堆', check: () => placed('traffic_cone') && placed('cement_bag') && placed('tire_stack') },
  { id: 'full-course', icon: '🍽️', name: '滿漢全席', desc: '同時擺出 6 樣餐點', check: () => placedFrom(FOOD_IDS) >= 6 },
  { id: 'green-thumb', icon: '🪴', name: '綠手指', desc: '同時擺出 5 件植物', check: () => placedFrom(PLANT_IDS) >= 5 },
  { id: 'zoo-keeper', icon: '🦁', name: '動物園', desc: '鯊魚＋店長立牌＋任一公仔同框', check: () => placed('shark_plush') && placed('standee_shopkeeper') && (placed('figure_chiikawa') || placed('figure_hachiware') || placed('figure_usagi')) },
  { id: 'couch-potato', icon: '📺', name: '沙發馬鈴薯', desc: '布丁沙發配木紋電視', check: () => placed('pudding_sofa') && placed('tv_wooden_retro') },
  { id: 'regular-100', icon: '☕', name: '老主顧', desc: '累積完成 100 場練習', check: (s) => s.sessionsDone >= 100 },
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
