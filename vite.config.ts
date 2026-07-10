import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { mergeBoard, type BoardMsgBase } from './src/lib/board.ts';

// 開發模式：模擬 Worker 的 /api/*（記憶體假資料，重啟即清空）
function devApi(): Plugin {
  const store: Record<string, unknown> = {};
  const duels: Record<string, { jj: unknown; yaxuan: unknown }> = {};
  let challenges: { id: string; from: string; seed: string; score: number; at: string; reply: unknown }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readBody = (req: import('node:http').IncomingMessage): Promise<any> =>
    new Promise((resolve) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
      });
    });
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        const send = (obj: unknown) => {
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(obj));
        };
        if (url.startsWith('/api/auth')) {
          res.setHeader('set-cookie', 'nng_auth=dev; Path=/; Max-Age=31536000');
          return send({ ok: true });
        }
        if (url.startsWith('/api/me')) return send({ authed: true });
        if (url.startsWith('/api/boss/attack')) {
          void readBody(req).then((b: { week?: string; user?: string; damage?: number; date?: string }) => {
            const key = `boss:${b.week}`;
            const boss = (store[key] as { dmg: Record<string, number>; lastAttack: Record<string, string> }) ?? { dmg: { jj: 0, yaxuan: 0 }, lastAttack: {} };
            if (boss.lastAttack[b.user!] === b.date) { res.statusCode = 409; return send({ error: '今天攻擊過了', boss }); }
            boss.dmg[b.user!] = (boss.dmg[b.user!] || 0) + (b.damage ?? 0);
            boss.lastAttack[b.user!] = b.date!;
            store[key] = boss;
            send(boss);
          });
          return;
        }
        if (url.startsWith('/api/boss')) {
          const wk = new URL(url, 'http://x').searchParams.get('week');
          return send(store[`boss:${wk}`] ?? { dmg: { jj: 0, yaxuan: 0 }, lastAttack: {} });
        }
        // 伝言板獨立 KV（finding #1 方案B；同 worker）：canonical＝shop-board，讀時聯集舊位置
        const asMsgs = (v: unknown) => (Array.isArray(v) ? (v as BoardMsgBase[]) : []);
        const boardUnion = (extra?: unknown) =>
          mergeBoard(
            mergeBoard(asMsgs(store['shop-board']), asMsgs(((store['shop-decor'] as Record<string, unknown>) ?? {}).board)),
            asMsgs(extra),
          );
        if (url.startsWith('/api/shop/board')) {
          if (req.method === 'POST') {
            void readBody(req).then((b: { board?: unknown }) => {
              const board = boardUnion(b.board);
              store['shop-board'] = board;
              send({ ok: true, board });
            });
            return;
          }
          return send({ board: boardUnion() });
        }
        if (url.startsWith('/api/shop')) {
          if (req.method === 'POST') {
            void readBody(req).then((b: Record<string, unknown>) => {
              const cur = (store['shop-decor'] as Record<string, unknown>) ?? {};
              const toStock = (s: Record<string, unknown>): Record<string, number> =>
                s.stock && typeof s.stock === 'object'
                  ? (s.stock as Record<string, number>)
                  : ((s.owned as string[]) ?? []).reduce<Record<string, number>>((m, id) => ((m[id] = (m[id] || 0) + 1), m), {});
              const stock = { ...toStock(cur) };
              const bs = toStock(b);
              for (const k in bs) stock[k] = Math.max(stock[k] || 0, bs[k]);
              // 舊客戶端夾帶的 board 併進 shop-board；shop-decor 不再存 board（同 worker）
              const board = boardUnion(b.board);
              store['shop-board'] = board;
              // E14 客人自訂台詞按鍵合併（同 worker）
              const guestLines = { ...((cur.guestLines as Record<string, string>) ?? {}), ...((b.guestLines as Record<string, string>) ?? {}) };
              const merged = { ...b, stock, guestLines };
              delete (merged as Record<string, unknown>).owned;
              delete (merged as Record<string, unknown>).board;
              store['shop-decor'] = merged;
              send({ ok: true, saved: true, current: { ...merged, board } });
            });
            return;
          }
          return send({ ...((store['shop-decor'] as Record<string, unknown>) ?? {}), board: boardUnion() });
        }
        if (url.startsWith('/api/board')) {
          if (req.method === 'POST') {
            void readBody(req).then((b: { user?: string; text?: string }) => {
              store[`board:${b.user}`] = { text: b.text ?? '', at: new Date().toISOString() };
              send({ ok: true });
            });
            return;
          }
          return send({ jj: store['board:jj'] ?? null, yaxuan: store['board:yaxuan'] ?? null });
        }
        if (url === '/api/song/fetch' && req.method === 'POST') {
          void readBody(req).then((b: { title?: string }) => {
            send({ ok: true, source: 'dev-mock', title: b.title || '測試曲', artist: '開發模式', lyrics: '夢を見た\n君と歌う夢' });
          });
          return;
        }
        if (url === '/api/song/create' && req.method === 'POST') {
          void readBody(req).then((b: { title?: string; artist?: string; lyrics?: string }) => {
            const id = `dev${Object.keys(store).length}`;
            const lines = (b.lyrics || '').split('\n').filter(Boolean).map((l: string) => ({ ruby: [[l, null]], zh: '（開發模式不翻譯）' }));
            store[`song:${id}`] = { id, title: b.title, artist: b.artist || '', lines, vocab: [{ jp: '夢', kana: 'ゆめ', zh: '夢' }] };
            const idx = (store['songs-index'] as unknown[]) ?? [];
            (idx as { id: string }[]).unshift({ id, title: b.title || id, artist: b.artist || '', kv: true } as never);
            store['songs-index'] = idx;
            setTimeout(() => send({ ok: true, id }), 800);
          });
          return;
        }
        if (url === '/api/song/delete' && req.method === 'POST') {
          void readBody(req).then((b: { id?: string }) => {
            store['songs-index'] = ((store['songs-index'] as { id: string }[]) ?? []).filter((s) => s.id !== b.id);
            delete store[`song:${b.id}`];
            send({ ok: true });
          });
          return;
        }
        if (url.startsWith('/api/songs/')) {
          const id = url.slice('/api/songs/'.length);
          return send(store[`song:${id}`] ?? { error: 'not found' });
        }
        if (url.startsWith('/api/songs')) return send({ items: store['songs-index'] ?? [] });
        if (url.startsWith('/api/duel')) {
          const date = new URL(url, 'http://x').searchParams.get('date') || '';
          if (req.method === 'POST') {
            void readBody(req).then((b: { date?: string; user?: string; result?: unknown }) => {
              const day = duels[b.date || ''] ?? { jj: null, yaxuan: null };
              if (b.user === 'jj' || b.user === 'yaxuan') {
                if (!day[b.user]) day[b.user] = b.result;
              }
              duels[b.date || ''] = day;
              send(day);
            });
            return;
          }
          return send(duels[date] ?? { jj: null, yaxuan: null });
        }
        if (url.startsWith('/api/challenge/reply')) {
          void readBody(req).then((b: { id?: string; score?: number }) => {
            const it = challenges.find((c) => c.id === b.id);
            if (it && !it.reply) it.reply = { score: b.score ?? 0, at: new Date().toISOString() };
            send({ ok: true });
          });
          return;
        }
        if (url.startsWith('/api/challenge')) {
          if (req.method === 'POST') {
            void readBody(req).then((b: { id?: string; from?: string; seed?: string; score?: number }) => {
              if (b.id && !challenges.some((c) => c.id === b.id)) {
                challenges.unshift({ id: b.id, from: b.from || 'jj', seed: b.seed || b.id, score: b.score ?? 0, at: new Date().toISOString(), reply: null });
                challenges = challenges.slice(0, 20);
              }
              send({ ok: true });
            });
            return;
          }
          return send({ items: challenges });
        }
        if (url.startsWith('/api/progress')) {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c) => { body += c; });
            req.on('end', () => {
              try {
                const b = JSON.parse(body || '{}');
                if (b.user === 'jj' || b.user === 'yaxuan') store[b.user] = b.state;
              } catch { /* ignore */ }
              send({ ok: true });
            });
            return;
          }
          return send({ jj: store.jj ?? null, yaxuan: store.yaxuan ?? null });
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: '日々日文',
        short_name: '日々日文',
        description: 'JJ × 亞軒的每日 20 分鐘日文練習',
        theme_color: '#6b4a2e',
        background_color: '#faf0da',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 前端 shell＋歌詞 JSON 全快取（離線可練），/api 永遠走網路（進度同步不能吃舊快取）
        globPatterns: ['**/*.{js,css,html,png,json,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\/progress/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: { port: 5193 },
});
