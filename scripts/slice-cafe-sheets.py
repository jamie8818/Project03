#!/usr/bin/env python3
"""把 Codex 生的家具「總表」（綠幕、規則網格、一格一件）切成單張透明 PNG。
- 讀 docs/cafe-catalog.json 取每個 sheet 的 items（順序＝格順序，row-major）與 footprint w×h。
- 去背＝綠幕 chroma key（沿用 slice-food-sheets 的做法）；找連通塊→依重心歸格→union bbox 裁切。
- 每件縮放進 (w*CELL_RES × h*CELL_RES) 框、保留比例、底部置中（對齊 .cafe-furn object-fit:contain bottom）。
- 輸出到 assets_src/cafe/out/<id>.png（staging，Phase 4 才搬進 public/cafe/）＋ QC montage。
用法：python3 scripts/slice-cafe-sheets.py <sheet|all>
"""
import sys, os, json
from collections import deque, defaultdict
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, 'docs', 'cafe-catalog.json')
SHEET_DIR = '/tmp/cafe-gen'                      # 生成的總表放這
OUT = os.path.join(ROOT, 'assets_src', 'cafe', 'out')  # 切好的 staging

DRAW_RES = 64        # 每格內部解析度（px/cell）；家具寬 w*64、高依自然比例（可 overhang）
MIN_COMP = 200       # 連通塊 < 此像素＝雜點，丟
# 各 sheet 的網格（cols, rows）；要和生成 prompt 的排版一致
GRID = {
    'seating': (4, 2), 'counter': (3, 2), 'lightwall': (3, 2), 'rug': (3, 2), 'surface': (3, 2),
    'seating2': (3, 2), 'counter2': (2, 2), 'wall2': (3, 2), 'rug2': (2, 1), 'surface2': (3, 2),
    'furniture3': (4, 2), 'surface3': (3, 2), 'wall3': (3, 1),
    'furniture4': (3, 3), 'wall4': (2, 2), 'rug4': (3, 1), 'surface4': (2, 2),
    'furniture5': (3, 2), 'wall5': (2, 1), 'rug5': (2, 1),
    'personal': (3, 3),
    'furniture5b': (3, 1), 'personalfix': (2, 2), 'furniture5c': (2, 1), 'furniture5d': (1, 1),
    'furniture6': (3, 2), 'furniture7': (3, 2), 'wall6': (1, 1), 'rug6': (1, 1),
    'furniture7fix': (1, 1),
}


def load_items(sheet):
    d = json.load(open(MANIFEST))
    return [it for it in d['items'] if it['sheet'] == sheet]


def greenish(p):
    r, g, b = p[0], p[1], p[2]
    return g > 110 and g > r + 40 and g > b + 40


def chroma_key(im):
    """綠幕去背：全域去掉鮮綠 chroma（含被物件包住的封閉綠塊，如高腳椅腳架間），再 despill 壓殘綠邊。
    喫茶綠絨(#35503F)是悶綠、g<110 不符 greenish → 安全不誤殺。"""
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    for y in range(h):
        for x in range(w):
            if greenish(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and g > max(r, b) + 18: px[x, y] = (r, max(r, b), b, a)
    return im


def find_components(im):
    w, h = im.size; px = im.load()
    seen = bytearray(w * h); comps = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] == 0:
                continue
            q = deque([(sx, sy)]); seen[sy * w + sx] = 1; cells = []
            while q:
                x, y = q.popleft(); cells.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] > 0:
                        seen[ny * w + nx] = 1; q.append((nx, ny))
            comps.append(cells)
    return comps


def fit_sprite(sprite, item):
    """依 z 決定成品尺寸（不含陰影，陰影由 app 引擎畫在 footprint 上）：
    - furniture/surface：寬對齊 w*DRAW_RES、高依自然比例（保留立面高度，之後在 app overhang 往上長）。
    - rug：填滿 w*DRAW_RES × h*DRAW_RES（俯視平貼，鋪滿佔格）。
    - wall：contain 進 w*DRAW_RES × h*DRAW_RES、置中（貼牆平面）。"""
    z, w, h = item['z'], item['w'], item['h']
    s = sprite.copy()
    if z == 'rug':
        return s.resize((w * DRAW_RES, h * DRAW_RES), Image.LANCZOS)
    if z == 'wall':
        bw, bh = w * DRAW_RES, h * DRAW_RES
        r = min(bw / s.width, bh / s.height)
        s = s.resize((max(1, round(s.width * r)), max(1, round(s.height * r))), Image.LANCZOS)
        canvas = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        canvas.alpha_composite(s, ((bw - s.width) // 2, (bh - s.height) // 2))
        return canvas
    # furniture / surface：寬對齊，高自然（立面，可 overhang）
    tw = w * DRAW_RES
    return s.resize((tw, max(1, round(s.height * tw / s.width))), Image.LANCZOS)


def slice_sheet(sheet):
    items = load_items(sheet)
    cols, rows = GRID[sheet]
    path = os.path.join(SHEET_DIR, f'sheet_{sheet}.png')
    if not os.path.exists(path):
        print(f'  ! 缺總表 {path}'); return []
    sheet_im = chroma_key(Image.open(path))
    W, H = sheet_im.size; cw, ch = W / cols, H / rows
    px = sheet_im.load()
    cell_comps = defaultdict(list)
    for c in find_components(sheet_im):
        if len(c) < MIN_COMP:
            continue
        cx = sum(p[0] for p in c) / len(c); cy = sum(p[1] for p in c) / len(c)
        col = min(cols - 1, max(0, int(cx // cw))); row = min(rows - 1, max(0, int(cy // ch)))
        cell_comps[row * cols + col].append(c)
    os.makedirs(OUT, exist_ok=True)
    done = []
    for i, it in enumerate(items):           # items 依 manifest 順序＝格 0,1,2… row-major
        cs = cell_comps.get(i, [])
        if not cs:
            print(f'  ! 格{i} {it["id"]} 找不到物件（總表排版可能歪，考慮重生）'); continue
        xs = [p[0] for c in cs for p in c]; ys = [p[1] for c in cs for p in c]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs) + 1, max(ys) + 1
        sprite = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0)); sp = sprite.load()
        for c in cs:
            for x, y in c:
                sp[x - x0, y - y0] = px[x, y]
        out = fit_sprite(sprite, it)
        out.save(os.path.join(OUT, it['id'] + '.png'))
        done.append((it, out))
    return done


def qc(done, sheet):
    if not done:
        return
    cell = 170; cols = 4; rows = (len(done) + cols - 1) // cols
    m = Image.new('RGBA', (cols * cell, rows * cell), (150, 150, 150, 255))
    d = ImageDraw.Draw(m)
    for i, (it, im) in enumerate(done):
        t = im.copy(); t.thumbnail((cell - 20, cell - 40))
        x = (i % cols) * cell + (cell - t.width) // 2; y = (i // cols) * cell + 8
        m.alpha_composite(t, (x, y))
        d.text(((i % cols) * cell + 6, (i // cols) * cell + cell - 26), f"{it['id']}", fill=(15, 15, 15, 255))
        d.text(((i % cols) * cell + 6, (i // cols) * cell + cell - 14), f"{it['w']}x{it['h']} {it['name']}", fill=(40, 40, 40, 255))
    p = f'/tmp/cafe_qc_{sheet}.png'
    m.convert('RGB').save(p)
    print('  QC ->', p)


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'all'
    sheets = list(GRID) if target == 'all' else [target]
    for s in sheets:
        done = slice_sheet(s)
        print(f'{s}: {len(done)} 件')
        qc(done, s)
