export type UserId = 'jj' | 'yaxuan';

export type Script = 'hira' | 'kata';

/** 一張 SRS 卡的排程狀態。內容由 id 前綴對回資料表：
 *  h:/k: 假名、w: N5 牌組單字、v: 歌詞加入的單字（內容存 UserState.vocab） */
export interface CardState {
  id: string; // 'h:あ' | 'k:ア' | 'w:食べる' | 'v:故郷'
  reps: number; // 連續答對次數
  lapses: number; // 忘記次數
  ease: number; // 難易係數，起始 2.5
  ivl: number; // 目前間隔（天）
  due: string; // 到期日 YYYY-MM-DD（台北時區）
}

export interface UserState {
  user: UserId;
  createdAt: string;
  updatedAt: string; // ISO，KV 同步 last-write-wins 用
  streak: number;
  lastDoneDate: string; // 最後完成每日練習的日期 YYYY-MM-DD
  totalMinutes: number;
  sessionsDone: number;
  knownScripts: { hira: boolean; kata: boolean }; // 初次設定：已熟的假名
  newPerDay: number;
  cards: Record<string, CardState>;
  vocab: Record<string, { jp: string; kana: string; zh: string; src: string }>; // v: 卡的內容（來源＝歌名）
  phraseIdx: number; // 今日一句進度
  xp: number;
  sprintBest: number;
  maxCombo: number;
  achievements: string[];
  duel: { w: number; l: number; streak: number; lastCounted: string }; // lastCounted=已入帳的對決日期，防重複計
  omikuji?: { date: string; luck: string; kana: string; line: string }; // 今日御神籤
  puddings: Record<string, number>; // 布丁圖鑑：口味 id → 累積數
  coins: number; // 扭蛋金幣
  mystery?: { date: string; correct: number }; // 神秘客：今日已接待紀錄
  wornBadge: string; // 佩戴中的成就徽章 id（'' = 沒戴）
  bossClaimed: string; // 已領獎的 Boss 週 id（防重複領）
  minigames: { dictBest: number; pairsBest: number; clozeBest: number }; // 小遊戲最佳紀錄
  claimedStreaks: number[]; // 已領過的連續里程碑（防重複）
  shiftBest: number; // 打工單場最高小費
  regulars?: Record<string, number>; // 打工服務滿意過的客人 charId → 次數（常客，供商店展示）
  foodMastery?: Record<string, number>; // 出餐版：食物庫的熟練度 foodId → 累積答對數（獨立於 cards SRS，供場間輪替抽選）
  // ── 今日課程 ──
  goal?: { level: 'N5' | 'N4'; date: string }; // 學習目標：等級＋達成日（儀表板配速用，可改）
  cram?: { date: string; coins: number }; // 背單字：今日已領金幣（每日上限防刷，見 lib/cram.ts）
  introGiftClaimed?: boolean; // 喫茶店首次引導的店長私房錢（350🪙）是否已領（每帳號一次）
  catAffection?: { value: number; lastPetAt: number; pets: number[]; sulkUntil: number }; // 粉圓好感度（E19；未初始化＝lib/cat.ts 起始值）
  lessonsPassed?: number[]; // 小測達標(≥70%)的課號＝該課真正學完（課程完成的門檻）
  lastSprintDate?: string; // 最後一次「一天一課衝刺」的日期（隔天＝消化日、不給新課）
  quizFail?: { no: number; date: string }; // 最後一次小測沒過的課與日期（隔天＝補強日）
}

export interface KanaInfo {
  id: string;
  kana: string;
  romaji: string;
  script: Script;
  row: string; // 'あ行' 等，介紹順序用
}

export type QuizMode = 'kana2roma' | 'audio2kana' | 'lookalike' | 'word2zh' | 'grammar';

export type SessionItem =
  | { kind: 'teach'; cardId: string }
  | { kind: 'flash'; cardId: string }
  | { kind: 'quiz'; cardId: string; mode: QuizMode; retest?: boolean }
  | { kind: 'dialog'; lessonNo: number } // 讀本課會話
  | { kind: 'minitest'; lessonNo: number } // 本課小測（自我檢查、達 70% 過關）
  | { kind: 'phrase'; idx: number };

export interface PeerSummary {
  streak: number;
  lastDoneDate: string;
  totalMinutes: number;
  sessionsDone: number;
  updatedAt: string;
}
