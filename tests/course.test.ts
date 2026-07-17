import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initState } from '../src/lib/store.ts';
import { grade, newCard } from '../src/lib/srs.ts';
import { LESSONS, lessonVocab, lessonGrammarCards, wordCardId, grammarCardIdOf } from '../src/data/curriculum.ts';
import {
  currentLesson,
  courseProgress,
  masteryPct,
  buildDailyPlan,
  lessonComplete,
  dayMode,
  NEW_VOCAB_CAP,
  NEW_GRAMMAR_CAP,
  KANA_NEW_CAP,
  kanaPhaseEta,
} from '../src/lib/course.ts';

const TODAY = '2026-07-08';

const teachLessonWords = (s: ReturnType<typeof initState>, li: number) => {
  for (const w of lessonVocab(LESSONS[li])) s.cards[wordCardId(w.jp)] = grade(newCard(wordCardId(w.jp), TODAY), true, TODAY);
};

test('currentLesson / courseProgress：第一個未完成的課', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  assert.equal(currentLesson(s).no, 1);
  assert.equal(courseProgress(s).done, 0);
  // 教完第 1 課單字＋可考文法＋小測達標 → 完成、currentLesson 進到 2
  teachLessonWords(s, 0);
  for (const p of lessonGrammarCards(LESSONS[0])) s.cards[grammarCardIdOf(p)] = grade(newCard(grammarCardIdOf(p), TODAY), true, TODAY);
  s.lessonsPassed = [1]; // 小測過關才算學完
  assert.equal(currentLesson(s).no, 2);
  assert.equal(courseProgress(s).done, 1);
});

test('masteryPct：只算精熟(ivl≥14)的課綱卡、防進度幻覺', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  assert.equal(masteryPct(s, 'N5'), 0);
  let c = newCard('w:私', TODAY);
  for (let i = 0; i < 6; i++) c = grade(c, true, c.due); // 連對到 ivl≥14
  s.cards['w:私'] = c;
  assert.ok(masteryPct(s, 'N5') > 0, '有精熟卡→掌握度 > 0');
});

test('buildDailyPlan：分開 cap 單字/文法、文法等單字教完、帶本課會話小測', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  s.sessionsDone = 1; // 非人生首輪
  const p0 = buildDailyPlan(s, TODAY);
  assert.equal(p0.inKana, false);
  assert.equal(p0.lessonNo, 1);
  assert.ok(p0.newVocab.length > 0 && p0.newVocab.length <= NEW_VOCAB_CAP);
  assert.ok(p0.newVocab.every((id) => id.startsWith('w:')), '課程階段新卡是單字');
  assert.equal(p0.newGrammar.length, 0, '第 1 課單字還沒教完→文法卡不出');
  assert.ok(p0.dialog.length > 0, '帶本課會話');
  assert.equal(p0.quizLessonNo, null, '內容還沒教完→今天不考小測');

  teachLessonWords(s, 0); // 教完第 1 課單字
  const p1 = buildDailyPlan(s, TODAY);
  assert.equal(p1.newGrammar.length, NEW_GRAMMAR_CAP, '單字教完→文法卡開始出（cap 1）');
  assert.ok(p1.newGrammar[0].startsWith('g:'));

  const sp = buildDailyPlan(s, TODAY, true); // 衝刺：放掉上限、給當前課全部未教
  assert.equal(sp.sprint, true);
  assert.ok(sp.newGrammar.length >= 1);
});

test('小測門檻＋消化日/補強日：內容教完才考、達標才完課、隔天模式', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  s.sessionsDone = 1; // 非人生第一輪，才會進一般課末小測
  const l1 = LESSONS[0];
  teachLessonWords(s, 0);
  for (const p of lessonGrammarCards(l1)) s.cards[grammarCardIdOf(p)] = grade(newCard(grammarCardIdOf(p), TODAY), true, TODAY);
  assert.equal(lessonComplete(l1, s), false, '內容教完但沒過小測→未學完');
  assert.equal(buildDailyPlan(s, TODAY).quizLessonNo, 1, '內容教完→今天考第 1 課小測');
  s.lessonsPassed = [1];
  assert.equal(lessonComplete(l1, s), true, '過了小測→學完');

  const y = '2026-07-07'; // TODAY 的前一天
  const sSprint = initState('jj', { hira: true, kata: true }, TODAY);
  sSprint.sessionsDone = 1;
  sSprint.lastSprintDate = y;
  assert.equal(dayMode(sSprint, TODAY), 'digest');
  assert.equal(buildDailyPlan(sSprint, TODAY).newVocab.length, 0, '消化日不給新內容');

  const sFail = initState('jj', { hira: true, kata: true }, TODAY);
  sFail.sessionsDone = 1;
  sFail.quizFail = { no: 1, date: y };
  assert.equal(dayMode(sFail, TODAY), 'reinforce');
  const pf = buildDailyPlan(sFail, TODAY);
  assert.equal(pf.newVocab.length, 0, '補強日不給新內容');
  assert.equal(pf.quizLessonNo, 1, '補強日重考那課');
});

