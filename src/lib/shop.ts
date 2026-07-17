// 喫茶店共同經營：店等級 = 兩人合計 XP 推進；一般貨架每日換 10 件，金幣買家具、裝潢擺進店。
// 素材＝JJ 在 Tiled 手畫的咖啡廳，scripts/build-cafe-assets.py 切成 public/cafe/。
// 場景邏輯座標 576×416（18×13 格 32px），資料在 data/cafe.gen.ts。
import {
  CAFE,
  CAFE_ITEMS as RAW_ITEMS,
  PLACE,
  Z_RANK,
  Z_TOP_ROW,
  type CafeItem,
} from '../data/cafe.gen.ts';
import { NAME_OVERRIDES, PRICE_OVERRIDES } from '../data/cafe-overrides.ts';
import { SHOP_LINES_GEN, type ShopLine } from '../data/shop-lines.gen.ts';
import type { Facing, PlacedItem, ShopState } from './shopstate.ts';
import { hashSeed, mulberry32 } from './seeded.ts';
export type { ShopLine } from '../data/shop-lines.gen.ts';

export { BLOCKED, CAFE, CATEGORY_LABELS, PLACE, Z_RANK, Z_TOP_ROW } from '../data/cafe.gen.ts';
export type { CafeItem, Z層 } from '../data/cafe.gen.ts';

// 疊上手維護的命名／售價覆寫（cafe-overrides.ts，重跑切圖腳本也不會被洗掉）
export const CAFE_ITEMS: CafeItem[] = RAW_ITEMS.map((it) => ({
  ...it,
  name: NAME_OVERRIDES[it.id] ?? it.name,
  price: PRICE_OVERRIDES[it.id] ?? it.price,
}));

export function shopLevel(combinedXp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, combinedXp) / 80)) + 1;
}

/** 該等級的起始 XP（顯示升級進度條用） */
export function shopLevelXp(lv: number): number {
  return 80 * (lv - 1) ** 2;
}

export const SHOP_TITLES = ['剛開幕', '巷口小店', '小有名氣', '街坊愛店', '排隊名店', '傳說喫茶'];

export function shopTitle(lv: number): string {
  return SHOP_TITLES[Math.min(Math.floor((lv - 1) / 3), SHOP_TITLES.length - 1)];
}

// ── 家具目錄查詢 ──
export const ITEM_BY_ID: Record<string, CafeItem> = Object.fromEntries(CAFE_ITEMS.map((i) => [i.id, i]));
// 一般貨架排除開局贈品與「珍藏・私物」；後者保留在不重複的專屬轉蛋池。
export const SHOP_ITEMS: CafeItem[] = CAFE_ITEMS.filter((i) => !i.starter && i.category !== 'personal');
export const DAILY_SHOP_SIZE = 10;

/**
 * 每日一般貨架：日期相同就拿到同一批 10 件（兩位玩家、重整頁面皆一致），隔日換 seed。
 * 先按 id 排序，避免資料檔換行／重排意外改變當天貨單；不消耗庫存，可重複購買。
 */
export function dailyShopItems(today: string): CafeItem[] {
  const rng = mulberry32(hashSeed(`daily-shop:v1:${today}`));
  const items = [...SHOP_ITEMS].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items.slice(0, DAILY_SHOP_SIZE);
}

export function itemById(id: string): CafeItem | undefined {
  return ITEM_BY_ID[id];
}

// ── 店長在店裡的碎念（依營業狀態換話題；點熊貓會再講一句）──
// 資料來源：docs/shop-lines.json → scripts/build-shop-lines.py → data/shop-lines.gen.ts（702 句，每句自帶 pose）。
export function pickShopLine(attend: number, meDone: boolean, rng: () => number = Math.random): ShopLine {
  const pool = !meDone ? SHOP_LINES_GEN.closed : attend >= 2 ? SHOP_LINES_GEN.full : SHOP_LINES_GEN.solo;
  return pool[Math.floor(rng() * pool.length)];
}

