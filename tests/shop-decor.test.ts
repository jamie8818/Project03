import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_BY_ID,
  availableFacings,
  canPlace,
  canToggleInside,
  FRONT_WALL_ROW,
  isFrontWallPlaced,
  findSpot,
  footprintDims,
  frontRowOf,
  guestIndicesOf,
  hostIndexOf,
  isSurfaceHost,
  itemAtCell,
  itemById,
  nextFacing,
  placedCount,
  renderOrder,
  rendersInside,
  rendersOnCounter,
  rotateHost,
  spriteFor,
  stockAvailable,
  type CafeItem,
} from '../src/lib/shop.ts';
import { STARTER_LAYOUT } from '../src/data/cafe.gen.ts';
import { BOARD_MAX, DEFAULT_SHOP, STARTER_IDS, addStockForUser, mergeBoard, mergeStock, mergeStockState, normalizeShop, type BoardMsg, type PlacedItem } from '../src/lib/shopstate.ts';

// 具體品項（來自 cafe.gen.ts 昭和喫茶目錄）
const CHAIR = 'chair_velvet'; // 1×1 家具，非檯面 host（椅子不可放小物）
const APPL = 'grinder';       // 1×1 家具
const TABLE = 'table_low';    // 2×1 家具，檯面 host（可放小物）
const GUEST = 'candle';       // 1×1 檯面小物（surface）
const RUG = 'rug_round';      // 2×2 地毯
const WALL = 'poster';        // 1×2 壁飾
const WIDE = 'rug_runner';    // 4×2（測右界）

test('品項存在且 footprint 合理', () => {
  for (const id of [CHAIR, APPL, TABLE, GUEST, RUG, WALL, WIDE]) {
    const it = itemById(id);
    assert.ok(it, `${id} 不存在`);
    assert.ok(it!.w > 0 && it!.h > 0);
  }
});

test('canPlace：界內、避開固定裝置、不出界', () => {
  assert.ok(canPlace([], CHAIR, 10, 8));   // 內部空地板可放
  assert.ok(!canPlace([], CHAIR, 10, 1));  // 家具不能放牆列（gy < 地板起始列 2）
  assert.ok(!canPlace([], CHAIR, 3, 3));   // 吧檯格被擋（cols1-8 rows2-4）
  assert.ok(!canPlace([], WIDE, 15, 8));   // 4 寬放 col15 → 到 col18 出右界（最右欄＝col17）
  assert.ok(!canPlace([], RUG, 5, 11));    // 2 高放 row11 → 到 row12 出下界
});

test('canPlace：同 z 層不重疊、跨 z 層可交疊', () => {
  const layout: PlacedItem[] = [{ id: CHAIR, gx: 10, gy: 8 }];
  assert.ok(!canPlace(layout, APPL, 10, 8));    // 同層（家具 vs 家具）重疊 → 擋
  assert.ok(canPlace(layout, APPL, 11, 8));     // 同層錯開 → 可
  assert.ok(canPlace(layout, RUG, 10, 8));      // 跨層（地毯壓家具下）→ 可交疊
  assert.ok(canPlace(layout, CHAIR, 10, 8, 0)); // 忽略自己（搬到原位）→ 可
});

test('canPlace：壁飾可貼牆列、家具不可', () => {
  assert.ok(canPlace([], WALL, 5, 0)); // 壁掛可放最上列
  assert.ok(!canPlace([], CHAIR, 5, 0)); // 家具不可
});

test('canPlace：最左/最右整欄是地板，壁飾與家具都可放，只有左上吧台擋家具', () => {
  assert.ok(canPlace([], WALL, 0, 3), '壁飾貼左牆 col 0'); // poster 1×2
  assert.ok(canPlace([], WALL, 17, 3), '壁飾貼右牆 col 17');
  assert.ok(canPlace([], CHAIR, 0, 7), '家具放最左欄地板（吧台下方 row 7）');
  assert.ok(canPlace([], CHAIR, 17, 7), '家具放最右欄地板');
  assert.ok(canPlace([], CHAIR, 17, 3), '最右欄 row 3 是地板（非左吧台）→ 家具可放');
  assert.ok(!canPlace([], CHAIR, 3, 3), '左上吧台本體擋家具');
  assert.ok(!canPlace([], CHAIR, 0, 3), '吧台左端 (col0,row3) 擋家具');
  assert.ok(!canPlace([], CHAIR, 7, 3), '吧台右緣 (col7) 擋家具');
  assert.ok(canPlace([], CHAIR, 8, 3), '吧台右側 (col8) 是地板可放');
  assert.ok(canPlace([], CHAIR, 9, 3), '吧台右側 (col9) 是地板可放');
});

