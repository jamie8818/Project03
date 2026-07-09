#!/usr/bin/env python3
"""從 docs/shop-lines.json（手維護的店長台詞庫）產出 src/data/shop-lines.gen.ts。
改台詞內容／新增句子改 docs/shop-lines.json 再重跑本腳本；gen.ts 是產物，別手改。
用法：python3 scripts/build-shop-lines.py

schema（docs/shop-lines.json，每筆一句）：
  id      唯一字串 id（原始遷移句 "orig-<pool>-<seq>"；新增句 "new-<seq>"）
  text    台詞原文（原始句一字不動照搬自舊 src/lib/shop.ts SHOP_LINES）
  pose    16 選 1（見 SHOPKEEPER_POSES，shop.ts）
  states  該句可在哪些營業狀態抽到：closed/solo/full 的子集（原 idle 池＝三態全給）
  tags    輔助標記（migrated＝原句遷入；new＝本輪新增；jp＝含假名的日語教學句），engine 不吃這欄
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC_JSON = os.path.join(ROOT, 'docs', 'shop-lines.json')
GEN_TS = os.path.join(ROOT, 'src', 'data', 'shop-lines.gen.ts')

VALID_POSES = {
    'serve', 'idle', 'onion', 'no', 'eat', 'welcome', 'cheer', 'dismay',
    'cat', 'happy', 'think', 'love', 'play', 'cozy', 'statue', 'shock',
}
VALID_STATES = {'closed', 'solo', 'full'}


def esc(s: str) -> str:
    return s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')


def main() -> None:
    with open(SRC_JSON, encoding='utf-8') as f:
        lines = json.load(f)

    seen_ids = set()
    seen_texts = set()
    for i, ln in enumerate(lines):
        for key in ('id', 'text', 'pose', 'states'):
            if key not in ln:
                raise SystemExit(f'第 {i} 筆缺欄位 {key!r}：{ln}')
        if ln['pose'] not in VALID_POSES:
            raise SystemExit(f'第 {i} 筆 pose 不合法：{ln["pose"]!r}（{ln["id"]}）')
        if not ln['states'] or any(s not in VALID_STATES for s in ln['states']):
            raise SystemExit(f'第 {i} 筆 states 不合法：{ln["states"]!r}（{ln["id"]}）')
        if ln['id'] in seen_ids:
            raise SystemExit(f'重複 id：{ln["id"]!r}')
        seen_ids.add(ln['id'])
        if ln['text'] in seen_texts:
            raise SystemExit(f'重複台詞文字：{ln["text"]!r}（{ln["id"]}）')
        seen_texts.add(ln['text'])

    closed = [ln for ln in lines if 'closed' in ln['states']]
    solo = [ln for ln in lines if 'solo' in ln['states']]
    full = [ln for ln in lines if 'full' in ln['states']]

    def entry(ln: dict) -> str:
        return f"{{ text: '{esc(ln['text'])}', pose: '{ln['pose']}' }}"

    def pool_block(name: str, pool: list) -> str:
        rows = ',\n'.join(f'    {entry(ln)}' for ln in pool)
        return f'  {name}: [\n{rows},\n  ],\n' if pool else f'  {name}: [],\n'

    out = []
    out.append('// ⚠️ AUTO-GENERATED — 由 scripts/build-shop-lines.py 從 docs/shop-lines.json 產出。手改會被覆蓋。')
    out.append('// 內容改 docs/shop-lines.json 再重跑：python3 scripts/build-shop-lines.py')
    out.append("import type { Pose } from '../lib/shop.ts';")
    out.append('')
    out.append('export interface ShopLine {')
    out.append('  text: string;')
    out.append('  pose: Pose; // 該句自帶姿勢；poseForLine 優先用這個，猜不到才退回關鍵字表')
    out.append('}')
    out.append('')
    out.append(f'// 共 {len(lines)} 句（closed {len(closed)}／solo {len(solo)}／full {len(full)}，含通用句重複計入）')
    out.append('export const SHOP_LINES_GEN: Record<\'closed\' | \'solo\' | \'full\', ShopLine[]> = {')
    out.append(pool_block('closed', closed).rstrip('\n'))
    out.append(pool_block('solo', solo).rstrip('\n'))
    out.append(pool_block('full', full).rstrip('\n'))
    out.append('};')
    out.append('')

    with open(GEN_TS, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')

    print(f'寫入 {GEN_TS}：共 {len(lines)} 句（closed {len(closed)} / solo {len(solo)} / full {len(full)}）')


if __name__ == '__main__':
    main()
