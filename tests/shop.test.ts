import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAFE_ITEMS,
  DAILY_SHOP_SIZE,
  SHOP_ITEMS,
  dailyShopItems,
  pickShopLine,
  poseForLine,
  shopLevel,
  shopLevelXp,
  shopTitle,
} from '../src/lib/shop.ts';
import { SHOP_LINES_GEN } from '../src/data/shop-lines.gen.ts';

test('店長台詞：總數 ≥ 200、三情境抽詞正常、每句自帶姿勢可用', () => {
  const all = [...SHOP_LINES_GEN.closed, ...SHOP_LINES_GEN.solo, ...SHOP_LINES_GEN.full];
  assert.ok(all.length >= 200, `目前 ${all.length} 句`);
  const closedPick = pickShopLine(0, false, () => 0);
  assert.ok(SHOP_LINES_GEN.closed.includes(closedPick));
  assert.equal(typeof closedPick.text, 'string');
  assert.equal(poseForLine(closedPick, false, 0), closedPick.pose);
  const fullPick = pickShopLine(2, true, () => 0);
  assert.ok(SHOP_LINES_GEN.full.includes(fullPick));
});

test('店等級曲線：Lv1 起步、XP 遞增、門檻一致', () => {
  assert.equal(shopLevel(0), 1);
  assert.equal(shopLevel(80), 2);
  assert.ok(shopLevel(5000) > shopLevel(500));
  assert.equal(shopLevelXp(2), 80);
  assert.ok(shopTitle(1).length > 0);
});

test('咖啡廳家具目錄：id 不重複、每件有 footprint 與價/等級、開局家具送庫存', () => {
  const ids = CAFE_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'id 重複');
  for (const it of CAFE_ITEMS) {
    assert.ok(it.w > 0 && it.h > 0, `${it.id} 缺 footprint`);
    assert.ok(it.price >= 0 && it.lv >= 1, `${it.id} 價/等級異常`);
    assert.ok(['rug', 'furniture', 'surface', 'wall'].includes(it.z), `${it.id} z 非法`);
  }
  // 開局家具＝送 1 件庫存（不進商店販售，見「商店販售清單排除開局贈品」）；售價欄位僅顯示用、不強制 0
  assert.ok(CAFE_ITEMS.some((i) => i.starter), '應有開局家具');
});

test('一般貨架排除開局贈品與珍藏轉蛋品', () => {
  assert.ok(SHOP_ITEMS.length > 0);
  assert.ok(SHOP_ITEMS.every((i) => !i.starter), '商店不該賣開局贈品');
  assert.ok(SHOP_ITEMS.every((i) => i.category !== 'personal'), '珍藏・私物只進專屬轉蛋池');
  assert.equal(SHOP_ITEMS.length, CAFE_ITEMS.filter((i) => !i.starter && i.category !== 'personal').length);
});

test('每日商店：同日固定 10 件、隔日換貨、無重複且不受舊等級欄位限制', () => {
  const a = dailyShopItems('2026-07-06');
  const b = dailyShopItems('2026-07-06');
  const nextDay = dailyShopItems('2026-07-07');
  assert.equal(a.length, DAILY_SHOP_SIZE);
  assert.equal(new Set(a.map((i) => i.id)).size, DAILY_SHOP_SIZE);
  assert.deepEqual(a.map((i) => i.id), b.map((i) => i.id), '同一天重整／不同玩家看到同一批');
  assert.notDeepEqual(a.map((i) => i.id), nextDay.map((i) => i.id), '隔天更換貨單');
  assert.ok(a.every((i) => SHOP_ITEMS.includes(i)), '只從一般貨架池抽');
  assert.ok(a.some((i) => i.lv > 1), '舊資料的 Lv.2+ 家具也能直接出現在今日貨架');
});
