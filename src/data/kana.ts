import type { KanaInfo, Script } from '../types.ts';

// 基礎 46 音＋濁音/半濁音，依行序介紹。片假名由平假名碼位 +0x60 生成。
const ROWS: { row: string; items: [string, string][] }[] = [
  { row: 'あ行', items: [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o']] },
  { row: 'か行', items: [['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko']] },
  { row: 'さ行', items: [['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so']] },
  { row: 'た行', items: [['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to']] },
  { row: 'な行', items: [['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no']] },
  { row: 'は行', items: [['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho']] },
  { row: 'ま行', items: [['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo']] },
  { row: 'や行', items: [['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo']] },
  { row: 'ら行', items: [['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro']] },
  { row: 'わ行', items: [['わ', 'wa'], ['を', 'wo'], ['ん', 'n']] },
  { row: 'が行', items: [['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go']] },
  { row: 'ざ行', items: [['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo']] },
  { row: 'だ行', items: [['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do']] },
  { row: 'ば行', items: [['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo']] },
  { row: 'ぱ行', items: [['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po']] },
];

export const BASE_ROW_COUNT = 10; // 前 10 行是基礎 46 音，之後是濁音/半濁音

function toKatakana(hira: string): string {
  return String.fromCharCode(hira.charCodeAt(0) + 0x60);
}

function buildScript(script: Script): KanaInfo[] {
  const out: KanaInfo[] = [];
  for (const { row, items } of ROWS) {
    for (const [h, romaji] of items) {
      const kana = script === 'hira' ? h : toKatakana(h);
      out.push({ id: `${script === 'hira' ? 'h' : 'k'}:${kana}`, kana, romaji, script, row });
    }
  }
  return out;
}

export const HIRAGANA: KanaInfo[] = buildScript('hira');
export const KATAKANA: KanaInfo[] = buildScript('kata');
export const ALL_KANA: KanaInfo[] = [...HIRAGANA, ...KATAKANA];

export const KANA_BY_ID: Record<string, KanaInfo> = Object.fromEntries(ALL_KANA.map((k) => [k.id, k]));

/** 依行分組（畫五十音表用） */
export function rowsOf(script: Script): { row: string; items: KanaInfo[] }[] {
  const list = script === 'hira' ? HIRAGANA : KATAKANA;
  const map = new Map<string, KanaInfo[]>();
  for (const k of list) {
    if (!map.has(k.row)) map.set(k.row, []);
    map.get(k.row)!.push(k);
  }
  return [...map.entries()].map(([row, items]) => ({ row, items }));
}

/** 介紹順序：指定字系的基礎音 → 濁音；每個新字都照這個順序進牌組 */
export function introOrder(script: Script): string[] {
  const list = script === 'hira' ? HIRAGANA : KATAKANA;
  return list.map((k) => k.id);
}

/** 易混淆組（外觀相似），學到其中兩個以上才會出對比題 */
export const LOOKALIKE_GROUPS: string[][] = [
  // 平假名
  ['h:ね', 'h:れ', 'h:わ'],
  ['h:ぬ', 'h:め'],
  ['h:る', 'h:ろ'],
  ['h:は', 'h:ほ'],
  ['h:き', 'h:さ'],
  ['h:こ', 'h:た'],
  ['h:あ', 'h:お'],
  ['h:い', 'h:り'],
  // 片假名
  ['k:シ', 'k:ツ'],
  ['k:ソ', 'k:ン'],
  ['k:ク', 'k:ワ', 'k:フ'],
  ['k:コ', 'k:ユ'],
  ['k:チ', 'k:テ'],
  ['k:ナ', 'k:メ'],
  ['k:ウ', 'k:ワ'],
];
