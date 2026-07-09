#!/usr/bin/env python3
"""重出帶字的來源貼圖（例：61ab2ca4「もんもんもん」）→ 去字版 slug png。

背景：fix-shopkeeper-pose.py 只做「邊界 flood-fill 去背 + 身高正規化」，
沒有「去字」步驟。當初 cheer/think/love 那 3 張帶字來源圖產出時多做了
一步「連通元件去字」（只留 ≥最大塊12% 大小的連通塊，字通常是很多小塊、
遠小於熊貓本體，會被濾掉；熊貓本體是最大塊、一定保留）。這支腳本補回
那個去字步驟，其餘（去背/置中/著地）邏輯照抄 fix-shopkeeper-pose.py。

用法：
  python3 scripts/gen-welcome-delettered.py <來源png> <輸出png> \
      [--canvas 331x320] [--bottom-y 314] [--margin 8] [--tol 60] [--keep-ratio 0.12]
"""
import argparse
from collections import deque

import numpy as np
from PIL import Image
from scipy import ndimage


def flood_fill_bg(img: Image.Image, tol: float) -> Image.Image:
    im = img.convert('RGBA')
    arr = np.array(im).astype(np.int32)
    h, w = arr.shape[0], arr.shape[1]
    rgb = arr[:, :, :3]

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


def remove_text_blobs(im: Image.Image, keep_ratio: float) -> Image.Image:
    """去掉字：連通元件分析，只留 >= 最大塊 keep_ratio 大小的塊（熊貓本體必是最大塊）。"""
    arr = np.array(im.convert('RGBA'))
    mask = arr[:, :, 3] > 10
    labels, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return im
    sizes = ndimage.sum(mask, labels, index=range(1, n + 1))
    max_size = sizes.max()
    keep_labels = [i + 1 for i, s in enumerate(sizes) if s >= max_size * keep_ratio]
    keep_mask = np.isin(labels, keep_labels)
    out = arr.copy()
    out[~keep_mask, 3] = 0
    removed = n - len(keep_labels)
    print(f'去字：{n} 個連通塊，留下 {len(keep_labels)} 個（濾掉 {removed} 個小塊，門檻={max_size * keep_ratio:.0f}px）')
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def normalize_to_canvas(im: Image.Image, canvas_w: int, canvas_h: int,
                         bottom_y: int, margin: int) -> Image.Image:
    bbox = im.getbbox()
    if bbox is None:
        raise ValueError('去背後沒有任何不透明像素，來源圖或 tol 有問題')
    cropped = im.crop(bbox)
    src_w, src_h = cropped.size

    max_w = canvas_w - 2 * margin
    max_h = bottom_y - margin
    scale = min(max_w / src_w, max_h / src_h)
    new_w = max(1, round(src_w * scale))
    new_h = max(1, round(src_h * scale))

    resized = cropped.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    paste_x = (canvas_w - new_w) // 2
    paste_y = bottom_y - new_h
    assert paste_x >= 0
    assert paste_x + new_w <= canvas_w
    assert paste_y >= 0
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--canvas', default='331x320')
    ap.add_argument('--bottom-y', type=int, default=314)
    ap.add_argument('--margin', type=int, default=8)
    ap.add_argument('--tol', type=float, default=60.0)
    ap.add_argument('--keep-ratio', type=float, default=0.12)
    args = ap.parse_args()

    canvas_w, canvas_h = (int(v) for v in args.canvas.split('x'))
    src_im = Image.open(args.src)
    cutout = flood_fill_bg(src_im, args.tol)
    delettered = remove_text_blobs(cutout, args.keep_ratio)
    result = normalize_to_canvas(delettered, canvas_w, canvas_h, args.bottom_y, args.margin)
    result.save(args.dst)
    print(f'寫出 {args.dst}, size={result.size}')


if __name__ == '__main__':
    main()