// ── 格子系統（家具擺放，18×13 @32px；座標與尺寸來自 cafe.gen.ts）──

// 家具/地毯真正不能放的固定裝置＝左上吧台本體＝rows 2–4、cols 0–7（引擎直接定義，不吃 BLOCKED）。
// 吧台右側(cols 8,9 那 6 格)其實是地板、可放家具；最左/最右整欄也是地板（非牆）。
const counterBlocked = (gx: number, gy: number) => gy >= 2 && gy <= 4 && gx >= 0 && gx <= 7;

export const zRankOf = (id: string): number => Z_RANK[ITEM_BY_ID[id]?.z ?? 'furniture'];

// ── facing-aware footprint（§2）──
// footprint w×h＝佔地深度；朝左/右時 w↔h 對調，碰撞格一起轉。
export function footprintDims(it: { w: number; h: number }, facing?: Facing): { w: number; h: number } {
  return facing === 'left' || facing === 'right' ? { w: it.h, h: it.w } : { w: it.w, h: it.h };
}

// ── 四向 sprite 解析（§D 檔名慣例）──
// front=<id>.png（＝item.sprite）；back/left/right=<id>_<facing>.png。左右對稱件只畫 _right，
// 缺 left 時引擎用 _right 水平鏡像；沒畫的向退回 front（旋轉 no-op）。
export interface FacingSprite {
  src: string;
  flip: boolean; // 是否水平鏡像（另一側用單邊圖鏡像出來）
}

/** 由 front 圖路徑推同 id 的其他向路徑：<id>.png → <id>_<facing>.png（front 回原路徑） */
const siblingSprite = (frontSrc: string, facing: Facing): string =>
  facing === 'front' ? frontSrc : frontSrc.replace(/\.png$/i, `_${facing}.png`);

/** 依 facing 解析要畫哪張 sprite ＋是否水平鏡像（見 engine-to-art-requests §D）。 */
export function spriteFor(item: CafeItem, facing: Facing = 'front'): FacingSprite {
  const authored = new Set<Facing>(item.facings ?? ['front']);
  authored.add('front'); // front 一定有（＝item.sprite）
  if (authored.has(facing)) return { src: siblingSprite(item.sprite, facing), flip: false };
  if (facing === 'left' && authored.has('right')) return { src: siblingSprite(item.sprite, 'right'), flip: true };
  if (facing === 'right' && authored.has('left')) return { src: siblingSprite(item.sprite, 'left'), flip: true };
  return { src: item.sprite, flip: false }; // 沒畫的向 → 退回 front
}

/** 該件實際可用的向（含單邊鏡像補出的另一側），循環順序 front→right→back→left。旋轉鍵用。 */
export function availableFacings(item: CafeItem): Facing[] {
  const set = new Set<Facing>(item.facings ?? ['front']);
  set.add('front');
  if (set.has('right')) set.add('left'); // 有右＝左可鏡像
  if (set.has('left')) set.add('right'); // 有左＝右可鏡像
  return (['front', 'right', 'back', 'left'] as Facing[]).filter((f) => set.has(f));
}

/** 旋轉鍵：跳到下一個可用向（循環）；單向件回自己（no-op） */
export function nextFacing(item: CafeItem, cur: Facing = 'front'): Facing {
  const av = availableFacings(item);
  const i = av.indexOf(cur);
  return av[(i + 1) % av.length] ?? 'front';
}

/** footprint 前緣列（gy + 佔地深度）＝越大越前面，用來深度排序＋底部錨定（吃 facing） */
export const frontRowOf = (p: PlacedItem): number => {
  const it = ITEM_BY_ID[p.id];
  return p.gy + (it ? footprintDims(it, p.facing).h : 1);
};

