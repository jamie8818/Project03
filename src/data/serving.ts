// 打工接客的會話資料。客人說一句日文，你選對的回應/動作。
// tier 0=五十音初心者也能玩（招呼＋無厘頭），1=學了些單字，2=進階（結帳/敬語）。
// phase：greet 招呼 / order 點餐 / pay 結帳 / bye 送客。

// 食物庫來源（111 種，美術 session 產）；FOOD_POOL 直接吃它
import FOOD_POOL_RAW from '../../docs/food-pool.json' with { type: 'json' };

export interface Exchange {
  phase: 'greet' | 'order' | 'pay' | 'bye';
  tier: 0 | 1 | 2;
  say: string; // 客人說的（含漢字）
  kana: string; // 讀音（TTS 用 say）
  zh: string; // 客人這句的中文
  answer: string; // 正確回應/動作
  wrong: string[]; // 干擾選項
  silly?: boolean; // 無厘頭
}

export const EXCHANGES: Exchange[] = [
  // ── tier 0：招呼／送客／無厘頭，五十音初心者也能玩 ──
  { phase: 'greet', tier: 0, say: 'こんにちは', kana: 'こんにちは', zh: '你好（白天）', answer: 'いらっしゃいませ！', wrong: ['さようなら', 'おやすみ', 'いただきます'] },
  { phase: 'greet', tier: 0, say: 'おはよう', kana: 'おはよう', zh: '早安', answer: 'おはようございます！', wrong: ['こんばんは', 'ごちそうさま', 'ごめんなさい'] },
  { phase: 'greet', tier: 0, say: 'こんばんは', kana: 'こんばんは', zh: '晚上好', answer: 'いらっしゃいませ！', wrong: ['おはよう', 'またね', 'すみません'] },
  { phase: 'bye', tier: 0, say: 'ごちそうさま', kana: 'ごちそうさま', zh: '謝謝招待（吃飽了）', answer: 'ありがとうございました！', wrong: ['いらっしゃいませ', 'はじめまして', 'いただきます'] },
  { phase: 'bye', tier: 0, say: 'また来るね', kana: 'またくるね', zh: '我還會再來', answer: 'お待ちしています！', wrong: ['はじめまして', 'ごめんなさい', 'いくらですか'] },
  { phase: 'greet', tier: 0, say: 'すみません', kana: 'すみません', zh: '不好意思（叫店員）', answer: 'はい、ただいま！', wrong: ['さようなら', 'おやすみなさい', 'いただきます'] },
  { phase: 'order', tier: 0, silly: true, say: 'にゃ', kana: 'にゃ', zh: '喵。（貓客人只會喵）', answer: '（先端一杯水給牠）', wrong: ['（把牠趕出去）', '（也回一聲汪）', '（收 100 萬円）'] },
  { phase: 'order', tier: 0, silly: true, say: 'プリンを100個！', kana: 'プリンをひゃっこ！', zh: '給我一百個布丁！', answer: 'ええっ、100 個ですか！？', wrong: ['はい、0 個ですね', 'さようなら', 'おやすみなさい'] },
  { phase: 'greet', tier: 0, silly: true, say: 'ぽ〜う', kana: 'ぽ〜う', zh: '（店長熊貓亂入）ぽ〜う', answer: 'ぽ〜う（回應牠）', wrong: ['報警', '假裝沒看到', 'いくらですか'] },
  { phase: 'bye', tier: 0, say: 'ありがとう', kana: 'ありがとう', zh: '謝謝', answer: 'どういたしまして！', wrong: ['すみません', 'いただきます', 'はじめまして'] },
  { phase: 'greet', tier: 0, say: 'はじめまして', kana: 'はじめまして', zh: '初次見面', answer: 'はじめまして、どうぞ！', wrong: ['ごちそうさま', 'おやすみ', 'いくらですか'] },
  { phase: 'order', tier: 0, say: 'メニューください', kana: 'メニューください', zh: '請給我菜單', answer: 'はい、どうぞ！', wrong: ['ありません', 'さようなら', 'おやすみ'] },

  // ── tier 1：真的點餐、簡單問句（用到食物單字） ──
  { phase: 'order', tier: 1, say: 'プリンをください', kana: 'プリンをください', zh: '請給我布丁', answer: '🍮 布丁', wrong: ['☕ 咖啡', '🍜 拉麵', '🍰 蛋糕'] },
  { phase: 'order', tier: 1, say: 'コーヒーをおねがいします', kana: 'コーヒーをおねがいします', zh: '麻煩給我咖啡', answer: '☕ 咖啡', wrong: ['🍮 布丁', '🍵 茶', '🥤 蘇打'] },
  { phase: 'order', tier: 1, say: 'お茶をひとつ', kana: 'おちゃをひとつ', zh: '一杯茶', answer: '🍵 茶', wrong: ['☕ 咖啡', '🍺 啤酒', '🥛 牛奶'] },
  { phase: 'order', tier: 1, say: 'ケーキをふたつ', kana: 'ケーキをふたつ', zh: '兩個蛋糕', answer: '🍰🍰 兩個蛋糕', wrong: ['🍰 一個蛋糕', '🍮 兩個布丁', '☕ 兩杯咖啡'] },
  { phase: 'order', tier: 1, say: 'ラーメンが食べたい', kana: 'ラーメンがたべたい', zh: '我想吃拉麵', answer: '🍜 拉麵', wrong: ['🍣 壽司', '🍞 麵包', '🍮 布丁'] },
  { phase: 'pay', tier: 1, say: 'いくらですか？', kana: 'いくらですか？', zh: '多少錢？', answer: '300円です', wrong: ['ありがとう', 'いらっしゃいませ', 'どういたしまして'] },
  { phase: 'order', tier: 1, say: 'おすすめは何ですか？', kana: 'おすすめはなんですか？', zh: '有什麼推薦的？', answer: 'プリンがおすすめです！', wrong: ['ありません', 'いくらですか', 'さようなら'] },
  { phase: 'order', tier: 1, say: '水をください', kana: 'みずをください', zh: '請給我水', answer: '💧 水', wrong: ['🍺 啤酒', '☕ 咖啡', '🧃 果汁'] },
  { phase: 'bye', tier: 1, say: 'おいしかったです', kana: 'おいしかったです', zh: '很好吃', answer: 'ありがとうございます！', wrong: ['すみません', 'いくらですか', 'はじめまして'] },
  { phase: 'order', tier: 1, silly: true, say: '一番高いのください', kana: 'いちばんたかいのください', zh: '給我最貴的！', answer: '（端出金黃布丁）', wrong: ['（端出水）', '（假裝聽不懂）', '（把店賣給他）'] },
  { phase: 'pay', tier: 1, say: 'カードで払えますか？', kana: 'カードではらえますか？', zh: '可以刷卡嗎？', answer: 'はい、大丈夫です', wrong: ['いいえ、現金だけです（其實可以）', 'いくらですか', 'ごちそうさま'] },

  // ── tier 2：結帳數字、敬語、進階應對 ──
  { phase: 'pay', tier: 2, say: '五百円です、どうぞ', kana: 'ごひゃくえんです、どうぞ', zh: '（客人付）這是五百円', answer: 'お預かりします、お釣りです', wrong: ['足りません', '千円です', 'ありがとうございました、また'] },
  { phase: 'order', tier: 2, say: '砂糖は入れないでください', kana: 'さとうはいれないでください', zh: '請不要加糖', answer: 'かしこまりました（不加糖）', wrong: ['砂糖を 3 つ入れます', 'ありません', 'いくらですか'] },
  { phase: 'order', tier: 2, say: 'アレルギーはありますか、卵は？', kana: 'アレルギーはありますか、たまごは？', zh: '有含蛋嗎？（過敏）', answer: 'このプリンは卵を使っています', wrong: ['わかりません（亂猜）', 'ぜんぶ入っています', 'さようなら'] },
  { phase: 'pay', tier: 2, say: '領収書をお願いします', kana: 'りょうしゅうしょをおねがいします', zh: '請給我收據', answer: 'はい、少々お待ちください', wrong: ['ありません', 'ごちそうさま', 'いらっしゃいませ'] },
  { phase: 'greet', tier: 2, say: '二名ですが、席はありますか？', kana: 'にめいですが、せきはありますか？', zh: '兩位，有位子嗎？', answer: 'はい、こちらへどうぞ', wrong: ['ありません（其實有）', 'いくらですか', 'ごちそうさま'] },
  { phase: 'order', tier: 2, say: 'テイクアウトできますか？', kana: 'テイクアウトできますか？', zh: '可以外帶嗎？', answer: 'はい、お包みします', wrong: ['店内だけです（其實可以）', 'わかりません', 'さようなら'] },
  { phase: 'bye', tier: 2, say: 'ごちそうさまでした、また来ます', kana: 'ごちそうさまでした、またきます', zh: '謝謝招待，還會再來', answer: 'ありがとうございました、お気をつけて', wrong: ['はじめまして', 'いらっしゃいませ', 'いくらですか'] },
];

