#!/usr/bin/env python3
"""PWA 圖示（布丁喫茶版）：奶油底＋焦糖布丁＋櫻桃，Pillow 向量繪製"""
from PIL import Image, ImageDraw
import os

S = 512
img = Image.new('RGBA', (S, S), (250, 240, 218, 255))  # 奶油底 #faf0da
d = ImageDraw.Draw(img)

# 盤子
d.ellipse([70, 350, 442, 430], fill=(255, 250, 240, 255), outline=(216, 189, 141, 255), width=6)

# 布丁身體（黃）
d.rounded_rectangle([136, 190, 376, 385], radius=70, fill=(245, 185, 66, 255))

# 焦糖頂（棕，蓋在上半）
d.rounded_rectangle([136, 150, 376, 265], radius=70, fill=(107, 74, 46, 255))
# 焦糖垂滴
for cx in (190, 260, 330):
    d.ellipse([cx - 26, 235, cx + 26, 295], fill=(107, 74, 46, 255))

# 櫻桃
d.ellipse([222, 84, 290, 152], fill=(217, 85, 63, 255))
d.arc([250, 40, 330, 120], start=140, end=230, fill=(85, 112, 42, 255), width=10)

# 布丁高光
d.ellipse([170, 300, 210, 330], fill=(252, 214, 130, 255))

out = os.path.join(os.path.dirname(__file__), '..', 'public')
img.save(os.path.join(out, 'icon-512.png'))
img.resize((192, 192), Image.LANCZOS).save(os.path.join(out, 'icon-192.png'))
print('done: pudding icon-512.png / icon-192.png')
