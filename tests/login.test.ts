import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catGuardBridges, completeSession, displayStreak, initState, nextStreakOf } from '../src/lib/store.ts';
import { applyLogin, grantableGifts } from '../src/lib/login.ts';
import { GIFT_COIN_FALLBACK, LOGIN_COINS, PANDA_GIFTS, PANDA_MAIL, PANDA_MAIL_FIRST, giftsEarned, letterFor } from '../src/data/panda-mail.ts';
import { addDays } from '../src/lib/dates.ts';
import type { UserState } from '../src/types.ts';

const TODAY = '2026-07-06';
const fresh = (): UserState => initState('jj', { hira: false, kata: false }, TODAY);
const withLogin = (days: number, furn = 0): UserState => ({ ...fresh(), login: { last: addDays(TODAY, -1), days, furn } });

test('熊貓信：第 1 天開場信、之後 30 封輪替', () => {
  assert.equal(PANDA_MAIL.length, 30);
  assert.equal(letterFor(1), PANDA_MAIL_FIRST); // 第一天專屬、不進輪替
  assert.equal(letterFor(2), PANDA_MAIL[0]);
  assert.equal(letterFor(31), PANDA_MAIL[29]);
  assert.equal(letterFor(32), PANDA_MAIL[0]); // 第二輪回第一封（不會再看到開場信）
});

test('每日登入：首登發零用錢＋第 1 件家具、同日冪等', () => {
  const r = applyLogin(fresh(), TODAY)!;
  assert.equal(r.days, 1);
  assert.equal(r.coins, LOGIN_COINS);
  assert.equal(r.gift?.id, PANDA_GIFTS[0].id); // 人生第一天就送熊貓不倒翁
  assert.equal(r.state.coins, fresh().coins + LOGIN_COINS);
  assert.equal(r.state.login?.last, TODAY);
  assert.equal(applyLogin(r.state, TODAY), null); // 同日再開＝不重複
});

test('每日登入：家具日節奏 1/8/15…、六件送完改發轉蛋基金', () => {
  const d2 = applyLogin(applyLogin(fresh(), TODAY)!.state, addDays(TODAY, 1))!;
  assert.equal(d2.days, 2);
  assert.equal(d2.gift, undefined); // 第 2 天沒禮物

  const d8 = applyLogin(withLogin(7), TODAY)!;
  assert.equal(d8.days, 8);
  assert.equal(d8.gift?.id, PANDA_GIFTS[1].id); // 滿一週第 2 件

  const d36 = applyLogin(withLogin(35), TODAY)!;
  assert.equal(d36.gift?.id, PANDA_GIFTS[5].id); // 最後一件

  const d43 = applyLogin(withLogin(42), TODAY)!;
  assert.equal(d43.gift, undefined);
  assert.equal(d43.coins, LOGIN_COINS + GIFT_COIN_FALLBACK); // 家具送完＝轉蛋基金
  assert.equal(giftsEarned(43), PANDA_GIFTS.length);
});

test('每日登入：天數累積制、斷簽不歸零', () => {
  const r = applyLogin(withLogin(9), addDays(TODAY, 30))!; // 隔一個月才回來
  assert.equal(r.days, 10);
});

test('週家具入庫：照順序、遇素材未到貨即停', () => {
  const s = withLogin(15); // 賺到 3 件
  const none = grantableGifts(s, new Set());
  assert.equal(none.length, 0); // 素材全沒到＝先掛帳
  const partial = grantableGifts(s, new Set([PANDA_GIFTS[0].id, PANDA_GIFTS[2].id]));
  assert.deepEqual(partial.map((g) => g.id), [PANDA_GIFTS[0].id]); // 第 2 件缺貨＝後面的先不發
  const s2 = { ...s, login: { ...s.login!, furn: 1 } };
  const rest = grantableGifts(s2, new Set(PANDA_GIFTS.map((g) => g.id)));
  assert.deepEqual(rest.map((g) => g.id), [PANDA_GIFTS[1].id, PANDA_GIFTS[2].id]); // 已發過的不重發
});

test('貓顧店：漏一天粉圓代守、7 天冷卻、漏兩天救不了', () => {
  let s = completeSession(fresh(), 20, TODAY);
  s = completeSession(s, 20, addDays(TODAY, 1));
  assert.equal(s.streak, 2);
  // 漏掉 +2，+3 回來：粉圓補洞，streak 接著跳 3
  assert.ok(catGuardBridges(s, addDays(TODAY, 3)));
  assert.equal(nextStreakOf(s, addDays(TODAY, 3)), 3);
  s = completeSession(s, 20, addDays(TODAY, 3));
  assert.equal(s.streak, 3);
  assert.equal(s.catGuardAt, addDays(TODAY, 3));
  // 再漏 +4、+5 回來：冷卻中（距上次 2 天）＝斷鏈歸一
  assert.equal(catGuardBridges(s, addDays(TODAY, 5)), false);
  s = completeSession(s, 20, addDays(TODAY, 5));
  assert.equal(s.streak, 1);
  // 冷卻滿 7 天後又漏一天：可以再救
  s = completeSession(s, 20, addDays(TODAY, 11));
  s = completeSession(s, 20, addDays(TODAY, 12));
  assert.ok(catGuardBridges(s, addDays(TODAY, 14))); // 上次出勤 +3、已滿 7 天
  // 漏兩天（最後完成日與今天差 3）＝救不了
  assert.equal(catGuardBridges(s, addDays(TODAY, 15)), false);
  assert.equal(nextStreakOf(s, addDays(TODAY, 15)), 1);
});

test('貓顧店：顯示值在「漏一天且可救」時不歸零', () => {
  let s = completeSession(fresh(), 20, TODAY);
  s = completeSession(s, 20, addDays(TODAY, 1));
  assert.equal(displayStreak(s, addDays(TODAY, 3)), 2); // 粉圓顧店中，照常顯示
  assert.equal(displayStreak({ ...s, catGuardAt: addDays(TODAY, 2) }, addDays(TODAY, 3)), 0); // 冷卻中＝真斷了
  assert.equal(displayStreak(s, addDays(TODAY, 4)), 0); // 漏兩天＝歸零
});
