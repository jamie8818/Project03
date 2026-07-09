#!/usr/bin/env python3
"""§C 硬驗收：alpha_composite(base_nocounter, counter_body, counter_front) 在兩張 sprite
不透明處必須與原 base.png 逐像素相等（diff==0）。"""
from PIL import Image
import numpy as np
import sys

BASE = 'public/cafe/base.png'
NOCOUNTER = 'public/cafe/base_nocounter.png'
BODY = 'public/cafe/counter_body.png'
FRONT = 'public/cafe/counter_front.png'

def main():
    base = np.array(Image.open(BASE).convert('RGB'))
    nocounter = Image.open(NOCOUNTER).convert('RGBA')
    body = Image.open(BODY).convert('RGBA')
    front = Image.open(FRONT).convert('RGBA')

    composite = nocounter.copy()
    composite = Image.alpha_composite(composite, body)
    composite = Image.alpha_composite(composite, front)
    comp_rgb = np.array(composite.convert('RGB'))

    body_a = np.array(body)[:, :, 3]
    front_a = np.array(front)[:, :, 3]
    opaque_mask = (body_a > 0) | (front_a > 0)

    diff = np.abs(comp_rgb.astype(int) - base.astype(int)).sum(axis=2)
    bad = diff[opaque_mask]
    n_opaque = opaque_mask.sum()
    n_bad = (bad > 0).sum()
    max_diff = bad.max() if n_opaque else 0

    print(f'opaque px (body|front)={n_opaque}')
    print(f'mismatched px={n_bad}  max_diff={max_diff}')
    if n_bad == 0:
        print('PASS: composite == base.png at all sprite-opaque pixels (diff==0)')
        sys.exit(0)
    else:
        print('FAIL')
        sys.exit(1)

if __name__ == '__main__':
    main()
