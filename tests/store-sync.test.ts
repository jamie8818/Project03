import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initState, pushRemote, remoteNeedsBackfill } from '../src/lib/store.ts';

test('pushRemote：HTTP 409／500 必須視為失敗，不能回報已同步', async () => {
  const originalFetch = globalThis.fetch;
  const state = initState('jj', { hira: false, kata: false }, '2026-07-17');
  try {
    globalThis.fetch = async () => new Response('{"stale":true}', { status: 409 });
    await assert.rejects(pushRemote(state), /progress push 409/);
    globalThis.fetch = async () => new Response('oops', { status: 500 });
    await assert.rejects(pushRemote(state), /progress push 500/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('remoteNeedsBackfill：本機較新或遠端不存在時要主動補推', () => {
  const remote = initState('jj', { hira: false, kata: false }, '2026-07-17');
  remote.updatedAt = '2026-07-17T10:00:00.000Z';
  const local = { ...remote, updatedAt: '2026-07-17T10:01:00.000Z' };
  assert.equal(remoteNeedsBackfill(remote, local), true);
  assert.equal(remoteNeedsBackfill(null, local), true);
  assert.equal(remoteNeedsBackfill(local, remote), false);
});
