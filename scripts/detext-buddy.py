#!/usr/bin/env python3
"""擦掉 sprite 上烙印的手寫日文：
去背後文字與角色是分離的不透明色塊 → 只保留面積 ≥ 最大色塊 12% 的元件
（角色本體與貓咪留下，文字筆畫、飄浮汗滴刪掉），再重新裁邊。
會列出「文字黏在角色上」疑似清不掉的檔案供人工複查。"""
from PIL import Image
from collections import deque
import os

POOL = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'pool')
KEEP_RATIO = 0.12


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


changed, suspicious = 0, []
for name in sorted(os.listdir(POOL)):
    if not name.endswith('.png'):
        continue
    path = os.path.join(POOL, name)
    im = Image.open(path).convert('RGBA')
    comps = components(im)
    if not comps:
        continue
    biggest = max(len(c) for c in comps)
    drop = [c for c in comps if len(c) < biggest * KEEP_RATIO]
    if not drop:
        # 只有一大塊：可能字黏在角色上，也可能本來就乾淨
        if len(comps) == 1:
            suspicious.append(name)
        continue
    px = im.load()
    for c in drop:
        for x, y in c:
            px[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    if bbox:
        pad = 6
        bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(im.width, bbox[2]+pad), min(im.height, bbox[3]+pad))
        im = im.crop(bbox)
    im.save(path)
    changed += 1

print(f'✅ 清理 {changed} 張（丟掉小色塊）')
print('單一色塊、需人工確認是否有字黏著：', ', '.join(suspicious) if suspicious else '無')