test('canPlace：檯面小物只落在 host 家具上，椅子/空地板不可（③）', () => {
  const withTable: PlacedItem[] = [{ id: TABLE, gx: 10, gy: 8 }]; // 佔 (10,8)(11,8)
  assert.ok(canPlace(withTable, GUEST, 10, 8)); // 桌上 → 可
  assert.ok(canPlace(withTable, GUEST, 11, 8));
  assert.ok(!canPlace(withTable, GUEST, 12, 8)); // 桌外空地板 → 不可
  const withChair: PlacedItem[] = [{ id: CHAIR, gx: 10, gy: 8 }];
  assert.ok(!canPlace(withChair, GUEST, 10, 8)); // 椅子非 host → 不可（＝不會掉到椅子下）
  assert.ok(!canPlace([], GUEST, 10, 8)); // 空地板 → 不可
  assert.ok(isSurfaceHost(TABLE) && !isSurfaceHost(CHAIR));
});

test('canPlace：檯面小物不互相疊、吧檯檯面可放（④ 檯面上）', () => {
  const onTable: PlacedItem[] = [{ id: TABLE, gx: 10, gy: 8 }, { id: GUEST, gx: 10, gy: 8 }];
  assert.ok(!canPlace(onTable, 'vase', 10, 8)); // 同格已有小物 → 擋
  assert.ok(canPlace(onTable, 'vase', 11, 8)); // 桌上另一格 → 可
  assert.ok(canPlace([], GUEST, 3, 3)); // 吧檯檯面（COUNTER_TOP，row 3）→ 可
  assert.ok(!canPlace([], GUEST, 0, 2)); // row2 舊「翹角」已除名（E4 拆層確認是抽屜排非平面）
});

test('canPlace／變體：counter-inside 小家電加法放置（E7）——吧檯格/桌面都可，嵌入是渲染變體', () => {
  // catalog 沒有的假 item 注入驗管線規則（同 E4 手法）
  const FAKE = 'test_coffee_machine';
  ITEM_BY_ID[FAKE] = {
    id: FAKE, z: 'surface', w: 1, h: 1, name: '測試咖啡機', sprite: '/cafe/x.png',
    price: 0, lv: 1, starter: false, surface: false, spriteHeightTiles: 2, hostType: 'counter-inside',
  } as unknown as CafeItem;
  try {
    // 放置＝一般 surface 規則（加法）：吧檯格全開放（含店長區 col4/5）、桌面也可
    assert.ok(canPlace([], FAKE, 3, 3)); // 吧檯格 → 可
    assert.ok(canPlace([], FAKE, 0, 3)); // 吧檯最左格 → 可
    assert.ok(canPlace([], FAKE, 4, 3)); // 店長視覺區 col4 → 可放（只是不能嵌，見下）
    assert.ok(canPlace([{ id: TABLE, gx: 10, gy: 8 }], FAKE, 10, 8)); // 桌上 → 可（E7 放寬）
    assert.ok(!canPlace([], FAKE, 10, 8)); // 空地板 → 仍不可（沒檯面）
    assert.ok(!canPlace([{ id: FAKE, gx: 3, gy: 3 }], GUEST, 3, 3)); // 同格已有小家電 → 檯面小物擋
    assert.ok(!canPlace([{ id: GUEST, gx: 3, gy: 3 }], FAKE, 3, 3)); // 反向同理

    // 渲染變體：吧檯格預設嵌內側、top=true 切檯面；col4/5／桌面一律檯面路徑
    assert.ok(rendersInside({ id: FAKE, gx: 3, gy: 3 })); // 吧檯格＋無旗標 → 嵌
    assert.ok(!rendersInside({ id: FAKE, gx: 3, gy: 3, top: true })); // 切檯面 → 不嵌
    assert.ok(!rendersInside({ id: FAKE, gx: 4, gy: 3 })); // 店長區 col4 → 強制檯面
    assert.ok(!rendersInside({ id: FAKE, gx: 10, gy: 8 })); // 桌上 → 一般 surface
    assert.ok(!rendersInside({ id: GUEST, gx: 3, gy: 3 })); // 非 counter-inside 件 → 永不嵌

    // 切換鈕條件：吧檯格非 col4/5 才有兩種變體可切
    assert.ok(canToggleInside({ id: FAKE, gx: 3, gy: 3 }));
    assert.ok(!canToggleInside({ id: FAKE, gx: 4, gy: 3 })); // col4 只能檯面 → 不給切
    assert.ok(!canToggleInside({ id: FAKE, gx: 10, gy: 8 })); // 桌上 → 不給切
    assert.ok(!canToggleInside({ id: GUEST, gx: 3, gy: 3 })); // 一般小物 → 不給切
  } finally {
    delete ITEM_BY_ID[FAKE];
  }
});

