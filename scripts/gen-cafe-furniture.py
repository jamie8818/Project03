#!/usr/bin/env python3
"""Codex 綠幕「總表」批量生昭和喫茶家具：一張 sheet 多件、吃錨圖定裝、生完自動切圖。
- 讀 docs/cafe-catalog.json 分 sheet；每 sheet 組一張 cols×rows 網格 prompt（順序＝manifest 順序）。
- 錨圖 assets_src/cafe/anchor-booth.png 做 -i 保持風格一致（C 清脆像素）。
- 綠幕輸出 /tmp/cafe-gen/sheet_<name>.png → 呼叫 slice-cafe-sheets.py 切成透明 PNG。
用法：python3 scripts/gen-cafe-furniture.py [sheet ...]   # 省略＝全部
需求：Codex.app＋ChatGPT 訂閱登入。踩過的坑：codex exec 一定 < /dev/null；401 就重跑該 sheet。
"""
import os, sys, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(ROOT, 'docs', 'cafe-catalog.json')
ANCHOR = os.path.join(ROOT, 'assets_src', 'cafe', 'anchor-furniture.png')  # v2 正交正面錨圖
TMP = '/tmp/cafe-gen'
CODEX = '/Applications/Codex.app/Contents/Resources/codex'
if not os.path.exists(CODEX):
    import shutil
    CODEX = shutil.which('codex') or os.path.expanduser('~/.local/opt/node/bin/codex')

# 各 sheet 網格（要和 slice-cafe-sheets.py 的 GRID 一致）
GRID = {
    'seating': (4, 2), 'counter': (3, 2), 'lightwall': (3, 2), 'rug': (3, 2), 'surface': (3, 2),
    # 22 件新家具（wishlist 🆕）批次，各自獨立 sheet，避免跟舊 sheet 混格
    'seating2': (3, 2), 'counter2': (2, 2), 'wall2': (3, 2), 'rug2': (2, 1), 'surface2': (3, 2),
    # wishlist v2 首波 15 件，各自獨立 sheet
    'furniture3': (4, 2), 'surface3': (3, 2), 'wall3': (3, 1),
    # wishlist v2 第二波 20 件，各自獨立 sheet（依 z 分組：furniture/wall/rug/surface）
    'furniture4': (3, 3), 'wall4': (2, 2), 'rug4': (3, 1), 'surface4': (2, 2),
}

DATA = json.load(open(MANIFEST))
STYLE = DATA['style']
PAL = DATA['palette']


def view_for(sheet):
    """依該 sheet 裡第一件的 z 決定視角 prompt（比硬編 sheet 名更泛用，新 sheet 不用再改這裡）。"""
    its = items_of(sheet)
    z = its[0]['z'] if its else 'furniture'
    if z == 'rug':
        return DATA['view_rug']
    if z == 'wall':
        return DATA['view_wall']
    return DATA['view_furniture']  # furniture/surface＝淺假3D 立面（含負面提示）
COLORLINE = ('配色嚴格用這組色票：胡桃木%(walnut)s、喫茶綠絨%(velvet)s、酒紅%(burgundy)s、黃銅金%(brass)s、'
             '奶油%(cream)s、描邊深%(espresso)s。' % PAL)


def items_of(sheet):
    return [it for it in DATA['items'] if it['sheet'] == sheet]


def build_prompt(sheet):
    its = items_of(sheet)
    cols, rows = GRID[sheet]
    lines = []
    for n, it in enumerate(its, 1):
        lines.append(f"格{n}｜{it['name']}：{it['desc']}（形狀比例約寬{it['w']}比高{it['h']}）")
    grid_desc = '、'.join(f'格{i+1}' for i in range(len(its)))
    tail = f"；其餘格子留空（純綠背景）" if len(its) < cols * rows else ""
    return (
        "圖1（anchor-booth.png）＝畫風與配色的唯一定裝基準（一張墨綠絨布卡座）。"
        "你要畫的每一件都必須是同一間昭和復古喫茶店、同一套畫風、同一組色票，像同一組素材包。\n"
        f"請畫一張『{cols}×{rows} 規則網格』的家具總表：每一格放一件家具，"
        f"由左到右、由上到下依序為（{grid_desc}{tail}）：\n"
        + '\n'.join(lines) + '\n'
        f"{COLORLINE}\n"
        f"畫風：{STYLE}\n"
        f"每件的視角：{view_for(sheet)}\n"
        "背景填滿『純亮綠色 chroma green（約 #00B140）』（含格與格之間），"
        "每件家具置中、彼此之間留明顯間距不要相黏、不要畫格線/邊框/文字/標籤/地面陰影。\n"
        f"把最終成品存成 PNG 到路徑：{TMP}/sheet_{sheet}.png"
    )


def gen(sheet):
    os.makedirs(TMP, exist_ok=True)
    out = f'{TMP}/sheet_{sheet}.png'
    if os.path.exists(out):
        os.remove(out)
    prompt = build_prompt(sheet)
    print(f'== gen sheet_{sheet} ({len(items_of(sheet))} 件) ==', flush=True)
    subprocess.run(
        [CODEX, 'exec', '-C', TMP, '-s', 'workspace-write', '--skip-git-repo-check',
         '-i', ANCHOR, '-o', f'{TMP}/sheet_{sheet}-last.txt', prompt],
        stdin=subprocess.DEVNULL,
        stdout=open(f'{TMP}/sheet_{sheet}-run.log', 'w'), stderr=subprocess.STDOUT,
    )
    if not os.path.exists(out):
        print(f'  FAIL（看 {TMP}/sheet_{sheet}-run.log；401 就重跑）', flush=True)
        return False
    print('  sheet ok →', out, flush=True)
    subprocess.run([sys.executable, os.path.join(HERE, 'slice-cafe-sheets.py'), sheet])
    return True


if __name__ == '__main__':
    sheets = sys.argv[1:] or list(GRID)
    for s in sheets:
        gen(s)
    print('done', flush=True)
