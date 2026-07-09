import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, newCardOrder, quizChoices, pickQuizMode, MAX_REVIEWS } from '../src/lib/session.ts';
import { initState, completeSession, displayStreak } from '../src/lib/store.ts';
import { grade, newCard } from '../src/lib/srs.ts';
import { KANA_BY_ID, HIRAGANA, KATAKANA } from '../src/data/kana.ts';
import { LESSONS, lessonVocab, lessonGrammarCards, wordCardId, grammarCardIdOf, grammarByCardId } from '../src/data/curriculum.ts';
import { addDays } from '../src/lib/dates.ts';
import type { UserState } from '../src/types.ts';

const TODAY = '2026-07-06';
const rng = () => 0.42; // 固定假亂數讓測試可重現

test('假名表完整：46 基礎＋25 濁音/半濁音 × 兩字系', () => {
  assert.equal(HIRAGANA.length, 71);
  assert.equal(KATAKANA.length, 71);
  assert.equal(KANA_BY_ID['k:ア'].romaji, 'a');
  assert.equal(KANA_BY_ID['h:し'].romaji, 'shi');
  assert.equal(KANA_BY_ID['k:ツ'].romaji, 'tsu');
});

test('JJ（平假名已熟）：新卡先出片假名、種子卡不重複', () => {
  const s = initState('jj', { hira: true, kata: false }, TODAY);
  assert.equal(Object.keys(s.cards).length, 71); // 平假名全部種子
  const order = newCardOrder(s);
  assert.ok(order[0].startsWith('k:'), `第一張新卡應是片假名，得到 ${order[0]}`);
  assert.ok(order.every((id) => !s.cards[id]));
});

test('亞軒（都不熟）：新卡先平假名、第一天 session 是 5 教學＋測驗＋一句', () => {
  const s = initState('yaxuan', { hira: false, kata: false }, TODAY);
  const plan = buildSession(s, TODAY, rng);
  assert.equal(plan.newIds.length, 5);
  assert.ok(plan.newIds.every((id) => id.startsWith('h:')));
  assert.equal(plan.newIds[0], 'h:あ');
  const kinds = plan.items.map((i) => i.kind);
  assert.equal(kinds.filter((k) => k === 'teach').length, 5);
  assert.equal(kinds[kinds.length - 1], 'phrase');
});

test('到期複習有上限，複習壓力大時不加新卡', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  // 全部種子卡推到今天到期
  for (const id of Object.keys(s.cards)) s.cards[id] = { ...s.cards[id], due: TODAY };
  const plan = buildSession(s, TODAY, rng);
  assert.equal(plan.dueCount, MAX_REVIEWS);
  assert.equal(plan.newIds.length, 0);
});

test('quizChoices：四選一、含正解、聽音題排除同音字', () => {
  const s = initState('jj', { hira: true, kata: false }, TODAY); // 平假名全種子＝已教，干擾池夠大
  const roma = quizChoices('h:し', 'kana2roma', s, rng);
  assert.equal(roma.length, 4);
  assert.ok(roma.includes('shi'));
  for (let i = 0; i < 30; i++) {
    const audio = quizChoices('h:じ', 'audio2kana', s, Math.random);
    assert.ok(audio.includes('じ'));
    assert.ok(!audio.includes('ぢ'), '聽音題不能同時出 じ 和 ぢ');
  }
});

test('無教不考：干擾項只從已教假名取，不含沒教過的字', () => {
  const s = initState('yaxuan', { hira: false, kata: false }, TODAY);
  for (const id of ['h:あ', 'h:い', 'h:う']) s.cards[id] = grade(newCard(id, TODAY), true, TODAY);
  const opts = quizChoices('h:あ', 'kana2roma', s, () => 0.3);
  assert.ok(opts.includes('a'));
  const allowed = new Set(['a', 'i', 'u']); // 只有三個已教字的羅馬音
  for (const o of opts) assert.ok(allowed.has(o), `干擾 ${o} 不該出現（沒教過）`);
});

