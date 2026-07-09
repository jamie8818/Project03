#!/usr/bin/env python3
"""生家具的『非 front 向』(back/right/left) ＋ 拆套桌本體 front。
- 檔名慣例（引擎 §D）：back=<id>_back.png、right=<id>_right.png、left=<id>_left.png；front=<id>.png。
- 側向(right/left)畫布寬 = 旋轉後佔地寬 = 原 footprint.h × 64；front/back 寬 = footprint.w × 64。
- 每個非 front 向：餵『該件的 front sprite』(-i) 保持是同一件 + anchor-furniture(-i) 定畫風。
- 拆套桌(--front id)：重畫成桌本體（不含椅），餵 anchor-furniture、照 manifest 的 desc。
用法：
  python3 scripts/gen-cafe-facings.py --front table_round table_square   # 重畫桌本體 front
  python3 scripts/gen-cafe-facings.py chair_velvet                       # 生該件所有非 front 向
  python3 scripts/gen-cafe-facings.py all                                # 所有有 facings 的件
"""
import os, sys, json, subprocess
from collections import deque
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = json.load(open(os.path.join(ROOT, 'docs', 'cafe-catalog.json')))
ITEM = {it['id']: it for it in DATA['items']}
ANCHOR = os.path.join(ROOT, 'assets_src', 'cafe', 'anchor-furniture.png')
CATALOG = os.path.join(ROOT, 'public', 'cafe', 'catalog')
OUT = os.path.join(ROOT, 'assets_src', 'cafe', 'out')
TMP = '/tmp/cafe-gen'
DRAW_RES = 64
CODEX = '/Applications/Codex.app/Contents/Resources/codex'
if not os.path.exists(CODEX):
    import shutil
    CODEX = shutil.which('codex') or os.path.expanduser('~/.local/opt/node/bin/codex')

PAL = DATA['palette']
COLOR = ('配色嚴格用色票：胡桃木%(walnut)s、喫茶綠絨%(velvet)s、酒紅%(burgundy)s、黃銅金%(brass)s、奶油%(cream)s、描邊深%(espresso)s。' % PAL)
VIEW = DATA['view_furniture']

VIEW_SPEC = {
    'back': '把這件家具轉成『正背面』：從正後方看（背對畫面），一樣正交、相機略俯只露一薄條頂、看不到側面。椅子/沙發＝看到椅背外側；櫃子＝看到背板。',
    'right': '把這件家具轉成『右側面』：側身、正面朝向畫面右方（side profile facing RIGHT），只露單一側平面＋一薄條頂，正交無透視。',
    'left': '把這件家具轉成『左側面』：側身、正面朝向畫面左方（side profile facing LEFT），只露單一側平面＋一薄條頂，正交無透視。',
}


def greenish(p):
    r, g, b = p[0], p[1], p[2]
    return g > 110 and g > r + 40 and g > b + 40


def chroma_trim(im):
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    for y in range(h):
        for x in range(w):
            if greenish(px[x, y]): px[x, y] = (0, 0, 0, 0)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and g > max(r, b) + 18: px[x, y] = (r, max(r, b), b, a)
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def scale_w(sprite, target_w):
    r = target_w / sprite.width
    return sprite.resize((target_w, max(1, round(sprite.height * r))), Image.LANCZOS)


def codex(imgs, prompt, out_png, log):
    if os.path.exists(out_png):
        os.remove(out_png)
    args = [CODEX, 'exec', '-C', TMP, '-s', 'workspace-write', '--skip-git-repo-check']
    for im in imgs:
        args += ['-i', im]
    args += ['-o', log, prompt]
    subprocess.run(args, stdin=subprocess.DEVNULL, stdout=open(log.replace('-last.txt', '-run.log'), 'w'), stderr=subprocess.STDOUT)
    return os.path.exists(out_png)


def gen_facing(item, facing):
    iid = item['id']; front = os.path.join(CATALOG, f'{iid}.png')
    tw = (item['h'] if facing in ('left', 'right') else item['w']) * DRAW_RES
    raw = f'{TMP}/facing_{iid}_{facing}.png'
    prompt = (
        f"圖1＝這件家具的『正面(front)』參考圖，圖2＝畫風/配色基準。\n"
        f"請畫『同一件家具』（同款式、同材質、同顏色、同細節），{VIEW_SPEC[facing]}\n"
        f"{COLOR}\n畫風：{VIEW}\n"
        "純亮綠 chroma green(#00B140) 背景、單一物件置中、四周留白、不要地面陰影/文字/邊框。\n"
        f"存成 PNG 到 {raw}"
    )
    print(f'  {iid}_{facing} (w={tw}) …', flush=True)
    if not codex([front, ANCHOR], prompt, raw, f'{TMP}/facing_{iid}_{facing}-last.txt'):
        print(f'    FAIL {iid}_{facing}（看 log；401 重跑）', flush=True); return False
    sp = scale_w(chroma_trim(Image.open(raw)), tw)
    sp.save(os.path.join(OUT, f'{iid}_{facing}.png'))
    return True


def redraw_front(item):
    iid = item['id']; tw = item['w'] * DRAW_RES
    raw = f'{TMP}/front_{iid}.png'
    prompt = (
        f"圖1＝畫風/配色基準。請畫昭和喫茶家具：{item['name']}——{item['desc']}。\n"
        f"這是『桌本體、絕對不要畫任何椅子』。footprint 佔地約寬{item['w']}比深{item['h']}。\n"
        f"{COLOR}\n畫風：{VIEW}\n"
        "純亮綠 chroma green(#00B140) 背景、單一物件置中、不要椅子/地面陰影/文字。\n"
        f"存成 PNG 到 {raw}"
    )
    print(f'  redraw front {iid} (w={tw}) …', flush=True)
    if not codex([ANCHOR], prompt, raw, f'{TMP}/front_{iid}-last.txt'):
        print(f'    FAIL front {iid}', flush=True); return False
    sp = scale_w(chroma_trim(Image.open(raw)), tw)
    sp.save(os.path.join(OUT, f'{iid}.png'))
    return True


if __name__ == '__main__':
    os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    args = sys.argv[1:]
    if args and args[0] == '--front':
        for iid in args[1:]:
            redraw_front(ITEM[iid])
    else:
        ids = [i['id'] for i in DATA['items'] if i.get('facings')] if (not args or args[0] == 'all') else args
        for iid in ids:
            it = ITEM[iid]
            for f in it.get('facings', []):
                if f == 'front':
                    continue
                gen_facing(it, f)
    print('done', flush=True)
