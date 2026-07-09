// 課綱資料的型別與選擇器。
// 實際內容在 curriculum.gen.ts（由 scripts/build-curriculum.mjs 從 Notion「日々日文・課綱教材」產生）。
// 這裡只放型別＋規則（助詞路由、卡片 id、drip 順序），gen 檔保持 Notion 的忠實鏡像、不摻規則。
// 接入合約：Notion 頁「課綱接入規格（給 app session）」。

export type Level = 'N5' | 'N4';

export interface LessonWord {
  jp: string; // 本課單字表「日文」欄（含漢字，可能帶 〜 前綴或（な））
  kana: string; // 假名
  romaji: string;
  zh: string;
  pos: string; // 詞性（名詞/動詞/助詞/な形容詞…）
}

export interface GrammarExample {
  jp: string;
  zh: string;
}

/** 小測一題：題目＋答案（供每日課程的自我檢查用）。 */
export interface QuizItem {
  q: string;
  a: string;
}

export interface GrammarPoint {
  id: string; // 課內穩定 id（build 產：`${no}-${index}`）
  pattern: string; // ### 標題（去掉開頭圈碼 ①②③）
  formula: string[]; // 📐 公式 callout（可多條）
  notes: string[]; // ⚠️ 提醒 callout
  examples: GrammarExample[];
}

export interface Lesson {
  no: number;
  level: Level;
  title: string;
  genki: string;
  sigure: string; // 時雨連結（校對來源）
  goals: string[];
  prereqLessons: number[]; // 從「開始前你要先會」解析出的課號
  words: LessonWord[];
  grammar: GrammarPoint[];
  dialog: GrammarExample[]; // 「串起來」情境會話（jp/zh 逐句）
  quiz: QuizItem[]; // 「小測」題目＋答案
}

import { CURRICULUM_RAW } from './curriculum.gen.ts';

/** 依課號排序（gen 產生時已過濾「已上線」＋排序，這裡再保險一次）。 */
export const LESSONS: Lesson[] = [...CURRICULUM_RAW].sort((a, b) => a.no - b.no);

export const lessonByNo = (no: number): Lesson | undefined => LESSONS.find((l) => l.no === no);

/**
 * 出現在「本課單字」表、但在 app 裡屬於文法（g:）而非單字（w:）的功能詞。
 * 課綱把助詞列進單字表方便對照，但它們由該課文法教、不建 w: 卡（接入合約：文法→g:）。
 */
export const PARTICLE_WORDS = new Set([
  'で', 'に', 'へ', 'が', 'を', 'は', 'から', 'まで', 'と', 'も', 'より', 'ね', 'よ', 'の',
]);

/** 是不是「該建 w: 單字卡」的字：排除助詞、排除 〜 開頭的接尾/接頭（如 〜さん）。 */
export function isVocabWord(w: LessonWord): boolean {
  if (PARTICLE_WORDS.has(w.jp)) return false;
  if (w.pos === '助詞' || w.jp.startsWith('〜')) return false;
  return true;
}

/** 卡面/卡 id 用的字：去掉課綱的文法註記尾綴 `（な）`（な形容詞標記，非字本身）。 */
export const normalizeWordJp = (jp: string): string => jp.replace(/（な）\s*$/, '').trim();

export const wordCardId = (jp: string) => `w:${normalizeWordJp(jp)}`;
export const grammarCardId = (g: Pick<GrammarPoint, 'id'>) => `g:${g.id}`;

/** 該課要建成 w: 卡的單字（過濾掉助詞/接尾）。 */
export const lessonVocab = (l: Lesson): LessonWord[] => l.words.filter(isVocabWord);

/**
 * 依課序展開所有 w: 單字卡 id（drip 用；跨課去重，前面課先出）。
 * 混合 gate：新字滴漏照這個順序走，取代原本 vocab.ts 的 deckOrder。
 */
export function curriculumWordOrder(): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const l of LESSONS) {
    for (const w of lessonVocab(l)) {
      const id = wordCardId(w.jp);
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** w: 卡 id → 單字內容（供 teach/flash/quiz 顯示；jp 已正規化去掉（な）；取第一次出現的課的資料）。 */
export const CURRICULUM_WORDS: Record<string, LessonWord> = (() => {
  const m: Record<string, LessonWord> = {};
  for (const l of LESSONS) {
    for (const w of lessonVocab(l)) {
      const id = wordCardId(w.jp);
      if (!m[id]) m[id] = { ...w, jp: normalizeWordJp(w.jp) };
    }
  }
  return m;
})();

/** 每個文法點掛在哪一課（供 g: 卡 gate：該課前置單字都教過才解鎖）。 */
export function grammarWithLesson(): { lesson: Lesson; point: GrammarPoint }[] {
  return LESSONS.flatMap((lesson) => lesson.grammar.map((point) => ({ lesson, point })));
}

// ── 文法卡（g:）──────────────────────────────────────────────

export const grammarCardIdOf = (point: Pick<GrammarPoint, 'id'>) => `g:${point.id}`;

/** 有例句的文法點才做成可考的 g: 卡（純介紹/表格點只教不考、不進 SRS）。 */
export const isQuizzableGrammar = (p: GrammarPoint): boolean => p.examples.length > 0;

/** 該課要建成 g: 卡的文法點（可考的）。 */
export const lessonGrammarCards = (l: Lesson): GrammarPoint[] => l.grammar.filter(isQuizzableGrammar);

/** g: 卡 id → 文法點內容＋所屬課（只含可考的）。 */
export const CURRICULUM_GRAMMAR: Record<string, { no: number; point: GrammarPoint }> = (() => {
  const m: Record<string, { no: number; point: GrammarPoint }> = {};
  for (const l of LESSONS) {
    for (const point of lessonGrammarCards(l)) m[grammarCardIdOf(point)] = { no: l.no, point };
  }
  return m;
})();

export const grammarByCardId = (id: string): GrammarPoint | null => CURRICULUM_GRAMMAR[id]?.point ?? null;

/**
 * 該課的 g: 文法卡是否可解鎖：該課的前置單字（w: 卡）都已在 state.cards（教過）。
 * 混合 gate 的「文法 gate」——單字滴漏、文法等該課字備齊才出。
 */
export function grammarUnlocked(lesson: Lesson, hasCard: (id: string) => boolean): boolean {
  return lessonVocab(lesson).every((w) => hasCard(wordCardId(w.jp)));
}

/** 依課序展開所有可考 g: 文法卡 id（drip 用，接在該課單字之後）。 */
export function curriculumGrammarOrder(): string[] {
  return LESSONS.flatMap((l) => lessonGrammarCards(l).map((p) => grammarCardIdOf(p)));
}