test('canPlace／rendersOnCounter：counterTop 家具可放檯面格（E11 加法）', () => {
  const G = 'grinder'; // 1×1 z=furniture counterTop:true（manifest 已標）
  assert.ok(itemById(G)?.counterTop, '前置：grinder 應標 counterTop');
  assert.ok(canPlace([], G, 3, 3), '檯面格 → 可（E11）');
  assert.ok(canPlace([], G, 10, 8), '地板照舊可放（加法）');
  assert.ok(!canPlace([], CHAIR, 3, 3), '非 counterTop 家具上檯面 → 仍擋（counterBlocked）');
  assert.ok(!canPlace([{ id: G, gx: 3, gy: 3 }], GUEST, 3, 3), '小物別疊在檯面上的器材');
  assert.ok(!canPlace([{ id: GUEST, gx: 3, gy: 3 }], G, 3, 3), '器材別疊在小物上');
  assert.ok(!canPlace([{ id: G, gx: 3, gy: 3 }], G, 3, 3), '同格兩件器材 → 擋');
  assert.ok(rendersOnCounter({ id: G, gx: 3, gy: 3 }), '檯面上 → 檯面錨變體');
  assert.ok(!rendersOnCounter({ id: G, gx: 10, gy: 8 }), '地板上 → 一般家具錨');
  assert.ok(!rendersOnCounter({ id: CHAIR, gx: 3, gy: 3 }), '非 counterTop 件永不走檯面錨');
});

test('canPlace／isFrontWallPlaced：frontWall 掛件可掛前牆虛擬列 row12（E10 加法）', () => {
  const NOREN = 'noren_curtain';
  assert.ok(itemById(NOREN)?.frontWall, '前置：noren_curtain 應標 frontWall');
  assert.ok(itemById(WALL)?.frontWall, '前置：poster 應標 frontWall');
  assert.ok(canPlace([], NOREN, 8, FRONT_WALL_ROW), '門面槽 → 可');
  assert.ok(canPlace([], WALL, 3, FRONT_WALL_ROW), '門左牆 → 可');
  assert.ok(canPlace([], WALL, 12, FRONT_WALL_ROW), '門右牆 → 可');
  assert.ok(canPlace([], WALL, 5, 0), '後牆照舊可掛（加法）');
  assert.ok(!canPlace([], CHAIR, 5, FRONT_WALL_ROW), '非 frontWall 件不可上前牆');
  assert.ok(!canPlace([], WALL, 0, FRONT_WALL_ROW), '出左界（minCol=1）');
  // 橫帶碰撞：只跟其他前牆件比
  const hung: PlacedItem[] = [{ id: NOREN, gx: 8, gy: FRONT_WALL_ROW }];
  const norenW = footprintDims(itemById(NOREN)!).w;
  assert.ok(!canPlace(hung, WALL, 8, FRONT_WALL_ROW), '同位重疊 → 擋');
  assert.ok(canPlace(hung, WALL, 8 + norenW, FRONT_WALL_ROW), '錯開 → 可');
  assert.ok(isFrontWallPlaced({ id: NOREN, gx: 8, gy: FRONT_WALL_ROW }));
  assert.ok(!isFrontWallPlaced({ id: WALL, gx: 5, gy: 0 }), '後牆的 poster 不算前牆件');
  assert.ok(!isFrontWallPlaced({ id: CHAIR, gx: 5, gy: FRONT_WALL_ROW }), '非 frontWall 件永不算');
});

