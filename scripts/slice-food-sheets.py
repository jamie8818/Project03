#!/usr/bin/env python3
"""把 JJ 生成的食物「總表」（一張多道菜＋米色底＋編號標籤）切成單張透明 PNG。
- 每張總表是規則網格：cols×rows，每格＝食物（上）＋標籤（下）
- 去背＝從邊緣 flood-fill 掉與角落同色（米色）的連通區，保留食物本體
- 裁邊、輸出 public/baito/food/<slug>.png（slug=None 的格子跳過，用於去重/空格）
- 產 QC montage 供人工檢查

用法：python3 scripts/slice-food-sheets.py <類別prefix|all>
"""
import sys, glob, os
from collections import deque
from PIL import Image, ImageDraw

SRC = os.path.expanduser('~/Desktop/食物圖')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'baito', 'food')

# 每張總表：prefix → (cols, rows, [slug...])。slug=None＝該格跳過（去重或空格）。
# 核心20 只留「非重複」的（飲料/軽食＋新增10）；其餘 5 道(purin/shortcake/icecream/ramen/sandwich)由分類表提供。
SHEETS = {
    '96a89260': (4, 5, [  # 甜點（綠幕版，取代 e58b5ba2 米色版）
        'purin', 'shortcake', 'icecream', 'taiyaki', 'dorayaki', 'daifuku', 'mitarashi',
        'warabimochi', 'parfait', 'crepe', 'donut', 'macaron', 'kakigori', 'softcream',
        'waffle', 'chocolate', 'cookie', 'castella', 'montblanc', 'anmitsu']),
    'f9ab9f10': (4, 5, [  # 日式（綠幕版）
        'ramen', 'sushi', 'tempura', 'udon', 'soba', 'curryrice', 'onigiri', 'gyudon',
        'oyakodon', 'katsudon', 'takoyaki', 'okonomiyaki', 'yakisoba', 'gyoza', 'karaage',
        'tonkatsu', 'sashimi', 'misoshiru', 'oden', 'tamagoyaki']),
    'e4898943': (4, 5, [  # 各國（綠幕版）
        'pasta', 'tacos', 'burrito', 'indiancurry', 'naan', 'tomyum', 'padthai', 'pho',
        'springroll', 'bibimbap', 'kimchi', 'tteokbokki', 'paella', 'croissant', 'kebab',
        'sausage', 'pretzel', 'mapo', 'chahan', 'pekingduck']),
    '13da328b': (3, 6, [  # 美式（綠幕版）
        'sandwich', 'hamburger', 'hotdog', 'fries', 'pizza', 'friedchicken', 'pancake',
        'steak', 'bagel', 'popcorn', 'macncheese', 'nachos', 'bbqribs', 'corndog',
        'onionring', 'cheesecake', 'milkshake', 'brownie']),
    '9e74ba96': (4, 5, [  # 台式（綠幕版；末排 2 個補 None）
        'beefnoodle', 'xiaolongbao', 'rulohan', 'dajipai', 'boba', 'congzhuabing',
        'hujiaobing', 'stinkytofu', 'oajian', 'saltchicken', 'guabao', 'douhua',
        'pineapplecake', 'aiyu', 'dachang', 'mianxian', 'wheelcake', 'mangoice', None, None]),
    '1a337945': (4, 5, [  # 核心20（綠幕版；前 5 個與分類表重複→跳過）
        None, None, None, None, None, 'bread', 'salad', 'coffee', 'tea', 'juice',
        'omurice', 'unagi', 'yakitori', 'ebifry', 'hamburg', 'korokke', 'nikuman',
        'shucream', 'eggtart', 'frenchtoast']),
    'e58b5ba2': (4, 5, [  # 甜點
        'purin', 'shortcake', 'icecream', 'taiyaki', 'dorayaki', 'daifuku', 'mitarashi',
        'warabimochi', 'parfait', 'crepe', 'donut', 'macaron', 'kakigori', 'softcream',
        'waffle', 'chocolate', 'cookie', 'castella', 'montblanc', 'anmitsu']),
    '816adc80': (4, 5, [  # 日式
        'ramen', 'sushi', 'tempura', 'udon', 'soba', 'curryrice', 'onigiri', 'gyudon',
        'oyakodon', 'katsudon', 'takoyaki', 'okonomiyaki', 'yakisoba', 'gyoza', 'karaage',
        'tonkatsu', 'sashimi', 'misoshiru', 'oden', 'tamagoyaki']),
    '8a83b719': (4, 5, [  # 各國
        'pasta', 'tacos', 'burrito', 'indiancurry', 'naan', 'tomyum', 'padthai', 'pho',
        'springroll', 'bibimbap', 'kimchi', 'tteokbokki', 'paella', 'croissant', 'kebab',
        'sausage', 'pretzel', 'mapo', 'chahan', 'pekingduck']),
    'c83d4bf9': (3, 6, [  # 美式
        'sandwich', 'hamburger', 'hotdog', 'fries', 'pizza', 'friedchicken', 'pancake',
        'steak', 'bagel', 'popcorn', 'macncheese', 'nachos', 'bbqribs', 'corndog',
        'onionring', 'cheesecake', 'milkshake', 'brownie']),
    'caeb05d4': (4, 5, [  # 台式（末排 2 個，補 None 湊滿 20 格）
        'beefnoodle', 'xiaolongbao', 'rulohan', 'dajipai', 'boba', 'congzhuabing',
        'hujiaobing', 'stinkytofu', 'oajian', 'saltchicken', 'guabao', 'douhua',
        'pineapplecake', 'aiyu', 'dachang', 'mianxian', 'wheelcake', 'mangoice', None, None]),
    '13e28e97': (4, 5, [  # 核心20：前 5 個與分類表重複→跳過
        None, None, None, None, None, 'bread', 'salad', 'coffee', 'tea', 'juice',
        'omurice', 'unagi', 'yakitori', 'ebifry', 'hamburg', 'korokke', 'nikuman',
        'shucream', 'eggtart', 'frenchtoast']),
}

