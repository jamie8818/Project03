#!/usr/bin/env python3
"""v2 正交錨圖：生「基準椅／基準櫃／基準桌」的正面向（front facing），鎖新視角基準。
- 取代舊的 30° anchor-booth.png。純亮綠背景、正交正面淺假3D（view_furniture 規格）。
- 不餵舊斜視錨圖（會把模型拉回 30°），只餵 palette.png 鎖色。
- 輸出 /tmp/cafe-gen/anchor_probe.png → chroma key → QC 對照，JJ 過稿後挑一版當新錨圖。
用法：python3 scripts/gen-cafe-anchor.py
"""
import os, json, subprocess
from collections import deque
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = json.load(open(os.path.join(ROOT, 'docs', 'cafe-catalog.json')))
PALETTE = os.path.join(ROOT, 'assets_src', 'cafe', 'palette.png')
TMP = '/tmp/cafe-gen'
CODEX = '/Applications/Codex.app/Contents/Resources/codex'
if not os.path.exists(CODEX):
    import shutil
    CODEX = shutil.which('codex') or os.path.expanduser('~/.local/opt/node/bin/codex')

PAL = DATA['palette']
COLOR = ('配色嚴格用色票：胡桃木%(walnut)s、喫茶綠絨%(velvet)s、酒紅%(burgundy)s、黃銅金%(brass)s、奶油%(cream)s、描邊深%(espresso)s。' % PAL)

PROMPT = (
    "圖1（palette.png）只用來鎖配色，不要照抄排版。\n"
    "請畫一張『1×3 規則網格』的昭和喫茶家具總表，三件由左到右：\n"
    "格1｜基準餐椅：木框＋墨綠絨布座面的單椅。\n"
    "格2｜基準玻璃甜點櫃：直立玻璃冷藏展示櫃、木框黃銅收邊、層架上有蛋糕布丁。\n"
    "格3｜基準圓木桌：胡桃木圓桌面配單柱底座。\n"
    f"{COLOR}\n"
    f"畫風：{DATA['style']}\n"
    f"視角（三件都必須嚴格遵守，這是這張的重點）：{DATA['view_furniture']}\n"
    "特別強調：每件都『正對正面（front facing）』、看不到側面、不要 30 度斜視、不要 3/4 視角、"
    "只靠相機略俯露出一薄條頂面來表現高度。\n"
    "背景填滿純亮綠 chroma green(#00B140)（含格間），三件置中、彼此留間距不相黏、不要格線/文字/邊框/地面陰影。\n"
    f"把成品存成 PNG 到 {TMP}/anchor_probe.png"
)


def greenish(p):
    r, g, b = p[0], p[1], p[2]
    return g > 110 and g > r + 40 and g > b + 40


def chroma(im):
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    for y in range(h):
        for x in range(w):
            if greenish(px[x, y]): px[x, y] = (0, 0, 0, 0)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and g > max(r, b) + 18: px[x, y] = (r, max(r, b), b, a)
    return im


def main():
    os.makedirs(TMP, exist_ok=True)
    out = f'{TMP}/anchor_probe.png'
    if os.path.exists(out):
        os.remove(out)
    print('== gen anchor_probe (front orthographic 椅/櫃/桌) ==', flush=True)
    subprocess.run([CODEX, 'exec', '-C', TMP, '-s', 'workspace-write', '--skip-git-repo-check',
                    '-i', PALETTE, '-o', f'{TMP}/anchor_probe-last.txt', PROMPT],
                   stdin=subprocess.DEVNULL,
                   stdout=open(f'{TMP}/anchor_probe-run.log', 'w'), stderr=subprocess.STDOUT)
    if not os.path.exists(out):
        print(f'  FAIL（看 {TMP}/anchor_probe-run.log；401 就重跑）', flush=True); return
    keyed = chroma(Image.open(out))
    bb = keyed.getbbox()
    if bb:
        keyed = keyed.crop(bb)
    keyed.save(f'{ROOT}/assets_src/cafe/anchor_probe.png')
    # QC 灰底
    qc = Image.new('RGBA', (keyed.width, keyed.height), (150, 150, 150, 255))
    qc.alpha_composite(keyed)
    qc.convert('RGB').save('/tmp/cafe_qc_anchor.png')
    print('  anchor_probe ->', f'{ROOT}/assets_src/cafe/anchor_probe.png', keyed.size, flush=True)


if __name__ == '__main__':
    main()
