import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initState } from '../src/lib/store.ts';
import { grade, newCard } from '../src/lib/srs.ts';
import { VOCAB_N5 } from '../src/data/vocab.ts';
import {
  CRAM_DAILY_COIN_CAP,
  CRAM_SIZE,
  cramCategories,
  cramChoices,
  cramCoins,
  cramRound,
} from '../src/lib/cram.ts';

const TODAY = '2026-07-09';
const rng = () => 0.42;

test('cramCategories：分類齊全、總數對、learned 跟 cards 走', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  const cats = cramCategories(s);
  assert.equal(cats.reduce((n, c) => n + c.total, 0), VOCAB_N5.length);
  assert.ok(cats.every((c) => c.learned === 0), '新帳號各類 learned=0');

  const w = VOCAB_N5.find((x) => x.cat === '寒暄')!;
  s.cards[`w:${w.jp}`] = grade(newCard(`w:${w.jp}`, TODAY), true, TODAY);
  const c2 = cramCategories(s).find((c) => c.cat === '寒暄')!;
  assert.equal(c2.learned, 1);
});

test('cramRound：未學優先、滿 10 個、全同類；全學過時補最弱的', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  const r = cramRound(s, '動詞');
  assert.equal(r.length, CRAM_SIZE);
  assert.ok(r.every((w) => w.cat === '動詞'));
  assert.ok(r.every((w) => !s.cards[`w:${w.jp}`]), '新帳號應全是未學字');

  // 寒暄全 10 字建卡（一個 ease 壓低），再抽應回頭複習、弱卡在前
  const greet = VOCAB_N5.filter((w) => w.cat === '寒暄');
  for (const w of greet) s.cards[`w:${w.jp}`] = grade(newCard(`w:${w.jp}`, TODAY), true, TODAY);
  const weak = greet[3];
  s.cards[`w:${weak.jp}`] = { ...s.cards[`w:${weak.jp}`], ease: 1.3, lapses: 5 };
  const r2 = cramRound(s, '寒暄');
  assert.equal(r2.length, Math.min(CRAM_SIZE, greet.length));
  assert.equal(r2[0].jp, weak.jp, '最弱的排最前');
});

test('cramChoices：四選一、含正解、不重複', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  const round = cramRound(s, '時間');
  for (const w of round) {
    const opts = cramChoices(w, round, rng);
    assert.equal(opts.length, 4);
    assert.ok(opts.includes(w.zh));
    assert.equal(new Set(opts).size, 4);
  }
});

test('cramCoins：答對數×1.5、每日上限 45、跨日重置', () => {
  const s = initState('jj', { hira: true, kata: true }, TODAY);
  assert.equal(cramCoins(10, s, TODAY).earned, 15, '滿分 15 金幣');
  assert.equal(cramCoins(7, s, TODAY).earned, 10, '7 對＝10.5 捨去成 10');
  assert.equal(cramCoins(0, s, TODAY).earned, 0);

  s.cram = { date: TODAY, coins: 44 };
  assert.equal(cramCoins(10, s, TODAY).earned, 1, '剩 1 額度只發 1');
  s.cram = { date: TODAY, coins: CRAM_DAILY_COIN_CAP };
  assert.equal(cramCoins(10, s, TODAY).earned, 0, '滿額不發');
  s.cram = { date: '2026-07-08', coins: CRAM_DAILY_COIN_CAP };
  assert.equal(cramCoins(10, s, TODAY).earned, 15, '跨日重置');
});
