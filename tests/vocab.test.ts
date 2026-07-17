import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, newCardOrder, quizChoices, pickQuizMode, wordInfo } from '../src/lib/session.ts';
import { initState } from '../src/lib/store.ts';
import { newCard, grade } from '../src/lib/srs.ts';
import { VOCAB_N5, WORD_BY_ID } from '../src/data/vocab.ts';
import { curriculumWordOrder } from '../src/data/curriculum.ts';

const TODAY = '2026-07-06';
const rng = () => 0.42;

test('N5 牌組資料完整：id 可反查、無重複', () => {
  assert.ok(VOCAB_N5.length >= 180, `牌組要夠大，目前 ${VOCAB_N5.length}`);
  assert.equal(new Set(VOCAB_N5.map((w) => w.jp)).size, VOCAB_N5.length, '單字 jp 不可重複');
  assert.equal(WORD_BY_ID['w:食べる'].zh, '吃');
});

test('五十音全學完後，新卡自動接課綱第一課單字', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY); // 兩字系都熟 → 假名全在牌組
  const order = newCardOrder(s);
  assert.equal(order[0], curriculumWordOrder()[0], `第一張新卡應是課綱第一個單字，得到 ${order[0]}`);
  const plan = buildSession(s, TODAY, rng);
  assert.ok(plan.newIds.every((id) => id.startsWith('w:')));
  // 單字教學後跟的是詞義測驗
  const quiz = plan.items.find((i) => i.kind === 'quiz' && i.cardId === plan.newIds[0]);
  assert.ok(quiz && quiz.kind === 'quiz' && quiz.mode === 'word2zh');
});

test('word2zh 選項：四選一含正解、干擾只從已教單字取', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  // 先教 5 個單字（無教不考：干擾只會從這些取）
  const learned = ['食べる', '飲む', '見る', '買う', '行く'];
  for (const jp of learned) s.cards[`w:${jp}`] = grade(newCard(`w:${jp}`, TODAY), true, TODAY);
  const opts = quizChoices('w:食べる', 'word2zh', s, Math.random);
  assert.equal(opts.length, 4);
  assert.ok(opts.includes('吃'));
  assert.equal(new Set(opts).size, 4);
  const learnedZh = new Set(learned.map((jp) => wordInfo(`w:${jp}`, s)!.zh));
  for (const o of opts) assert.ok(learnedZh.has(o), `干擾 ${o} 不該出現（沒教過）`);
});

test('歌詞單字（v: 卡）：內容從 state.vocab 解析、reps 0 也進當日複習', () => {
  const s = initState('yaxuan', { hira: false, kata: false }, TODAY);
  s.sessionsDone = 2; // 教材庫第二輪才開；避開人生第一輪的專用短流程
  s.cards['v:故郷'] = newCard('v:故郷', TODAY);
  s.vocab['v:故郷'] = { jp: '故郷', kana: 'ふるさと', zh: '故鄉', src: '故郷' };
  assert.equal(wordInfo('v:故郷', s)!.kana, 'ふるさと');
  assert.equal(pickQuizMode('v:故郷', s, rng), 'word2zh');
  const plan = buildSession(s, TODAY, rng);
  assert.ok(plan.items.some((i) => i.kind === 'flash' && i.cardId === 'v:故郷'), 'v: 卡要以複習卡形式首見');
});

test('v: 卡內容缺漏時不進混合測驗（防呆）', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  s.sessionsDone = 2; // 確實走一般混合測驗路徑，不靠首輪跳過而誤過測試
  s.cards['v:幽靈'] = { id: 'v:幽靈', reps: 2, lapses: 0, ease: 2.5, ivl: 3, due: '2026-09-01' };
  const plan = buildSession(s, TODAY, rng);
  assert.ok(!plan.items.some((i) => i.kind === 'quiz' && i.cardId === 'v:幽靈'));
});
