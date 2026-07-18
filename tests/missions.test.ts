import test from 'node:test';
import assert from 'node:assert/strict';
import { initState } from '../src/lib/store.ts';
import { completeMission, missionDoneToday } from '../src/lib/missions.ts';
import { STATION_MISSION } from '../src/data/missions.ts';

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
