#!/usr/bin/env python3
"""把 JJ 在 Tiled 手畫的咖啡廳切成 app Shop 用的素材。

輸入：
  scene-editor/cafe.tmx                   手畫咖啡廳（18x13 @32px）
  scene-editor/catalog.tmx                家具目錄（28x24，四 z 層）
  scene-editor/furniture-annotation.json  cafe 固定 vs 可動標注
  scene-editor/tilesets/*.png             五個 LimeZu tileset

輸出（public/cafe/，不動舊 public/shop/）：
  base.png                地板+牆+固定裝置（可動家具留白）
  movable/{id}.png        6 件開局可動家具（各自帶 grid 尺寸）
  catalog/{id}.png        57 件可買家具（catalog.tmx 每層連通元件）
  ../src/data/cafe.gen.ts 場景/家具中繼資料（footprint、z 層、售價、開局擺放）
  （店長多姿勢另由 scripts/gen-shopkeeper.sh 產進 public/cafe/shopkeeper/）

切圖法：每個 gid → 依 firstgid/columns 反查 tileset PNG，crop 32x32 tile 貼上。
每件家具 = 該層的一個連通元件（JJ 每件間留 1 格，切得開）。
"""
import json
import os
import xml.etree.ElementTree as ET
from PIL import Image

TILE = 32
FLIP = 0x80000000 | 0x40000000 | 0x20000000  # Tiled 翻轉旗標，切圖前清掉

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # Project03/
SCENE = os.path.join(HERE, 'scene-editor')
OUT = os.path.join(HERE, 'public', 'cafe')
GEN_TS = os.path.join(HERE, 'src', 'data', 'cafe.gen.ts')


def load_tmx(path):
    root = ET.parse(path).getroot()
    W, H = int(root.get('width')), int(root.get('height'))
    tsets = []
    for ts in root.findall('tileset'):
        img = ts.find('image')
        src = os.path.join(SCENE, img.get('source'))
        im = Image.open(src).convert('RGBA')
        cols = int(ts.get('columns'))
        rows = im.height // TILE
        tsets.append(dict(first=int(ts.get('firstgid')), cols=cols,
                          count=cols * rows, img=im))
    tsets.sort(key=lambda t: t['first'])
    layers = {}
    for ly in root.findall('layer'):
        vals = [int(x) for x in ly.find('data').text.replace('\n', '').split(',') if x.strip()]
        layers[ly.get('name')] = [vals[r * W:(r + 1) * W] for r in range(H)]
    return W, H, tsets, layers


