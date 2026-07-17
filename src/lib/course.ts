// 課程制每日入口的推導：目前第幾課、課程進度、掌握度、今天的份（配速上限）。
// 設計見記憶 jp-learning-app-plan「今日課程首頁」；與 Codex 交叉討論定調。
import type { UserState } from '../types.ts';
import type { GrammarExample, Lesson, Level, QuizItem } from '../data/curriculum.ts';
import { LESSONS, lessonVocab, lessonGrammarCards, wordCardId, grammarCardIdOf } from '../data/curriculum.ts';
import { isDue, isLearning, isMastered } from './srs.ts';
import { newCardOrder, isGrammarCard } from './session.ts';
import { addDays } from './dates.ts';

const has = (state: UserState, id: string) => !!state.cards[id];

// 標準日新量上限（Codex：3–5 單字＋1 主文法最多 2）；複習壓力大時走輕量。
export const NEW_VOCAB_CAP = 5;
export const NEW_GRAMMAR_CAP = 1;
// 五十音階段配速較快（無文法/會話、前期複習壓力小；5/天要一個月太拖——JJ 2026-07-09 拍板）
export const KANA_NEW_CAP = 10;
// 人生第一輪（sessionsDone=0）超迷你：只教 3 個（あいう），抓到形式就完課、快點進到有趣的階段
// （解鎖進度頁→看到喫茶店→私房錢）。完成後含當天加練都回正常配速。——JJ 2026-07-10 拍板
export const FIRST_RUN_CAP = 3;
export const LIGHT_DUE_THRESHOLD = 20; // 到期卡 ≥ 此數＝輕量日，減少新量
export const QUIZ_PASS = 0.7; // 小測過關門檻

/** 該課的單字與可考文法是否都已進 cards（內容看過，但還沒到「學完」）。 */
export function lessonContentTaught(lesson: Lesson, state: UserState): boolean {
  return (
    lessonVocab(lesson).every((w) => has(state, wordCardId(w.jp))) &&
    lessonGrammarCards(lesson).every((p) => has(state, grammarCardIdOf(p)))
  );
}

/** 一課「學完」＝內容看過 AND 小測達標（防看完≠會了；小測是完課門檻）。 */
export function lessonComplete(lesson: Lesson, state: UserState): boolean {
  return lessonContentTaught(lesson, state) && (state.lessonsPassed?.includes(lesson.no) ?? false);
}

export type DayMode = 'normal' | 'digest' | 'reinforce';

/** 今天是哪種日：補強日(昨天小測沒過) > 消化日(昨天衝刺) > 一般日。 */
export function dayMode(state: UserState, today: string): DayMode {
  const yesterday = addDays(today, -1);
  if (state.quizFail?.date === yesterday) return 'reinforce';
  if (state.lastSprintDate === yesterday) return 'digest';
  return 'normal';
}

/** 五十音是否還沒學完（仍在 pre-lesson 階段）。 */
export function inKanaPhase(state: UserState): boolean {
  return newCardOrder(state).some((id) => id.startsWith('h:') || id.startsWith('k:'));
}

/** 五十音先修 ETA：還剩幾個假名沒教、照 KANA_NEW_CAP 標準配速約幾天學完（儀表板顯示用）。 */
export function kanaPhaseEta(state: UserState): { remaining: number; days: number } {
  const remaining = newCardOrder(state).filter((id) => id.startsWith('h:') || id.startsWith('k:')).length;
  return { remaining, days: Math.ceil(remaining / KANA_NEW_CAP) };
}

/** 目前在學的課＝第一個未完成的課（全完成回最後一課）。 */
export function currentLesson(state: UserState): Lesson {
  return LESSONS.find((l) => !lessonComplete(l, state)) ?? LESSONS[LESSONS.length - 1];
}

/** 課程進度：連續已完成的課數（＝第一個未完成課之前的課數，避免零卡複習課 vacuously 灌數）。 */
export function courseProgress(state: UserState): { done: number; total: number } {
  const idx = LESSONS.findIndex((l) => !lessonComplete(l, state));
  return { done: idx === -1 ? LESSONS.length : idx, total: LESSONS.length };
}

/** 某級別課綱卡（w:+g:）id 集合（去重）。 */
function levelCardIds(level: Level): string[] {
  const ls = LESSONS.filter((l) => l.level === level);
  return [
    ...new Set([
      ...ls.flatMap((l) => lessonVocab(l).map((w) => wordCardId(w.jp))),
      ...ls.flatMap((l) => lessonGrammarCards(l).map((p) => grammarCardIdOf(p))),
    ]),
  ];
}