// ── 檯面寄生（§4）：小物只落在「有檯面」的家具上，椅子不可放 ──
// §A：改吃 manifest 的 surface:true 旗標（桌／櫃頂／開放層架 true；椅凳沙發卡座 false），
// 取代舊的引擎端硬編白名單——新家具進 catalog 就自動生效，不用回來改這裡。
export const isSurfaceHost = (id: string): boolean => ITEM_BY_ID[id]?.surface === true;
export const isSurfaceGuest = (id: string): boolean => ITEM_BY_ID[id]?.z === 'surface';

// E4：內側小家電（嵌吧檯裡、下半身被 counter_front 遮）＝surface 件掛 hostType:'counter-inside'。
// E7 放寬成「加法」：放置走一般 surface 規則（吧檯格＋任何 surface host 桌面都可），
// 「嵌內側」降級成吧檯格上的渲染變體（預設嵌入、PlacedItem.top=true 切檯面全露）。
export const isCounterInside = (it: CafeItem | undefined): boolean => it?.hostType === 'counter-inside';
// 嵌內側變體避開店長視覺區（店長固定 cx=150≈col4.7，佔 col4/5）；放檯面（top）不受限
const COUNTER_INSIDE_EXCLUDED_COLS = new Set([4, 5]);

/** 該已擺件是否以「嵌吧檯內側」變體渲染（畫在店長後、counter_front 前，下半被面板遮）。
 *  條件＝counter-inside 件＋落在吧檯格＋非店長區 col4/5＋沒切成檯面（top）。其餘一律走一般 surface 路徑。 */
export function rendersInside(p: PlacedItem): boolean {
  return isCounterInside(ITEM_BY_ID[p.id]) && !p.top && isCounterTop(p.gx, p.gy) && !COUNTER_INSIDE_EXCLUDED_COLS.has(p.gx);
}

/** 該已擺件可否切換嵌入⇄檯面（兩種變體都合法＝吧檯格上、非 col4/5 的 counter-inside 件） */
export function canToggleInside(p: PlacedItem): boolean {
  return isCounterInside(ITEM_BY_ID[p.id]) && isCounterTop(p.gx, p.gy) && !COUNTER_INSIDE_EXCLUDED_COLS.has(p.gx);
}

/** E11：z=furniture 的 counterTop 件目前是否擺在吧檯檯面上（渲染改錨 COUNTER_SURFACE_Y、全露） */
export function rendersOnCounter(p: PlacedItem): boolean {
  return !!ITEM_BY_ID[p.id]?.counterTop && isCounterTop(p.gx, p.gy);
}

// E10：前牆裝潢（門＋門旁牆掛件，frontWall:true 的 7 件）。座標編碼＝虛擬列 row 12
// （格系最後一列，一般放置最深到 maxRow=11 不衝突）；渲染畫在 base-fg 之上、恆亮。
export const FRONT_WALL_ROW = 12;
export const FRONT_DOOR_COLS = { min: 8, max: 10 } as const; // 門面槽（門欄 x257–331 ≈ cols 8–10）
/** 該已擺件是否掛在前牆（渲染走門頂/牆頂錨、畫在 base-fg 之上） */
export const isFrontWallPlaced = (p: PlacedItem): boolean =>
  !!ITEM_BY_ID[p.id]?.frontWall && p.gy === FRONT_WALL_ROW;

// 吧檯檯面格（虛擬 host）：純 row3 cols0–7＝吧檯唯一攤平可見的檯面（E4 拆層確認 row2 是矮櫃抽屜排
// ＋內角柱、非平面，舊的兩格「翹角」特例已刪）。內側小家電（counter-inside）也用同一排格。
export const COUNTER_TOP: ReadonlyArray<readonly [number, number]> = [
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
];
const COUNTER_TOP_SET = new Set(COUNTER_TOP.map(([x, y]) => `${x},${y}`));
export const isCounterTop = (gx: number, gy: number): boolean => COUNTER_TOP_SET.has(`${gx},${gy}`);