test('footprintDims：left/right 旋轉時 w↔h 對調（①）', () => {
  const it = itemById(TABLE)!; // 2×1
  assert.deepEqual(footprintDims(it), { w: 2, h: 1 });
  assert.deepEqual(footprintDims(it, 'front'), { w: 2, h: 1 });
  assert.deepEqual(footprintDims(it, 'back'), { w: 2, h: 1 });
  assert.deepEqual(footprintDims(it, 'left'), { w: 1, h: 2 });
  assert.deepEqual(footprintDims(it, 'right'), { w: 1, h: 2 });
});

test('canPlace / frontRowOf：facing 旋轉的碰撞格與深度一起轉（①）', () => {
  // table_low 2×1 front 放 (15,8) → 佔 (15,8)(16,8)，右緣 col16 界內
  assert.ok(canPlace([], TABLE, 15, 8, -1, 'front'));
  // 轉 left → 1×2，佔 (15,8)(15,9)，界內
  assert.ok(canPlace([], TABLE, 15, 8, -1, 'left'));
  // front 放 col17 → 佔 col17,col18 出右界（最右欄＝col17）
  assert.ok(!canPlace([], TABLE, 17, 8, -1, 'front'));
  // front 放 col16 → 佔 col16,col17 剛好界內（最右欄是地板）
  assert.ok(canPlace([], TABLE, 16, 8, -1, 'front'));
  // left 放 col17 → 1 寬 col17 界內
  assert.ok(canPlace([], TABLE, 17, 8, -1, 'left'));
  // 深度換算：left 的佔地深度＝原 w=2
  assert.equal(frontRowOf({ id: TABLE, gx: 15, gy: 8 }), 8 + 1);
  assert.equal(frontRowOf({ id: TABLE, gx: 15, gy: 8, facing: 'left' }), 8 + 2);
});

test('spriteFor：單向件（無 facings）任何向都退回 front（旋轉 no-op）', () => {
  const t = itemById('table_round')!; // 徑向對稱、無 facings
  assert.deepEqual(spriteFor(t), { src: '/cafe/catalog/table_round.png', flip: false });
  assert.deepEqual(spriteFor(t, 'front'), { src: '/cafe/catalog/table_round.png', flip: false });
  assert.deepEqual(spriteFor(t, 'back'), { src: '/cafe/catalog/table_round.png', flip: false });
  assert.deepEqual(spriteFor(t, 'left'), { src: '/cafe/catalog/table_round.png', flip: false });
});

test('spriteFor：前後＋單邊（B 型）→ 缺 left 用 _right 鏡像', () => {
  const c = itemById('chair_velvet')!; // facings: front,back,right
  assert.deepEqual(spriteFor(c, 'front'), { src: '/cafe/catalog/chair_velvet.png', flip: false });
  assert.deepEqual(spriteFor(c, 'back'), { src: '/cafe/catalog/chair_velvet_back.png', flip: false });
  assert.deepEqual(spriteFor(c, 'right'), { src: '/cafe/catalog/chair_velvet_right.png', flip: false });
  assert.deepEqual(spriteFor(c, 'left'), { src: '/cafe/catalog/chair_velvet_right.png', flip: true }, 'left＝right 鏡像');
});

test('spriteFor：真四向（C 型）→ left 用自己的檔、不鏡像', () => {
  const b = itemById('booth_corner')!; // facings: front,back,left,right
  assert.deepEqual(spriteFor(b, 'left'), { src: '/cafe/catalog/booth_corner_left.png', flip: false });
  assert.deepEqual(spriteFor(b, 'right'), { src: '/cafe/catalog/booth_corner_right.png', flip: false });
  assert.deepEqual(spriteFor(b, 'back'), { src: '/cafe/catalog/booth_corner_back.png', flip: false });
});

