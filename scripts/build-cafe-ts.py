#!/usr/bin/env python3
"""從 docs/cafe-catalog.json（手維護規格）＋碰撞格定義，產出 src/data/cafe.gen.ts。
取代舊 build-cafe-assets.py 的 TS 產出角色（那個是 Tiled 版，已退役）。
sprite 路徑統一 /cafe/catalog/<id>.png（Phase 4 從 assets_src/cafe/out/ 複製過去）。
用法：python3 scripts/build-cafe-ts.py
"""
import os, json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, 'docs', 'cafe-catalog.json')
GEN_TS = os.path.join(ROOT, 'src', 'data', 'cafe.gen.ts')

COLS, ROWS, CELL = 18, 13, 32

# ── 分類 taxonomy（E6：目錄 UI 分頁籤用，key→中文顯示名，順序＝頁籤順序）──
CATEGORY_LABELS = [
    ('seating', '座席・桌椅'),
    ('counter', '吧檯・沖煮・展示'),
    ('wall', '燈・牆飾'),
    ('rug', '地毯・地面'),
    ('tabletop', '桌上擺件・小物'),
    ('seasonal', '擺飾雜貨・季節'),
]

# ── 碰撞格（對齊 bar-baked 場景 base.png：左上吧檯＋後吧台層架＋三張高腳椅烤進圖）──
WALL_ROWS = [0, 1]         # 上緣木牆＋牆裙
BOTTOM_ROWS = [12]         # 底牆＋店門
BORDER_COLS = [0, 17]      # 左右邊欄
COUNTER = (0, 8, 2, 5)     # 吧檯區：cols 0..8 × rows 2..5（後吧台/吧檯/高腳椅，店員站裡面，不可擺）

# ── 開局免費擺好（starter，位置避開 BLOCKED，canPlace 合法）──
STARTER_LAYOUT = [
    ('booth_corner', 13, 3),
    ('table_round', 5, 6),
    ('chair_velvet', 8, 6),
    ('rug_mat', 5, 8),
    ('candle', 5, 6),          # 坐在 table_round(5,6) 桌面上（surface 需有 host）
    ('poster', 10, 0),
]


def build_blocked():
    b = set()
    for r in WALL_ROWS + BOTTOM_ROWS:
        for c in range(COLS):
            b.add((c, r))
    for c in BORDER_COLS:
        for r in range(ROWS):
            b.add((c, r))
    c0, c1, r0, r1 = COUNTER
    for c in range(c0, c1 + 1):
        for r in range(r0, r1 + 1):
            b.add((c, r))
    return sorted(b, key=lambda t: (t[1], t[0]))


def main():
    data = json.load(open(MANIFEST))
    items = data['items']
    blocked = build_blocked()

    L = []
    L.append('// 由 scripts/build-cafe-ts.py 從 docs/cafe-catalog.json 產出。改規格請改 manifest 再重跑，或直接手改本檔。')
    L.append('// 昭和喫茶版：footprint w×h＝佔地格（碰撞只認這個，h＝地面深度）；家具 sprite 自然比例往上長（overhang）。')
    L.append("import type { Facing, PlacedItem } from '../lib/shopstate.ts';")
    L.append('')
    L.append("export type Z層 = 'rug' | 'furniture' | 'surface' | 'wall';")
    L.append('')
    L.append('export interface CafeItem {')
    L.append('  id: string;')
    L.append('  category: string; // E6：目錄 UI 分頁籤 key（見 CATEGORY_LABELS）')
    L.append('  z: Z層;')
    L.append('  w: number; // 佔地寬（格）')
    L.append('  h: number; // 佔地深度（格，非視覺高度）')
    L.append('  name: string;')
    L.append('  sprite: string; // public 路徑（front）；其餘向由引擎按檔名慣例推導')
    L.append('  price: number;')
    L.append('  lv: number; // 店等級解鎖門檻')
    L.append('  starter: boolean; // true = 開局免費附贈、不進商店')
    L.append('  surface: boolean; // 可放小物（surface 寄生）：桌/櫃頂/開放層架 true；椅凳沙發卡座/其餘 false')
    L.append('  spriteHeightTiles: number; // 視覺高度（格）＝footprint_w × naturalH/naturalW；引擎算桌面高度用（spriteH = spriteHeightTiles × CELL）')
    L.append('  facings?: Facing[]; // 實際畫了哪些向；省略＝front 單向（旋轉 no-op）。back/right 加檔 <id>_back/_right.png，left 缺則引擎鏡像 right')
    L.append("  hostType?: 'counter-inside'; // E4：吧檯內側小家電（嵌吧檯裡、下半身被 counter_front 遮）；省略＝一般家具/小物")
    L.append('}')
    L.append('')
    L.append(f'export const CAFE = {{ w: {COLS * CELL}, h: {ROWS * CELL}, cols: {COLS}, rows: {ROWS}, cell: {CELL} }} as const;')
    L.append('')
    L.append('// z 層渲染順序（小→先畫→在下層）')
    L.append("export const Z_RANK: Record<Z層, number> = { rug: 0, furniture: 1, surface: 2, wall: 3 };")
    L.append('')
    L.append('// 分類 taxonomy（E6：目錄 UI 分頁籤 key→中文顯示名，陣列順序＝頁籤順序）')
    L.append('export const CATEGORY_LABELS: Array<[string, string]> = [')
    for key, label in CATEGORY_LABELS:
        L.append(f"  ['{key}', '{label}'],")
    L.append('];')
    L.append('')
    L.append('// 各 z 可放的最上排（wall 可貼上牆，其餘從地板起）')
    L.append("export const Z_TOP_ROW: Record<Z層, number> = { rug: 2, furniture: 2, surface: 2, wall: 0 };")
    L.append('')
    L.append('// 可放區間（牆內；底排/邊欄不可放）')
    L.append(f'export const PLACE = {{ minCol: 1, maxCol: {COLS - 2}, maxRow: {ROWS - 2} }} as const;')
    L.append('')
    L.append('// 固定裝置＋牆佔用、不能擺家具的格')
    L.append('export const BLOCKED: ReadonlyArray<readonly [number, number]> = [')
    L += [f'  [{x}, {y}],' for x, y in blocked]
    L.append('];')
    L.append('')
    L.append('export const CAFE_ITEMS: CafeItem[] = [')
    for it in items:
        fac = ''
        if it.get('facings'):
            fac = ", facings: [" + ", ".join(f"'{f}'" for f in it['facings']) + "]"
        host = f", hostType: '{it['hostType']}'" if it.get('hostType') else ''
        L.append(
            f"  {{ id: '{it['id']}', category: '{it['category']}', z: '{it['z']}', w: {it['w']}, h: {it['h']}, "
            f"surface: {str(it['surface']).lower()}, spriteHeightTiles: {it['spriteHeightTiles']}, "
            f"name: '{it['name']}', sprite: '/cafe/catalog/{it['id']}.png', price: {it['price']}, "
            f"lv: {it['lv']}, starter: {str(it['starter']).lower()}{fac}{host} }},"
        )
    L.append('];')
    L.append('')
    L.append('// 開局免費擺好的家具')
    L.append('export const STARTER_LAYOUT: PlacedItem[] = [')
    for iid, gx, gy in STARTER_LAYOUT:
        L.append(f"  {{ id: '{iid}', gx: {gx}, gy: {gy} }},")
    L.append('];')
    L.append('')
    open(GEN_TS, 'w').write('\n'.join(L))
    print(f'→ {GEN_TS}')
    print(f'  items {len(items)} · blocked {len(blocked)} · starters {len(STARTER_LAYOUT)}')


if __name__ == '__main__':
    main()
