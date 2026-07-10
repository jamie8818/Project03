import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duelQuestions, duelPoints, mulberry32, hashSeed } from '../src/lib/seeded.ts';
import { levelInfo, comboMultiplier, newlyUnlocked, setShopSnapshot, ACHIEVEMENTS, XP } from '../src/lib/xp.ts';
import { initState, normalize } from '../src/lib/store.ts';
import type { UserState } from '../src/types.ts';

const TODAY = '2026-07-06';

test('seeded：同 seed 出同題同選項序，不同 seed 不同', () => {
  const a = duelQuestions('duel:2026-07-06');
  const b = duelQuestions('duel:2026-07-06');
  const c = duelQuestions('duel:2026-07-07');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((q) => q.prompt), c.map((q) => q.prompt));
});

test('seeded：10 題＝5 假名＋5 單字、四選一含正解且無重複', () => {
  const qs = duelQuestions('test-seed');
  assert.equal(qs.length, 10);
  assert.equal(qs.filter((q) => q.kind === 'kana').length, 5);
  assert.equal(qs.filter((q) => q.kind === 'word').length, 5);
  for (const q of qs) {
    assert.equal(q.choices.length, 4, `${q.prompt} 選項數`);
    assert.ok(q.choices.includes(q.answer));
    assert.equal(new Set(q.choices).size, 4);
  }
});

test('mulberry32 決定性、hashSeed 穩定', () => {
  const r1 = mulberry32(hashSeed('abc'));
  const r2 = mulberry32(hashSeed('abc'));
  assert.equal(r1(), r2());
});

test('對決計分：對題 100＋剩秒×5，錯題 0', () => {
  assert.equal(duelPoints(true, 10), 150);
  assert.equal(duelPoints(true, 0), 100);
  assert.equal(duelPoints(false, 10), 0);
});

test('等級曲線：Lv1 起步、XP 越多等級越高、稱號會變', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(0).title, '見習店員');
  assert.equal(levelInfo(40).level, 2);
  assert.ok(levelInfo(4000).level > levelInfo(400).level);
  assert.notEqual(levelInfo(4000).title, '見習店員');
});

test('combo 係數：0-2→×1、3-5→×2、6+→×3', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(3), 2);
  assert.equal(comboMultiplier(6), 3);
  assert.equal(comboMultiplier(20), 3);
});

test('成就判定：初陣、衝刺300、初勝利', () => {
  const s = initState('jj', { hira: false, kata: false }, TODAY);
  assert.deepEqual(newlyUnlocked(s), []);
  s.sessionsDone = 1;
  s.sprintBest = 320;
  s.duel = { w: 1, l: 0, streak: 1, lastCounted: TODAY };
  const got = newlyUnlocked(s);
  assert.ok(got.includes('first-clear'));
  assert.ok(got.includes('sprint-300'));
  assert.ok(got.includes('duel-first-win'));
  // 已入帳的不重複解鎖
  s.achievements = got;
  assert.deepEqual(newlyUnlocked(s), []);
  assert.ok(ACHIEVEMENTS.length >= 12);
});

test('E16 店鋪型成就：snapshot 缺席一律 false、餵店況後正確判定', () => {
  const s = initState('jj', { hira: false, kata: false }, TODAY);
  s.coins = 1500;
  // 尚未餵 snapshot：店鋪型不解鎖（miser 是純 state 判定、照樣解）
  let got = newlyUnlocked(s);
  assert.ok(got.includes('miser'), '金幣 1000 純 state 判定不用 snapshot');
  assert.ok(!got.includes('first-deco'), 'snapshot 缺席 → 店鋪型 false');
  s.achievements = got;

  setShopSnapshot({
    stock: { shark_plush: 3, trophy_second_best: 1 },
    sign: '',
    guestLines: {},
    layout: [
      { id: 'shark_plush', gx: 10, gy: 8 },
      { id: 'shark_plush', gx: 12, gy: 8 },
      { id: 'shark_plush', gx: 14, gy: 8 },
    ],
    board: [],
    updatedAt: '',
  });
  got = newlyUnlocked(s);
  assert.ok(got.includes('first-deco'), '擺了東西 → 初擺設');
  assert.ok(got.includes('shark-keeper'), '3 隻鯊魚 → 鯊魚飼育員');
  assert.ok(got.includes('second-best'), '擁有第二名獎盃');
  assert.ok(!got.includes('interior-designer'), '3 件 < 30');
  assert.ok(!got.includes('gacha-complete'), 'personal 沒收齊');
  assert.ok(ACHIEVEMENTS.length >= 29, `12 學習型 + 17 店鋪型（Tier A），實際 ${ACHIEVEMENTS.length}`);
});

test('normalize 補齊 R2 新欄位（舊資料相容）', () => {
  const legacy = { user: 'jj', cards: {}, streak: 0 } as unknown as UserState;
  const s = normalize(legacy)!;
  assert.equal(s.xp, 0);
  assert.deepEqual(s.achievements, []);
  assert.equal(s.duel.w, 0);
  assert.equal(typeof XP.daily, 'number');
});
