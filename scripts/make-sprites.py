#!/usr/bin/env python3
"""把 JJ 供的角色圖處理成店長 sprite：去背（近角落色）＋裁切＋等比縮放（平滑，不像素化）。
用法：python3 scripts/make-sprites.py 開心的圖.png happy
     （第二個參數 = idle|happy|sad|cheer|sleep，輸出 public/sprites/<mood>.png）
背景若不是乾淨純色，去背效果差的話跟 Claude 說，改用手動遮罩處理。"""
from PIL import Image
import sys
import os

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)

src, mood = sys.argv[1], sys.argv[2]
assert mood in ('idle', 'happy', 'sad', 'cheer', 'sleep'), f'未知情境 {mood}'

img = Image.open(src).convert('RGBA')

# 去背：以四角平均色為背景，容差內變透明
corners = [img.getpixel((x, y)) for x, y in [(0, 0), (img.width - 1, 0), (0, img.height - 1), (img.width - 1, img.height - 1)]]
bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
TOL = 40
px = img.load()
for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = px[x, y]
        if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < TOL * 3:
            px[x, y] = (0, 0, 0, 0)

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

# 平滑縮放到高 384（Retina 2x 用），保持比例
h = 384
w = max(1, round(img.width * h / img.height))
out = img.resize((w, h), Image.LANCZOS)

dest_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites')
os.makedirs(dest_dir, exist_ok=True)
dest = os.path.join(dest_dir, f'{mood}.png')
out.save(dest)
print(f'✅ {dest}（{out.width}×{out.height}）')
