import type { KanaInfo, QuizMode, SessionItem, UserState } from '../types.ts';
import { KANA_BY_ID, LOOKALIKE_GROUPS, introOrder } from '../data/kana.ts';
import { deckOrder } from '../data/vocab.ts';
import {
  LESSONS,
  lessonVocab,
  lessonGrammarCards,
  wordCardId,
  grammarCardIdOf,
  grammarByCardId,
  curriculumWordOrder,
} from '../data/curriculum.ts';
import { taughtKana, taughtWords, taughtGrammar, wordContent } from './taught.ts';
import { isDue, isLearning } from './srs.ts';

export const isWordCard = (id: string) => id.startsWith('w:') || id.startsWith('v:');
export const isGrammarCard = (id: string) => id.startsWith('g:');

/** 單字卡內容：w: 先查課綱、退回 vocab.ts 尾巴；v: 查使用者歌詞單字（實作在 taught.ts） */
export function wordInfo(cardId: string, state: UserState): { jp: string; kana: string; zh: string } | null {
  return wordContent(cardId, state);
}

export const MAX_REVIEWS = 30;
export const QUIZ_ROUND_SIZE = 10;

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 這張卡有沒有已學的易混淆同伴（有才出對比題） */
export function lookalikePeers(cardId: string, state: UserState): string[] {
  const group = LOOKALIKE_GROUPS.find((g) => g.includes(cardId));
  if (!group) return [];
  return group.filter((id) => id !== cardId && state.cards[id] && isLearning(state.cards[id]));
}

/**
 * 新卡介紹順序（混合 gate）：
 *  1. 先補不熟的字系（平假名優先）→ 另一個字系
 *  2. 五十音學完 → 依課綱課序滴漏：逐課先出該課單字（w:），該課單字全教過才解鎖該課文法（g:）
 *  3. 課綱教完 → vocab.ts 非課綱尾巴（補充 deck）
 */
export function newCardOrder(state: UserState): string[] {
  const scripts: ('hira' | 'kata')[] = [];
  if (!state.knownScripts.hira) scripts.push('hira');
  if (!state.knownScripts.kata) scripts.push('kata');
  if (state.knownScripts.hira) scripts.push('hira');
  if (state.knownScripts.kata) scripts.push('kata');
  const kana = scripts.flatMap((s) => introOrder(s));

  // 課綱：逐課 單字 → 文法。累積 gate＝第 N 課文法要「1..N 課單字都教過」才解鎖
  // （零單字的複習課如 L19/L24 靠累積條件擋住，不會 vacuously 提早解鎖）。
  const hasCard = (id: string) => !!state.cards[id];
  const curriculum: string[] = [];
  let cumulativeTaught = true;
  for (const lesson of LESSONS) {
    for (const w of lessonVocab(lesson)) curriculum.push(wordCardId(w.jp));
    cumulativeTaught = cumulativeTaught && lessonVocab(lesson).every((w) => hasCard(wordCardId(w.jp)));
    if (cumulativeTaught) {
      for (const p of lessonGrammarCards(lesson)) curriculum.push(grammarCardIdOf(p));
    }
  }

  // vocab.ts 非課綱尾巴（補充 deck，排在課綱之後）
  const inCurriculum = new Set(curriculumWordOrder());
  const tail = deckOrder().filter((id) => !inCurriculum.has(id));

  return [...kana, ...curriculum, ...tail].filter((id) => !state.cards[id]);
}

export function pickQuizMode(cardId: string, state: UserState, rng: () => number): QuizMode {
  if (isGrammarCard(cardId)) return 'grammar';
  if (isWordCard(cardId)) return 'word2zh';
  const r = rng();
  if (r < 0.3 && lookalikePeers(cardId, state).length > 0) return 'lookalike';
  if (r < 0.6) return 'audio2kana';
  return 'kana2roma';
}

export interface SessionPlan {
  items: SessionItem[];
  newIds: string[];
  dueCount: number;
}

/**
 * 組一輪：到期複習 → 新字教學(每字跟一題) → 混合測驗 → 今日一句。
 * opts.newIds：由「今日課程」計畫指定要新教的卡（已配速 cap）；不給則用預設 newCardOrder 滴漏。
 * 加練一輪也走這裡（呼叫端重算計畫＝繼續滴漏下一批；首輪教過的卡已進 cards 不會重出）。
 */
