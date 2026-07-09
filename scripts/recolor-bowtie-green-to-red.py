#!/usr/bin/env python3
"""把店長熊貓圖片裡的綠色領結換成跟其他姿勢一致的紅色。

只動「綠色系」像素（色相落在綠色範圍、且有一定飽和度），
保留每個像素原本的飽和度(S)與明度(V)——這樣領結原本的
2-3 階陰影＋白色高光＋黑色描邊都會自然保留，只是色相被
換成跟其他姿勢紅領結一致的暖紅。

用法：
  python3 scripts/recolor-bowtie-green-to-red.py <輸入png> <輸出png> \
      [--hue-min 70] [--hue-max 170] [--sat-min 0.15] [--target-hue 8]
"""
import argparse
import colorsys

import numpy as np
from PIL import Image


def recolor(src_path, dst_path, hue_min, hue_max, sat_min, target_hue):
    im = Image.open(src_path).convert('RGBA')
    arr = np.array(im).astype(np.float64)
    r, g, b, a = arr[:, :, 0] / 255, arr[:, :, 1] / 255, arr[:, :, 2] / 255, arr[:, :, 3]

    h, w = r.shape
    out = arr.copy()
    changed = 0
    target_h = target_hue / 360.0

    for y in range(h):
        for x in range(w):
            if a[y, x] == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r[y, x], g[y, x], b[y, x])
            deg = hh * 360
            if hue_min <= deg <= hue_max and ss >= sat_min:
                nr, ng, nb = colorsys.hsv_to_rgb(target_h, ss, vv)
                out[y, x, 0] = round(nr * 255)
                out[y, x, 1] = round(ng * 255)
                out[y, x, 2] = round(nb * 255)
                changed += 1

    print(f'{src_path}: 換掉 {changed} 個綠色系像素 -> 目標色相 {target_hue}度')
    result = Image.fromarray(out.astype(np.uint8), 'RGBA')
    result.save(dst_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--hue-min', type=float, default=70.0)
    ap.add_argument('--hue-max', type=float, default=170.0)
    ap.add_argument('--sat-min', type=float, default=0.15)
    ap.add_argument('--target-hue', type=float, default=8.0)
    args = ap.parse_args()
    recolor(args.src, args.dst, args.hue_min, args.hue_max, args.sat_min, args.target_hue)


if __name__ == '__main__':
    main()
