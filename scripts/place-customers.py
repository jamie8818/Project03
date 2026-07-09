#!/usr/bin/env python3
"""把 JJ 從 sheet 挑好的客人貼圖搬進 public/baito/customers/（五動作版）。
- 依 sheet 編號（＝productInfo.meta 的 stickers 順序）取對應 sticker
- 擦台詞文字（連通元件 < biggest*KEEP 者移除，同 ingest-line-stickers.py）
- 裁邊、限高，存 {slug}{0..4}.png（0走進來 1講話 2等待 3滿意 4生氣）
- 產 /tmp/customers_qc.png 供 QC
"""
import os, json, urllib.request
from collections import deque
from PIL import Image, ImageDraw

PID = {
    'konezumi': 31953466, 'warumeneko': 25513030, 'saenaineko': 28190805,
    'loverabbit': 33067524, 'kanedakon': 32676481, 'kaeru': 28199969,
    'kobito': 28955131, 'pekio': 28313773, 'piko': 28895644, 'obakakonezumi': 28955150,
}
# [走進來, 講話, 等待, 滿意, 生氣] 的 sheet 編號
PICKS = {
    'warumeneko': [0, 17, 23, 5, 24], 'saenaineko': [11, 2, 34, 33, 7],
    'piko': [31, 2, 36, 20, 6], 'pekio': [0, 2, 25, 7, 6],
    'obakakonezumi': [7, 4, 22, 27, 21], 'loverabbit': [0, 19, 5, 1, 18],
    'konezumi': [9, 22, 1, 5, 12], 'kobito': [8, 21, 38, 20, 30],
    'kanedakon': [10, 16, 13, 2, 11], 'kaeru': [3, 14, 26, 20, 6],
}
LABELS = ['走進來', '講話', '等待', '滿意', '生氣']
UA = {'User-Agent': 'Mozilla/5.0'}
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'baito', 'customers')
os.makedirs(OUT, exist_ok=True)
KEEP, MAXH = 0.12, 320


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30)


def components(im):
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    comps = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy][3] == 0:
                continue
            q = deque([(sx, sy)]); seen[sy * w + sx] = 1; cells = []
            while q:
                x, y = q.popleft(); cells.append((x, y))
                for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1),(x+1,y+1),(x-1,y-1),(x+1,y-1),(x-1,y+1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx] and px[nx, ny][3] > 0:
                        seen[ny*w+nx] = 1; q.append((nx, ny))
            comps.append(cells)
    return comps


def detext_crop(im):
    im = im.convert('RGBA')
    comps = components(im)
    if not comps:
        return None
    biggest = max(len(c) for c in comps)
    px = im.load()
    for c in comps:
        if len(c) < biggest * KEEP:
            for x, y in c:
                px[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    if not bbox:
        return None
    pad = 8
    bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(im.width, bbox[2]+pad), min(im.height, bbox[3]+pad))
    im = im.crop(bbox)
    if im.height > MAXH:
        im = im.resize((round(im.width * MAXH / im.height), MAXH), Image.LANCZOS)
    return im


results = []
for slug, picks in PICKS.items():
    meta = json.load(get(f'https://stickershop.line-scdn.net/stickershop/v1/product/{PID[slug]}/android/productInfo.meta'))
    sids = [s['id'] for s in meta['stickers']]
    for label, idx in enumerate(picks):
        sid = sids[idx]
        with get(f'https://stickershop.line-scdn.net/stickershop/v1/sticker/{sid}/android/sticker.png') as r:
            raw = f'/tmp/_cust_{slug}_{label}.png'
            open(raw, 'wb').write(r.read())
        im = detext_crop(Image.open(raw))
        im.save(os.path.join(OUT, f'{slug}{label}.png'))
        results.append((slug, label, im))
        print(f'{slug}{label}.png  (#{idx} sid={sid})')

cw, ch = 150, 150
rows = list(PICKS.keys())
sheet = Image.new('RGBA', (cw*5 + 100, ch*len(rows)), (245, 245, 245, 255))
d = ImageDraw.Draw(sheet)
for slug, label, im in results:
    row = rows.index(slug)
    t = im.copy(); t.thumbnail((cw-14, ch-14))
    x = 100 + label*cw + (cw - t.width)//2
    y = row*ch + (ch - t.height)//2
    sheet.alpha_composite(t, (x, y))
for row, slug in enumerate(rows):
    d.text((4, row*ch + ch//2), slug[:10], fill=(30, 30, 30, 255))
for j, lb in enumerate(LABELS):
    d.text((100 + j*cw + 6, 2), lb, fill=(200, 30, 30, 255))
sheet.convert('RGB').save('/tmp/customers_qc.png')
print('QC -> /tmp/customers_qc.png')