export function buildSession(
  state: UserState,
  today: string,
  rng: () => number = Math.random,
  opts: { newIds?: string[]; dialogLessonNo?: number; quizLessonNo?: number } = {},
): SessionPlan {
  const { newIds: forcedNew, dialogLessonNo, quizLessonNo } = opts;
  const items: SessionItem[] = [];

  // 歌詞加入的 v: 卡 reps 0 也算到期（沒有教學步驟，直接以複習卡形式首見）
  const due = Object.values(state.cards)
    .filter((c) => isDue(c, today) && (isLearning(c) || c.id.startsWith('v:')))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.id < b.id ? -1 : 1))
    .slice(0, MAX_REVIEWS);
  for (const c of due) items.push({ kind: 'flash', cardId: c.id });

  // 有課程計畫就用它（已配速）；否則複習壓力太大就先不加新字，避免雪球
  const newIds = forcedNew ?? (due.length <= 20 ? newCardOrder(state).slice(0, state.newPerDay) : []);
  for (const id of newIds) {
    items.push({ kind: 'teach', cardId: id });
    const mode: QuizMode = isGrammarCard(id) ? 'grammar' : isWordCard(id) ? 'word2zh' : 'kana2roma';
    items.push({ kind: 'quiz', cardId: id, mode });
  }

  // 讀本課會話 → 本課小測（新內容之後、混合測驗之前）
  if (dialogLessonNo != null) items.push({ kind: 'dialog', lessonNo: dialogLessonNo });
  if (quizLessonNo != null) items.push({ kind: 'minitest', lessonNo: quizLessonNo });

  // 混合測驗：從已學的卡挑弱的優先（ease 低、忘記多）；v: 卡沒內容就跳過（防資料缺漏）
  const pool = Object.values(state.cards)
    .filter((c) => isLearning(c) && !newIds.includes(c.id) && (!isWordCard(c.id) || wordInfo(c.id, state)))
    .sort((a, b) => a.ease - b.ease || b.lapses - a.lapses)
    .slice(0, QUIZ_ROUND_SIZE * 2);
  const picked = shuffle(pool, rng).slice(0, QUIZ_ROUND_SIZE);
  for (const c of picked) {
    items.push({ kind: 'quiz', cardId: c.id, mode: pickQuizMode(c.id, state, rng) });
  }

  items.push({ kind: 'phrase', idx: state.phraseIdx });
  return { items, newIds, dueCount: due.length };
}

/** 選擇題選項：正解＋干擾項共 4 個。干擾一律只從「已教集合」取（無教不考） */
export function quizChoices(cardId: string, mode: QuizMode, state: UserState, rng: () => number = Math.random): string[] {
  if (mode === 'grammar') {
    // 文法題：中文→選正確日文例句，干擾＝其他已教文法點的例句
    const point = grammarByCardId(cardId);
    if (!point || point.examples.length === 0) return [];
    const answer = point.examples[0].jp;
    const pool = [...new Set(taughtGrammar(state).flatMap((g) => g.point.examples.map((e) => e.jp)))].filter(
      (jp) => jp !== answer,
    );
    const opts = new Set<string>([answer]);
    for (const jp of shuffle(pool, rng)) {
      if (opts.size >= 4) break;
      opts.add(jp);
    }
    return shuffle([...opts], rng);
  }
  if (mode === 'word2zh') {
    const w = wordInfo(cardId, state);
    if (!w) return [];
    // 干擾＝其他已教單字的中文（排除 v: 歌詞冷字）
    const pool = [...new Set(taughtWords(state, true).map((x) => x.zh))].filter((z) => z && z !== w.zh);
    const opts = new Set<string>([w.zh]);
    for (const z of shuffle(pool, rng)) {
      if (opts.size >= 4) break;
      opts.add(z);
    }
    return shuffle([...opts], rng);
  }
  const kana = KANA_BY_ID[cardId];
  // 只從已教假名取干擾；聽音/認字題排除同音字（じ/ぢ、ず/づ），不然題目無解
  const taughtPool = taughtKana(state).filter(
    (k) => k.id !== cardId && k.script === kana.script && (mode === 'kana2roma' || k.romaji !== kana.romaji),
  );
  const peerIds = lookalikePeers(cardId, state);

  let distractors: KanaInfo[];
  if (mode === 'lookalike') {
    const peers = taughtPool.filter((k) => peerIds.includes(k.id));
    const rest = taughtPool.filter((k) => !peerIds.includes(k.id));
    distractors = [...peers, ...shuffle(rest, rng)].slice(0, 3);
  } else {
    // 優先拿同行/同段的近音字當干擾
    const near = taughtPool.filter(
      (k) => k.row === kana.row || k.romaji[k.romaji.length - 1] === kana.romaji[kana.romaji.length - 1],
    );
    const rest = taughtPool.filter((k) => !near.includes(k));
    distractors = [...shuffle(near, rng), ...shuffle(rest, rng)].slice(0, 3);
  }

  if (mode === 'kana2roma') {
    // 答案是羅馬音；干擾去重（ぢ/じ 同音）
    const opts = new Set<string>([kana.romaji]);
    for (const k of distractors) opts.add(k.romaji);
    for (const k of shuffle(taughtPool, rng)) {
      if (opts.size >= 4) break;
      opts.add(k.romaji);
    }
    return shuffle([...opts], rng);
  }
  // audio2kana / lookalike：答案是假名字
  const opts = new Set<string>([kana.kana]);
  for (const k of distractors) opts.add(k.kana);
  for (const k of shuffle(taughtPool, rng)) {
    if (opts.size >= 4) break;
    opts.add(k.kana);
  }
  return shuffle([...opts], rng);
}
