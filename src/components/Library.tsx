import { useEffect, useMemo, useState } from 'react';
import type { UserState } from '../types.ts';
import { DIALOGS, type Dialog } from '../data/dialogs.ts';
import { LESSONS } from '../data/curriculum.ts';
import { VOCAB_N5, WORD_BY_ID } from '../data/vocab.ts';
import { newCard, isMastered, isLearning } from '../lib/srs.ts';
import { tpeToday } from '../lib/dates.ts';
import { speakJa, speakSeqJa, stopSpeak } from '../lib/tts.ts';
import { isSong, type Song } from '../lib/song.ts';
import SpeedSlider from './SpeedSlider.tsx';

type Sect = 'talk' | 'song' | 'grammar' | 'words';

interface SongMeta {
  id: string;
  title: string;
  artist: string;
  file?: string; // 內建（static assets）
  kv?: boolean; // App 內加的（雲端 KV）
}

export default function Library({ state, update }: { state: UserState; update: (fn: (s: UserState) => UserState) => void }) {
  const [sect, setSect] = useState<Sect>('talk');
  return (
    <div className="library">
      <div className="seg">
        <button className={sect === 'talk' ? 'on' : ''} onClick={() => setSect('talk')}>會話</button>
        <button className={sect === 'song' ? 'on' : ''} onClick={() => setSect('song')}>歌</button>
        <button className={sect === 'grammar' ? 'on' : ''} onClick={() => setSect('grammar')}>文法</button>
        <button className={sect === 'words' ? 'on' : ''} onClick={() => setSect('words')}>單字</button>
      </div>
      {sect === 'talk' && <Talk />}
      {sect === 'song' && <Songs state={state} update={update} />}
      {sect === 'grammar' && <Grammar />}
      {sect === 'words' && <Words state={state} />}
    </div>
  );
}

// ── 會話 ──

function Talk() {
  const [open, setOpen] = useState<Dialog | null>(null);
  const [romaji, setRomaji] = useState(() => localStorage.getItem('nng:romaji') !== '0');
  useEffect(() => () => stopSpeak(), []);

  if (!open) {
    return (
      <div className="list">
        {DIALOGS.map((d) => (
          <button key={d.id} className="list-item" onClick={() => setOpen(d)}>
            <span className="li-emoji">{d.emoji}</span>
            <span className="li-body">
              <b>{d.title}</b>
              <small>{d.desc}</small>
            </span>
            <span className="li-arrow">→</span>
          </button>
        ))}
        <p className="hint">點一段對話進去，逐句聽＋跟讀</p>
      </div>
    );
  }

  return (
    <div className="dialog-view">
      <div className="view-head">
        <button className="back" onClick={() => { stopSpeak(); setOpen(null); }}>← 返回</button>
        <b>{open.emoji} {open.title}</b>
      </div>
      <div className="view-tools">
        <button className="tool" onClick={() => speakSeqJa(open.lines.map((l) => l.jp))}>▶ 整段連播</button>
        <button className="tool" onClick={stopSpeak}>■ 停止</button>
        <label className="tool-check">
          <input type="checkbox" checked={romaji} onChange={(e) => { setRomaji(e.target.checked); localStorage.setItem('nng:romaji', e.target.checked ? '1' : '0'); }} />
          羅馬音
        </label>
      </div>
      <SpeedSlider />
      <div className="bubbles">
        {open.lines.map((l, i) => (
          <button key={i} className={`bubble ${l.speaker}`} onClick={() => speakJa(l.jp)}>
            <span className="b-jp">{l.jp}</span>
            {l.kana !== l.jp && <span className="b-kana">{l.kana}</span>}
            {romaji && <span className="b-roma">{l.romaji}</span>}
            <span className="b-zh">{l.zh}</span>
          </button>
        ))}
      </div>
      <p className="hint">點任一句重播；跟讀練習：播一句、暫停、自己唸一次</p>
    </div>
  );
}

// ── 歌 ──