test('availableFacings / nextFacing：旋轉鍵循環 front→right→back→left，跳過沒有的向', () => {
  const solo = itemById('table_round')!;
  assert.deepEqual(availableFacings(solo), ['front'], '單向件只有 front');
  assert.equal(nextFacing(solo, 'front'), 'front', '單向件旋轉 no-op');

  const biax = itemById('chair_velvet')!; // right 補出 left
  assert.deepEqual(availableFacings(biax), ['front', 'right', 'back', 'left']);
  assert.equal(nextFacing(biax, 'front'), 'right');
  assert.equal(nextFacing(biax, 'right'), 'back');
  assert.equal(nextFacing(biax, 'back'), 'left');
  assert.equal(nextFacing(biax, 'left'), 'front', '循環回 front');

  const dir = itemById('booth_corner')!;
  assert.deepEqual(availableFacings(dir), ['front', 'right', 'back', 'left']);
});

test('rotateHost：桌子連小物一起轉、小物仍在桌上（②③）', () => {
  // table_square 2×1 front 佔 (10,8)(11,8)，兩格各放一個小物
  const layout: PlacedItem[] = [
    { id: 'table_square', gx: 10, gy: 8 }, // 0 host
    { id: 'candle', gx: 10, gy: 8 },       // 1 後格
    { id: 'vase', gx: 11, gy: 8 },         // 2 前格（右格）
  ];
  const nf = nextFacing(itemById('table_square')!, 'front'); // right
  const next = rotateHost(layout, 0, nf)!;
  assert.ok(next, '應可旋轉');
  assert.equal(next[0].facing, 'right', 'host 轉到 right');
  assert.equal(hostIndexOf(next, 1), 0, 'candle 仍在桌上');
  assert.equal(hostIndexOf(next, 2), 0, 'vase 仍在桌上');
  // 具體格：candle (0,0)→(10,8)；vase (1,0)→(10,9)（繞原點順時針 90°）
  assert.deepEqual([next[1].gx, next[1].gy], [10, 8]);
  assert.deepEqual([next[2].gx, next[2].gy], [10, 9]);
});

test('rotateHost：180°（front→back）小物翻到另一端', () => {
  const layout: PlacedItem[] = [
    { id: 'table_square', gx: 10, gy: 8 },
    { id: 'vase', gx: 11, gy: 8 }, // 前格
  ];
  const next = rotateHost(layout, 0, 'back')!;
  assert.equal(next[0].facing, 'back');
  assert.deepEqual([next[1].gx, next[1].gy], [10, 8], '翻到另一端、仍在桌上');
  assert.equal(hostIndexOf(next, 1), 0);
});

test('rotateHost：桌子轉後撞到別件 → 回 null（不動）', () => {
  const layout: PlacedItem[] = [
    { id: 'table_square', gx: 10, gy: 8 }, // front (10,8)(11,8)
    { id: 'chair_velvet', gx: 10, gy: 9 }, // 擋住 right 會用到的 (10,9)
  ];
  assert.equal(rotateHost(layout, 0, 'right'), null);
});

test('rotateHost：非 host 家具單純轉向（無小物邏輯）', () => {
  const layout: PlacedItem[] = [{ id: 'chair_velvet', gx: 10, gy: 8 }];
  const next = rotateHost(layout, 0, 'right')!;
  assert.equal(next[0].facing, 'right');
  assert.equal(next.length, 1);
});

test('itemAtCell：回覆蓋該格最上層家具（拖曳抓取），小物優先於其下的桌', () => {
  const layout: PlacedItem[] = [
    { id: 'table_low', gx: 10, gy: 8 },   // 0 桌 2×1 (10,8)(11,8)、檯面 host
    { id: 'candle', gx: 10, gy: 8 },      // 1 桌上小物
    { id: 'chair_velvet', gx: 4, gy: 8 }, // 2 別處
  ];
  assert.equal(itemAtCell(layout, 11, 8), 0, '桌的另一格＝抓到桌');
  assert.equal(itemAtCell(layout, 10, 8), 1, '同格有小物＝抓到小物（最上層）');
  assert.equal(itemAtCell(layout, 4, 8), 2);
  assert.equal(itemAtCell(layout, 0, 0), -1, '空格回 -1');
});

