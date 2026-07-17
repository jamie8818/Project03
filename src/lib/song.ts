export interface Song {
  id: string;
  title: string;
  artist: string;
  lines: { ruby: [string, string | null][]; zh: string }[];
  vocab: { jp: string; kana: string; zh: string }[];
  kv?: boolean;
}

/** 外部歌詞 JSON 的完整 schema gate；壞資料不能一路流進畫面才在 .map/.filter 白屏。 */
export function isSong(value: unknown): value is Song {
  if (!value || typeof value !== 'object') return false;
  const song = value as Partial<Song>;
  return typeof song.id === 'string'
    && typeof song.title === 'string'
    && typeof song.artist === 'string'
    && Array.isArray(song.lines)
    && song.lines.every((line) => line
      && typeof line.zh === 'string'
      && Array.isArray(line.ruby)
      && line.ruby.every((part) => Array.isArray(part)
        && typeof part[0] === 'string'
        && (part[1] === null || typeof part[1] === 'string')))
    && Array.isArray(song.vocab)
    && song.vocab.every((word) => word
      && typeof word.jp === 'string'
      && typeof word.kana === 'string'
      && typeof word.zh === 'string');
}