function Songs({ state, update }: { state: UserState; update: (fn: (s: UserState) => UserState) => void }) {
  const [index, setIndex] = useState<SongMeta[] | null>(null);
  const [pending, setPending] = useState<{ qid: string; title: string }[]>([]);
  const [song, setSong] = useState<Song | null>(null);
  const [err, setErr] = useState('');

  const loadIndex = () => {
    setErr('');
    Promise.all([
      fetch('/data/songs/index.json').then((r) => r.json()).catch(() => []),
      fetch('/api/songs').then((r) => r.json()).then((d) => d.items ?? []).catch(() => []),
      fetch('/api/song/queue').then((r) => r.json()).then((d) => d.items ?? []).catch(() => []),
    ])
      .then(([staticIdx, kvIdx, queue]) => {
        setIndex([...kvIdx, ...staticIdx]);
        setPending(queue);
      })
      .catch(() => setErr('載入歌單失敗'));
  };
  useEffect(() => {
    loadIndex();
    return () => stopSpeak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSong = async (m: SongMeta) => {
    setErr('');
    try {
      const r = await fetch(m.kv ? `/api/songs/${m.id}` : `/data/songs/${m.file}`);
      if (!r.ok) throw new Error(`song ${r.status}`);
      const raw: unknown = await r.json();
      if (!isSong(raw)) throw new Error('bad song');
      setSong({ ...raw, kv: m.kv });
    } catch {
      setErr('載入歌詞失敗，歌曲可能已移除或登入已失效');
    }
  };

  const removeSong = (id: string) => {
    if (!window.confirm('把這首歌從歌庫移除？（已加入牌組的單字會留著）')) return;
    fetch('/api/song/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`delete ${r.status}`);
        setSong(null);
        loadIndex();
      })
      .catch(() => setErr('移除失敗，請確認連線或重新登入'));
  };

  // 歌詞單字若已在 N5 牌組就用 w: 卡，否則建 v: 卡（內容存進 state.vocab）
  const cardIdFor = (w: { jp: string }) => (WORD_BY_ID[`w:${w.jp}`] ? `w:${w.jp}` : `v:${w.jp}`);

  const addWord = (w: { jp: string; kana: string; zh: string }, src: string) => {
    const id = cardIdFor(w);
    update((s) => {
      if (s.cards[id]) return s;
      const next = { ...s, cards: { ...s.cards, [id]: newCard(id, tpeToday()) } };
      if (id.startsWith('v:')) next.vocab = { ...s.vocab, [id]: { ...w, src } };
      return next;
    });
  };

  if (!index) return <p className="hint">{err || '載入中…'}</p>;

  if (!song) {
    return (
      <div className="list">
        {err && <p className="hint">{err}</p>}
        <AddSong onAdded={loadIndex} />
        {pending.map((q) => (
          <div key={q.qid} className="list-item pending">
            <span className="li-emoji">⏳</span>
            <span className="li-body">
              <b>{q.title}</b>
              <small>店長製作教材中…每小時來做一批，做好自動上架</small>
            </span>
          </div>
        ))}
        {index.map((m) => (
          <button key={m.id} className="list-item" onClick={() => openSong(m)}>
            <span className="li-emoji">🎤</span>
            <span className="li-body">
              <b>{m.title}</b>
              <small>{m.artist}</small>
            </span>
            <span className="li-arrow">→</span>
          </button>
        ))}
      </div>
    );
  }

  const notAdded = song.vocab.filter((w) => !state.cards[cardIdFor(w)]);
  return (
    <div className="song-view">
      <div className="view-head">
        <button className="back" onClick={() => { stopSpeak(); setSong(null); }}>← 返回</button>
        <b>🎤 {song.title}</b>
      </div>
      {err && <p className="hint">{err}</p>}
      <div className="view-tools">
        <button className="tool" onClick={() => speakSeqJa(song.lines.map((l) => l.ruby.map(([t]) => t).join('')))}>▶ 整首唸給你聽</button>
        <button className="tool" onClick={stopSpeak}>■ 停止</button>
      </div>
      <SpeedSlider />
      <div className="lyrics">
        {song.lines.map((l, i) => (
          <button key={i} className="lyric-line" onClick={() => speakJa(l.ruby.map(([t]) => t).join(''))}>
            <span className="l-jp">
              {l.ruby.map(([t, r], j) =>
                r ? (
                  <ruby key={j}>
                    {t}
                    <rt>{r}</rt>
                  </ruby>
                ) : (
                  <span key={j}>{t}</span>
                ),
              )}
            </span>
            {l.zh && <span className="l-zh">{l.zh}</span>}
          </button>
        ))}
      </div>
      {song.kv && (
        <button className="linkish" onClick={() => removeSong(song.id)}>
          把這首歌從歌庫移除
        </button>
      )}
      <div className="song-vocab">
        <div className="sv-head">
          <b>這首歌的單字（{song.vocab.length}）</b>
          {notAdded.length > 0 && (
            <button className="tool" onClick={() => notAdded.forEach((w) => addWord(w, song.title))}>
              ＋全部加入牌組
            </button>
          )}
        </div>
        {song.vocab.map((w) => {
          const added = !!state.cards[cardIdFor(w)];
          return (
            <div key={w.jp} className="sv-row">
              <button className="sv-word" onClick={() => speakJa(w.jp)}>
                <b>{w.jp}</b>
                <small>{w.kana}・{w.zh}</small>
              </button>
              <button className={added ? 'sv-add added' : 'sv-add'} onClick={() => !added && addWord(w, song.title)}>
                {added ? '✓ 已在牌組' : '＋加入'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── App 內加歌（A+B：先試自動抓歌詞，抓不到再貼）──

function AddSong({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [busy, setBusy] = useState<'' | 'fetch' | 'create'>('');
  const [msg, setMsg] = useState('');

  const tryFetch = async () => {
    if (!title.trim() || busy) return;
    setBusy('fetch');
    setMsg('去歌詞站找找…');
    try {
      const r = await fetch('/api/song/fetch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        setTitle(d.title || title);
        if (d.artist) setArtist(d.artist);
        setLyrics(d.lyrics);
        setMsg(`抓到了（${d.source}）！確認歌詞沒錯就按「做成教材」`);
      } else {
        setMsg('自動抓不到這首，從歌詞網站複製貼到下面吧');
      }
    } catch {
      setMsg('連線失敗，直接貼歌詞也行');
    } finally {
      setBusy('');
    }
  };

  const create = async () => {
    if (!title.trim() || lyrics.trim().length < 10 || busy) return;
    setBusy('create');
    setMsg('店長標音＋翻譯中…大概半分鐘，去倒杯水');
    try {
      const r = await fetch('/api/song/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), artist: artist.trim(), lyrics: lyrics.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        setOpen(false);
        setTitle('');
        setArtist('');
        setLyrics('');
        setMsg('');
        if (d.queued) window.alert('已排隊！店長每小時來做一批教材，做好會自動出現在歌單');
        onAdded();
      } else {
        setMsg(d.error || '失敗了，再試一次');
      }
    } catch {
      setMsg('連線失敗，再試一次');
    } finally {
      setBusy('');
    }
  };

  if (!open) {
    return (
      <button className="list-item" onClick={() => setOpen(true)}>
        <span className="li-emoji">➕</span>
        <span className="li-body">
          <b>加一首你們的歌</b>
          <small>輸入歌名自動抓歌詞，店長標音＋翻譯後上架</small>
        </span>
        <span className="li-arrow">→</span>
      </button>
    );
  }

  return (
    <div className="add-song">
      <div className="view-head">
        <button className="back" onClick={() => !busy && setOpen(false)}>← 收起</button>
        <b>➕ 加歌</b>
      </div>
      <input className="as-input" placeholder="歌名（例如：Lemon）" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="view-tools">
        <button className="tool" onClick={tryFetch} disabled={busy !== ''}>
          {busy === 'fetch' ? '搜尋中…' : '🔍 用歌名自動抓歌詞'}
        </button>
      </div>
      <input className="as-input" placeholder="歌手（可空白）" value={artist} onChange={(e) => setArtist(e.target.value)} />
      <textarea
        className="as-textarea"
        placeholder="歌詞貼這裡（自動抓到會幫你填）"
        value={lyrics}
        rows={7}
        onChange={(e) => setLyrics(e.target.value)}
      />
      <button className="primary" onClick={create} disabled={busy !== '' || !title.trim() || lyrics.trim().length < 10}>
        {busy === 'create' ? '製作教材中…' : '做成教材 🍮'}
      </button>
      {msg && <p className="hint">{msg}</p>}
    </div>
  );
}

// ── 文法 ──

function Grammar() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="list">
      <p className="hint">照課綱 {LESSONS.length} 課的文法點；點開看公式與例句。</p>
      {LESSONS.map((l) => (
        <div key={l.no} className="word-cat">
          <div className="wc-title">{l.title}</div>
          {l.grammar.map((g) => {
            const ex = g.examples[0];
            return (
              <div key={g.id} className="gram-item">
                <button className="gram-head" onClick={() => setOpen(open === g.id ? null : g.id)}>
                  <b>{g.pattern}</b>
                </button>
                {open === g.id && (
                  <div className="gram-body">
                    {g.formula.map((f, i) => (
                      <p key={i} className="gram-formula">{f}</p>
                    ))}
                    {ex && (
                      <button className="gram-ex" onClick={() => speakJa(ex.jp)}>
                        🔊 {ex.jp}　{ex.zh}
                      </button>
                    )}
                    {g.notes.map((n, i) => (
                      <p key={i} className="hint">⚠️ {n}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── 單字表 ──

function Words({ state }: { state: UserState }) {
  const byCat = useMemo(() => {
    const m = new Map<string, typeof VOCAB_N5>();
    for (const w of VOCAB_N5) {
      if (!m.has(w.cat)) m.set(w.cat, []);
      m.get(w.cat)!.push(w);
    }
    return [...m.entries()];
  }, []);

  const statusClass = (jp: string) => {
    const c = state.cards[`w:${jp}`];
    if (!c) return '';
    if (isMastered(c)) return ' mastered';
    if (isLearning(c)) return ' learning';
    return '';
  };

  const learned = VOCAB_N5.filter((w) => state.cards[`w:${w.jp}`]).length;
  return (
    <div className="words-view">
      <p className="legend">
        五十音學完後每天自動學 5 個新單字。進度 {learned}/{VOCAB_N5.length}
        　<span className="dot d-learn" /> 學習中　<span className="dot d-master" /> 精熟
      </p>
      {byCat.map(([cat, words]) => (
        <div key={cat} className="word-cat">
          <div className="wc-title">{cat}</div>
          <div className="wc-grid">
            {words.map((w) => (
              <button key={w.jp} className={'word-chip' + statusClass(w.jp)} onClick={() => speakJa(w.jp)}>
                <b>{w.jp}</b>
                <small>{w.zh}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