/** 依學習進度定接客難度：學過的卡越多，客人說的話越進階 */
export function serveTier(learnedCount: number): 0 | 1 | 2 {
  if (learnedCount < 25) return 0;
  if (learnedCount < 80) return 1;
  return 2;
}

function shuffle<T>(a: T[], rng: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** 抽一位客人的橋段：以玩家 tier 為上限，偏向當前 tier、偶爾摻簡單的當變化 */
export function pickExchange(playerTier: 0 | 1 | 2, rng: () => number = Math.random): Exchange {
  const pool = EXCHANGES.filter((e) => e.tier <= playerTier);
  // 七成抽當前 tier、三成抽較簡單的
  const atTier = pool.filter((e) => e.tier === playerTier);
  const bag = rng() < 0.7 && atTier.length > 0 ? atTier : pool;
  return bag[Math.floor(rng() * bag.length)];
}

/** 組四選一：正解＋三個干擾（不足就從其他橋段的 answer 補） */
export function serveChoices(ex: Exchange, rng: () => number = Math.random): string[] {
  const opts = new Set<string>([ex.answer, ...ex.wrong]);
  for (const other of shuffle(EXCHANGES, rng)) {
    if (opts.size >= 4) break;
    if (other.answer !== ex.answer) opts.add(other.answer);
  }
  return shuffle([...opts].slice(0, 4), rng);
}

// ════════════════════════════════════════════════════════════════════
// 出餐版接客（第三版）：食物庫 + 西村客人（5 動作）。詳見 docs/接客出餐版.md
// ════════════════════════════════════════════════════════════════════

// ── 食物庫（獨立於主課綱 SRS，111 種，場間輪替抽 10）──
// 資料＝美術 session 產的 docs/food-pool.json（單一來源，直接 import；圖在 public/baito/food/{id}.png）
export interface FoodItem {
  id: string; // 內部 slug（英文，＝圖檔名，程式用它當 key）
  ja: string; // 日文顯示名（客人氣泡/卡片顯示用；⚠️ 別餵 TTS——台式/異國漢字菜名會誤讀，臭豆腐→におい豆腐）
  kana: string; // 讀音（pre-lesson 卡顯示＋TTS 唸這個；異國/台式漢字料理是近似讀音，待校對）
  zh: string; // 中文
  price: number;
  cuisine: string; // 菜系（台式/各國/日式/甜點/綜合/美式，metadata）
  category: '甜點' | '飲料' | '正餐' | '點心' | '主食'; // 功能分類
  tags: ('甜' | '冰' | '熱' | '鹹' | '酸')[]; // 「あまいもの／つめたい」描述點餐比對（二版）
  art: string; // 去背 PNG 路徑
}

export const FOOD_POOL: FoodItem[] = FOOD_POOL_RAW as FoodItem[];

/** 抽今日這場的食物：未學（mastery 低）優先＋摻幾張生疏，湊 n 張。
 *  目前池子＝10，n=10 就是全露；池子變大後這裡負責輪替。 */
export function pickTodayFoods(
  mastery: Record<string, number> = {},
  n = 10,
  rng: () => number = Math.random,
): FoodItem[] {
  const ranked = [...FOOD_POOL].sort(
    (a, b) => (mastery[a.id] ?? 0) - (mastery[b.id] ?? 0) || rng() - 0.5,
  );
  return shuffle(ranked.slice(0, Math.min(n, FOOD_POOL.length)), rng);
}

// ── 點餐台詞（MVP：指名單品。ください／お願いします／ひとつ 都在課綱教過）──
export interface OrderLine {
  say: string; // 客人說的（氣泡顯示；含漢字菜名）
  kana: string; // 全假名句（TTS 唸這個——漢字菜名 TTS 會誤讀）
  zh: string;
}
// 台詞用全假名（お願い→おねがい），避免氣泡出現「漢字句＋讀音句」看起來重複；
// 唯一漢字＝食物本身（お茶＝茶），讀音靠 pre-lesson 教過＋點氣泡 TTS。
const ORDER_TEMPLATES: { suf: string; kana: string; zh: (z: string) => string }[] = [
  { suf: 'をください', kana: 'をください', zh: (z) => `請給我${z}` },
  { suf: 'をおねがいします', kana: 'をおねがいします', zh: (z) => `麻煩給我${z}` },
  { suf: 'をひとつ', kana: 'をひとつ', zh: (z) => `給我一份${z}` },
];
export function orderLine(food: FoodItem, rng: () => number = Math.random): OrderLine {
  const t = ORDER_TEMPLATES[Math.floor(rng() * ORDER_TEMPLATES.length)];
  return { say: food.ja + t.suf, kana: food.kana + t.kana, zh: t.zh(food.zh) };
}

// ── 複數點餐（最多 3 樣不同品項）──
// batch＝一口氣講完（「アイスとパンをください」，教 と）；
// seq＝給完之後又多要（「パンもください」，教 も）。3 樣一律走 seq，氣泡才不會太長。
export const MAX_ORDER = 3;
export type OrderMode = 'single' | 'batch' | 'seq';
export interface Order {
  items: FoodItem[]; // 1–3 樣不同食物
  mode: OrderMode;
}

/** 抽一張訂單：多數單品，部分複數（同桌不同品項） */
export function buildOrder(foods: FoodItem[], rng: () => number = Math.random): Order {
  const uniq = shuffle(foods, rng);
  const r = rng();
  let count = 1;
  if (uniq.length >= 3 && r < 0.12) count = 3;
  else if (uniq.length >= 2 && r < 0.42) count = 2;
  const items = uniq.slice(0, count);
  const mode: OrderMode = count === 1 ? 'single' : count === 3 ? 'seq' : rng() < 0.5 ? 'batch' : 'seq';
  return { items, mode };
}

/** 一句點餐台詞（deterministic，供複數/追加用）。additional＝追加用「も」，多品項用「と」串 */
export function orderPhrase(items: FoodItem[], additional = false): OrderLine {
  if (items.length === 1) {
    const f = items[0];
    const p = additional ? 'も' : 'を';
    return { say: `${f.ja}${p}ください`, kana: `${f.kana}${p}ください`, zh: `${additional ? '還要' : '請給我'}${f.zh}` };
  }
  const ja = items.map((f) => f.ja).join('と');
  const kana = items.map((f) => f.kana).join('と');
  const zh = items.map((f) => f.zh).join('、');
  return { say: `${ja}をください`, kana: `${kana}をください`, zh: `請給我${zh}` };
}

// ── 客人：西村（Studio U.G.）10 角色，每角色 5 動作 slug{0-4} ──
// 圖在 public/baito/customers/{slug}{action}.png（非像素、painted、去背）
export const CUST_ACTION = { walkin: 0, talk: 1, wait: 2, happy: 3, angry: 4 } as const;
export type CustAction = keyof typeof CUST_ACTION;

export const CUSTOMER_CHARS: { id: string; name: string }[] = [
  { id: 'konezumi', name: 'こねずみ' },
  { id: 'warumeneko', name: 'わるめねこ' },
  { id: 'saenaineko', name: 'さえないねこ' },
  { id: 'loverabbit', name: 'こいうさぎ' },
  { id: 'kanedakon', name: 'かねだこん' },
  { id: 'kaeru', name: 'かえる' },
  { id: 'kobito', name: 'こびと' },
  { id: 'pekio', name: 'ぺきお' },
  { id: 'piko', name: 'ぴこ' },
  { id: 'obakakonezumi', name: 'おばかこねずみ' },
];

export function custSprite(slug: string, action: CustAction): string {
  return `/baito/customers/${slug}${CUST_ACTION[action]}.png`;
}

export function pickCustomer(rng: () => number = Math.random): { id: string; name: string } {
  return CUSTOMER_CHARS[Math.floor(rng() * CUSTOMER_CHARS.length)];
}