test('課序：每天新內容只從當前課出、不跨課搶跑（Codex 抓的 bug）', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  for (let day = 0; day < 10; day++) {
    const p = buildDailyPlan(s, TODAY);
    const lesson = LESSONS.find((l) => l.no === p.lessonNo)!;
    const vIds = new Set(lessonVocab(lesson).map((w) => wordCardId(w.jp)));
    const gIds = new Set(lessonGrammarCards(lesson).map((g) => grammarCardIdOf(g)));
    for (const id of p.newVocab) assert.ok(vIds.has(id), `day${day}: 新單字 ${id} 應屬第 ${p.lessonNo} 課`);
    for (const id of p.newGrammar) assert.ok(gIds.has(id), `day${day}: 新文法 ${id} 應屬第 ${p.lessonNo} 課`);
    for (const id of [...p.newVocab, ...p.newGrammar]) s.cards[id] = grade(newCard(id, TODAY), true, TODAY);
    if (p.quizLessonNo != null) s.lessonsPassed = [...(s.lessonsPassed ?? []), p.quizLessonNo];
  }
});

test('buildDailyPlan：五十音階段新卡是假名、無文法、配速 KANA_NEW_CAP', () => {
  const s = initState('yaxuan', { hira: false, kata: false }, TODAY);
  s.sessionsDone = 1; // 非人生首輪
  const p = buildDailyPlan(s, TODAY);
  assert.equal(p.inKana, true);
  assert.ok(p.newVocab.every((id) => id.startsWith('h:') || id.startsWith('k:')), '五十音階段新卡是假名');
  assert.equal(p.newVocab.length, KANA_NEW_CAP, '五十音配速走 KANA_NEW_CAP（比課綱階段快）');
  assert.equal(p.newGrammar.length, 0);

  // 輕量日（到期複習多）照樣減半
  const sl = initState('jj', { hira: true, kata: false }, TODAY); // 平假名種子 71 張
  sl.sessionsDone = 1; // 非人生首輪
  for (const id of Object.keys(sl.cards)) sl.cards[id] = { ...sl.cards[id], due: TODAY };
  const pl = buildDailyPlan(sl, TODAY);
  assert.equal(pl.light, true);
  assert.equal(pl.newVocab.length, Math.ceil(KANA_NEW_CAP / 2), '輕量日假名減半');
});

test('人生第一輪超迷你：只教 FIRST_RUN_CAP=3（あいう），完成後回正常配速', () => {
  const s = initState('yaxuan', { hira: false, kata: false }, TODAY);
  const first = buildDailyPlan(s, TODAY);
  assert.deepEqual(first.newVocab, ['h:あ', 'h:い', 'h:う']);
  assert.equal(first.newGrammar.length, 0);
  s.sessionsDone = 1; // 完成首輪（含當天再來一份）→ 正常 10
  const after = buildDailyPlan(s, TODAY);
  assert.equal(after.newVocab.length, KANA_NEW_CAP);
});

test('kanaPhaseEta：剩餘假名數÷KANA_NEW_CAP 無條件進位；學完＝0', () => {
  const s = initState('yaxuan', { hira: false, kata: false }, TODAY); // 142 字全沒學
  const eta = kanaPhaseEta(s);
  assert.equal(eta.remaining, 142);
  assert.equal(eta.days, Math.ceil(142 / KANA_NEW_CAP));

  const sh = initState('jj', { hira: true, kata: false }, TODAY); // 平假名種子＝只剩片假名 71
  assert.equal(kanaPhaseEta(sh).remaining, 71);

  const sb = initState('jj', { hira: true, kata: true }, TODAY); // 兩字系都熟＝0
  assert.deepEqual(kanaPhaseEta(sb), { remaining: 0, days: 0 });
});

test('加練一輪繼續滴漏：首輪教過的卡進 cards 後，重算計畫接下一批不重複', () => {
  const s = initState('yaxuan', { hira: false, kata: false }, TODAY);
  s.sessionsDone = 1; // 完成過首輪（加練場景）
  const p1 = buildDailyPlan(s, TODAY);
  // 模擬首輪教完：newVocab 全部建卡（Session 的 gradeQuiz 會 newCard+grade）
  for (const id of p1.newVocab) s.cards[id] = grade(newCard(id, TODAY), true, TODAY);
  const p2 = buildDailyPlan(s, TODAY);
  assert.equal(p2.newVocab.length, KANA_NEW_CAP, '加練一輪照樣給一批新的');
  assert.ok(p2.newVocab.every((id) => !p1.newVocab.includes(id)), '下一批不含首輪教過的');
});
