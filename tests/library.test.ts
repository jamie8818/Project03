import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSong } from '../src/lib/song.ts';

const validSong = {
  id: 'demo',
  title: '測試歌',
  artist: '測試歌手',
  lines: [{ ruby: [['日本語', 'にほんご'], ['。', null]], zh: '日文。' }],
  vocab: [{ jp: '日本語', kana: 'にほんご', zh: '日文' }],
};

test('歌詞 schema：完整教材才接受', () => {
  assert.equal(isSong(validSong), true);
  assert.equal(isSong({ ...validSong, lines: [{ ruby: [{}], zh: '壞資料' }] }), false);
  assert.equal(isSong({ ...validSong, vocab: [{ jp: '日本語' }] }), false);
  assert.equal(isSong({ ...validSong, artist: null }), false);
});