/** 掌握度：該級別課綱卡中「精熟(ivl≥14)」比例（%）。看完≠會了，用這條防進度幻覺。 */
export function masteryPct(state: UserState, level: Level): number {
  const ids = levelCardIds(level);
  if (ids.length === 0) return 0;
  const mastered = ids.filter((id) => {
    const c = state.cards[id];
    return c && isMastered(c);
  }).length;
  return Math.round((mastered / ids.length) * 100);
}

export interface DailyPlan {
  lessonNo: number;
  lessonTitle: string;
  inKana: boolean;
  mode: DayMode; // normal / digest 消化日 / reinforce 補強日
  newVocab: string[]; // 今天新教的單字/假名卡 id（已 cap；消化/補強日為空）
  newGrammar: string[]; // 今天新教的文法卡 id（已 cap）
  dueCount: number; // 到期複習總數
  light: boolean; // 是否輕量日（複習壓力大）
  showDialog: boolean; // 今天要不要讀本課會話
  dialog: GrammarExample[]; // 本課會話
  quizLessonNo: number | null; // 今天要考小測的課號（null＝不考）
  quiz: QuizItem[]; // 今天要考的小測題（quizLessonNo 那課）
  sprint: boolean;
}

/** 今天的份：配速上限下要新教的卡＋本課會話＋（內容看完才考的）小測。sprint 放掉上限、給當前課全部未教。 */
export function buildDailyPlan(state: UserState, today: string, sprint = false): DailyPlan {
  const lesson = currentLesson(state);
  const kana = inKanaPhase(state);
  const mode = dayMode(state, today);
  const newV = newCardOrder(state).filter((id) => !isGrammarCard(id)); // 五十音/尾巴滴漏用

  const due = Object.values(state.cards).filter((c) => isDue(c, today) && (isLearning(c) || c.id.startsWith('v:')));
  const light = due.length >= LIGHT_DUE_THRESHOLD;
  const noNew = !sprint && mode !== 'normal'; // 消化日/補強日不給新內容
  const firstRun = state.sessionsDone === 0; // 人生第一輪＝超迷你（見 FIRST_RUN_CAP）
  const vCap = firstRun ? FIRST_RUN_CAP : light ? Math.ceil(NEW_VOCAB_CAP / 2) : NEW_VOCAB_CAP;

  let newVocab: string[], newGrammar: string[];
  if (noNew) {
    newVocab = [];
    newGrammar = [];
  } else if (kana) {
    // 五十音階段：照 introOrder 滴漏假名，無文法；配速用 KANA_NEW_CAP（輕量日照樣減半、首輪超迷你）
    newVocab = newV.slice(0, firstRun ? FIRST_RUN_CAP : light ? Math.ceil(KANA_NEW_CAP / 2) : KANA_NEW_CAP);
    newGrammar = [];
  } else if (lessonComplete(lesson, state)) {
    // 全部課程學完 → vocab.ts 補充 deck 尾巴（此時 newV 只剩尾巴）
    newVocab = sprint && !firstRun ? newV : newV.slice(0, vCap);
    newGrammar = [];
  } else {
    // 課程階段：新內容只從「當前課」出、不跨課搶跑（課序）；該課單字全教完才出文法
    const lessonVIds = lessonVocab(lesson)
      .map((w) => wordCardId(w.jp))
      .filter((id) => !has(state, id));
    const lessonGIds = lessonGrammarCards(lesson)
      .map((p) => grammarCardIdOf(p))
      .filter((id) => !has(state, id));
    if (sprint && !firstRun) {
      newVocab = lessonVIds;
      newGrammar = lessonGIds;
    } else {
      newVocab = lessonVIds.slice(0, vCap);
      newGrammar = firstRun || light || lessonVIds.length > 0 ? [] : lessonGIds.slice(0, NEW_GRAMMAR_CAP);
    }
  }

  // 小測：補強日考 quizFail 那課；否則當前課內容看完但還沒過→考本課
  let quizLessonNo: number | null = null;
  if (!firstRun && mode === 'reinforce' && state.quizFail) quizLessonNo = state.quizFail.no;
  else if (!firstRun && !kana && lessonContentTaught(lesson, state) && !(state.lessonsPassed?.includes(lesson.no) ?? false))
    quizLessonNo = lesson.no;
  const quizLesson = quizLessonNo != null ? LESSONS.find((l) => l.no === quizLessonNo) ?? null : null;

  return {
    lessonNo: lesson.no,
    lessonTitle: lesson.title,
    inKana: kana,
    mode,
    newVocab,
    newGrammar,
    dueCount: due.length,
    light,
    showDialog: !firstRun && !kana && lesson.dialog.length > 0,
    dialog: lesson.dialog,
    quizLessonNo,
    quiz: quizLesson?.quiz ?? [],
    sprint,
  };
}