/** 檯面小物的 host（覆蓋該格、可放小物的家具）在 layout 的 index；吧檯檯面回 -1 但視為合法落點。
 *  找不到（孤兒／舊存檔落在地板）回 -1。多 host 命中取最前緣者。 */
export function hostIndexOf(layout: PlacedItem[], guestIndex: number): number {
  const g = layout[guestIndex];
  if (!g || !isSurfaceGuest(g.id)) return -1;
  const key = `${g.gx},${g.gy}`; // 小物皆 1×1，用左上格判定
  let best = -1, bestFront = -Infinity;
  layout.forEach((p, i) => {
    if (i === guestIndex || !isSurfaceHost(p.id)) return;
    if (footprint(p.id, p.gx, p.gy, p.facing).some(([x, y]) => `${x},${y}` === key)) {
      const f = frontRowOf(p);
      if (f > bestFront) { bestFront = f; best = i; }
    }
  });
  return best;
}

/** 某 host（layout index）上寄生的所有小物 index（host 被搬走時一起收回，別變孤兒） */
export function guestIndicesOf(layout: PlacedItem[], hostIndex: number): number[] {
  if (!isSurfaceHost(layout[hostIndex]?.id ?? '')) return [];
  const out: number[] = [];
  layout.forEach((p, i) => {
    if (isSurfaceGuest(p.id) && hostIndexOf(layout, i) === hostIndex) out.push(i);
  });
  return out;
}

// facing 相對 front 的順時針 90° 圈數（front→right→back→left＝0→1→2→3）
const FACING_TURNS: Record<Facing, number> = { front: 0, right: 1, back: 2, left: 3 };

/** 把某已擺家具旋轉到 newFacing；若是 host，其上小物一起繞 footprint 原點轉到新桌面格。
 *  回傳新 layout；家具本身轉後撞到別件/出界則回 null（不動）。非 host 家具就是單純轉向。 */
export function rotateHost(layout: PlacedItem[], index: number, newFacing: Facing): PlacedItem[] | null {
  const host = layout[index];
  const it = ITEM_BY_ID[host?.id ?? ''];
  if (!host || !it) return null;
  const cur = host.facing ?? 'front';
  if (newFacing === cur) return null;
  if (!canPlace(layout, host.id, host.gx, host.gy, index, newFacing)) return null; // 家具本身放不下（撞件/出界）
  const { w, h } = footprintDims(it, cur); // 旋轉前的佔地
  const turns = (FACING_TURNS[newFacing] - FACING_TURNS[cur] + 4) % 4; // 順時針 90° 幾次
  const guests = new Set(guestIndicesOf(layout, index));
  return layout.map((p, i) => {
    if (i === index) return newFacing === 'front' ? { id: p.id, gx: p.gx, gy: p.gy } : { ...p, facing: newFacing };
    if (!guests.has(i)) return p;
    // 小物相對 host 原點座標，繞原點順時針轉 turns 次（格網 W×H 每轉一次 (x,y)→(H-1-y, x)）
    let x = p.gx - host.gx, y = p.gy - host.gy, W = w, H = h;
    for (let t = 0; t < turns; t++) { const nx = H - 1 - y; y = x; x = nx; [W, H] = [H, W]; }
    return { ...p, gx: host.gx + x, gy: host.gy + y };
  });
}

/** 已擺家具的渲染順序（回原本 layout 的 index，由後往前）。
 *  L0 地毯→L1 地板家具（前緣 y-sort）→ 每件 host 之後緊接它的檯面小物（L2 寄生，跟著 host 排序位置，
 *  兩桌重疊也不錯層）→ L3 壁飾 → 孤兒小物墊頂（維持舊存檔不消失）。 */
