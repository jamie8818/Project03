// 日々日文 Worker：密碼閘門 + KV 進度同步 + 靜態前端（沿用 finlearn 模式）
// mergeBoard 三端共用一份（src/lib/board.ts）；wrangler 預設 esbuild bundle，TS 直接 import。
import { mergeBoard } from '../src/lib/board.ts';

const USERS = ['jj', 'yaxuan'];

async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function authToken(env) {
  return sha256hex(`nihongo-v1:${env.APP_PASSWORD}`);
}

function getCookie(request, name) {
  const h = request.headers.get('cookie') || '';
  const m = h.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

async function isAuthed(request, env) {
  if (!env.APP_PASSWORD) return false; // fail-closed：沒設密碼一律拒絕（npx wrangler secret put APP_PASSWORD）
  return getCookie(request, 'nng_auth') === (await authToken(env));
}

const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

// ── 近期存檔備份：主存檔寫入時順手留「當天快照」bk:<key>:<YYYY-MM-DD>（台北日界），
//    同一天 30 分鐘最多備份一次（metadata.at 節流）、TTL 14 天自動過期＝免清理。
//    回復手順見 docs/kv-backup.md（wrangler get 備份 → put 回原 key）。──
const BK_TTL_S = 60 * 60 * 24 * 14;
const BK_MIN_GAP_MS = 30 * 60e3;
async function backupSnapshot(env, key, value) {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    const bk = `bk:${key}:${today}`;
    const cur = await env.PROGRESS.getWithMetadata(bk);
    if (cur && cur.value !== null && cur.metadata && Date.now() - cur.metadata.at < BK_MIN_GAP_MS) return;
    await env.PROGRESS.put(bk, value, { expirationTtl: BK_TTL_S, metadata: { at: Date.now() } });
  } catch {
    // 備份失敗不影響主寫入
  }
}

// ── 歌詞抓取（B 方案：uta-net → j-lyric，站改版就會失效，屆時退回貼歌詞）──
const UA = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'accept-language': 'ja,zh-TW;q=0.8,en;q=0.6',
};

const stripHtml = (s) =>
  s
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

// Utaten：搜尋用 ?title=（曲名精準搜尋），歌詞在 div.hiragana（先拔掉振假名 rt 再取純文字）
// 2026/7 驗證可用；uta-net 全站防爬、j-lyric 搜尋端點已死，都不用
let lastDebug = '';

async function searchUtaten(q) {
  const sr = await fetch(`https://utaten.com/search?title=${encodeURIComponent(q)}`, { headers: UA });
  lastDebug = `search ${sr.status}`;
  if (!sr.ok) return [];
  const html = await sr.text();
  // 只吃結果表格裡的曲名連結（searchResult__title），不然側欄排行榜的歌會混進來
  const rows = [...html.matchAll(/class="searchResult__title">\s*<a href="(\/lyric\/[^"]+)"[^>]*>([\s\S]{0,150}?)<\/a>/g)]
    .map((m) => ({ href: m[1], text: stripHtml(m[2]).trim() }))
    .filter((r) => r.text && r.text.length < 60);
  lastDebug += ` len=${html.length} rows=${rows.length}`;
  return rows;
}

async function fetchLyricsByTitle(title) {
  try {
    let rows = await searchUtaten(title.trim());
    const tokens = title.trim().split(/\s+/);
    if (rows.length === 0 && tokens.length > 1) rows = await searchUtaten(tokens[0]); // 「歌名 歌手」輸入時退回只搜歌名
    if (rows.length === 0) return null;

    const norm = (s) => s.toLowerCase().replace(/[（(][^）)]*[）)]/g, '').replace(/\s+/g, '');
    const want = norm(tokens[0]);
    const pick = rows.find((r) => norm(r.text) === want) || rows.find((r) => norm(r.text).includes(want)) || rows[0];

    const pr = await fetch(`https://utaten.com${pick.href}`, { headers: UA });
    if (!pr.ok) return null;
    const ph = await pr.text();
    const m = ph.match(/<div class="hiragana"[^>]*>([\s\S]*?)<\/div>/);
    if (!m) return null;
    const lyrics = stripHtml(m[1].replace(/<span class="rt">[^<]*<\/span>/g, '')).replace(/\n{3,}/g, '\n\n').trim();
    if (lyrics.length < 20) return null;

    let songTitle = pick.text.replace(/[（(][^）)]*[）)]\s*$/, '').trim();
    let artist = '';
    const tt = ph.match(/<title>([^<]+)<\/title>/);
    const tm = tt && tt[1].match(/^(.*?)\s*歌詞\s*(.*?)\s*(ふりがな|-)/);
    if (tm) {
      songTitle = tm[1].trim() || songTitle;
      artist = tm[2].trim();
    }
    return { source: 'utaten', title: songTitle, artist, lyrics };
  } catch {
    return null;
  }
}