test('findSpot：能找到合法空位', () => {
  const spot = findSpot([], CHAIR);
  assert.ok(spot);
  assert.ok(canPlace([], CHAIR, spot!.gx, spot!.gy));
});

test('renderOrder：地毯先畫、家具其上、小物緊接 host 之後（②③）', () => {
  const layout: PlacedItem[] = [
    { id: CHAIR, gx: 10, gy: 8 }, // 0 家具
    { id: RUG, gx: 2, gy: 6 },    // 1 地毯（rank 最低，先畫）
    { id: TABLE, gx: 4, gy: 9 },  // 2 host 家具
    { id: GUEST, gx: 4, gy: 9 },  // 3 桌上小物（寄生 host=2）
    { id: WALL, gx: 5, gy: 0 },   // 4 壁飾（rank 最高，後畫）
  ];
  const order = renderOrder(layout);
  assert.equal(order[0], 1, '地毯應最先畫');
  assert.equal(order.indexOf(3), order.indexOf(2) + 1, '小物應緊接它的 host');
  assert.equal(order[order.length - 1], 4, '壁飾應最後畫');
  assert.equal(order.length, layout.length, '不掉件');
});

test('renderOrder：未知 id 保留 index 不掉件（損毀存檔容錯）', () => {
  const order = renderOrder([{ id: '__nope__', gx: 3, gy: 3 }, { id: CHAIR, gx: 10, gy: 8 }]);
  assert.equal(order.length, 2);
  assert.deepEqual([...order].sort(), [0, 1]);
});

test('hostIndexOf：小物綁到覆蓋它的 host，孤兒回 -1', () => {
  const layout: PlacedItem[] = [{ id: TABLE, gx: 10, gy: 8 }, { id: GUEST, gx: 10, gy: 8 }];
  assert.equal(hostIndexOf(layout, 1), 0);
  assert.equal(hostIndexOf([{ id: GUEST, gx: 10, gy: 8 }], 0), -1, '無 host＝孤兒');
});

test('guestIndicesOf：搬走 host 連帶收回其上小物（別變孤兒）', () => {
  const layout: PlacedItem[] = [
    { id: TABLE, gx: 10, gy: 8 },  // 0 host（佔 10,8 / 11,8）
    { id: GUEST, gx: 10, gy: 8 },  // 1 桌上
    { id: 'vase', gx: 11, gy: 8 }, // 2 桌上
    { id: CHAIR, gx: 4, gy: 8 },   // 3 無關家具
  ];
  assert.deepEqual(guestIndicesOf(layout, 0).sort((a, b) => a - b), [1, 2]);
  assert.deepEqual(guestIndicesOf(layout, 3), [], '椅子非 host、無寄生');
});

test('開局佈置：預設擺好 STARTER_LAYOUT、開局家具各贈 1 件庫存', () => {
  const shop = normalizeShop(null);
  assert.equal(shop.layout.length, STARTER_LAYOUT.length);
  for (const id of STARTER_IDS) assert.ok((shop.stock[id] ?? 0) >= 1, `${id} 應有庫存`);
  assert.equal(DEFAULT_SHOP.layout.length, STARTER_LAYOUT.length);
});

test('normalizeShop：已存在的 layout（含空陣列）被尊重、開局家具仍保底 1 件', () => {
  const cleared = normalizeShop({ layout: [], stock: {} });
  assert.equal(cleared.layout.length, 0, '空 layout 應被保留');
  for (const id of STARTER_IDS) assert.ok((cleared.stock[id] ?? 0) >= 1);
});

test('normalizeShop：舊格式 owned[] 遷移成計數（重複＝多件）', () => {
  const migrated = normalizeShop({ owned: [CHAIR, CHAIR, RUG], layout: [] });
  assert.equal(migrated.stock[CHAIR], 2, '買兩次＝庫存 2');
  assert.equal(migrated.stock[RUG], 1);
});