export function renderOrder(layout: PlacedItem[]): number[] {
  const guestsByHost = new Map<number, number[]>();
  const orphanGuests: number[] = [];
  const solids: number[] = [];
  layout.forEach((p, i) => {
    // 未知 id（損毀存檔）當地板家具處理，保留 index 不掉（渲染端再 null 掉）
    if (isSurfaceGuest(p.id)) {
      const h = hostIndexOf(layout, i);
      if (h >= 0) (guestsByHost.get(h) ?? guestsByHost.set(h, []).get(h)!).push(i);
      else orphanGuests.push(i);
    } else solids.push(i);
  });
  const byFront = (a: number, b: number) => frontRowOf(layout[a]) - frontRowOf(layout[b]) || a - b;
  solids.sort((a, b) => {
    const za = zRankOf(layout[a].id), zb = zRankOf(layout[b].id);
    return za !== zb ? za - zb : byFront(a, b); // 前緣下方的後畫（近＝上）＝walk-behind
  });
  const out: number[] = [];
  for (const i of solids) {
    out.push(i);
    const gs = guestsByHost.get(i);
    if (gs) { gs.sort(byFront); out.push(...gs); }
  }
  orphanGuests.sort(byFront);
  out.push(...orphanGuests);
  return out;
}

/** footprint 內的每一格（吃 facing） */
function footprint(id: string, gx: number, gy: number, facing?: Facing): [number, number][] {
  const it = ITEM_BY_ID[id];
  if (!it) return [];
  const { w, h } = footprintDims(it, facing);
  const cells: [number, number][] = [];
  for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) cells.push([gx + dx, gy + dy]);
  return cells;
}

/** 某家具放在 (gx,gy) 是否合法。
 *  檯面小物（surface）＝每格都要落在檯面（surface-host 家具佔格或吧檯檯面）、且不與其他小物同格。
 *  地板類（rug/furniture）＝界內、避開固定裝置、不與「同 z 層」互相重疊（不同層可交疊）。
 *  壁飾（wall）＝可貼牆，只跟其他壁飾互斥。 */