LABEL_FRAC = 0.78  # 食物佔格子上緣的比例，其下是編號標籤
BG_THR = 46        # 去背色距門檻
KEEP_FRAC = 0.015  # 保留 >= 最大塊此比例的連通塊（濾掉沾到的標籤碎字）


def debeige(im):
    """從四邊 flood-fill 掉與角落同色（米色底）的連通區。只吃邊緣連通的背景，保留食物內部同色。"""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    corners = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    thr2 = BG_THR * BG_THR

    def bgish(p):
        return (p[0] - bg[0]) ** 2 + (p[1] - bg[1]) ** 2 + (p[2] - bg[2]) ** 2 < thr2

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and bgish(px[x, y]):
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and bgish(px[x, y]):
                seen[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and bgish(px[nx, ny]):
                seen[ny * w + nx] = 1
                q.append((nx, ny))
    return im


def _greenish(p):
    """chroma-key 綠（食物本身的綠，如薄荷/抹茶較不飽和，不符此條件→保留）。"""
    r, g, b = p[0], p[1], p[2]
    return g > 110 and g > r + 40 and g > b + 40


def chroma_key(im):
    """綠幕去背：從邊緣 flood-fill 掉綠底，再 despill 壓掉殘留綠邊。綠幕版最乾淨。"""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and _greenish(px[x, y]):
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and _greenish(px[x, y]):
                seen[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and _greenish(px[nx, ny]):
                seen[ny * w + nx] = 1
                q.append((nx, ny))
    for yy in range(h):
        for xx in range(w):
            r, g, b, a = px[xx, yy]
            if a > 0 and g > max(r, b) + 18:
                px[xx, yy] = (r, max(r, b), b, a)  # despill：綠邊壓到 r,b 水平
    return im


def keep_main_components(im, frac=KEEP_FRAC):
    """去背後濾掉小連通塊（沾到的標籤碎字），保留食物本體與夠大的配菜/多塊食物。"""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    comps = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] == 0:
                continue
            q = deque([(sx, sy)])
            seen[sy * w + sx] = 1
            cells = []
            while q:
                x, y = q.popleft()
                cells.append((x, y))
                for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx] and px[nx, ny][3] > 0:
                        seen[ny*w+nx] = 1
                        q.append((nx, ny))
            comps.append(cells)
    if not comps:
        return im
    biggest = max(len(c) for c in comps)
    for c in comps:
        if len(c) == biggest:
            continue  # 主食物永遠保留（即使碰到邊）
        xs = [p[0] for p in c]
        ys = [p[1] for p in c]
        comp_h = max(ys) - min(ys) + 1
        touch_lr = min(xs) <= 1 or max(xs) >= w - 2  # 貼左右邊＝裁到隔壁食物的碎片
        # 太小（碎屑）、又矮又扁（標籤橫條）、或貼左右邊（鄰格碎片）就清掉
        if len(c) < biggest * frac or comp_h < 0.12 * h or touch_lr:
            for x, y in c:
                px[x, y] = (0, 0, 0, 0)
    return im


