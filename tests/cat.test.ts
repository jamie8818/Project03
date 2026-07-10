import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AFFECTION_COOLDOWN_MS,
  AFFECTION_START,
  ANGRY_PENALTY,
  PET_ACCEPT_BASE,
  PET_ACCEPT_PER_POINT,
  PET_GAIN,
  SULK_MS,
  affectionTier,
  initAffection,
  petCat,
  type CatAffection,
} from '../src/lib/cat.ts';

const T0 = 1_800_000_000_000; // 固定基準時間
const always = () => 0; // rng=0 → 必過擲骰
const never = () => 0.999; // rng≈1 → 必不過

test('petCat：首摸初始化＋擲骰通過＝+2、更新 lastPetAt', () => {
  const r = petCat(undefined, 'yaxuan', T0, always);
  assert.equal(r.outcome, 'pet');
  assert.equal(r.next.value, AFFECTION_START.yaxuan + PET_GAIN);
  assert.equal(r.next.lastPetAt, T0);
  const j = petCat(undefined, 'jj', T0, always);
  assert.equal(j.next.value, AFFECTION_START.jj + PET_GAIN, 'JJ 起始 5（待覆核值）');
});

test('petCat：擲骰失敗＝dodge、不扣分、lastPetAt 不動（可再試手氣）', () => {
  const r = petCat(undefined, 'jj', T0, never);
  assert.equal(r.outcome, 'dodge');
  assert.equal(r.next.value, AFFECTION_START.jj);
  assert.equal(r.next.lastPetAt, 0);
  // 馬上再摸一次（第 2 次，不觸連摸）→ 仍可擲骰
  const r2 = petCat(r.next, 'jj', T0 + 1000, always);
  assert.equal(r2.outcome, 'pet');
});

test('petCat：接受率公式 30%+好感×0.6%（好感 100 → 90%）', () => {
  const a: CatAffection = { value: 100, lastPetAt: 0, pets: [], sulkUntil: 0 };
  assert.equal(petCat(a, 'jj', T0, () => 0.899).outcome, 'pet');
  assert.equal(petCat(a, 'jj', T0, () => 0.901).outcome, 'dodge');
  const zero: CatAffection = { value: 0, lastPetAt: 0, pets: [], sulkUntil: 0 };
  assert.equal(petCat(zero, 'jj', T0, () => 0.299).outcome, 'pet');
  assert.equal(petCat(zero, 'jj', T0, () => 0.301).outcome, 'dodge');
  assert.ok(Math.abs(PET_ACCEPT_BASE + 100 * PET_ACCEPT_PER_POINT - 0.9) < 1e-9);
});

test('petCat：冷卻內＝cooldown 不擲骰不加分；好感 cap 100', () => {
  const ok = petCat(undefined, 'jj', T0, always).next;
  const cold = petCat(ok, 'jj', T0 + AFFECTION_COOLDOWN_MS - 1000, always);
  assert.equal(cold.outcome, 'cooldown');
  assert.equal(cold.next.value, ok.value);
  const warm = petCat(ok, 'jj', T0 + AFFECTION_COOLDOWN_MS + 1000, always);
  assert.equal(warm.outcome, 'pet');
  const maxed: CatAffection = { value: 100, lastPetAt: 0, pets: [], sulkUntil: 0 };
  assert.equal(petCat(maxed, 'jj', T0, always).next.value, 100, 'cap 100');
});

test('petCat：60s 內第 3 次＝生氣 −3（floor 0）＋賭氣 300s，期間必拒', () => {
  let a = initAffection('yaxuan'); // 15
  a = petCat(a, 'yaxuan', T0, never).next; // 1
  a = petCat(a, 'yaxuan', T0 + 10e3, never).next; // 2
  const angry = petCat(a, 'yaxuan', T0 + 20e3, always); // 3 → 生氣（就算骰運好也生氣）
  assert.equal(angry.outcome, 'angry');
  assert.equal(angry.next.value, 15 - ANGRY_PENALTY);
  assert.equal(angry.next.sulkUntil, T0 + 20e3 + SULK_MS);
  // 賭氣期間必拒
  const sulk = petCat(angry.next, 'yaxuan', T0 + 20e3 + SULK_MS - 1000, always);
  assert.equal(sulk.outcome, 'sulk');
  // 賭氣結束恢復擲骰
  const after = petCat(angry.next, 'yaxuan', T0 + 20e3 + SULK_MS + 1000, always);
  assert.equal(after.outcome, 'pet');
  // floor 0：低好感連生氣不會變負
  let low: CatAffection = { value: 1, lastPetAt: 0, pets: [T0, T0 + 1000], sulkUntil: 0 };
  assert.equal(petCat(low, 'jj', T0 + 2000, always).next.value, 0);
});

test('petCat：61s 前的點擊滑出視窗、不累計連摸', () => {
  let a = initAffection('jj');
  a = petCat(a, 'jj', T0, never).next;
  a = petCat(a, 'jj', T0 + 30e3, never).next;
  // 第 3 點在第 1 點滑出視窗之後 → 視窗內只有 2 次，不生氣
  const r = petCat(a, 'jj', T0 + 65e3, always);
  assert.equal(r.outcome, 'pet');
});

test('affectionTier：四階級邊界', () => {
  assert.equal(affectionTier(0).name, '生疏');
  assert.equal(affectionTier(24).badge, '');
  assert.equal(affectionTier(25).badge, '❤');
  assert.equal(affectionTier(50).badge, '❤❤♪');
  assert.equal(affectionTier(75).badge, '❤❤❤');
  assert.equal(affectionTier(100).name, '家人');
});

test('E21 逗貓棒被動：+5%、與滿好感疊加剛好頂 95% cap', () => {
  const zero: CatAffection = { value: 0, lastPetAt: 0, pets: [], sulkUntil: 0 };
  // 好感 0＋teaser：30%+5%=35%
  assert.equal(petCat(zero, 'jj', T0, () => 0.349, true).outcome, 'pet');
  assert.equal(petCat(zero, 'jj', T0, () => 0.351, true).outcome, 'dodge');
  // 好感 100＋teaser：90%+5%=95%＝cap
  const maxed: CatAffection = { value: 100, lastPetAt: 0, pets: [], sulkUntil: 0 };
  assert.equal(petCat(maxed, 'jj', T0, () => 0.949, true).outcome, 'pet');
  assert.equal(petCat(maxed, 'jj', T0, () => 0.951, true).outcome, 'dodge');
  // 沒 teaser 行為不變（90%）
  assert.equal(petCat(maxed, 'jj', T0, () => 0.901, false).outcome, 'dodge');
});
