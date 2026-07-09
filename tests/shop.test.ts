import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAFE_ITEMS,
  SHOP_ITEMS,
  SHOP_LINES,
  nextItemLv,
  pickShopLine,
  shopLevel,
  shopLevelXp,
  shopTitle,
} from '../src/lib/shop.ts';

test('店長台詞：總數 ≥ 200、無重複、三情境抽詞正常', () => {
  const all = Object.values(SHOP_LINES).flat();
  assert.ok(all.length >= 200, `目前 ${all.length} 句`);
  assert.equal(new Set(all).size, all.length, '有重複句');
  assert.ok(SHOP_LINES.closed.includes(pickShopLine(0, false, () => 0)));
  assert.ok(typeof pickShopLine(2, true) === 'string');
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

test('商店販售清單排除開局贈品', () => {
  assert.ok(SHOP_ITEMS.length > 0);
  assert.ok(SHOP_ITEMS.every((i) => !i.starter), '商店不該賣開局贈品');
  assert.equal(SHOP_ITEMS.length, CAFE_ITEMS.filter((i) => !i.starter).length);
});

test('nextItemLv：回下一個解鎖等級、全解鎖回 null', () => {
  const first = nextItemLv(1);
  assert.ok(first === null || first > 1);
  assert.equal(nextItemLv(999), null);
});
