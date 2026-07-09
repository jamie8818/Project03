import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedHours, paceStatus, GOAL } from '../src/lib/goal.ts';

test('目標曲線：起點 0、N5 考日 120h、N4 考日 320h', () => {
  assert.equal(expectedHours(GOAL.start), 0);
  assert.ok(Math.abs(expectedHours(GOAL.n5.date) - 120) < 0.01);
  assert.ok(Math.abs(expectedHours(GOAL.n4.date) - 320) < 0.01);
  assert.ok(expectedHours('2026-09-06') > 0);
});

test('paceStatus：落後為負、每週需求時數合理', () => {
  const p = paceStatus(0, '2026-08-06'); // 一個月都沒練
  assert.ok(p.deltaH < 0);
  assert.equal(p.nextExam.label, GOAL.n5.label);
  assert.ok(p.weeklyNeededH > 5 && p.weeklyNeededH < 10, `每週需求 ${p.weeklyNeededH}`);
});
