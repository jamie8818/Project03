import test from 'node:test';
import assert from 'node:assert/strict';
import { initState } from '../src/lib/store.ts';
import { completeMission, missionDoneToday } from '../src/lib/missions.ts';
import { existsSync } from 'node:fs';
import { MISSION_CATALOG, STATION_MISSION, missionForDate } from '../src/data/missions.ts';

const TODAY = '2026-07-18';
const ID = 'station-platform';

test('完成任務只新增獨立紀錄，不改動正式經濟', () => {
  const state = initState('jj', { hira: true, kata: true }, TODAY);
  state.coins = 321;
  state.xp = 654;
  const next = completeMission(state, ID, TODAY, 2);
  assert.equal(next.coins, 321);
  assert.equal(next.xp, 654);
  assert.deepEqual(next.missions?.[ID], { date: TODAY, bestScore: 2, plays: 1 });
  assert.equal(missionDoneToday(next, ID, TODAY), true);
});

test('同日重玩保留最佳分，跨日重新計當日最佳', () => {
  let state = initState('jj', { hira: false, kata: false }, TODAY);
  state = completeMission(state, ID, TODAY, 2);
  state = completeMission(state, ID, TODAY, 1);
  assert.deepEqual(state.missions?.[ID], { date: TODAY, bestScore: 2, plays: 2 });

  state = completeMission(state, ID, '2026-07-19', 1);
  assert.deepEqual(state.missions?.[ID], { date: '2026-07-19', bestScore: 1, plays: 3 });
  assert.equal(missionDoneToday(state, ID, TODAY), false);
});

test('車站題不靠重複漢字洩漏答案，且每個選項都有作答解析', () => {
  assert.equal(STATION_MISSION.questions[0].audioOnly, true);
  assert.equal(STATION_MISSION.questions[2].audioOnly, true);
  assert.ok(STATION_MISSION.prepChoices.every((choice) => choice.explain.length > 0));

  for (const question of STATION_MISSION.questions) {
    assert.ok(question.explain.length > 0);
    assert.ok(question.choices.every((choice) => choice.explain.length > 0));
    if (question.audioOnly) {
      assert.ok(question.lineKana.length > 0);
      assert.ok(question.choices.every((choice) => !choice.label.includes('番線')));
    }
  }
});

test('今日委託完整涵蓋 10 主題 39 情境', () => {
  const expected = new Map([
    ['交通', 4], ['購物', 4], ['餐飲', 5], ['住宿', 3], ['便利商店', 4],
    ['問路', 4], ['社交', 5], ['電話', 4], ['工作／學校', 3], ['緊急需求', 3],
  ]);
  assert.equal(MISSION_CATALOG.length, 39);
  assert.equal(new Set(MISSION_CATALOG.map((mission) => mission.id)).size, 39);
  for (const [theme, count] of expected) {
    assert.equal(MISSION_CATALOG.filter((mission) => mission.theme === theme).length, count, theme);
  }
});

test('39 個情境都有三段教學、三題與答對答錯解析，動態圖片存在', () => {
  for (const mission of MISSION_CATALOG) {
    assert.equal(mission.lesson.length, 3, mission.id);
    assert.equal(mission.prepChoices.length, 3, mission.id);
    assert.ok(mission.prepChoices.every((choice) => choice.explain.length > 0), mission.id);
    assert.equal(mission.questions.length, 3, mission.id);
    assert.ok(existsSync(`public${mission.image}`), `${mission.id}: ${mission.image}`);
    for (const question of mission.questions) {
      assert.ok(question.correct >= 0 && question.correct < question.choices.length, mission.id);
      assert.ok(question.choices.length >= 3, mission.id);
      assert.ok(question.explain.length > 0, mission.id);
      assert.ok(question.choices.every((choice) => choice.explain.length > 0), mission.id);
      if (question.audioOnly) {
        assert.ok(question.lineKana && question.lineKana.length > 0, mission.id);
        assert.ok(question.choices.every((choice) => !question.line.includes(choice.label)), mission.id);
      }
    }
  }
});

test('每日輪替 39 天走完一輪，同日固定且第 40 天回到第一題', () => {
  const dates = Array.from({ length: 40 }, (_, offset) => {
    const date = new Date(Date.UTC(2026, 6, 19 + offset));
    return date.toISOString().slice(0, 10);
  });
  const firstRound = dates.slice(0, 39).map((date) => missionForDate(date).id);
  assert.equal(new Set(firstRound).size, 39);
  assert.equal(missionForDate('2026-07-19').id, STATION_MISSION.id);
  assert.equal(missionForDate('2026-07-19').id, missionForDate('2026-07-19').id);
  assert.equal(missionForDate(dates[39]).id, firstRound[0]);
});