test('stockAvailable：可同款多件、擺出消耗托盤', () => {
  const shop = normalizeShop({ stock: { [CHAIR]: 3 }, layout: [{ id: CHAIR, gx: 10, gy: 8 }] });
  assert.equal(stockAvailable(shop, CHAIR), 2, '買3擺1剩2');
  assert.equal(placedCount(shop.layout, CHAIR), 1);
  const none = normalizeShop({ stock: { [RUG]: 1 }, layout: [{ id: RUG, gx: 3, gy: 6 }] });
  assert.equal(stockAvailable(none, RUG), 0, '買1擺1托盤空');
});

test('mergeStock：同一份單調計數取大值，不被舊請求倒退', () => {
  assert.deepEqual(mergeStock({ a: 2, b: 1 }, { a: 1, c: 3 }), { a: 2, b: 1, c: 3 });
});

test('分玩家庫存 ledger：兩人從同一舊庫存各買 1 件，總數會加 2', () => {
  const original = normalizeShop({ stock: { [CHAIR]: 1 }, layout: [] });
  const jjPurchase = addStockForUser(original, 'jj', CHAIR);
  const yaxuanPurchase = addStockForUser(original, 'yaxuan', CHAIR);

  const afterJj = { ...original, ...mergeStockState(original, jjPurchase) };
  const afterBoth = mergeStockState(afterJj, yaxuanPurchase);
  assert.equal(afterBoth.stock[CHAIR], 3);
  assert.equal(afterBoth.stockByUser.jj?.[CHAIR], 1);
  assert.equal(afterBoth.stockByUser.yaxuan?.[CHAIR], 1);
});

// ── 伝言板 mergeBoard（append-only union；兩人並發留言不覆蓋） ──
const bm = (author: BoardMsg['author'], at: string, text: string): BoardMsg => ({ author, text, at });

test('mergeBoard：聯集合併並依 at 由舊到新排序', () => {
  const a = [bm('jj', '2026-07-08T10:00:00Z', 'A')];
  const b = [bm('yaxuan', '2026-07-08T09:00:00Z', 'B')];
  assert.deepEqual(mergeBoard(a, b).map((m) => m.text), ['B', 'A']);
});

test('mergeBoard：author+at+text 完全相同才去重（並發同秒不同內容都保留）', () => {
  const dup = bm('jj', '2026-07-08T10:00:00Z', 'same');
  assert.equal(mergeBoard([dup], [{ ...dup }]).length, 1); // 同一則推兩次只留一份
  const at = '2026-07-08T10:00:00Z';
  const concurrent = mergeBoard([bm('jj', at, 'x')], [bm('yaxuan', at, 'y')]);
  assert.equal(concurrent.length, 2); // 同秒但不同人/內容＝兩則，不可覆蓋
});

test('mergeBoard：超過上限只留最近 BOARD_MAX 則（丟舊）', () => {
  const many = Array.from({ length: BOARD_MAX + 10 }, (_, i) =>
    bm('jj', `2026-07-08T${String(i).padStart(2, '0')}:00:00Z`, `m${i}`),
  );
  const merged = mergeBoard(many, []);
  assert.equal(merged.length, BOARD_MAX);
  assert.equal(merged[merged.length - 1].text, `m${BOARD_MAX + 9}`); // 保最新
  assert.equal(merged[0].text, 'm10'); // 最舊 10 則被丟
});

test('mergeBoard：略過壞資料（缺 at/text 非字串），undefined 當空陣列', () => {
  const good = bm('jj', '2026-07-08T10:00:00Z', 'ok');
  const dirty = [good, { author: 'jj', text: 'no-at' } as unknown as BoardMsg, null as unknown as BoardMsg];
  assert.deepEqual(mergeBoard(dirty, undefined).map((m) => m.text), ['ok']);
  assert.deepEqual(mergeBoard(undefined, undefined), []);
});

test('normalizeShop：帶進 board 陣列，缺欄位補空陣列', () => {
  assert.deepEqual(normalizeShop(null).board, []);
  const withBoard = normalizeShop({ layout: [], board: [bm('jj', '2026-07-08T10:00:00Z', 'hi')] });
  assert.equal(withBoard.board.length, 1);
});
