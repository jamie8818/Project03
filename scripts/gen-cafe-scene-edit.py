#!/usr/bin/env python3
"""定點修改選定的場景（img2img）：保留 scene_v1_1 的一切，只改兩處——底部門兩側補牆、門窗改半圓拱形。
生 N 張變體→ assets_src/cafe/scene_edit_{i}.png，JJ 挑。
用法：python3 scripts/gen-cafe-scene-edit.py [N]
"""
import os, sys, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'assets_src', 'cafe', 'scene_v1_1.png')  # 選定的變體1
TMP = '/tmp/cafe-gen'
STAGE_W, STAGE_H = 576, 416
CODEX = '/Applications/Codex.app/Contents/Resources/codex'
if not os.path.exists(CODEX):
    import shutil
    CODEX = shutil.which('codex') or os.path.expanduser('~/.local/opt/node/bin/codex')

PROMPT = (
    "圖1 是一張昭和喫茶店的空房間底圖（2D 俯視遊戲地圖）。請『保留這張的一切』——"
    "亮度、俯視溫潤木地板、左上的木色 L/⊐ 吧檯、右上的木框窗、上緣木鑲板牆＋墨綠牆裙、"
    "整體佈局與配色都不要改。只做以下兩個修改：\n"
    "1) 底部中央的門：把門『左右兩側原本是地板的地方改成牆』——補上跟上緣同款的木鑲板牆＋墨綠牆裙，"
    "讓門嵌在一道完整的底牆中間（現在門旁邊空空是地板，要變成牆面）。\n"
    "2) 門上的玻璃窗改成『半圓形（拱形）玻璃窗』——an arched / semicircular glass window on the top of the door, "
    "透出溫暖黃光，取代原本的方形窗格。\n"
    "除了這兩處，其餘畫面盡量保持一致。橫向填滿 4:3、不要外框/文字/家具/人物。\n"
    f"把成品存成 PNG 到路徑：{TMP}/scene_edit.png"
)


def fit_cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im.width - w) // 2; y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def gen_one(i):
    out = f'{TMP}/scene_edit.png'
    if os.path.exists(out):
        os.remove(out)
    print(f'== edit scene #{i} ==', flush=True)
    subprocess.run([CODEX, 'exec', '-C', TMP, '-s', 'workspace-write', '--skip-git-repo-check',
                    '-i', SRC, '-o', f'{TMP}/scene_edit_{i}-last.txt', PROMPT],
                   stdin=subprocess.DEVNULL,
                   stdout=open(f'{TMP}/scene_edit_{i}-run.log', 'w'), stderr=subprocess.STDOUT)
    if not os.path.exists(out):
        print(f'  #{i} FAIL', flush=True); return None
    fit = fit_cover(Image.open(out).convert('RGB'), STAGE_W, STAGE_H)
    p = f'{ROOT}/assets_src/cafe/scene_edit_{i}.png'; fit.save(p)
    print(f'  #{i} ok -> {p}', flush=True)
    return fit


def main():
    os.makedirs(TMP, exist_ok=True)
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    for i in range(1, n + 1):
        gen_one(i)
    print('done', flush=True)


if __name__ == '__main__':
    main()
