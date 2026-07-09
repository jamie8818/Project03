#!/usr/bin/env python3
"""單張店長姿勢圖修復/重出工具（origin: 修 cozy.png 右側切邊 E-bug）。

流程：
  1. 從 ~/Desktop/新熊貓/ 的 LINE 貼圖風熊貓來源圖去背（邊界 flood-fill，
     連通元件同色調才挖空，不會誤挖角色身上跟背景色調相近的區塊）。
  2. 緊裁 bbox（不加留白）。
  3. 依目標畫布（預設 331x320，跟 public/cafe/shopkeeper/ 其他姿勢一致）
     等比例縮放＋置中＋底部著地，四邊留白、絕不觸邊裁切。
  4. LANCZOS 縮放，邊緣自然羽化（不是硬 0/255）。

用法：
  python3 scripts/fix-shopkeeper-pose.py <來源png> <輸出png> \
      [--canvas 331x320] [--bottom-y 314] [--margin 8] [--tol 60]

驗證：
  python3 scripts/fix-shopkeeper-pose.py --verify <png>
"""
import argparse
import sys
from collections import deque

from PIL import Image
import numpy as np


def flood_fill_bg(img: Image.Image, tol: float) -> Image.Image:
    """從四邊界 flood-fill 挖掉背景，回傳 RGBA（背景 alpha=0）。
    用色距（歐氏距離）判定「像背景」，只挖掉跟邊界連通的區域，
    角色身上就算有相近色調的孤立區塊也不會被誤挖（沒有連到邊界）。
    """
    im = img.convert('RGBA')
    arr = np.array(im).astype(np.int32)
    h, w = arr.shape[0], arr.shape[1]
    rgb = arr[:, :, :3]

    # 邊界平均色當背景參考色
    border_px = np.concatenate([
        rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :],
    ])
    bg = border_px.mean(axis=0)

    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    is_bg_candidate = dist < tol

    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    def seed(y, x):
        if is_bg_candidate[y, x] and not visited[y, x]:
            visited[y, x] = True
            q.append((y, x))

    for x in range(w):
        seed(0, x)
        seed(h - 1, x)
    for y in range(h):
        seed(y, 0)
        seed(y, w - 1)

    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg_candidate[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    out = arr.copy()
    out[visited, 3] = 0
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def normalize_to_canvas(im: Image.Image, canvas_w: int, canvas_h: int,
                         bottom_y: int, margin: int) -> Image.Image:
    """緊裁 bbox → 等比縮放（含留白硬約束）→ 水平置中、底部貼齊 bottom_y。"""
    bbox = im.getbbox()
    if bbox is None:
        raise ValueError('去背後沒有任何不透明像素，來源圖或 tol 有問題')
    cropped = im.crop(bbox)
    src_w, src_h = cropped.size

    max_w = canvas_w - 2 * margin
    max_h = bottom_y - margin  # 頂部也要留白，避免頂到畫布邊
    scale = min(max_w / src_w, max_h / src_h)
    new_w = max(1, round(src_w * scale))
    new_h = max(1, round(src_h * scale))

    resized = cropped.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    paste_x = (canvas_w - new_w) // 2
    paste_y = bottom_y - new_h
    assert paste_x >= 0, f'水平置中後仍然溢出：paste_x={paste_x}'
    assert paste_x + new_w <= canvas_w, f'右側會溢出畫布：{paste_x + new_w} > {canvas_w}'
    assert paste_y >= 0, f'頂部溢出畫布：paste_y={paste_y}'
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


def alpha_profile(im: Image.Image):
    arr = np.array(im.convert('RGBA'))
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 0)
    print(f'size={im.size} bbox x[{xs.min()}-{xs.max()}] y[{ys.min()}-{ys.max()}]')
    # 檢查左右邊緣是否有硬懸崖（相鄰兩欄不透明像素數落差 > 30 且其中一欄直接掉到 0 附近）
    col_counts = (alpha > 0).sum(axis=0)
    cliffs = []
    for x in range(1, len(col_counts)):
        prev, cur = col_counts[x - 1], col_counts[x]
        if prev > 20 and cur == 0:
            cliffs.append((x - 1, x, int(prev)))
    if cliffs:
        print('!! 偵測到硬懸崖 (x_before, x_after, height):', cliffs)
    else:
        print('OK：沒有偵測到硬懸崖（邊緣漸減正常）')
    return col_counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='?')
    ap.add_argument('dst', nargs='?')
    ap.add_argument('--canvas', default='331x320')
    ap.add_argument('--bottom-y', type=int, default=314)
    ap.add_argument('--margin', type=int, default=8)
    ap.add_argument('--tol', type=float, default=60.0)
    ap.add_argument('--verify', metavar='PNG', help='只印 alpha 剖面，不處理')
    args = ap.parse_args()

    if args.verify:
        alpha_profile(Image.open(args.verify))
        return

    if not args.src or not args.dst:
        ap.error('需要 src 與 dst，或用 --verify PNG')

    canvas_w, canvas_h = (int(v) for v in args.canvas.split('x'))
    src_im = Image.open(args.src)
    cutout = flood_fill_bg(src_im, args.tol)
    result = normalize_to_canvas(cutout, canvas_w, canvas_h, args.bottom_y, args.margin)
    result.save(args.dst)
    print(f'寫出 {args.dst}')
    alpha_profile(result)


if __name__ == '__main__':
    main()
