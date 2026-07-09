// 對決題組：同 seed 必出同題同選項序。預設取固定池（基礎假名＋N5 牌組）供 Arena PK 用；
// 傳入 pool（已教集合）＝單人情境（如神秘客）只考已教（無教不考）。
// ⚠️ Arena（兩人 PK）要無教不考，需傳「兩人課程進度交集」的 pool——屬打工 session 的檔，留 fast-follow。
import { HIRAGANA, KATAKANA } from '../data/kana.ts';
import { VOCAB_N5 } from '../data/vocab.ts';
import type { KanaInfo } from '../types.ts';

export interface DuelPool {
  kanas: KanaInfo[];
  words: { jp: string; kana: string; zh: string }[];
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface DuelQuestion {
  kind: 'kana' | 'word';
  prompt: string; // 顯示的題目（假名或單字）
  sub?: string; // 單字的讀音（答完才顯示）
  answer: string;
  choices: string[];
  speak: string; // TTS 唸什麼
}

// 基礎音池：每字系前 46 個基礎音（不含濁音，兩人剛起步時較公平）
const BASE_KANA = [...HIRAGANA.slice(0, 46), ...KATAKANA.slice(0, 46)];

/**
 * 10 題：5 假名認讀＋5 單字詞義，順序與選項全由 seed 決定。
 * 傳 pool＝只從已教集合出題與取干擾（無教不考）；不傳＝固定池（向後相容 Arena）。
 * 池太小時該題選項自然少於 4 個，仍可作答。
 */
export function duelQuestions(seedStr: string, pool?: DuelPool): DuelQuestion[] {
  const rng = mulberry32(hashSeed(seedStr));
  // 有傳 pool 就完全尊重它（連空池也是＝只考已教）；不傳才用固定全池。
  const kanaSource: KanaInfo[] = pool ? pool.kanas : BASE_KANA;
  const wordSource: { jp: string; kana: string; zh: string }[] = pool ? pool.words : VOCAB_N5;
  const kanas = shuffle(kanaSource, rng).slice(0, 5);
  const words = shuffle(wordSource, rng).slice(0, 5);

  const kanaQs: DuelQuestion[] = kanas.map((k) => {
    const others = shuffle(
      kanaSource.filter((x) => x.script === k.script && x.romaji !== k.romaji).map((x) => x.romaji),
      rng,
    );
    const opts = [...new Set([k.romaji, ...others])].slice(0, 4);
    return { kind: 'kana', prompt: k.kana, answer: k.romaji, choices: shuffle(opts, rng), speak: k.kana };
  });

  const wordQs: DuelQuestion[] = words.map((w) => {
    const others = shuffle(
      [...new Set(wordSource.filter((x) => x.zh !== w.zh).map((x) => x.zh))],
      rng,
    );
    const opts = [w.zh, ...others.slice(0, 3)];
    return { kind: 'word', prompt: w.jp, sub: w.kana, answer: w.zh, choices: shuffle(opts, rng), speak: w.jp };
  });

  return shuffle([...kanaQs, ...wordQs], rng);
}

/** 對決計分：答對 100＋剩餘秒數×5（每題 10 秒） */
export const DUEL_SECONDS = 10;

export function duelPoints(correct: boolean, secondsLeft: number): number {
  return correct ? 100 + Math.max(0, Math.round(secondsLeft)) * 5 : 0;
}
