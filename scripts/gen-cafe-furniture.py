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
MANIFEST = os.environ.get('CAFE_MANIFEST') or os.path.join(ROOT, 'docs', 'cafe-catalog.json')
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
    # wishlist v2 第三波 10 件，依 z 分組（furniture/surface 共用 view_furniture 故合併一 sheet）
    'furniture5': (3, 2), 'wall5': (2, 1), 'rug5': (2, 1),
    # JJ 特注「珍藏・私物」9 件，同一 sheet（furniture/surface 共用 view_furniture）
    'personal': (3, 3),
    # 重生批：furniture5 三件畫風/比例修正、personal 四件（公仔單體化＋snowboard 比例）
    'furniture5b': (3, 1), 'personalfix': (2, 2), 'furniture5c': (2, 1), 'furniture5d': (1, 1),
    # 台式復古 8 件＋無厘頭惡搞 7 件（JJ 圈選批，standee_shopkeeper 除外＝PIL 手工合成不進 codex）
    'furniture6': (3, 2), 'furniture7': (3, 2), 'wall6': (1, 1), 'rug6': (1, 1),
    # claw_machine_onion 重生：codex 審核判定蔥不夠像蔥（太像白棒/蠟燭），單件重生強化蔥綠比例
    'furniture7fix': (1, 1),
    # JJ 追加 6 件（楓之谷公仔3隻＋睡褲展示架＋復古電腦桌組＋落地版特斯拉），各自獨立 sheet
    'qfig3': (3, 1), 'pajama1': (1, 1), 'retrodesk1': (1, 1), 'teslafloor1': (1, 1),
    # 台式復古 27 件（wishlist 圈選批）：furniture 分兩張、圓桌獨立一張、tabletop/wall 各一張
    'furniture8': (4, 2), 'furniture8b': (1, 1), 'furniture9': (3, 3), 'surface5': (4, 2), 'wall7': (2, 2),
    # ring_toss_stall 重生：codex 判定第一版像桌上酒瓶陳列，不像套圈圈攤位，單件重生強化竹籤掛獎品
    'furniture9fix': (1, 1),
    # papaya_milk 重生：codex 判定漸層不夠像木瓜牛奶，較像一般果汁，單件重生強化奶橘分層
    'surface5fix': (1, 1),
    # 搞笑惡搞 23 件（JJ 圈選批，category 按自然分類而非 personal）：furniture/surface 分兩張、wall 分兩張、rug 一張
    'gagfurn1': (4, 2), 'gagfurn2': (4, 2), 'gagwall1': (2, 2), 'gagwall2': (2, 2), 'gagrug1': (1, 1),
    # 搞笑惡搞重生批：codex 判定 4 件需修（撲滿太卡通/小費箱字太小/門沒傳達通牆感/鏡子招牌字太小）
    'gagfix1': (2, 2),
    # JJ 特注私藏第二批 7 件（category 全 personal）：furniture/surface 合一張 sheet，wall 獨立一張
    'personal2': (3, 2), 'wall8': (1, 1),
    # tofu_supermarket 重生：codex 判定豆腐本體偏米棕/紙盒感，不夠白，單件重生強化奶白色調＋封膜反光
    'personal2fix': (1, 1),
    # JJ 特注私藏第二批（另一組）6 件（category 全 personal）：furniture/surface 合一張 sheet
    'personal3': (3, 2),
    # personal3 重生：codex 判定 korean_chicken_feet 缺煙霧、yimei_puff 比例過方、character_balloon 比例過矮，3 件單獨重生
    'personal3fix': (3, 1),
    # 日式喫茶 30 件（監工策展定案）：座席9／吧檯7／牆飾5／桌上小物9，依 category 各自獨立 sheet
    'jpcafe_seat': (3, 3), 'jpcafe_counter': (4, 2), 'jpcafe_wall': (3, 2), 'jpcafe_tabletop': (3, 3),
    # cuckoo_clock 重生：codex 判定屋頂小門的小鳥不夠清楚，單件重生強化鳥形輪廓
    'jpcafe_wallfix': (1, 1),
    # 粉圓生態系家具 4 件（JJ 拍板，貓窩/貓跳台/貓碗/逗貓棒立架，furniture+surface 共用 view_furniture 合併一 sheet）
    'catfurn1': (2, 2),
    # E22 每日登入週禮物：熊貓店長無厘頭家具 6 件（furniture/surface 5 件一張、wall 霓虹燈獨立）
    'pandagift1': (3, 2), 'pandawall1': (1, 1), 'pandagift1fix': (2, 1), 'pandagift1fix2': (1, 1),
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
