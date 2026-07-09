import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXCHANGES,
  pickExchange,
  serveChoices,
  serveTier,
  FOOD_POOL,
  pickTodayFoods,
  orderLine,
  buildOrder,
  maxOrderItems,
  orderPhrase,
  CUSTOMER_CHARS,
  CUST_ACTION,
  custSprite,
  pickCustomer,
} from '../src/data/serving.ts';

test('接客台詞（重用）：四選一可組、四階段都有、tier 0 也夠玩', () => {
  assert.ok(EXCHANGES.length >= 25, `橋段數 ${EXCHANGES.length}`);
  for (const ex of EXCHANGES) {
    const ch = serveChoices(ex, () => 0.5);
    assert.equal(ch.length, 4, `${ex.say} 選項數`);
    assert.ok(ch.includes(ex.answer));
    assert.equal(new Set(ch).size, 4, `${ex.say} 選項重複`);
  }
  const phases = new Set(EXCHANGES.map((e) => e.phase));
  for (const p of ['greet', 'order', 'pay', 'bye']) assert.ok(phases.has(p as never), `缺 ${p}`);
  assert.ok(EXCHANGES.filter((e) => e.tier === 0).length >= 8, 'tier0 太少');
});

test('serveTier：learned 越多 tier 越高，pickExchange 不超過玩家 tier', () => {
  assert.equal(serveTier(0), 0);
  assert.equal(serveTier(30), 1);
  assert.equal(serveTier(120), 2);
  for (let i = 0; i < 50; i++) {
    assert.ok(pickExchange(0).tier <= 0);
    assert.ok(pickExchange(1).tier <= 1);
  }
});

test('食物庫 FOOD_POOL：111 種、id 唯一、對得到圖檔、定價/分類/tags 完整', () => {
  assert.ok(FOOD_POOL.length >= 100, `食物數 ${FOOD_POOL.length}`);
  const ids = FOOD_POOL.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, '食物 id 重複');
  const CATS = ['甜點', '飲料', '正餐', '點心', '主食'];
  const TAGS = ['甜', '冰', '熱', '鹹', '酸'];
  for (const f of FOOD_POOL) {
    assert.equal(f.art, `/baito/food/${f.id}.png`, `${f.id} 圖檔路徑`);
    assert.ok(f.price > 0, `${f.id} 定價`);
    assert.ok(CATS.includes(f.category), `${f.id} 分類 ${f.category}`);
    assert.ok(Array.isArray(f.tags) && f.tags.every((t) => TAGS.includes(t)), `${f.id} tags ${f.tags}`);
    assert.ok(f.ja && f.kana && f.zh && f.cuisine, `${f.id} 缺欄位`);
  }
});

test('pickTodayFoods：抽 n 張不重複，未學（mastery 低）優先', () => {
  const foods = pickTodayFoods({}, 10, () => 0.5);
  assert.equal(foods.length, Math.min(10, FOOD_POOL.length));
  assert.equal(new Set(foods.map((f) => f.id)).size, foods.length, '抽到重複');

  // 只練過部分食物 → 沒練過的要被排進來
  const mastery: Record<string, number> = {};
  for (const f of FOOD_POOL.slice(0, 3)) mastery[f.id] = 99;
  const picked = pickTodayFoods(mastery, 5, () => 0.5).map((f) => f.id);
  const cold = FOOD_POOL.slice(3).map((f) => f.id);
  assert.ok(picked.some((id) => cold.includes(id)), '未學食物沒被優先');
});

test('orderLine：say/kana/zh 都帶進點的那樣食物', () => {
  for (const f of FOOD_POOL) {
    const line = orderLine(f, () => 0);
    assert.ok(line.say.startsWith(f.ja), `${f.id} say`);
    assert.ok(line.kana.startsWith(f.kana), `${f.id} kana`);
    assert.ok(line.zh.includes(f.zh), `${f.id} zh`);
  }
});

test('buildOrder：1–3 樣不重複、單品必 single、三品必 seq、都在今日食物內', () => {
  const foods = FOOD_POOL.slice(0, 6);
  const ids = new Set(foods.map((f) => f.id));
  for (let i = 0; i < 300; i++) {
    const o = buildOrder(foods);
    assert.ok(o.items.length >= 1 && o.items.length <= 3, `品項數 ${o.items.length}`);
    assert.equal(new Set(o.items.map((f) => f.id)).size, o.items.length, '品項重複');
    for (const f of o.items) assert.ok(ids.has(f.id), '點到非今日食物');
    if (o.items.length === 1) assert.equal(o.mode, 'single');
    else assert.notEqual(o.mode, 'single');
    if (o.items.length === 3) assert.equal(o.mode, 'seq', '三品應走 seq');
  }
});

test('buildOrder 難度 gate：maxItems=1 全單品、=2 不出三品；maxOrderItems 依課程進度解鎖', () => {
  const foods = FOOD_POOL.slice(0, 6);
  for (let i = 0; i < 200; i++) {
    assert.equal(buildOrder(foods, Math.random, 1).items.length, 1, 'maxItems=1 應全單品');
    assert.ok(buildOrder(foods, Math.random, 2).items.length <= 2, 'maxItems=2 不應出三品');
  }
  // と/も L16 教 → 16 課前全單品；N5 全 20 課後開三品
  assert.equal(maxOrderItems(0), 1);
  assert.equal(maxOrderItems(15), 1);
  assert.equal(maxOrderItems(16), 2);
  assert.equal(maxOrderItems(19), 2);
  assert.equal(maxOrderItems(20), 3);
});

test('orderPhrase：單品用を、追加用も、多品用と串接全部', () => {
  const [a, b, c] = FOOD_POOL;
  const single = orderPhrase([a]);
  assert.ok(single.say.startsWith(a.ja) && single.say.includes('を'), '單品用を');
  const add = orderPhrase([b], true);
  assert.ok(add.say.startsWith(b.ja) && add.say.includes('も'), '追加用も');
  const multi = orderPhrase([a, b, c]);
  assert.ok(multi.say.includes('と'), '多品用と');
  for (const f of [a, b, c]) assert.ok(multi.say.includes(f.ja), `多品缺 ${f.id}`);
});

test('客人角色：10 隻、5 動作 sprite 檔名合法', () => {
  assert.equal(CUSTOMER_CHARS.length, 10);
  const actions = Object.keys(CUST_ACTION) as (keyof typeof CUST_ACTION)[];
  assert.equal(actions.length, 5, '動作應為 5 個');
  for (const c of CUSTOMER_CHARS) {
    for (const a of actions) {
      assert.equal(custSprite(c.id, a), `/baito/customers/${c.id}${CUST_ACTION[a]}.png`);
    }
  }
  const slugs = new Set(CUSTOMER_CHARS.map((c) => c.id));
  for (let i = 0; i < 30; i++) {
    assert.ok(slugs.has(pickCustomer().id));
  }
});