def tile_image(tsets, gid):
    gid &= ~FLIP
    if gid == 0:
        return None
    ts = None
    for t in tsets:
        if t['first'] <= gid < t['first'] + t['count']:
            ts = t
            break
    if ts is None:
        return None
    local = gid - ts['first']
    sx = (local % ts['cols']) * TILE
    sy = (local // ts['cols']) * TILE
    return ts['img'].crop((sx, sy, sx + TILE, sy + TILE))


def render_region(tsets, layers, layer_names, x0, y0, w, h, skip=None):
    """把指定圖層在 grid 區塊 (x0,y0,w,h) 內的 tile 合成成一張 RGBA。
    skip(x,y)->bool 回 True 的格子跳過（用來把可動家具從 base 挖掉）。"""
    canvas = Image.new('RGBA', (w * TILE, h * TILE), (0, 0, 0, 0))
    for name in layer_names:
        grid = layers[name]
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if skip and skip(x, y):
                    continue
                tile = tile_image(tsets, grid[y][x])
                if tile:
                    canvas.alpha_composite(tile, ((x - x0) * TILE, (y - y0) * TILE))
    return canvas


def components(grid, W, H):
    """8-連通元件，回 (x0,y0,w,h)。JJ 每件家具間留 1 格空隙 → 一元件=一件。"""
    seen = [[False] * W for _ in range(H)]
    out = []
    for sy in range(H):
        for sx in range(W):
            if grid[sy][sx] == 0 or seen[sy][sx]:
                continue
            stack, cells = [(sx, sy)], []
            seen[sy][sx] = True
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and grid[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
            xs = [c[0] for c in cells]
            ys = [c[1] for c in cells]
            out.append((min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1))
    # 由上而下、由左而右，讓編號穩定
    out.sort(key=lambda b: (b[1], b[0]))
    return out


# ── z 層與售價（placeholder，JJ 之後在 cafe.gen.ts 改）──
Z_META = {
    'rug':       dict(zh='地毯', rank=0, base=40, per=8),
    'furniture': dict(zh='家具', rank=1, base=50, per=12),
    'surface':   dict(zh='擺件', rank=2, base=25, per=6),
    'wall':      dict(zh='壁飾', rank=3, base=60, per=10),
}


def price_for(z, w, h):
    m = Z_META[z]
    return m['base'] + w * h * m['per']


def main():
    os.makedirs(os.path.join(OUT, 'movable'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'catalog'), exist_ok=True)

    # ── cafe.tmx：base + 可動家具 ──
    cW, cH, cTs, cL = load_tmx(os.path.join(SCENE, 'cafe.tmx'))
    ann = json.load(open(os.path.join(SCENE, 'furniture-annotation.json')))
    floor_wall_layers = [n for n in cL if 'Floor' in n or 'Walls' in n]        # 1_Floor, 2_Walls
    furni_layers = [n for n in cL if 'Floor' not in n and 'Walls' not in n]    # 3_Furniture, 4_furniture

    # 可動格集合（base 的「家具層」要挖掉這些；地板/牆保留，家具搬走才不會露洞）
    movable_cells = set()
    for it in ann['movable']:
        for x in range(it['x'], it['x'] + it['w']):
            for y in range(it['y'], it['y'] + it['h']):
                movable_cells.add((x, y))

    # base = 滿地板+牆（不挖） + 固定家具（挖掉可動件）
    base = render_region(cTs, cL, floor_wall_layers, 0, 0, cW, cH)
    furni_flat = render_region(cTs, cL, furni_layers, 0, 0, cW, cH,
                               skip=lambda x, y: (x, y) in movable_cells)
    base.alpha_composite(furni_flat)
    base.save(os.path.join(OUT, 'base.png'))

    # 每件可動家具切出來（只吃 furniture 層，避免帶到地板）
    movable_items = []
    starter_layout = []
    for it in ann['movable']:
        sprite = render_region(cTs, cL, furni_layers, it['x'], it['y'], it['w'], it['h'])
        sprite.save(os.path.join(OUT, 'movable', f"{it['id']}.png"))
        # 掛畫在牆上→z=wall；盆栽/立燈/桌椅→furniture（立燈其實較高但當家具擺）
        z = 'wall' if it['id'] == 'painting' else 'furniture'
        movable_items.append(dict(id=it['id'], z=z, w=it['w'], h=it['h'],
                                  name=it['name'], sprite=f"/cafe/movable/{it['id']}.png",
                                  price=0, lv=1, starter=True))
        starter_layout.append(dict(id=it['id'], gx=it['x'], gy=it['y']))

    # ── catalog.tmx：57 件可買家具 ──
    kW, kH, kTs, kL = load_tmx(os.path.join(SCENE, 'catalog.tmx'))
    z_by_layer = {'1_rug': 'rug', '2_furniture': 'furniture', '3_surface': 'surface', '4_wall': 'wall'}
    catalog_items = []
    for lname, z in z_by_layer.items():
        comps = components(kL[lname], kW, kH)
        for i, (x0, y0, w, h) in enumerate(comps, 1):
            iid = f"{z}_{i}"
            sprite = render_region(kTs, kL, [lname], x0, y0, w, h)
            sprite.save(os.path.join(OUT, 'catalog', f"{iid}.png"))
            lv = min(1 + (i - 1) // 4, 12)
            catalog_items.append(dict(id=iid, z=z, w=w, h=h,
                                      name=f"{Z_META[z]['zh']}{i}",
                                      sprite=f"/cafe/catalog/{iid}.png",
                                      price=price_for(z, w, h), lv=lv, starter=False))

    # 店長熊貓改用多姿勢（scripts/gen-shopkeeper.sh → public/cafe/shopkeeper/），這裡不再產單張 panda.png。

    # ── 固定裝置 BLOCKED（cafe 固定家具佔格，裝潢時不能疊）──
    blocked = set()
    for it in ann['fixed']:
        for x in range(it['x'], it['x'] + it['w']):
            for y in range(it['y'], it['y'] + it['h']):
                blocked.add((x, y))
    # 牆：上兩排、底排、左右邊欄（從 2_Walls 非零推）
    walls = cL['2_Walls']
    for y in range(cH):
        for x in range(cW):
            if walls[y][x]:
                blocked.add((x, y))
    blocked_sorted = sorted(blocked, key=lambda c: (c[1], c[0]))

    # ── 產出 cafe.gen.ts ──
    all_items = movable_items + catalog_items
    ts_lines = [
        '// 由 scripts/build-cafe-assets.py 從 Tiled 手畫場景自動產生 — 不要手改（重跑腳本會覆蓋）。',
        '// 命名/售價是 placeholder，要調整請改本檔並「不要」再跑腳本，或改腳本裡的 Z_META。',
        "import type { PlacedItem } from '../lib/shopstate.ts';",
        '',
        'export type Z層 = \'rug\' | \'furniture\' | \'surface\' | \'wall\';',
        '',
        'export interface CafeItem {',
        '  id: string;',
        '  z: Z層;',
        '  w: number; // footprint 寬（格）',
        '  h: number; // footprint 高（格）',
        '  name: string;',
        '  sprite: string; // public 路徑',
        '  price: number;',
        '  lv: number; // 店等級解鎖門檻',
        '  starter: boolean; // true = 開局免費附贈、不進商店',
        '}',
        '',
        f'export const CAFE = {{ w: {cW * TILE}, h: {cH * TILE}, cols: {cW}, rows: {cH}, cell: {TILE} }} as const;',
        '',
        '// z 層渲染順序（小→先畫→在下層）',
        "export const Z_RANK: Record<Z層, number> = { rug: 0, furniture: 1, surface: 2, wall: 3 };",
        '',
        '// 各 z 可放的最上排（wall 可貼上牆，其餘從地板起）',
        "export const Z_TOP_ROW: Record<Z層, number> = { rug: 2, furniture: 2, surface: 2, wall: 0 };",
        '',
        '// 可放區間（牆內；底排/邊欄不可放）',
        f'export const PLACE = {{ minCol: 1, maxCol: {cW - 2}, maxRow: {cH - 2} }} as const;',
        '',
        '// 固定裝置＋牆佔用、不能擺家具的格',
        'export const BLOCKED: ReadonlyArray<readonly [number, number]> = [',
        *[f'  [{x}, {y}],' for x, y in blocked_sorted],
        '];',
        '',
    ]
    ts_lines.append('export const CAFE_ITEMS: CafeItem[] = [')
    for it in all_items:
        ts_lines.append(
            f"  {{ id: '{it['id']}', z: '{it['z']}', w: {it['w']}, h: {it['h']}, "
            f"name: '{it['name']}', sprite: '{it['sprite']}', price: {it['price']}, "
            f"lv: {it['lv']}, starter: {str(it['starter']).lower()} }},"
        )
    ts_lines.append('];')
    ts_lines.append('')
    ts_lines.append('// 開局免費擺好的可動家具（cafe.tmx 原位）')
    ts_lines.append('export const STARTER_LAYOUT: PlacedItem[] = [')
    for p in starter_layout:
        ts_lines.append(f"  {{ id: '{p['id']}', gx: {p['gx']}, gy: {p['gy']} }},")
    ts_lines.append('];')
    ts_lines.append('')
    with open(GEN_TS, 'w') as f:
        f.write('\n'.join(ts_lines))

    print(f"base.png            {base.size}")
    print(f"movable             {len(movable_items)} 件")
    print(f"catalog             {len(catalog_items)} 件 "
          f"(rug {sum(1 for i in catalog_items if i['z']=='rug')}, "
          f"furniture {sum(1 for i in catalog_items if i['z']=='furniture')}, "
          f"surface {sum(1 for i in catalog_items if i['z']=='surface')}, "
          f"wall {sum(1 for i in catalog_items if i['z']=='wall')})")
    print(f"blocked cells       {len(blocked_sorted)}")
    print(f"→ {GEN_TS}")


if __name__ == '__main__':
    main()
