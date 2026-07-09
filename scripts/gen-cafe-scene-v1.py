#!/usr/bin/env python3
"""重生 v1 風格的昭和喫茶空房間底圖（暗調 moody，當初那張已遺失）。生 N 張變體→拼成對照給 JJ 挑。
- 不餵版面參考（v1 就是這樣跑出偏暗、深木/磚感的氛圍）；餵 anchor-furniture 只借畫風、palette 鎖色。
- 每張 fit 成 576×416，輸出 assets_src/cafe/scene_v1_{i}.png ＋ /tmp/cafe_scene_v1_montage.png
用法：python3 scripts/gen-cafe-scene-v1.py [N]
"""
import os, sys, json, subprocess
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = json.load(open(os.path.join(ROOT, 'docs', 'cafe-catalog.json')))
ANCHOR = os.path.join(ROOT, 'assets_src', 'cafe', 'anchor-furniture.png')
LAYOUT = os.path.join(ROOT, 'public', 'cafe', 'base.png')  # v2＝亮度/俯視/佈局參考
PALETTE = os.path.join(ROOT, 'assets_src', 'cafe', 'palette.png')
TMP = '/tmp/cafe-gen'
STAGE_W, STAGE_H = 576, 416
CODEX = '/Applications/Codex.app/Contents/Resources/codex'
if not os.path.exists(CODEX):
    import shutil
    CODEX = shutil.which('codex') or os.path.expanduser('~/.local/opt/node/bin/codex')
PAL = DATA['palette']

PROMPT = (
    "圖1（anchor-furniture.png）借『畫風與配色』；圖2（base.png）借『亮度、俯視視角、空間佈局』"
    "（上緣一道牆、其餘一大片俯視木地板、左上吧檯、右上窗、底部門）。成品不要畫任何可移動家具或人物。\n"
    "請畫一張昭和復古喫茶店的『空房間地圖』底圖（俯視 tilemap，像 JRPG／LimeZu，非透視效果圖）：\n"
    "· 亮度（重要）：**明亮溫暖的午後光，跟圖2差不多、頂多暗一階，不要昏暗 moody**。\n"
    "· 地板：一整片清楚的『俯視溫潤木地板』（像圖2那種一看就知道是地面、不是磚牆），鋪滿下方約四分之三、清空留白。\n"
    "· 左上角：一組 L 形吧檯，**檯面與櫃體都是胡桃木原木色（木頭色，不要紅色/酒紅檯面）**，店員站位、吧檯後貼上緣牆掛一塊小招牌。\n"
    "· 右上牆：一扇透暖黃光的木框窗。\n"
    "· 底部中央：一扇木門，**門上有玻璃窗格、透進暖光（wooden door with glass window panels letting warm light through）**。\n"
    "· 上緣一道木鑲板牆＋墨綠牆裙。\n"
    f"配色用色票：胡桃木{PAL['walnut']}、喫茶綠絨{PAL['velvet']}、酒紅{PAL['burgundy']}（少量點綴）、黃銅金{PAL['brass']}、奶油{PAL['cream']}、描邊深{PAL['espresso']}。\n"
    f"畫風：{DATA['style']}\n"
    "橫向約 4:3、填滿整張、不要外框/文字/浮水印，除固定裝置外不要任何可移動家具。\n"
    f"把成品存成 PNG 到路徑：{TMP}/scene_v1.png"
)


def fit_cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im.width - w) // 2; y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def gen_one(i):
    out = f'{TMP}/scene_v1.png'
    if os.path.exists(out):
        os.remove(out)
    print(f'== gen scene_v1 #{i} ==', flush=True)
    subprocess.run([CODEX, 'exec', '-C', TMP, '-s', 'workspace-write', '--skip-git-repo-check',
                    '-i', ANCHOR, '-i', LAYOUT, '-i', PALETTE, '-o', f'{TMP}/scene_v1_{i}-last.txt', PROMPT],
                   stdin=subprocess.DEVNULL,
                   stdout=open(f'{TMP}/scene_v1_{i}-run.log', 'w'), stderr=subprocess.STDOUT)
    if not os.path.exists(out):
        print(f'  #{i} FAIL', flush=True); return None
    fit = fit_cover(Image.open(out).convert('RGB'), STAGE_W, STAGE_H)
    p = f'{ROOT}/assets_src/cafe/scene_v1_{i}.png'; fit.save(p)
    print(f'  #{i} ok -> {p}', flush=True)
    return fit


def main():
    os.makedirs(TMP, exist_ok=True)
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    imgs = [im for im in (gen_one(i) for i in range(1, n + 1)) if im]
    if imgs:
        m = Image.new('RGB', (STAGE_W, STAGE_H * len(imgs) + 8 * (len(imgs) - 1)), (40, 40, 40))
        for k, im in enumerate(imgs):
            m.paste(im, (0, k * (STAGE_H + 8)))
        m.save('/tmp/cafe_scene_v1_montage.png')
        print('montage -> /tmp/cafe_scene_v1_montage.png', flush=True)


if __name__ == '__main__':
    main()
