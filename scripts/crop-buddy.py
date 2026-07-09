#!/usr/bin/env python3
"""ごきげんぱんだ素材裁切管線：
- grid 模式把貼圖總表切格，single 模式整張處理
- 去背用「從邊界 flood-fill」：只挖掉跟邊界相連的背景，保住熊貓白肚子
- 輸出 public/sprites/pool/pNN.png（高度上限 384）＋帶編號預覽圖 /tmp/pool-preview.png
"""
from PIL import Image, ImageDraw
from collections import deque
import os

SRC = os.path.expanduser('~/Downloads/開心熊貓圖')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'pool')
os.makedirs(OUT, exist_ok=True)

# (檔名, 模式, 參數)；grid=(rows, cols)，vsplit=直向等分數
PLAN = [
    ('LINEgokigenP.png', 'grid', (4, 4)),
    ('main (6).png', 'grid', (2, 2)),          # 四表情格
    ('75f2c57b708a61a596b5dbd40c617c44.jpg', 'vsplit', 2),
    ('608def66ef630f2b24ba053585ee12c8.jpg', 'single', None),
    ('73f4579d3135e14392303b7baa850c7a97338b3b.png', 'single', None),
    ('83bac84ee0569dd3a2b0dae31cf846d3.jpg', 'single', None),
    ('9a487598564b2865c2bce8e8fbc66fb6.jpg', 'single', None),
    ('D46qXHmUEAUZiww.jpg', 'single', None),
    ('FaBPneoacAAonRA.jpg', 'single', None),
    ('FgneifAacAAiMKM.jpg', 'single', None),
    ('images (1).png', 'single', None),
    ('images (2).jpeg', 'single', None),
    ('images (3).jpeg', 'single', None),
    ('images (4).jpeg', 'single', None),
    ('images (5).jpeg', 'single', None),
    ('images.jpeg', 'single', None),
    ('images.png', 'single', None),
    ('main (1).png', 'single', None),
    ('main (2).png', 'single', None),
    ('main (3).png', 'single', None),
    ('main (4).png', 'single', None),
    ('main (5).png', 'single', None),
    ('main (7).png', 'single', None),
    ('main (8).png', 'single', None),
    ('main (9).png', 'single', None),
    ('main.png', 'single', None),
    ('sticker.png', 'single', None),
]


def cutout(im, tol=110):
    """從邊界 flood-fill 去背；回傳 RGBA 或 None（去背後空了）"""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    border = (
        [px[x, 0][:3] for x in range(w)] + [px[x, h - 1][:3] for x in range(w)] +
        [px[0, y][:3] for y in range(h)] + [px[w - 1, y][:3] for y in range(h)]
    )
    n = len(border)
    bg = tuple(sum(p[i] for p in border) // n for i in range(3))

    def is_bg(p):
        return abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) < tol

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x] and is_bg(px[x, y][:3]):
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x] and is_bg(px[x, y][:3]):
                seen[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_bg(px[nx, ny][:3]):
                seen[ny * w + nx] = 1
                q.append((nx, ny))
    bbox = im.getbbox()
    if not bbox:
        return None
    pad = 8
    bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad))
    im = im.crop(bbox)
    if im.height > 384:
        im = im.resize((round(im.width * 384 / im.height), 384), Image.LANCZOS)
    return im


def pieces(path, mode, arg):
    im = Image.open(path)
    if mode == 'single':
        return [im]
    if mode == 'vsplit':
        n = arg
        return [im.crop((0, i * im.height // n, im.width, (i + 1) * im.height // n)) for i in range(n)]
    rows, cols = arg
    cw, ch = im.width // cols, im.height // rows
    return [im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for r in range(rows) for c in range(cols)]


idx = 0
made = []
for fname, mode, arg in PLAN:
    path = os.path.join(SRC, fname)
    if not os.path.exists(path):
        print(f'⚠️ 缺 {fname}')
        continue
    for piece in pieces(path, mode, arg):
        out = cutout(piece)
        if out is None or out.width < 40 or out.height < 40:
            print(f'  跳過空白格 {fname}')
            continue
        name = f'p{idx:02d}.png'
        out.save(os.path.join(OUT, name))
        made.append(name)
        idx += 1

# 帶編號預覽圖（奶油底，模擬 App 呈現）
TH = 190
cols = 6
rows = (len(made) + cols - 1) // cols
sheet = Image.new('RGB', (cols * TH, rows * (TH + 16)), (250, 240, 218))
d = ImageDraw.Draw(sheet)
for i, name in enumerate(made):
    im = Image.open(os.path.join(OUT, name))
    im.thumbnail((TH - 10, TH - 10))
    x, y = (i % cols) * TH, (i // cols) * (TH + 16)
    sheet.paste(im, (x + (TH - im.width) // 2, y + 16 + (TH - 10 - im.height) // 2), im)
    d.text((x + 5, y + 2), name, fill=(176, 58, 58))
sheet.save('/tmp/pool-preview.png')
print(f'✅ {len(made)} 隻 → public/sprites/pool/，預覽 /tmp/pool-preview.png')