test('課綱 drip：先出該課單字、累積 gate 才解鎖文法、零單字複習課不提早解鎖', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY); // 假名全種子，尚無單字
  const l1 = LESSONS[0];
  const l1WordIds = lessonVocab(l1).map((w) => wordCardId(w.jp));
  const g11 = grammarCardIdOf(lessonGrammarCards(l1)[0]); // 第1課第一個「可考」文法點

  const before = newCardOrder(s);
  assert.equal(before[0], l1WordIds[0], '第一張新卡＝第1課第一個單字');
  assert.ok(!before.some((id) => id.startsWith('g:')), '沒教任何單字前，全課文法都未解鎖（含零單字複習課）');

  // 教完第1課所有單字 → 第1課文法解鎖、且排在第2課單字之前
  for (const id of l1WordIds) s.cards[id] = grade(newCard(id, TODAY), true, TODAY);
  const after = newCardOrder(s);
  assert.ok(after.includes(g11), '第1課單字教完→文法解鎖');
  const l2FirstWord = wordCardId(lessonVocab(LESSONS[1])[0].jp);
  assert.ok(after.indexOf(g11) < after.indexOf(l2FirstWord), '該課文法排在下一課單字之前');
  // 更後面的零單字複習課（有可考文法者）此時仍未解鎖
  const reviewLesson = LESSONS.find((l) => l.no > 1 && lessonVocab(l).length === 0 && lessonGrammarCards(l).length > 0)!;
  const reviewG = grammarCardIdOf(lessonGrammarCards(reviewLesson)[0]);
  assert.ok(!after.includes(reviewG), '前面課還沒教完，後面零單字複習課的文法不解鎖');
});

test('文法進 SRS：新文法卡走 grammar 教學＋測驗、干擾只從已教文法', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  const l1 = LESSONS[0];
  for (const w of lessonVocab(l1)) s.cards[wordCardId(w.jp)] = grade(newCard(wordCardId(w.jp), TODAY), true, TODAY);
  const gCards = lessonGrammarCards(l1).map((p) => grammarCardIdOf(p));

  // 第1課單字教完 → 新卡開始含文法卡，且用 grammar 教學＋測驗
  const plan = buildSession(s, TODAY, () => 0.42);
  const gNew = plan.newIds.find((id) => id.startsWith('g:'));
  assert.ok(gNew, '第1課單字教完後，新卡含文法卡');
  assert.equal(pickQuizMode(gNew!, s, () => 0.5), 'grammar');
  const q = plan.items.find((i) => i.kind === 'quiz' && i.cardId === gNew);
  assert.ok(q && q.kind === 'quiz' && q.mode === 'grammar', '文法卡用 grammar 測驗');

  // quizChoices grammar：含正解例句、干擾只從已教文法的例句
  for (const g of gCards) s.cards[g] = grade(newCard(g, TODAY), true, TODAY);
  const point = grammarByCardId(gCards[0])!;
  const opts = quizChoices(gCards[0], 'grammar', s, () => 0.3);
  assert.ok(opts.includes(point.examples[0].jp), '含正解例句');
  const taughtEx = new Set(gCards.flatMap((g) => grammarByCardId(g)!.examples.map((e) => e.jp)));
  for (const o of opts) assert.ok(taughtEx.has(o), `干擾 ${o} 應來自已教文法`);
});

test('completeSession：streak 連續加一、斷鏈歸一、同日不重複計', () => {
  let s: UserState = initState('jj', { hira: true, kata: false }, TODAY);
  s = completeSession(s, 20, TODAY);
  assert.equal(s.streak, 1);
  s = completeSession(s, 10, TODAY); // 同一天加練
  assert.equal(s.streak, 1);
  assert.equal(s.totalMinutes, 30);
  s = completeSession(s, 20, addDays(TODAY, 1));
  assert.equal(s.streak, 2);
  s = completeSession(s, 20, addDays(TODAY, 5)); // 斷鏈
  assert.equal(s.streak, 1);
  assert.equal(displayStreak(s, addDays(TODAY, 5)), 1);
  assert.equal(displayStreak(s, addDays(TODAY, 9)), 0); // 幾天沒練，顯示歸零
});
