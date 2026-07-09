#!/usr/bin/env node
// 歌詞標註管線：txt 歌詞 → 振假名＋單字抽取 JSON → public/data/songs/
// 用法：npm run song -- 歌詞.txt --id lemon --title "Lemon" [--artist "米津玄師"]
// 產出後檢查一下 vocab 的 zh（中文意思）欄，空的自己補或丟給 Claude 補，再部署。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import kuromoji from 'kuromoji';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = join(__dirname, '..', 'public', 'data', 'songs');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const id = opt('id');
const title = opt('title', id);
const artist = opt('artist', '');
if (!file || !id) {
  console.error('用法：npm run song -- 歌詞.txt --id 英文代號 --title "曲名" [--artist "歌手"]');
  process.exit(1);
}

const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const hasKanji = (s) => /[一-龯々]/.test(s);

const tokenizer = await new Promise((resolve, reject) => {
  kuromoji
    .builder({ dicPath: join(__dirname, '..', 'node_modules', 'kuromoji', 'dict') })
    .build((err, tk) => (err ? reject(err) : resolve(tk)));
});

const rawLines = readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const vocabMap = new Map();
const lines = rawLines.map((line) => {
  const tokens = tokenizer.tokenize(line);
  const ruby = tokens.map((t) => [t.surface_form, hasKanji(t.surface_form) && t.reading ? kataToHira(t.reading) : null]);
  for (const t of tokens) {
    const pos = t.pos; // 名詞/動詞/形容詞
    const base = t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form;
    if (!['名詞', '動詞', '形容詞'].includes(pos)) continue;
    if (t.pos_detail_1 === '非自立' || t.pos_detail_1 === '代名詞' || base.length < 2 && !hasKanji(base)) continue;
    if (!vocabMap.has(base)) {
      vocabMap.set(base, { jp: base, kana: t.reading ? kataToHira(t.reading) : base, zh: '' });
    }
  }
  return { ruby, zh: '' };
});

const song = { id, title, artist, lines, vocab: [...vocabMap.values()] };
writeFileSync(join(SONGS_DIR, `${id}.json`), JSON.stringify(song, null, 2));

const indexPath = join(SONGS_DIR, 'index.json');
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : [];
if (!index.some((s) => s.id === id)) index.push({ id, title, artist, file: `${id}.json` });
writeFileSync(indexPath, JSON.stringify(index, null, 2));

console.log(`✅ ${id}.json：${lines.length} 句、${vocabMap.size} 個單字（zh 欄待補），index.json 已更新`);
