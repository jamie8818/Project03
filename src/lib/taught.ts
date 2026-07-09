// 「已教集合」守門員：唯一真相決定哪些字/文法教過了。
// 鐵律「無教不考」＝所有出題面＋干擾項都過這裡（合約：一個大腦、多個化身）。
// 卡片一旦被 grade()（或種子/加入牌組）就進 state.cards＝視為教過。
import type { UserState, KanaInfo } from '../types.ts';
import { KANA_BY_ID } from '../data/kana.ts';
import { WORD_BY_ID } from '../data/vocab.ts';
import { CURRICULUM_WORDS, CURRICULUM_GRAMMAR, normalizeWordJp } from '../data/curriculum.ts';
import type { GrammarPoint } from '../data/curriculum.ts';

export interface WordContent {
  jp: string;
  kana: string;
  zh: string;
}

/** 卡片是否「教過」＝已進 state.cards（介紹過就算）。守門員唯一真相。 */
export const isTaught = (id: string, state: UserState): boolean => !!state.cards[id];

/** w:/v: 卡的內容：w: 先查課綱、再退回 vocab.ts 尾巴；v: 查使用者歌詞字。 */
export function wordContent(id: string, state: UserState): WordContent | null {
  if (id.startsWith('w:')) {
    const norm = `w:${normalizeWordJp(id.slice(2))}`;
    return CURRICULUM_WORDS[norm] ?? CURRICULUM_WORDS[id] ?? WORD_BY_ID[id] ?? WORD_BY_ID[norm] ?? null;
  }
  if (id.startsWith('v:')) return state.vocab?.[id] ?? null;
  return null;
}

/** 已教的假名（含種子已熟的）。 */
export function taughtKana(state: UserState): KanaInfo[] {
  return Object.keys(state.cards)
    .map((id) => KANA_BY_ID[id])
    .filter((k): k is KanaInfo => !!k);
}

/**
 * 已教的單字（含內容）。
 * forDistractor=true 時排除 v: 歌詞字（歌詞冷字可被考、但不當別人的干擾）。
 */
export function taughtWords(state: UserState, forDistractor = false): WordContent[] {
  const out: WordContent[] = [];
  for (const id of Object.keys(state.cards)) {
    if (!id.startsWith('w:') && !id.startsWith('v:')) continue;
    if (forDistractor && id.startsWith('v:')) continue;
    const w = wordContent(id, state);
    if (w) out.push(w);
  }
  return out;
}

/** 已教的文法點（g: 卡）。 */
export function taughtGrammar(state: UserState): { id: string; point: GrammarPoint }[] {
  const out: { id: string; point: GrammarPoint }[] = [];
  for (const id of Object.keys(state.cards)) {
    if (!id.startsWith('g:')) continue;
    const point = CURRICULUM_GRAMMAR[id]?.point;
    if (point) out.push({ id, point });
  }
  return out;
}