// ── Claude 標音＋翻譯＋抽單字 → 教材 JSON ──
async function annotateSong(env, { title, artist, lyrics }) {
  const prompt = `你是日文教材編輯，服務台灣的日文初學者。把這首歌做成學習教材。

歌名：${title}
歌手：${artist || '未知'}
歌詞：
${lyrics.slice(0, 4000)}

輸出「嚴格 JSON」（不要 markdown 圍欄、不要多餘文字）：
{"id":"<英數與連字號的短id>","title":"${title}","artist":"...","lines":[{"ruby":[["表層文字","平假名讀音或null"], ...],"zh":"此句繁中翻譯"}],"vocab":[{"jp":"單字（辭書形）","kana":"平假名讀音","zh":"繁中意思"}]}

規則：
- lines 依歌詞逐句（空行跳過）；每句的 ruby 把文字拆段：含漢字的段附平假名讀音，純假名、片假名、標點的段讀音給 null
- ruby 各段串起來必須等於原句
- vocab 挑 10-20 個值得初學者學的實詞，去重
- zh 用台灣用語，簡潔口語`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env.MODEL || 'claude-sonnet-4-6', max_tokens: 16000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  let text = (data.content?.[0]?.text || '').trim();
  text = text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '');
  const song = JSON.parse(text);
  if (!song.title || !Array.isArray(song.lines) || !Array.isArray(song.vocab) || song.lines.length === 0) {
    throw new Error('bad song json');
  }
  song.id = String(song.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '') || `s${Date.now().toString(36)}`;
  return song;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/auth' && request.method === 'POST') {
      const { pw } = await request.json().catch(() => ({}));
      if (!env.APP_PASSWORD) return json({ ok: false, error: 'password not configured' }, 503);
      if (pw !== env.APP_PASSWORD) return json({ ok: false }, 401);
      const token = await authToken(env);
      return json({ ok: true }, 200, {
        'set-cookie': `nng_auth=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`,
      });
    }

    if (path === '/api/me') {
      return json({ authed: await isAuthed(request, env) });
    }

    if (path === '/api/progress' && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const [jj, yaxuan] = await Promise.all(USERS.map((u) => env.PROGRESS.get(`progress:${u}`, 'json')));
      return json({ jj, yaxuan });
    }

    if (path === '/api/progress' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { user, state } = await request.json().catch(() => ({}));
      if (!USERS.includes(user) || !state || state.user !== user || typeof state.updatedAt !== 'string') {
        return json({ error: 'bad request' }, 400);
      }
      // last-write-wins：舊資料不覆蓋新資料（例如換裝置後的殘留 push）
      const existing = await env.PROGRESS.get(`progress:${user}`, 'json');
      if (existing && existing.updatedAt > state.updatedAt) {
        return json({ ok: false, stale: true, serverUpdatedAt: existing.updatedAt }, 409);
      }
      const payload = JSON.stringify(state);
      await env.PROGRESS.put(`progress:${user}`, payload);
      ctx.waitUntil(backupSnapshot(env, `progress:${user}`, payload)); // 備份不擋回應
      return json({ ok: true });
    }

    // ── 伝言板獨立 KV（finding #1 方案B）：留言完全不帶 layout/sign，不再蓋裝潢 ──
    // canonical key＝shop-board；讀時聯集舊位置 shop-decor.board（過渡期舊客戶端仍推那邊）。
    if (path === '/api/shop/board' && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const [own, decor] = await Promise.all([env.PROGRESS.get('shop-board', 'json'), env.PROGRESS.get('shop-decor', 'json')]);
      return json({ board: mergeBoard(own, decor && decor.board) });
    }
    if (path === '/api/shop/board' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') return json({ error: 'bad body' }, 400);
      const [own, decor] = await Promise.all([env.PROGRESS.get('shop-board', 'json'), env.PROGRESS.get('shop-decor', 'json')]);
      const board = mergeBoard(mergeBoard(own, decor && decor.board), body.board);
      const boardJson = JSON.stringify(board);
      await env.PROGRESS.put('shop-board', boardJson);
      ctx.waitUntil(backupSnapshot(env, 'shop-board', boardJson));
      return json({ ok: true, board });
    }

    // ── 共有店鋪裝飾狀態（兩人共編，LWW；board 已移獨立 key，這裡只為相容而聯集回傳） ──
    if (path === '/api/shop' && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const [cur, own] = await Promise.all([env.PROGRESS.get('shop-decor', 'json'), env.PROGRESS.get('shop-board', 'json')]);
      return json({ ...(cur || {}), board: mergeBoard(own, cur && cur.board) });
    }
    if (path === '/api/shop' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') return json({ error: 'bad body' }, 400);
      const cur = (await env.PROGRESS.get('shop-decor', 'json')) || {};
      // stock（各家具已購數量＝花過的金幣）採「各鍵取大值」永不掉單：兩人並發購買不會互相覆蓋，
      // 也不會因某次 push 判定為舊資料就把剛買的弄丟。舊格式 owned: string[] 先遷移成計數。
      // 其餘（招牌/擺放）是呈現用，採 last-write-wins 新的贏。
      const toStock = (s) => (s.stock && typeof s.stock === 'object'
        ? s.stock
        : (s.owned || []).reduce((m, id) => ((m[id] = (m[id] || 0) + 1), m), {}));
      const curStock = toStock(cur);
      const bodyStock = toStock(body);
      const stock = { ...curStock };
      for (const k in bodyStock) stock[k] = Math.max(stock[k] || 0, bodyStock[k]);
      // 伝言板已移獨立 key（方案B）：舊客戶端夾帶的 board 併進 shop-board，shop-decor 本身不再存 board。
      // 注意：KV read-modify-write 非原子，兩請求「同時」寫仍可能掉一方（掉的那端同 session 再 push 會補回；
      // 真要杜絕得上 Durable Object，兩人小站先不做）。
      const own = await env.PROGRESS.get('shop-board', 'json');
      const board = mergeBoard(mergeBoard(own, cur.board), body.board);
      await env.PROGRESS.put('shop-board', JSON.stringify(board));
      const newest = !cur.updatedAt || String(body.updatedAt || '') >= cur.updatedAt ? body : cur;
      // E14 客人自訂台詞：按鍵合併（每人只寫自己的鍵；舊客戶端不帶此欄位＝保留現值不掉資料）
      const guestLines = { ...(cur.guestLines || {}), ...(body.guestLines || {}) };
      const merged = { ...newest, stock, guestLines };
      delete merged.owned; // 清掉舊欄位
      delete merged.board; // board 不再落在 shop-decor
      const mergedJson = JSON.stringify(merged);
      await env.PROGRESS.put('shop-decor', mergedJson);
      ctx.waitUntil(backupSnapshot(env, 'shop-decor', mergedJson));
      return json({ ok: true, saved: true, current: { ...merged, board } });
    }

    // ── 喫茶店黑板（每人一句話，前端負責「練完才看得到」的解鎖） ──
    if (path === '/api/board' && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      return json((await env.PROGRESS.get('board', 'json')) || { jj: null, yaxuan: null });
    }

    if (path === '/api/board' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { user, text } = await request.json().catch(() => ({}));
      if (!USERS.includes(user)) return json({ error: 'bad user' }, 400);
      const board = (await env.PROGRESS.get('board', 'json')) || { jj: null, yaxuan: null };
      board[user] = { text: String(text || '').slice(0, 100), at: new Date().toISOString() };
      await env.PROGRESS.put('board', JSON.stringify(board));
      return json({ ok: true });
    }

    // ── 週間合作 Boss ──
    if (path === '/api/boss' && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const wid = url.searchParams.get('week') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(wid)) return json({ error: 'bad week' }, 400);
      return json((await env.PROGRESS.get(`boss:${wid}`, 'json')) || { dmg: { jj: 0, yaxuan: 0 }, lastAttack: {} });
    }

    if (path === '/api/boss/attack' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { week, user, damage, date } = await request.json().catch(() => ({}));
      if (!USERS.includes(user) || !/^\d{4}-\d{2}-\d{2}$/.test(week || '') || typeof damage !== 'number') {
        return json({ error: 'bad request' }, 400);
      }
      const boss = (await env.PROGRESS.get(`boss:${week}`, 'json')) || { dmg: { jj: 0, yaxuan: 0 }, lastAttack: {} };
      if (boss.lastAttack[user] === date) return json({ error: '今天攻擊過了，明天再來', boss }, 409);
      boss.dmg[user] = (boss.dmg[user] || 0) + Math.max(0, Math.min(60, Math.round(damage)));
      boss.lastAttack[user] = date;
      await env.PROGRESS.put(`boss:${week}`, JSON.stringify(boss));
      return json(boss);
    }

    // ── 每日對決 ──
    if (path === '/api/duel' && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const date = url.searchParams.get('date') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'bad date' }, 400);
      return json((await env.PROGRESS.get(`duel:${date}`, 'json')) || { jj: null, yaxuan: null });
    }

    if (path === '/api/duel' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { date, user, result } = await request.json().catch(() => ({}));
      if (!USERS.includes(user) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || typeof result?.score !== 'number') {
        return json({ error: 'bad request' }, 400);
      }
      const day = (await env.PROGRESS.get(`duel:${date}`, 'json')) || { jj: null, yaxuan: null };
      if (!day[user]) day[user] = result; // 一天只算第一次，重打不覆蓋
      await env.PROGRESS.put(`duel:${date}`, JSON.stringify(day));
      return json(day);
    }

    // ── 戰帖 ──
    if (path === '/api/challenge' && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      return json({ items: (await env.PROGRESS.get('challenges', 'json')) || [] });
    }

    if (path === '/api/challenge' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { id, from, seed, score } = await request.json().catch(() => ({}));
      if (!id || !USERS.includes(from) || !seed || typeof score !== 'number') return json({ error: 'bad request' }, 400);
      let items = (await env.PROGRESS.get('challenges', 'json')) || [];
      if (!items.some((c) => c.id === id)) {
        items.unshift({ id, from, seed, score, at: new Date().toISOString(), reply: null });
        items = items.slice(0, 20);
        await env.PROGRESS.put('challenges', JSON.stringify(items));
      }
      return json({ ok: true });
    }

    if (path === '/api/challenge/reply' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { id, score } = await request.json().catch(() => ({}));
      const items = (await env.PROGRESS.get('challenges', 'json')) || [];
      const it = items.find((c) => c.id === id);
      if (!it) return json({ error: 'not found' }, 404);
      if (!it.reply) it.reply = { score: Number(score) || 0, at: new Date().toISOString() };
      await env.PROGRESS.put('challenges', JSON.stringify(items));
      return json({ ok: true });
    }

    // ── 雲端歌庫（App 內加歌）──
    if (path === '/api/songs' && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      return json({ items: (await env.PROGRESS.get('songs-index', 'json')) || [] });
    }

    if (path.startsWith('/api/songs/') && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const id = path.slice('/api/songs/'.length).replace(/[^a-z0-9-]/g, '');
      const song = await env.PROGRESS.get(`song:${id}`, 'json');
      return song ? json(song) : json({ error: 'not found' }, 404);
    }

    if (path === '/api/song/fetch' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { title } = await request.json().catch(() => ({}));
      if (!title || title.length > 80) return json({ error: 'bad title' }, 400);
      const got = await fetchLyricsByTitle(title.trim());
      return got ? json({ ok: true, ...got }) : json({ ok: false, error: '找不到，貼歌詞吧', debug: lastDebug });
    }

    if (path === '/api/song/create' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { title, artist, lyrics } = await request.json().catch(() => ({}));
      if (!title || !lyrics || lyrics.length < 10) return json({ error: 'bad request' }, 400);

      // 沒設 API key 就走「訂閱通道」：排進佇列，Claude Code 排程會來補工
      if (!env.ANTHROPIC_API_KEY) {
        const queue = (await env.PROGRESS.get('song-queue', 'json')) || [];
        if (queue.length >= 10) return json({ error: '佇列滿了（10 首），等店長消化一下' }, 429);
        const qid = `q${Date.now().toString(36)}`;
        queue.push({ qid, title: title.slice(0, 80), artist: (artist || '').slice(0, 60), lyrics: lyrics.slice(0, 6000), at: new Date().toISOString() });
        await env.PROGRESS.put('song-queue', JSON.stringify(queue));
        return json({ ok: true, queued: true, qid });
      }

      // 有 API key 走即時生成：加每日次數上限，防手滑連點／前端重試迴圈灌爆 Anthropic 帳單。
      // 先扣額度再打 Claude，這樣連續失敗重試也擋得住（花費風險在「打了幾次」不在「成功幾次」）。
      const costKey = `song-cost:${new Date().toISOString().slice(0, 10)}`;
      const usedToday = (await env.PROGRESS.get(costKey, 'json')) || 0;
      if (usedToday >= 20) return json({ error: '今天加歌到上限了（20 首/天），明天再來' }, 429);
      await env.PROGRESS.put(costKey, JSON.stringify(usedToday + 1), { expirationTtl: 172800 });

      let song;
      try {
        song = await annotateSong(env, { title: title.slice(0, 80), artist: (artist || '').slice(0, 60), lyrics });
      } catch (e) {
        return json({ error: `教材生成失敗：${e.message}` }, 502);
      }
      const index = (await env.PROGRESS.get('songs-index', 'json')) || [];
      while (index.some((s) => s.id === song.id)) song.id += 'x';
      index.unshift({ id: song.id, title: song.title, artist: song.artist || '', kv: true });
      await env.PROGRESS.put(`song:${song.id}`, JSON.stringify(song));
      await env.PROGRESS.put('songs-index', JSON.stringify(index.slice(0, 100)));
      return json({ ok: true, id: song.id, title: song.title });
    }

    // 佇列（Claude Code 排程補工用）：領工作 / 交作業
    if (path === '/api/song/queue' && request.method === 'GET') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      return json({ items: (await env.PROGRESS.get('song-queue', 'json')) || [] });
    }

    if (path === '/api/song/complete' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { qid, song } = await request.json().catch(() => ({}));
      if (!qid || !song?.title || !Array.isArray(song.lines) || !Array.isArray(song.vocab) || song.lines.length === 0) {
        return json({ error: 'bad song' }, 400);
      }
      song.id = String(song.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '') || `s${Date.now().toString(36)}`;
      const index = (await env.PROGRESS.get('songs-index', 'json')) || [];
      while (index.some((s) => s.id === song.id)) song.id += 'x';
      index.unshift({ id: song.id, title: song.title, artist: song.artist || '', kv: true });
      await env.PROGRESS.put(`song:${song.id}`, JSON.stringify(song));
      await env.PROGRESS.put('songs-index', JSON.stringify(index.slice(0, 100)));
      const queue = ((await env.PROGRESS.get('song-queue', 'json')) || []).filter((q) => q.qid !== qid);
      await env.PROGRESS.put('song-queue', JSON.stringify(queue));
      return json({ ok: true, id: song.id });
    }

    if (path === '/api/song/delete' && request.method === 'POST') {
      if (!(await isAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
      const { id } = await request.json().catch(() => ({}));
      const index = (await env.PROGRESS.get('songs-index', 'json')) || [];
      await env.PROGRESS.put('songs-index', JSON.stringify(index.filter((s) => s.id !== id)));
      await env.PROGRESS.delete(`song:${id}`);
      return json({ ok: true });
    }

    return env.ASSETS.fetch(request);
  },
};