export function canPlace(layout: PlacedItem[], id: string, gx: number, gy: number, ignoreIndex = -1, facing?: Facing): boolean {
  const it = ITEM_BY_ID[id];
  if (!it) return false;
  const { w, h } = footprintDims(it, facing);
  const cells = footprint(id, gx, gy, facing);

  if (it.z === 'surface') {
    // 檯面小物不吃地板 minCol/maxCol（吧檯左端翹角在 col 0）；合法性只認「落在檯面（host/吧檯）」
    // 收集其他小物佔格（別疊）＋檯面家具佔格（要落上去）
    const guestCells = new Set<string>();
    const hostCells = new Set<string>();
    layout.forEach((p, i) => {
      if (i === ignoreIndex) return;
      if (isSurfaceGuest(p.id)) footprint(p.id, p.gx, p.gy, p.facing).forEach(([x, y]) => guestCells.add(`${x},${y}`));
      // E11：已放上吧檯的 counterTop 家具佔住檯面格＝小物別疊上去
      if (ITEM_BY_ID[p.id]?.counterTop && isCounterTop(p.gx, p.gy))
        footprint(p.id, p.gx, p.gy, p.facing).forEach(([x, y]) => guestCells.add(`${x},${y}`));
      if (isSurfaceHost(p.id)) footprint(p.id, p.gx, p.gy, p.facing).forEach(([x, y]) => hostCells.add(`${x},${y}`));
    });
    for (const [cx, cy] of cells) {
      if (cy > PLACE.maxRow) return false;
      if (guestCells.has(`${cx},${cy}`)) return false;            // 別疊小物
      if (!hostCells.has(`${cx},${cy}`) && !isCounterTop(cx, cy)) return false; // 必須有檯面
      // counter-inside 件同樣走這條一般規則（E7 加法）：吧檯格/桌面都可放，嵌入與否是渲染變體（rendersInside）
    }
    return true;
  }

  // E10 加法：frontWall 掛件落虛擬前牆列（row 12）＝一維橫帶，只跟其他前牆件比碰撞；
  // 後牆（一般 wall 路徑）照舊可掛
  if (it.frontWall && gy === FRONT_WALL_ROW) {
    if (gx < PLACE.minCol || gx + w - 1 > PLACE.maxCol) return false;
    const taken = new Set<number>();
    layout.forEach((p, i) => {
      if (i === ignoreIndex || !isFrontWallPlaced(p)) return;
      const pw = footprintDims(ITEM_BY_ID[p.id]!).w;
      for (let x = p.gx; x < p.gx + pw; x++) taken.add(x);
    });
    for (let x = gx; x < gx + w; x++) if (taken.has(x)) return false;
    return true;
  }

  // 水平界限：整排 col 0..最右都可放（最左/最右是地板；壁飾貼側牆）——固定裝置改由 counterBlocked 管
  if (gx < 0 || gx + w - 1 > CAFE.cols - 1) return false;
  const top = Z_TOP_ROW[it.z];
  if (gy < top || gy + h - 1 > PLACE.maxRow) return false;

  // E11 加法：counterTop 件（咖啡器材/小型展示，z=furniture）可整件落吧檯檯面格——
  // 佔格衝突比照 surface 小物（別疊小物、別疊其他檯面住客），counterBlocked 對這條路不適用；地板照舊走下面一般規則
  if (it.counterTop && cells.every(([cx, cy]) => isCounterTop(cx, cy))) {
    const taken = new Set<string>();
    layout.forEach((p, i) => {
      if (i === ignoreIndex) return;
      // 檯面住客＝surface 小物（含嵌入式小家電）＋其他已放檯面的 counterTop 家具
      if (isSurfaceGuest(p.id) || (ITEM_BY_ID[p.id]?.counterTop && isCounterTop(p.gx, p.gy)))
        footprint(p.id, p.gx, p.gy, p.facing).forEach(([x, y]) => taken.add(`${x},${y}`));
    });
    return cells.every(([cx, cy]) => !taken.has(`${cx},${cy}`));
  }

  const occupied = new Set<string>();
  layout.forEach((p, i) => {
    if (i === ignoreIndex) return;
    if (zRankOf(p.id) !== Z_RANK[it.z]) return;
    footprint(p.id, p.gx, p.gy, p.facing).forEach(([x, y]) => occupied.add(`${x},${y}`));
  });
  for (const [cx, cy] of cells) {
    if (it.z !== 'wall' && counterBlocked(cx, cy)) return false; // 地板類只避開左上吧台（側牆欄是地板可放）；壁飾隨處貼
    if (occupied.has(`${cx},${cy}`)) return false;
  }
  return true;
}

/** 找一個能放下的空位（買了自動擺用；預設 front 朝向） */
export function findSpot(layout: PlacedItem[], id: string): { gx: number; gy: number } | null {
  const z = ITEM_BY_ID[id]?.z ?? 'furniture';
  for (let gy = Z_TOP_ROW[z]; gy <= PLACE.maxRow; gy++)
    for (let gx = 0; gx <= CAFE.cols - 1; gx++)
      if (canPlace(layout, id, gx, gy)) return { gx, gy };
  return null;
}

/** 覆蓋 (gx,gy) 的最上層已擺家具 index（拖曳時「抓」到哪一件）；沒有回 -1。
 *  取 renderOrder 最後畫的（最上層），小物優先於其下的桌子。 */
export function itemAtCell(layout: PlacedItem[], gx: number, gy: number): number {
  const order = renderOrder(layout);
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    const p = layout[i];
    if (footprint(p.id, p.gx, p.gy, p.facing).some(([x, y]) => x === gx && y === gy)) return i;
  }
  return -1;
}

// ── 店長姿勢（西村線稿→Codex 生的多姿勢，隨當下台詞換）──
// 素材：public/cafe/shopkeeper/<slug>.png（scripts 生成，見 jp-panda-pixel-art-recipe）
export const SHOPKEEPER_POSES = [
  'serve', 'idle', 'onion', 'no', 'eat', 'welcome', 'cheer', 'dismay',
  'cat', 'happy', 'think', 'love', 'play', 'cozy', 'statue', 'shock',
] as const;
export type Pose = (typeof SHOPKEEPER_POSES)[number];

