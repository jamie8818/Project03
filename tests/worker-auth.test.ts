import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { isPublicShellPath } from '../worker/index.js';

const env = () => {
  let assetCalls = 0;
  return {
    value: {
      APP_PASSWORD: 'test-password',
      ASSETS: {
        fetch: async () => {
          assetCalls += 1;
          return new Response('asset', { status: 200 });
        },
      },
    },
    calls: () => assetCalls,
  };
};

const ctx = { waitUntil: () => {} };

async function authCookie(mockEnv: Record<string, unknown>, password = 'test-password') {
  const login = await worker.fetch(new Request('https://example.test/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pw: password }),
  }), mockEnv, ctx);
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie;
}

test('靜態素材閘門：登入 shell 公開，角色圖與歌詞未登入回 401', async () => {
  const mock = env();
  const shell = await worker.fetch(new Request('https://example.test/assets/index-abc.js'), mock.value, ctx);
  assert.equal(shell.status, 200);
  assert.equal(mock.calls(), 1);

  for (const path of ['/cafe/shopkeeper/happy.png', '/sprites/pool/p01.png', '/data/songs/furusato.json']) {
    const denied = await worker.fetch(new Request(`https://example.test${path}`), mock.value, ctx);
    assert.equal(denied.status, 401, path);
  }
  assert.equal(mock.calls(), 1, '受保護素材不應打到 Asset Worker');
  assert.equal(isPublicShellPath('/data/songs/furusato.json'), false);
});

test('靜態素材閘門：登入 cookie 可以讀取受保護素材', async () => {
  const mock = env();
  const cookie = await authCookie(mock.value);

  const asset = await worker.fetch(new Request('https://example.test/cafe/shopkeeper/happy.png', {
    headers: { cookie },
  }), mock.value, ctx);
  assert.equal(asset.status, 200);
  assert.equal(mock.calls(), 1);
});

test('店鋪庫存：兩人真正並發購買時分 key 保存，總數不會互蓋', async () => {
  const data = new Map<string, string>();
  let initialDecorReads = 0;
  let releaseDecorReads!: () => void;
  const bothAtDecor = new Promise<void>((resolve) => { releaseDecorReads = resolve; });
  const progress = {
    async get(key: string, format?: string) {
      if (key === 'shop-decor' && initialDecorReads < 2) {
        initialDecorReads += 1;
        if (initialDecorReads === 2) releaseDecorReads();
        await bothAtDecor;
      }
      const raw = data.get(key);
      if (raw === undefined) return null;
      return format === 'json' ? JSON.parse(raw) : raw;
    },
    async put(key: string, value: string) { data.set(key, value); },
    async getWithMetadata() { return { value: null, metadata: null }; },
  };
  const mockEnv = { APP_PASSWORD: 'test-password', PROGRESS: progress };
  const cookie = await authCookie(mockEnv);
  const payload = (user: 'jj' | 'yaxuan') => ({
    stock: { chair: 2 },
    stockBase: { chair: 1 },
    stockByUser: { [user]: { chair: 1 } },
    sign: '',
    layout: [],
    board: [],
    guestLines: {},
    updatedAt: '2026-07-17T12:00:00.000Z',
  });
  const post = (user: 'jj' | 'yaxuan') => worker.fetch(new Request('https://example.test/api/shop', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(payload(user)),
  }), mockEnv, ctx);

  const [jj, yaxuan] = await Promise.all([post('jj'), post('yaxuan')]);
  assert.equal(jj.status, 200);
  assert.equal(yaxuan.status, 200);

  const current = await worker.fetch(new Request('https://example.test/api/shop', { headers: { cookie } }), mockEnv, ctx);
  const shop = await current.json() as { stock: Record<string, number>; stockByUser: Record<string, Record<string, number>> };
  assert.equal(shop.stock.chair, 3);
  assert.equal(shop.stockByUser.jj.chair, 1);
  assert.equal(shop.stockByUser.yaxuan.chair, 1);
});
