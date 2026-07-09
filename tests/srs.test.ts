import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grade, newCard, seededCard, isDue, isMastered } from '../src/lib/srs.ts';
import { addDays, daysBetween } from '../src/lib/dates.ts';

const TODAY = '2026-07-06';

test('新卡當天到期', () => {
  const c = newCard('h:あ', TODAY);
  assert.equal(isDue(c, TODAY), true);
});

test('答對間隔 1 → 3 → ×ease 遞增', () => {
  let c = newCard('h:あ', TODAY);
  c = grade(c, true, TODAY);
  assert.equal(c.ivl, 1);
  assert.equal(c.due, addDays(TODAY, 1));
  c = grade(c, true, c.due);
  assert.equal(c.ivl, 3);
  const before = c.ivl;
  c = grade(c, true, c.due);
  assert.ok(c.ivl > before, `第三次間隔要變長，得到 ${c.ivl}`);
});

test('答錯歸零、當天重排、ease 下修但有下限', () => {
  let c = newCard('h:あ', TODAY);
  c = grade(c, true, TODAY);
  c = grade(c, true, addDays(TODAY, 1));
  c = grade(c, false, addDays(TODAY, 4));
  assert.equal(c.reps, 0);
  assert.equal(c.lapses, 1);
  assert.equal(c.due, addDays(TODAY, 4));
  for (let i = 0; i < 20; i++) c = grade(c, false, TODAY);
  assert.ok(c.ease >= 1.3);
});

test('種子卡（已熟字系）錯開到期、未達精熟門檻', () => {
  const c = seededCard('h:あ', TODAY, 5);
  assert.equal(daysBetween(TODAY, c.due), 5);
  assert.equal(isDue(c, TODAY), false);
  assert.equal(isMastered(c), false); // ivl 10 < 14，還要輪過驗證
});

test('連續答對會達到精熟（ivl ≥ 14）', () => {
  let c = newCard('h:あ', TODAY);
  for (let i = 0; i < 5; i++) c = grade(c, true, c.due);
  assert.equal(isMastered(c), true);
});