// 情境池（沒關鍵字命中時，依開店狀態挑）
const CLOSED_POSES: Pose[] = ['cozy', 'dismay', 'no', 'idle', 'statue'];
const SOLO_POSES: Pose[] = ['serve', 'think', 'onion', 'idle', 'play'];
const FULL_POSES: Pose[] = ['cheer', 'welcome', 'happy', 'love', 'cat'];

// 台詞關鍵字 → 姿勢（讓店長「照他講的話」擺姿勢）
const POSE_KEYWORDS: [string[], Pose][] = [
  [['布丁', '吃', '完食', '續', '零食', '饞', '甜'], 'eat'],
  [['歡迎', 'いらっしゃい', '熟客', '光臨', '隨便坐'], 'welcome'],
  [['客滿', '雙人', '興隆', '大入', '滿席', '滿員', '齊聚', '勢揃', '熱鬧'], 'cheer'],
  [['勝', '優勝', '贏', '冠', '最強', '討伐'], 'cheer'],
  [['貓'], 'cat'],
  [['愛心', '戀', '喜歡', '想我', '想你', '待って', '君を', '請客'], 'love'],
  [['蔥', '進貨', '咖啡豆', '菜單', '茶葉', '收銀', '帳本', '收工'], 'onion'],
  [['？', '嗎', '疑', '歪頭', '考你', '唸', '密碼', '幾度', '幾塊'], 'think'],
  [['睡', '盹', '打烊', '準備中', '冷了', '黑暗', '深夜', '棉被', '打個盹'], 'cozy'],
  [['痠', '累', '站著', '等', '房租', '催', '腳好'], 'dismay'],
  [['別怕', '不攔', '不要', '禁止', '放棄', '攔不住', '拒'], 'no'],
  [['驚', '嚇', 'えっ', 'うわ', '！？', '欸'], 'shock'],
  [['ぽ〜う', 'ぽう', '木魚', '敲', '氣定神閒', '發呆'], 'idle'],
];

/** 依當下台詞＋開店狀態，決定店長要擺哪個姿勢。
 *  優先吃該句（ShopLine）自帶的 pose 欄位；裸字串（找不到對應 ShopLine，例如黑板留言等非店長台詞）才降級：
 *  先比對關鍵字表，猜不到再從情境池依台詞穩定挑（同句同姿勢、換句換姿勢＝隨台詞輪播）。 */
export function poseForLine(line: string | ShopLine, meDone: boolean, attend: number): Pose {
  if (typeof line !== 'string') return line.pose;
  for (const [ks, pose] of POSE_KEYWORDS) if (ks.some((k) => line.includes(k))) return pose;
  const pool = !meDone ? CLOSED_POSES : attend >= 2 ? FULL_POSES : SOLO_POSES;
  let h = 0;
  for (let i = 0; i < line.length; i++) h = (h * 31 + line.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

// E12：珍藏・私物（category:'personal'）不走購買、走轉蛋機——一轉的金幣價
export const PERSONAL_GACHA_COST = 80;

// ── 庫存查詢（買了進托盤、擺出消耗庫存）──
/** 某家具目前擺在店裡的份數 */
export function placedCount(layout: PlacedItem[], id: string): number {
  return layout.reduce((n, p) => (p.id === id ? n + 1 : n), 0);
}
/** 某家具還在托盤、可再擺的份數 = 已購 - 已擺 */
export function stockAvailable(shop: ShopState, id: string): number {
  return (shop.stock[id] ?? 0) - placedCount(shop.layout, id);
}
/** 收藏種類數（擁有過的不同家具，給「收藏 N/總數」用） */
export function ownedKinds(shop: ShopState): number {
  return Object.values(shop.stock).filter((n) => n > 0).length;
}
