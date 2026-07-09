#!/usr/bin/env python3
"""Codex 生昭和喫茶『空房間』底圖（flat top-down 遊戲地圖，跟家具同投影）。
- 一張不透明底圖：暖木地板＋後牆木鑲板/牆裙/窗＋左上 L 形吧檯＋底部門，其餘地面清空留給玩家擺家具。
- 吃 anchor-booth.png 只借畫風/配色（明講別畫家具）。輸出 /tmp/cafe-gen/room.png，fit 成 576×416。
用法：python3 scripts/gen-cafe-scene.py
"""
import os, json, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, 'docs', 'cafe-catalog.json')
ANCHOR = os.path.join(ROOT, 'assets_src', 'cafe', 'anchor-booth.png')
LAYOUT = os.path.join(ROOT, 'public', 'cafe', 'base.png')  # 現有底圖＝版面/俯視視角參考
TMP = '/tmp/cafe-gen'
STAGE_W, STAGE_H = 576, 416
CODEX = '/Applications/Codex.app/Contents/Resources/codex'
if not os.path.exists(CODEX):
    import shutil
    CODEX = shutil.which('codex') or os.path.expanduser('~/.local/opt/node/bin/codex')

D = json.load(open(MANIFEST))
PAL = D['palette']

PROMPT = (
    "你有兩張參考圖。\n"
    "圖1（anchor-booth.png）＝只借『畫風與配色』，絕對不要在成品畫任何卡座/沙發/桌椅/人物。\n"
    "圖2（base.png）＝只參考『空間佈局與俯視視角』：最上緣一條薄牆、其餘一大片是『由上往下俯視的地板』、"
    "左上角有吧檯、右上角有窗、底部中央有門。照這個空間關係，但**不要照抄它的家具、顏色或工業廚具**。\n"
    "請照圖2的佈局，畫一張昭和復古喫茶店的『空房間地圖』底圖（像 JRPG／LimeZu 那種平面 tilemap，不是透視效果圖）：\n"
    "· 地板（最重要）：一整片『由正上方俯視的溫暖木地板』，明亮溫潤的胡桃木色、看得出一塊塊長條木地板(floorboards from above)，"
    "佔畫面下方約四分之三、乾淨清空。地板必須明顯比牆亮，讓人一看就知道那是可以站人擺家具的地面，不是磚牆或立面。\n"
    "· 牆：只在最上緣一條橫帶（木鑲板＋墨綠牆裙），牆上偏右一扇透暖光的木框窗。畫面下半部沒有牆、沒有牆裙。\n"
    "· 左上角：一組 L 形深胡桃木吧檯（店員站位），吧檯後貼上緣牆、掛一塊小招牌。\n"
    "· 底部中央：一扇木質店門。\n"
    f"配色用色票：胡桃木{PAL['walnut']}、喫茶綠絨{PAL['velvet']}、酒紅{PAL['burgundy']}、黃銅金{PAL['brass']}、奶油{PAL['cream']}、描邊深{PAL['espresso']}。整體暖琥珀燈光。\n"
    f"畫風：{D['style']}\n"
    "橫向約 4:3 構圖、填滿整張、不要外框/文字/浮水印。除上述固定裝置外不要任何可移動家具。\n"
    f"把成品存成 PNG 到路徑：{TMP}/room.png"
)


def fit_cover(im, w, h):
    """縮放覆蓋 w×h 再置中裁切（保比例填滿舞台）。"""
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im.width - w) // 2; y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def main():
    os.makedirs(TMP, exist_ok=True)
    out = f'{TMP}/room.png'
    if os.path.exists(out):
        os.remove(out)
    print('== gen room ==', flush=True)
    subprocess.run(
        [CODEX, 'exec', '-C', TMP, '-s', 'workspace-write', '--skip-git-repo-check',
         '-i', ANCHOR, '-i', LAYOUT, '-o', f'{TMP}/room-last.txt', PROMPT],
        stdin=subprocess.DEVNULL,
        stdout=open(f'{TMP}/room-run.log', 'w'), stderr=subprocess.STDOUT,
    )
    if not os.path.exists(out):
        print(f'  FAIL（看 {TMP}/room-run.log；401 就重跑）', flush=True); return
    im = Image.open(out).convert('RGB')
    print('  room raw', im.size, flush=True)
    fit = fit_cover(im, STAGE_W, STAGE_H)
    fit.save(f'{TMP}/room_fit.png')
    print('  room_fit ->', f'{TMP}/room_fit.png', fit.size, flush=True)


if __name__ == '__main__':
    main()