MIN_COMP = 150  # 連通塊小於此像素數＝雜點，丟棄


def find_components(im):
    """回傳所有 alpha>0 的連通塊（各為 (x,y) 座標清單）。"""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    comps = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] == 0:
                continue
            q = deque([(sx, sy)])
            seen[sy * w + sx] = 1
            cells = []
            while q:
                x, y = q.popleft()
                cells.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] > 0:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            comps.append(cells)
    return comps


def slice_green(sheet, cols, rows, slugs):
    """綠幕版切法：整張去綠→找連通塊→依重心歸格→只留該格自己的食物團。
    每道菜以實際像素為界（含完整盤子），絕不被格線切；鄰格碎片重心在別格自動排除。
    """
    from collections import defaultdict
    W, H = sheet.size
    cw, ch = W / cols, H / rows
    keyed = chroma_key(sheet.copy())
    px = keyed.load()
    cell_comps = defaultdict(list)
    for c in find_components(keyed):
        if len(c) < MIN_COMP:
            continue
        cx = sum(p[0] for p in c) / len(c)
        cy = sum(p[1] for p in c) / len(c)
        col = min(cols - 1, max(0, int(cx // cw)))
        row = min(rows - 1, max(0, int(cy // ch)))
        cell_comps[row * cols + col].append(c)
    done = []
    for i, slug in enumerate(slugs):
        cs = cell_comps.get(i, [])
        if not slug or not cs:
            continue
        xs = [p[0] for c in cs for p in c]
        ys = [p[1] for c in cs for p in c]
        x0, y0, x1, y1 = min(xs), min(ys), max(xs) + 1, max(ys) + 1
        out = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
        op = out.load()
        for c in cs:
            for x, y in c:
                op[x - x0, y - y0] = px[x, y]
        out.save(os.path.join(OUT, slug + '.png'))
        done.append((slug, out))
    return done


def slice_sheet(prefix):
    path = glob.glob(os.path.join(SRC, '**', prefix + '*.png'), recursive=True)[0]
    cols, rows, slugs = SHEETS[prefix]
    sheet = Image.open(path).convert('RGBA')
    if _greenish(sheet.convert('RGB').getpixel((3, 3))):
        return slice_green(sheet, cols, rows, slugs)
    # 米色版（舊，撞色去背差、已棄用）：固定網格＋切標籤＋濾碎屑
    W, H = sheet.size
    cw, ch = W / cols, H / rows
    done = []
    for i, slug in enumerate(slugs):
        if not slug:
            continue
        r, c = divmod(i, cols)
        x0, y0 = int(c * cw) + 6, int(r * ch) + 6
        x1, y1 = int((c + 1) * cw) - 6, int(r * ch + ch * LABEL_FRAC)
        cell = keep_main_components(debeige(sheet.crop((x0, y0, x1, y1))))
        bbox = cell.getbbox()
        if bbox:
            cell = cell.crop(bbox)
        cell.save(os.path.join(OUT, slug + '.png'))
        done.append((slug, cell))
    return done


def qc(done, name):
    cell = 200
    cols = 5
    rows = (len(done) + cols - 1) // cols
    m = Image.new('RGBA', (cols * cell, rows * cell), (190, 190, 190, 255))  # 灰底看去背邊
    d = ImageDraw.Draw(m)
    for i, (slug, im) in enumerate(done):
        t = im.copy()
        t.thumbnail((cell - 20, cell - 34))
        x = (i % cols) * cell + (cell - t.width) // 2
        y = (i // cols) * cell + 6
        m.alpha_composite(t, (x, y))
        d.text(((i % cols) * cell + 6, (i // cols) * cell + cell - 18), slug, fill=(20, 20, 20, 255))
    out = f'/tmp/food_qc_{name}.png'
    m.convert('RGB').save(out)
    print('QC ->', out)


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'e58b5ba2'
    prefixes = list(SHEETS) if target == 'all' else [target]
    for pfx in prefixes:
        done = slice_sheet(pfx)
        print(f'{pfx}: {len(done)} 張')
        qc(done, pfx)
