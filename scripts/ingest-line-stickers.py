#!/usr/bin/env python3
"""把 LINE 貼圖庫餵進 Buddy 圖池：
- 來源 ~/Downloads/開心熊貓圖/LINE貼圖庫/**/*.png（已是透明底）
- 擦烙印文字（連通元件 <12% 最大塊者移除，同 detext-buddy.py）
- 裁邊、限高 384，從 p46 起編號存 public/sprites/pool/
- 產出帶編號預覽（/tmp/ingest-N.png）與 TS manifest 草稿（/tmp/sprites-manifest.txt）
"""
from PIL import Image, ImageDraw, ImageFont
from collections import deque
import os

SRC = os.path.expanduser('~/Downloads/開心熊貓圖/LINE貼圖庫')
POOL = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'pool')
KEEP_RATIO = 0.12
START = 46


def components(im):
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
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1),(x+1,y+1),(x-1,y-1),(x+1,y-1),(x-1,y+1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] > 0:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            comps.append(cells)
    return comps


def process(path):
    im = Image.open(path).convert('RGBA')
    comps = components(im)
    if not comps:
        return None
    biggest = max(len(c) for c in comps)
    px = im.load()
    for c in comps:
        if len(c) < biggest * KEEP_RATIO:
            for x, y in c:
                px[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    if not bbox:
        return None
    pad = 6
    bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(im.width, bbox[2]+pad), min(im.height, bbox[3]+pad))
    im = im.crop(bbox)
    if im.height > 384:
        im = im.resize((round(im.width * 384 / im.height), 384), Image.LANCZOS)
    return im


files = []
for root, _, fs in os.walk(SRC):
    files += sorted(os.path.join(root, f) for f in fs if f.endswith('.png'))

idx = START
made = []
for f in files:
    out = process(f)
    if out is None or out.width < 40 or out.height < 40:
        print('跳過', f)
        continue
    name = f'p{idx:02d}.png'
    out.save(os.path.join(POOL, name))
    made.append(name)
    idx += 1

# 預覽（每張 24 格）
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 22)
except OSError:
    font = None
TH = 170
cols = 6
per = 24
for part in range((len(made) + per - 1) // per):
    batch = made[part * per:(part + 1) * per]
    rows = (len(batch) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * TH, rows * (TH + 26)), (250, 240, 218))
    d = ImageDraw.Draw(sheet)
    for i, name in enumerate(batch):
        im = Image.open(os.path.join(POOL, name))
        im.thumbnail((TH - 10, TH - 10))
        x, y = (i % cols) * TH, (i // cols) * (TH + 26)
        sheet.paste(im, (x + (TH - im.width) // 2, y + 26), im)
        d.text((x + 6, y + 2), name.replace('.png', ''), fill=(176, 58, 58), font=font)
    sheet.save(f'/tmp/ingest-{part}.png')

with open('/tmp/sprites-manifest.txt', 'w') as f:
    for name in made:
        f.write(f"  {{ f: '{name}', tags: ['idle'] }},\n")
print(f'✅ 入庫 {len(made)} 張（p{START:02d} 起），預覽 /tmp/ingest-*.png，manifest 草稿 /tmp/sprites-manifest.txt')
