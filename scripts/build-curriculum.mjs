#!/usr/bin/env node
// 課綱管線：Notion「日々日文・課綱教材」→ src/data/curriculum.gen.ts
// 用法：NOTION_TOKEN=secret_xxx npm run curriculum
//   token = Notion 內部整合（notion.so/my-integrations 建立後，把「日々日文・課綱教材」資料庫分享給它）
//
// 只吃「狀態＝已上線」的課、按課號排序。忠實鏡像 Notion（規則如助詞路由在 app 端 curriculum.ts 做）。
// 版型缺區塊／表格欄數不對＝fail loud（process.exit(1)），不靜默產壞資料。
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'data', 'curriculum.gen.ts');
const TOKEN_FILE = join(__dirname, '..', '.notion-token.local');

const DATABASE_ID = '58128ff6c80b4df4b103b3e677c5f586';
const NOTION_VERSION = process.env.NOTION_VERSION || '2022-06-28';
// 優先讀環境變數，其次讀 gitignored 的 .notion-token.local（一次貼、之後免再貼）
const TOKEN = process.env.NOTION_TOKEN || (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, 'utf8').trim() : '');

if (!TOKEN) {
  console.error(
    [
      '缺 NOTION_TOKEN。',
      '1. 到 https://www.notion.so/my-integrations 建一個內部整合（存取權杖），複製 secret。',
      '2. 把「日々日文・課綱教材」資料庫（在學習區下）→ ⋯ → 連結 → 加該整合。',
      '3. 把 secret 存進 Project03/.notion-token.local，或用 NOTION_TOKEN=secret_xxx npm run curriculum',
    ].join('\n'),
  );
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    console.error(`Notion API ${res.status} ${path}\n${await res.text()}`);
    process.exit(1);
  }
  return res.json();
};

const plain = (rich = []) => rich.map((r) => r.plain_text ?? '').join('').trim();
const stripCircled = (s) => s.replace(/^[①-⑳]\s*/, '').trim(); // 去開頭 ①②③…

