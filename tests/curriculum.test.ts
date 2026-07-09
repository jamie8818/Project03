import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSONS,
  lessonByNo,
  isVocabWord,
  lessonVocab,
  curriculumWordOrder,
  wordCardId,
  grammarCardId,
  CURRICULUM_WORDS,
  type Lesson,
} from '../src/data/curriculum.ts';

test('種子課綱可載入且按課號排序', () => {
  assert.ok(LESSONS.length >= 1, '至少要有種子第 1 課');
  for (let i = 1; i < LESSONS.length; i++) {
    assert.ok(LESSONS[i].no > LESSONS[i - 1].no, '課號應嚴格遞增');
  }
});

test('第 1 課結構完整：單字、文法、公式都在', () => {
  const l1 = lessonByNo(1)!;
  assert.ok(l1, '找得到第 1 課');
  assert.equal(l1.level, 'N5');
  assert.ok(l1.words.some((w) => w.jp === '私'), '含「私」');
  assert.ok(l1.grammar.length >= 3, '文法點 ≥3');
  assert.ok(l1.grammar[0].formula.length > 0, '文法點有公式');
});

test('isVocabWord：助詞與 〜 接尾不建 w: 卡', () => {
  assert.equal(isVocabWord({ jp: '私', kana: 'わたし', romaji: 'watashi', zh: '我', pos: '代名詞' }), true);
  assert.equal(isVocabWord({ jp: 'が', kana: 'が', romaji: 'ga', zh: '（助詞）', pos: '助詞' }), false);
  assert.equal(isVocabWord({ jp: 'で', kana: 'で', romaji: 'de', zh: '在', pos: '助詞' }), false);
  assert.equal(isVocabWord({ jp: '〜さん', kana: '〜さん', romaji: 'san', zh: '敬稱', pos: '接尾' }), false);
});

test('第 1 課 vocab 濾掉 〜さん', () => {
  const vocab = lessonVocab(lessonByNo(1)!);
  assert.ok(!vocab.some((w) => w.jp === '〜さん'), '〜さん 不進 w: 卡');
  assert.ok(vocab.some((w) => w.jp === '会社員'), '会社員 進 w: 卡');
});

test('curriculumWordOrder：跨課去重、前面課先出、都是 w: id', () => {
  // 內聯 fixture：兩課共用「食べる」，應只出現一次且在第 3 課的位置
  const fixture: Lesson[] = [
    {
      no: 3, level: 'N5', title: 'L3', genki: '', sigure: '', goals: [], prereqLessons: [],
      words: [
        { jp: '食べる', kana: 'たべる', romaji: 'taberu', zh: '吃', pos: '動詞' },
        { jp: 'を', kana: 'を', romaji: 'o', zh: '（助詞）', pos: '助詞' },
      ],
      grammar: [],
    },
    {
      no: 5, level: 'N5', title: 'L5', genki: '', sigure: '', goals: [], prereqLessons: [3],
      words: [{ jp: '食べる', kana: 'たべる', romaji: 'taberu', zh: '吃', pos: '動詞' }],
      grammar: [],
    },
  ];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const l of fixture) for (const w of lessonVocab(l)) {
    const id = wordCardId(w.jp);
    if (!seen.has(id)) { seen.add(id); ids.push(id); }
  }
  assert.deepEqual(ids, ['w:食べる'], '去重＋濾助詞後只剩一張食べる卡');

  // 種子的真實順序：全是 w: 前綴、無重複
  const order = curriculumWordOrder();
  assert.ok(order.every((id) => id.startsWith('w:')), '全部 w: 前綴');
  assert.equal(new Set(order).size, order.length, '無重複');
});

test('CURRICULUM_WORDS：w: id 對得回內容', () => {
  const id = wordCardId('私');
  assert.ok(CURRICULUM_WORDS[id], '私 有內容');
  assert.equal(CURRICULUM_WORDS[id].kana, 'わたし');
});

test('grammarCardId：g: 前綴', () => {
  assert.equal(grammarCardId({ id: '1-2' }), 'g:1-2');
});

test('な形容詞去掉（な）：卡 id 與卡面不含註記尾綴', () => {
  assert.equal(wordCardId('好き（な）'), 'w:好き');
  assert.equal(wordCardId('私'), 'w:私'); // 一般字不受影響
  // 課綱有這課才驗內容（種子只有第 1 課時跳過）
  const suki = CURRICULUM_WORDS['w:好き'];
  if (suki) {
    assert.equal(suki.jp, '好き', '卡面顯示去掉（な）');
    assert.equal(suki.pos, 'な形容詞', 'pos 仍記著な形容詞');
  }
});
