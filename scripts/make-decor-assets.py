#!/usr/bin/env python3
"""裝飾素材：從 public/shop/Inner.png（CC0 tileset）切家具＋地板磚，
Pillow 畫店長配件。輸出 public/shop/furniture/ floors/ outfits/ ＋預覽。"""
from PIL import Image, ImageDraw
from collections import deque
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'public', 'shop')
inner = Image.open(os.path.join(BASE, 'Inner.png')).convert('RGBA')
T = 16


def tile(c, r, w=1, h=1):
    return inner.crop((c * T, r * T, (c + w) * T, (r + h) * T))


def debg(im, tol=60):
    """從邊界 flood-fill 去掉相連的深色背景（tileset 家具坐在近黑底上）"""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    def dark(p):
        return p[0] + p[1] + p[2] < tol
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and dark(px[x, y]):
                seen[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and dark(px[x, y]):
                seen[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft(); px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx] and dark(px[nx, ny]):
                seen[ny*w+nx] = 1; q.append((nx, ny))
    return im


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


# ── 家具（floor 物件，footprint = 佔格 w×h）──
# footprint 也在這裡定（給前端格子系統用）
FURN = {
    'plant_s': (16, 11, 1, 1),   # 小盆栽
    'plant_big': (8, 12, 1, 2),  # 觀葉植物
    'barrel': (10, 11, 1, 1),    # 木桶
    'flowers': (11, 11, 1, 1),   # 小花
    'stool': (16, 4, 1, 2),      # 凳子
    'rug': (0, 8, 3, 3),         # 榻榻米地毯（fill，不去背）
    'shelf': (2, 12, 3, 2),      # 酒架
    'sidetable': (16, 8, 2, 2),  # 小桌
    'vase': (11, 10, 1, 1),      # 咖啡壺/花瓶
    'painting': (6, 11, 1, 1),   # 掛畫
    'plate': (12, 6, 1, 1),      # 餐盤擺飾
    'stove': (10, 12, 2, 2),     # 生火爐
}
NO_DEBG = {'rug'}  # 平鋪型不去背
fdir = os.path.join(BASE, 'furniture')
os.makedirs(fdir, exist_ok=True)
for name, (c, r, w, h) in FURN.items():
    im = tile(c, r, w, h)
    if name not in NO_DEBG:
        im = trim(debg(im))
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(fdir, f'{name}.png'))

# ── 地板磚（16×16，可平鋪）──
FLOORS = {
    'wood': (24, 72),     # 原木（沿用預設取樣點）
    'stone': (16, 40),    # 石地
    'dark': (152, 40),    # 深色木
    'checker': (48, 128), # 綠格（榻榻米色）
}
fldir = os.path.join(BASE, 'floors')
os.makedirs(fldir, exist_ok=True)
for name, (x, y) in FLOORS.items():
    inner.crop((x, y, x + T, y + T)).resize((T * 3, T * 3), Image.NEAREST).save(os.path.join(fldir, f'{name}.png'))

# ── 店長配件（Pillow 手畫像素，覆蓋在櫃檯熊貓頭上，24×24 畫布 3x=72）──
odir = os.path.join(BASE, 'outfits')
os.makedirs(odir, exist_ok=True)


def new_outfit():
    return Image.new('RGBA', (24, 24), (0, 0, 0, 0))


def save_outfit(im, name):
    im.resize((72, 72), Image.NEAREST).save(os.path.join(odir, f'{name}.png'))


# 廚師帽（白）
im = new_outfit(); d = ImageDraw.Draw(im)
d.rectangle([7, 5, 16, 9], fill=(250, 250, 250)); d.ellipse([6, 1, 11, 6], fill=(250, 250, 250))
d.ellipse([10, 0, 15, 5], fill=(250, 250, 250)); d.ellipse([13, 1, 18, 6], fill=(250, 250, 250))
d.rectangle([7, 8, 16, 10], fill=(225, 225, 225))
save_outfit(im, 'chef')

# 蝴蝶結領結（紅）
im = new_outfit(); d = ImageDraw.Draw(im)
d.polygon([(8, 14), (11, 13), (11, 17), (8, 18)], fill=(200, 60, 60))
d.polygon([(15, 14), (12, 13), (12, 17), (15, 18)], fill=(200, 60, 60))
d.rectangle([11, 14, 12, 17], fill=(150, 40, 40))
save_outfit(im, 'bowtie')

# 眼鏡（黑框）
im = new_outfit(); d = ImageDraw.Draw(im)
d.rectangle([6, 8, 10, 11], outline=(40, 40, 40), width=1)
d.rectangle([13, 8, 17, 11], outline=(40, 40, 40), width=1)
d.line([(10, 9), (13, 9)], fill=(40, 40, 40))
save_outfit(im, 'glasses')

# 頭花（櫻）
im = new_outfit(); d = ImageDraw.Draw(im)
for dx, dy in [(0, -2), (2, 0), (0, 2), (-2, 0)]:
    d.ellipse([15 + dx, 4 + dy, 18 + dx, 7 + dy], fill=(240, 150, 180))
d.ellipse([16, 5, 17, 6], fill=(250, 220, 80))
save_outfit(im, 'sakura')

# 頭巾（藍）
im = new_outfit(); d = ImageDraw.Draw(im)
d.rectangle([6, 3, 17, 6], fill=(70, 120, 200))
d.polygon([(6, 4), (3, 5), (5, 8)], fill=(70, 120, 200))
save_outfit(im, 'bandana')

# 預覽
sheet = Image.new('RGBA', (12 * 60, 3 * 64), (250, 240, 218, 255))
d = ImageDraw.Draw(sheet)
x = 6
for name in FURN:
    im = Image.open(os.path.join(fdir, f'{name}.png')); im.thumbnail((52, 52))
    sheet.paste(im, (x, 6), im); d.text((x, 0), name[:8], fill=(176, 58, 58)); x += 60
x = 6
for name in FLOORS:
    im = Image.open(os.path.join(fldir, f'{name}.png'))
    sheet.paste(im, (x, 70)); d.text((x, 64), name, fill=(176, 58, 58)); x += 60
x = 6
for name in ['chef', 'bowtie', 'glasses', 'sakura', 'bandana']:
    im = Image.open(os.path.join(odir, f'{name}.png')); im.thumbnail((52, 52))
    sheet.paste(im, (x, 134), im); d.text((x, 128), name, fill=(176, 58, 58)); x += 60
sheet.convert('RGB').save('/tmp/decor-preview.png')
print('✅ furniture', len(FURN), 'floors', len(FLOORS), 'outfits 5 → public/shop/{furniture,floors,outfits}/')
