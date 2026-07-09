#!/usr/bin/env python3
"""喫茶店場景素材管線：
- 從 /tmp/zelda-gfx（OpenGameArt「Zelda-like tilesets and sprites」by ArMM1998，CC0）
  複製 Inner/NPC/objects 三張表到 public/shop/
- 烘焙 base.png（牆＋地板＋家紋＋窗，靜態底圖 192×144）
- 店長熊貓像素化成 panda.png
素材來源若移動過，把 gfx 資料夾路徑改掉即可重跑。"""
from PIL import Image
import os
import shutil

SRC = '/tmp/zelda-gfx/gfx'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'shop')
os.makedirs(OUT, exist_ok=True)

for f in ['Inner.png', 'NPC_test.png', 'objects.png']:
    shutil.copy(os.path.join(SRC, f), os.path.join(OUT, f))

inner = Image.open(os.path.join(SRC, 'Inner.png')).convert('RGBA')
T = 16


def t(c, r, w=1, h=1):
    return inner.crop((c * T, r * T, (c + w) * T, (r + h) * T))


def px(x, y, w=16, h=16):
    return inner.crop((x, y, x + w, y + h))


COLS, ROWS = 12, 9
base = Image.new('RGBA', (COLS * T, ROWS * T))
floor = px(24, 72)
wallcol = inner.getpixel((120, 24))
for c in range(COLS):
    for r in range(ROWS):
        base.paste(Image.new('RGBA', (T, T), wallcol) if r < 2 else floor, (c * T, r * T))


def put(img, c, r):
    base.alpha_composite(img, (int(c * T), int(r * T)))


put(t(8, 1, 2, 2), 0, 0)      # 家紋
put(t(8, 1, 2, 2), 10, 0)
put(t(12, 0, 2, 1), 2.6, 0.6)  # 植栽窗 ×2
put(t(12, 0, 2, 1), 7.4, 0.6)
base.save(os.path.join(OUT, 'base.png'))

# 店長熊貓（像素化 20px 高）
p = Image.open(os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'pool', 'p14.png')).convert('RGBA')
ph = 20
small = p.resize((round(p.width * ph / p.height), ph), Image.LANCZOS)
alpha = small.split()[3]
q = small.convert('RGB').quantize(colors=14, dither=Image.Dither.NONE).convert('RGBA')
q.putalpha(alpha.point(lambda a: 255 if a > 120 else 0))
q.save(os.path.join(OUT, 'panda.png'))

with open(os.path.join(OUT, 'CREDITS.txt'), 'w') as f:
    f.write('Tileset/NPC/objects: "Zelda-like tilesets and sprites" by ArMM1998 (OpenGameArt, CC0)\n店長角色為私人使用素材。\n')
print('✅ public/shop/: base.png, panda.png, Inner.png, NPC_test.png, objects.png')
