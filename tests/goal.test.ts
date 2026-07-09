import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GOAL, goalTotalLessons, lessonPace } from '../src/lib/goal.ts';
import { initState } from '../src/lib/store.ts';
import { grade, newCard } from '../src/lib/srs.ts';
import { LESSONS, lessonVocab, lessonGrammarCards, wordCardId, grammarCardIdOf } from '../src/data/curriculum.ts';

const TODAY = '2026-07-09';

/** 模擬把第 li 課（0-based）完整學完：單字＋文法建卡＋小測過關 */
const completeLesson = (s: ReturnType<typeof initState>, li: number) => {
  for (const w of lessonVocab(LESSONS[li])) s.cards[wordCardId(w.jp)] = grade(newCard(wordCardId(w.jp), TODAY), true, TODAY);
  for (const p of lessonGrammarCards(LESSONS[li])) s.cards[grammarCardIdOf(p)] = grade(newCard(grammarCardIdOf(p), TODAY), true, TODAY);
  s.lessonsPassed = [...(s.lessonsPassed ?? []), LESSONS[li].no];
};

test('goalTotalLessons：N5＝N5 課數、N4＝全部課數', () => {
  const n5 = LESSONS.filter((l) => l.level === 'N5').length;
  assert.equal(goalTotalLessons('N5'), n5);
  assert.equal(goalTotalLessons('N4'), LESSONS.length);
  assert.ok(goalTotalLessons('N4') > goalTotalLessons('N5'));
});

test('lessonPace：預設目標 N4、起點 0 課、每週需求＝剩餘課÷剩餘週', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  assert.deepEqual(s.goal, DEFAULT_GOAL);
  const p = lessonPace(s, TODAY);
  assert.equal(p.total, LESSONS.length);
  assert.equal(p.done, 0);
  assert.equal(p.remaining, LESSONS.length);
  assert.ok(p.daysLeft > 0);
  const expected = (p.remaining / p.daysLeft) * 7;
  assert.ok(Math.abs(p.weeklyNeeded - expected) < 0.01, `每週需求 ${p.weeklyNeeded} vs ${expected}`);
});

test('lessonPace：完成課數推進 done/remaining、目標 N5 總數變小', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  completeLesson(s, 0);
  completeLesson(s, 1);
  s.goal = { level: 'N5', date: '2026-12-06' };
  const p = lessonPace(s, TODAY);
  assert.equal(p.total, goalTotalLessons('N5'));
  assert.equal(p.done, 2);
  assert.equal(p.remaining, p.total - 2);
});

test('lessonPace：目標日過期 daysLeft=0、全完成 weeklyNeeded=0', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  s.goal = { level: 'N5', date: '2026-01-01' }; // 已過期
  const p = lessonPace(s, TODAY);
  assert.equal(p.daysLeft, 0);
  assert.ok(p.weeklyNeeded > 0, '過期但沒完成→需求仍為正（除以保底 1 天）');

  for (let i = 0; i < LESSONS.length; i++) if (LESSONS[i].level === 'N5') completeLesson(s, i);
  const p2 = lessonPace(s, TODAY);
  assert.equal(p2.remaining, 0);
  assert.equal(p2.weeklyNeeded, 0);
});
