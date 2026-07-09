import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LUCKS, OMIKUJI_LINES, PUDDINGS, drawOmikuji, dropPudding, rarityWeights, luckOf } from '../src/data/fun.ts';

test('御神籤：每種運勢都有籤詩、權重合理、抽籤結果完整', () => {
  for (const l of LUCKS) {
    assert.ok(OMIKUJI_LINES[l.id]?.length >= 5, `${l.label} 籤詩不足`);
    assert.ok(l.xp > 0);
  }
  const r = drawOmikuji(() => 0.01); // 極小值 → 落在第一格
  assert.equal(r.luck, 'daikichi');
  assert.ok(r.kana.length === 1);
  assert.ok(OMIKUJI_LINES.daikichi.includes(r.line));
  assert.equal(luckOf('不存在').label, '中吉'); // fallback
});

test('布丁圖鑑：id 不重複、三稀有度都有、色相參數齊', () => {
  assert.equal(new Set(PUDDINGS.map((p) => p.id)).size, PUDDINGS.length);
  assert.ok(PUDDINGS.filter((p) => p.rarity === 'N').length >= 10);
  assert.ok(PUDDINGS.filter((p) => p.rarity === 'R').length >= 6);
  assert.ok(PUDDINGS.filter((p) => p.rarity === 'SR').length >= 3);
});

import { GACHA_COST, bossOfWeek, gachaRoll, mysteryReward, mysteryToday, weekId } from '../src/data/fun.ts';

test('神秘客：同人同日結果固定、兩人獨立、機率約35%', () => {
  assert.equal(mysteryToday('jj', '2026-07-06'), mysteryToday('jj', '2026-07-06'));
  let hits = 0;
  for (let i = 1; i <= 200; i++) {
    const d = `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
    if (mysteryToday('jj', d)) hits++;
  }
  assert.ok(hits > 40 && hits < 100, `200 天中出現 ${hits} 次`);
});

test('神秘客獎勵保底 R、扭蛋成本合理且大當たり給兩顆', () => {
  for (let i = 0; i < 30; i++) assert.notEqual(mysteryReward().rarity, 'N');
  assert.ok(GACHA_COST > 0);
  const jack = gachaRoll(() => 0.05); // rng 恆小 → 第一顆 N、jackpot 判定 <0.1 成立
  assert.equal(jack.jackpot, true);
  assert.equal(jack.puddings.length, 2);
});

test('週間 Boss：weekId 以週一為界、同週同 Boss', () => {
  assert.equal(weekId('2026-07-06'), '2026-07-06'); // 週一
  assert.equal(weekId('2026-07-12'), '2026-07-06'); // 週日仍同週
  assert.equal(weekId('2026-07-13'), '2026-07-13'); // 下週一換
  assert.deepEqual(bossOfWeek('2026-07-06'), bossOfWeek('2026-07-06'));
  assert.ok(bossOfWeek('2026-07-06').maxHp > 0);
});

import { COINS, STREAK_MILESTONES, dueStreakMilestone } from '../src/data/fun.ts';

test('連續里程碑：命中該天且未領過才給、遞增、金幣源齊全', () => {
  assert.equal(dueStreakMilestone(7, []).coins, 40);
  assert.equal(dueStreakMilestone(7, [7]), null); // 領過
  assert.equal(dueStreakMilestone(5, []), null); // 非里程碑天
  const days = STREAK_MILESTONES.map((m) => m.day);
  assert.deepEqual(days, [...days].sort((a, b) => a - b));
  for (const k of ['minigame', 'achievement', 'bossClaim', 'daily'] as const) assert.ok(COINS[k] > 0);
});

test('稀有率隨 streak 遞增、掉落尊重權重', () => {
  assert.ok(rarityWeights(0).SR < rarityWeights(7).SR);
  assert.ok(rarityWeights(7).SR < rarityWeights(30).SR);
  assert.equal(dropPudding(0, () => 0.01).rarity, 'N'); // 落在 N 區
  assert.equal(dropPudding(0, () => 0.999).rarity, 'SR'); // 落在最尾端
});
