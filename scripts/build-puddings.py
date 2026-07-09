#!/usr/bin/env python3
"""從 docs/puddings.json（手維護的布丁圖鑑資料）產出 src/data/puddings.gen.ts。
改口味內容／新增口味改 docs/puddings.json 再重跑本腳本；gen.ts 是產物，別手改。
用法：python3 scripts/build-puddings.py

schema（docs/puddings.json，每筆一款布丁）：
  id      唯一 snake_case id（現有 24 款遷自 src/data/fun.ts PUDDINGS，id 不變＝存檔相容）
  name    中文名稱（唯一，「XX布丁」）
  rarity  N/R/SR/UR 四選一（總分佈約 N50／R30／SR15／UR5）
  hue     CSS hue-rotate 角度，-180~180
  sat     飽和度倍率（可選，省略＝原始飽和度）
  desc    一句話 flavor 文案（4-14 字，既有語氣：畫面句/偶爾自嘲/日語梗/偶爾諧音）
  variant 10 選 1 美術基底（見 VALID_VARIANTS）：deluxe 為 UR 專用
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC_JSON = os.path.join(ROOT, 'docs', 'puddings.json')
GEN_TS = os.path.join(ROOT, 'src', 'data', 'puddings.gen.ts')

VALID_RARITY = {'N', 'R', 'SR', 'UR'}
VALID_VARIANTS = {
    'classic', 'cream', 'cherry', 'sauce', 'layered',
    'parfait', 'mochi', 'dust', 'star', 'deluxe',
}


def esc(s: str) -> str:
    return s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')


def main() -> None:
    with open(SRC_JSON, encoding='utf-8') as f:
        puddings = json.load(f)

    seen_ids = set()
    seen_names = set()
    for i, p in enumerate(puddings):
        for key in ('id', 'name', 'rarity', 'hue', 'desc', 'variant'):
            if key not in p:
                raise SystemExit(f'第 {i} 筆缺欄位 {key!r}：{p}')
        if p['rarity'] not in VALID_RARITY:
            raise SystemExit(f'第 {i} 筆 rarity 不合法：{p["rarity"]!r}（{p["id"]}）')
        if p['variant'] not in VALID_VARIANTS:
            raise SystemExit(f'第 {i} 筆 variant 不合法：{p["variant"]!r}（{p["id"]}）')
        if not (-180 <= p['hue'] <= 180):
            # 既有資料（如 starry: -200）migrate 進來時可能超界，保留不擋；新資料建議守 -180~180
            pass
        if not (4 <= len(p['desc']) <= 14):
            # 現有 24 款遷入時原樣不動，個別句子（如 panda）本來就超出這個建議範圍；只警告不擋
            print(f'⚠️  {p["id"]} desc 長度 {len(p["desc"])} 字，超出建議的 4-14 字：{p["desc"]!r}')
        if p['id'] in seen_ids:
            raise SystemExit(f'重複 id：{p["id"]!r}')
        seen_ids.add(p['id'])
        if p['name'] in seen_names:
            raise SystemExit(f'重複 name：{p["name"]!r}（{p["id"]}）')
        seen_names.add(p['name'])

    rarity_count = {r: sum(1 for p in puddings if p['rarity'] == r) for r in ('N', 'R', 'SR', 'UR')}
    variant_count: dict = {}
    for p in puddings:
        variant_count[p['variant']] = variant_count.get(p['variant'], 0) + 1

    def entry(p: dict) -> str:
        sat_field = f", sat: {p['sat']}" if 'sat' in p else ''
        return (
            f"  {{ id: '{esc(p['id'])}', name: '{esc(p['name'])}', rarity: '{p['rarity']}', "
            f"hue: {p['hue']}{sat_field}, desc: '{esc(p['desc'])}', variant: '{p['variant']}' }},"
        )

    out = []
    out.append('// ⚠️ AUTO-GENERATED — 由 scripts/build-puddings.py 從 docs/puddings.json 產出。手改會被覆蓋。')
    out.append('// 內容改 docs/puddings.json 再重跑：python3 scripts/build-puddings.py')
    out.append(
        f"// 共 {len(puddings)} 款（N {rarity_count['N']} / R {rarity_count['R']} "
        f"/ SR {rarity_count['SR']} / UR {rarity_count['UR']}）"
    )
    out.append('')
    out.append("export type RarityGen = 'N' | 'R' | 'SR' | 'UR';")
    out.append('')
    out.append('// 10 選 1 美術基底：扭蛋/圖鑑/招牌渲染改讀 public/cafe/pudding/<variant>.png')
    out.append('export type PuddingVariant =')
    out.append("  | 'classic' // 經典盤裝")
    out.append("  | 'cream' // 鮮奶油頂")
    out.append("  | 'cherry' // 櫻桃頂")
    out.append("  | 'sauce' // 醬汁瀑布")
    out.append("  | 'layered' // 雙層")
    out.append("  | 'parfait' // 高杯")
    out.append("  | 'mochi' // 白玉點綴")
    out.append("  | 'dust' // 粉末撒頂")
    out.append("  | 'star' // 星型模")
    out.append("  | 'deluxe'; // 豪華全配（UR 專用）")
    out.append('')
    out.append('export interface PuddingGen {')
    out.append('  id: string;')
    out.append('  name: string;')
    out.append('  rarity: RarityGen;')
    out.append('  hue: number; // CSS hue-rotate 角度（🍮 變色）')
    out.append('  sat?: number; // 飽和度倍率')
    out.append('  desc: string;')
    out.append('  variant: PuddingVariant;')
    out.append('}')
    out.append('')
    out.append(f'export const PUDDINGS_GEN: PuddingGen[] = [')
    out.extend(entry(p) for p in puddings)
    out.append('];')
    out.append('')
    out.append('export const PUDDING_GEN_BY_ID: Record<string, PuddingGen> = Object.fromEntries(')
    out.append('  PUDDINGS_GEN.map((p) => [p.id, p]),')
    out.append(');')
    out.append('')

    with open(GEN_TS, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')

    print(
        f'寫入 {GEN_TS}：共 {len(puddings)} 款'
        f'（N {rarity_count["N"]} / R {rarity_count["R"]} / SR {rarity_count["SR"]} / UR {rarity_count["UR"]}）'
    )
    print(f'variant 分佈：{variant_count}')


if __name__ == '__main__':
    main()