/** 分頁抓某 block 的所有 children */
async function childrenOf(blockId) {
  const out = [];
  let cursor;
  do {
    const q = cursor ? `?start_cursor=${cursor}&page_size=100` : '?page_size=100';
    const data = await api(`/blocks/${blockId}/children${q}`);
    out.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

/** 分頁抓資料庫裡「已上線」的課，按課號排序 */
async function queryLessons() {
  const out = [];
  let cursor;
  do {
    const data = await api(`/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: '狀態', select: { equals: '已上線' } },
        sorts: [{ property: '課號', direction: 'ascending' }],
        start_cursor: cursor,
        page_size: 100,
      }),
    });
    out.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

const prop = (p, name) => p[name];
const errors = [];
const fail = (no, msg) => errors.push(`第${no}課：${msg}`);

/** 把一頁的 top-level blocks 依 H2 切段 */
function sectionize(blocks) {
  const sections = new Map();
  let cur = null;
  for (const b of blocks) {
    if (b.type === 'heading_2') {
      cur = plain(b.heading_2.rich_text);
      sections.set(cur, []);
    } else if (cur) {
      sections.get(cur).push(b);
    }
  }
  return sections;
}

// 用表頭名稱對欄位（標準表＝日文/假名/羅馬音/中文/詞性；敬語課是敬語形/讀音/中文/對應普通形 4 欄）
const COL_ALIASES = {
  jp: ['日文', '尊敬語', '謙讓語', '謙譲語', '丁寧語'],
  kana: ['假名', '讀音', '読音'],
  romaji: ['羅馬音', '罗马音'],
  zh: ['中文', '意思'],
  pos: ['詞性', '词性'],
};
function resolveCols(headerCells) {
  const idx = { jp: -1, kana: -1, romaji: -1, zh: -1, pos: -1 };
  headerCells.forEach((h, i) => {
    for (const key of Object.keys(COL_ALIASES)) {
      if (idx[key] < 0 && COL_ALIASES[key].some((a) => h.includes(a))) idx[key] = i;
    }
  });
  return idx;
}

/** 「本課單字」表 → LessonWord[]（依表頭對欄位，容忍敬語課的變體表頭） */
async function parseWords(blocks, no) {
  const table = blocks.find((b) => b.type === 'table');
  if (!table) return []; // 複習課（如第19課）可無單字表
  const rows = await childrenOf(table.id);
  if (rows.length === 0) return [];
  const header = rows[0].table_row.cells.map((c) => plain(c));
  const col = resolveCols(header);
  if (col.jp < 0) {
    fail(no, `單字表找不到「日文/敬語形」欄，表頭：${header.join(' | ')}`);
    return [];
  }
  const words = [];
  for (const row of rows.slice(1)) {
    const cells = row.table_row.cells.map((c) => plain(c));
    const at = (i) => (i >= 0 && i < cells.length ? cells[i] : '');
    const jp = at(col.jp);
    if (!jp) continue;
    words.push({ jp, kana: at(col.kana) || jp, romaji: at(col.romaji), zh: at(col.zh), pos: at(col.pos) });
  }
  return words;
}

/** 「文法」段 → GrammarPoint[]（### 開新點，📐→公式、⚠️→提醒、含 → 的條目→例句） */
function parseGrammar(blocks, no) {
  const points = [];
  let cur = null;
  const pushExample = (text) => {
    if (!cur || !text.includes('→')) return;
    const [jp, zh] = text.split('→');
    cur.examples.push({ jp: jp.replace(/^[-•]\s*/, '').trim(), zh: (zh || '').trim() });
  };
  for (const b of blocks) {
    if (b.type === 'heading_3') {
      cur = { id: `${no}-${points.length + 1}`, pattern: stripCircled(plain(b.heading_3.rich_text)), formula: [], notes: [], examples: [] };
      points.push(cur);
    } else if (!cur) {
      continue;
    } else if (b.type === 'callout') {
      const icon = b.callout.icon?.emoji ?? '';
      const text = plain(b.callout.rich_text);
      if (icon === '📐') cur.formula.push(text);
      else if (icon === '⚠️') cur.notes.push(text);
    } else if (b.type === 'bulleted_list_item') {
      pushExample(plain(b.bulleted_list_item.rich_text));
    } else if (b.type === 'paragraph') {
      pushExample(plain(b.paragraph.rich_text));
    }
  }
  return points;
}

const prereqFrom = (blocks) => {
  const nums = new Set();
  for (const b of blocks) {
    const t = b.type === 'bulleted_list_item' ? plain(b.bulleted_list_item.rich_text) : b.type === 'paragraph' ? plain(b.paragraph.rich_text) : '';
    for (const m of t.matchAll(/第(\d+)課/g)) nums.add(Number(m[1]));
  }
  return [...nums].sort((a, b) => a - b);
};

const goalsFrom = (blocks) => blocks.filter((b) => b.type === 'bulleted_list_item').map((b) => plain(b.bulleted_list_item.rich_text)).filter(Boolean);

/** 「串起來」情境會話：含 → 的條目→{jp,zh} 逐句。 */
function dialogFrom(blocks) {
  const out = [];
  for (const b of blocks) {
    const t =
      b.type === 'bulleted_list_item' ? plain(b.bulleted_list_item.rich_text) : b.type === 'paragraph' ? plain(b.paragraph.rich_text) : '';
    if (!t.includes('→')) continue;
    const [jp, zh] = t.split('→');
    out.push({ jp: jp.replace(/^[-•]\s*/, '').trim(), zh: (zh || '').trim() });
  }
  return out;
}

/** 「小測」：編號題「題目 — 答案：X」→{q,a}。 */
function quizFrom(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.type !== 'numbered_list_item') continue;
    const t = plain(b.numbered_list_item.rich_text);
    const parts = t.split(/答案[:：]/);
    if (parts.length < 2) continue;
    const q = parts[0].replace(/[—–-]\s*$/, '').trim();
    const a = parts[1].trim();
    if (q && a) out.push({ q, a });
  }
  return out;
}

async function main() {
  console.log('拉課綱清單…');
  const pages = await queryLessons();
  console.log(`已上線 ${pages.length} 課，逐課解析…`);

  const lessons = [];
  for (const page of pages) {
    const p = page.properties;
    const no = prop(p, '課號')?.number;
    const level = prop(p, '級別')?.select?.name;
    const title = plain(prop(p, '標題')?.title);
    const genki = plain(prop(p, 'Genki對應')?.rich_text);
    const sigure = prop(p, '時雨連結')?.url ?? '';
    if (typeof no !== 'number') { fail('?', `${title || page.id} 缺課號`); continue; }
    if (level !== 'N5' && level !== 'N4') fail(no, `級別非 N5/N4：${level}`);

    const blocks = await childrenOf(page.id);
    const sections = sectionize(blocks);
    const S = (name) => sections.get(name) ?? [];
    const Spre = (prefix) => {
      for (const [k, v] of sections) if (k.startsWith(prefix)) return v;
      return [];
    };
    if (!sections.has('本課單字') && !sections.has('文法')) fail(no, '缺「本課單字」與「文法」兩區塊（版型異常）');

    const words = await parseWords(S('本課單字'), no);
    const grammar = parseGrammar(S('文法'), no);
    if (grammar.length === 0) fail(no, '「文法」段沒解析到任何文法點（### 標題缺失？）');
    for (const g of grammar) if (g.formula.length === 0 && g.examples.length === 0) {
      console.warn(`  ⚠️ 第${no}課「${g.pattern}」無公式也無例句，請確認版型`);
    }

    lessons.push({
      no, level, title, genki, sigure,
      goals: goalsFrom(S('學習目標')),
      prereqLessons: prereqFrom(S('開始前你要先會')),
      words, grammar,
      dialog: dialogFrom(Spre('串起來')),
      quiz: quizFrom(Spre('小測')),
    });
    console.log(`  ✓ ${title}（單字 ${words.length}、文法 ${grammar.length}）`);
  }

  lessons.sort((a, b) => a.no - b.no);

  if (errors.length) {
    console.error('\n✗ 版型/資料問題，未寫檔：');
    for (const e of errors) console.error('  - ' + e);
    process.exit(1);
  }

  const header = [
    '// ⚠️ AUTO-GENERATED — 由 scripts/build-curriculum.mjs 從 Notion「日々日文・課綱教材」產生。手改會被覆蓋。',
    '// 重新產生：NOTION_TOKEN=secret_xxx npm run curriculum',
    `// data source: 78d4aca2-b0e1-472b-a5a1-1a13b4821579；產生時間 ${new Date().toISOString()}`,
    "import type { Lesson } from './curriculum.ts';",
    '',
    `export const CURRICULUM_RAW: Lesson[] = ${JSON.stringify(lessons, null, 2)};`,
    '',
  ].join('\n');
  writeFileSync(OUT, header);
  console.log(`\n✓ 寫入 ${OUT}（${lessons.length} 課）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
