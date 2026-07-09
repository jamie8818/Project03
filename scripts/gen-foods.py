#!/usr/bin/env python3
"""量產出餐版食物插圖：以 purin.png 為唯一風格基準（雙圖錨定），保證 10 種同一套 C 彩色 Q 版。
每種餵 Codex 內建 gpt-image-2（綠幕→本地去背），存 public/baito/food/<slug>.png。
purin 已生，這裡補其餘 9 種。跑：python3 scripts/gen-foods.py [slug...]（省略＝全部）
"""
import os, sys, shutil, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'baito', 'food')
STYLE = os.path.join(OUT, 'purin.png')
CODEX = shutil.which('codex') or os.path.expanduser('~/.local/opt/node/bin/codex')

FOODS = {
    'coffee': '一杯熱咖啡：白色咖啡杯配小碟，咖啡色液體，杯口飄一點熱氣',
    'cake': '一塊草莓鮮奶油蛋糕：三角形切片，白色鮮奶油＋紅色草莓＋海綿蛋糕夾層，放在小白盤上',
    'tea': '一杯日本綠茶：和風茶杯（湯呑），綠色茶湯',
    'ramen': '一碗日式拉麵：醬油色湯頭＋黃麵＋一片叉燒＋蔥花＋半熟蛋，日式拉麵碗',
    'sandwich': '一份三明治：白吐司對切成三角形，夾生菜與番茄',
    'icecream': '一支冰淇淋甜筒：華夫餅乾甜筒＋香草白色冰淇淋球',
    'bread': '一個麵包：金黃色圓麵包，簡單可愛',
    'juice': '一杯柳橙汁：透明玻璃杯，橘色果汁，插一根吸管',
    'salad': '一碗沙拉：白碗裝，綠生菜＋小番茄＋小黃瓜，色彩繽紛',
}

want = sys.argv[1:] or list(FOODS)
for slug in want:
    desc = FOODS[slug]
    prompt = (
        "圖1是畫風與上色的唯一基準（一顆焦糖布丁），你要畫的東西必須跟它完全同一套風格："
        "一樣的粗黑手繪描邊、一樣的飽和度、一樣的平塗上色與 2–3 階柔和陰影、一樣乾淨可愛的 Q 版感。"
        f"請用這個風格畫【{desc}】。構圖：單一物件置中、正面微俯視、四周留白、透明背景、非像素、"
        "乾淨去背，食物填滿畫面中央約 7 成、大小佔比跟基準圖相近。"
        f"畫面裡不要出現任何文字、logo 或多餘裝飾。請把成品存成 {slug}.png。"
    )
    print(f'=== {slug} ===', flush=True)
    subprocess.run(
        [CODEX, 'exec', '-C', OUT, '-s', 'workspace-write', '--skip-git-repo-check',
         '-i', STYLE, '-o', f'/tmp/food-{slug}.log', prompt],
        stdin=subprocess.DEVNULL,
    )
    print(f'{slug} done', flush=True)
print('ALL FOODS DONE')
