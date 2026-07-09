#!/usr/bin/env python3
"""客人 sprite 產生工具（origin: E9 JJ/亞軒 Q 版客人圖處理）。

來源是「棋盤格烤進像素」的 RGB 圖（非真透明），流程：
  1. 借用 scripts/fix-shopkeeper-pose.py 的 flood_fill_bg() 去背
     （邊界 flood-fill，色距容忍 tol，跟角色不連通的孤立同色塊不會被誤挖）。
  2. 緊裁 bbox → 依「目標內容高度」等比縮放（不是 fit-canvas，是指定 target_h，
     讓多個客人可以用同一個 target_h 對齊身高）。
  3. 水平置中、底部貼齊 bottom_y，四邊留白、絕不觸邊（沿用 assert 風格）。

用法：
  python3 scripts/build-guest-sprites.py

  或individually：
  python3 scripts/build-guest-sprites.py <src> <dst> --target-h 273
"""
import argparse
import importlib.util
import os

from PIL import Image

_HERE = os.path.dirname(os.path.abspath(__file__))
_FSP_PATH = os.path.join(_HERE, 'fix-shopkeeper-pose.py')

_spec = importlib.util.spec_from_file_location('fix_shopkeeper_pose', _FSP_PATH)
fsp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fsp)


def normalize_to_height(im: Image.Image, canvas_w: int, canvas_h: int,
                         bottom_y: int, target_h: int, margin: int = 8) -> Image.Image:
    """緊裁 bbox → 依指定內容高度（target_h）等比縮放 → 水平置中、底部貼齊。

    跟 fix-shopkeeper-pose.py 的 normalize_to_canvas() 差別：
    那邊是「fit 到畫布」自動決定縮放比例；這裡是「指定目標內容高度」，
    讓多張圖可以縮到同一個高度基準（同框身高一致）。
    """
    bbox = im.getbbox()
    if bbox is None:
        raise ValueError('去背後沒有任何不透明像素，來源圖或 tol 有問題')
    cropped = im.crop(bbox)
    src_w, src_h = cropped.size

    scale = target_h / src_h
    new_w = max(1, round(src_w * scale))
    new_h = max(1, round(src_h * scale))

    max_w = canvas_w - 2 * margin
    assert new_w <= max_w, f'寬度超出畫布留白限制：new_w={new_w} > max_w={max_w}'
    assert new_h <= bottom_y - margin, f'高度超出畫布留白限制：new_h={new_h} > {bottom_y - margin}'

    resized = cropped.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
    paste_x = (canvas_w - new_w) // 2
    paste_y = bottom_y - new_h
    assert paste_x >= 0, f'水平置中後仍然溢出：paste_x={paste_x}'
    assert paste_x + new_w <= canvas_w, f'右側會溢出畫布：{paste_x + new_w} > {canvas_w}'
    assert paste_y >= 0, f'頂部溢出畫布：paste_y={paste_y}'
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


GUESTS = [
    ('/Users/huangchengchieh/Desktop/q版人/9a368067-cdeb-42e8-825d-5c6816790dc9.png',
     '/Users/huangchengchieh/Projects/Project03/public/cafe/guests/jj.png'),
    ('/Users/huangchengchieh/Desktop/q版人/f9516453-4312-45f3-b8be-1d193c45578d.png',
     '/Users/huangchengchieh/Projects/Project03/public/cafe/guests/yaxuan.png'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='?')
    ap.add_argument('dst', nargs='?')
    ap.add_argument('--canvas', default='331x320')
    ap.add_argument('--bottom-y', type=int, default=314)
    ap.add_argument('--margin', type=int, default=8)
    ap.add_argument('--tol', type=float, default=60.0)
    ap.add_argument('--target-h', type=int, default=273,
                     help='內容 bbox 目標高度（預設 273，約店長 happy.png 內容高 281 的 97%）')
    args = ap.parse_args()

    canvas_w, canvas_h = (int(v) for v in args.canvas.split('x'))

    jobs = [(args.src, args.dst)] if args.src and args.dst else GUESTS

    os.makedirs(os.path.dirname(jobs[0][1]), exist_ok=True)

    for src, dst in jobs:
        src_im = Image.open(src)
        cutout = fsp.flood_fill_bg(src_im, args.tol)
        result = normalize_to_height(cutout, canvas_w, canvas_h, args.bottom_y,
                                      args.target_h, args.margin)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        result.save(dst)
        print(f'寫出 {dst}')
        fsp.alpha_profile(result)


if __name__ == '__main__':
    main()
