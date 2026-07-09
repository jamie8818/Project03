import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserId, UserState } from './types.ts';
import { USERS, fetchRemote, initState, loadLocal, newer, normalize, pushRemote, saveLocal, touch } from './lib/store.ts';
import { tpeToday } from './lib/dates.ts';
import Gate from './components/Gate.tsx';
import Onboarding from './components/Onboarding.tsx';
import Session from './components/Session.tsx';
import TodayHome from './components/TodayHome.tsx';
import VocabCram from './components/VocabCram.tsx';
import KanaChart from './components/KanaChart.tsx';
import Library from './components/Library.tsx';
import Arena from './components/Arena.tsx';
import Dashboard from './components/Dashboard.tsx';
import { ACHIEVEMENTS, levelInfo, newlyUnlocked } from './lib/xp.ts';
import { COINS } from './data/fun.ts';
import { setSoundOn, sfx, soundOn } from './lib/sounds.ts';

type Tab = 'today' | 'arena' | 'kana' | 'lib' | 'stats';

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserId | null>(() => {
    const u = localStorage.getItem('nng:user');
    return u === 'jj' || u === 'yaxuan' ? u : null;
  });
  const [state, setState] = useState<UserState | null>(null);
  const [peer, setPeer] = useState<UserState | null>(null);
  const [remoteChecked, setRemoteChecked] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [started, setStarted] = useState(false); // 今日課程：從首頁按開始才進 session
  const [sprintMode, setSprintMode] = useState(false);
  const [cramming, setCramming] = useState(false); // 背單字（首頁入口的自選分類速記）
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const [sound, setSound] = useState(soundOn());
  const prevLevel = useRef<number | null>(null);

  // 金鑰隨連結（?k=…）：有就自動登入並收進 localStorage，之後 cookie 掉了也能自我修復
  useEffect(() => {
    (async () => {
      const url = new URL(location.href);
      const k = url.searchParams.get('k') || localStorage.getItem('nng:key');
      if (url.searchParams.get('k')) {
        localStorage.setItem('nng:key', url.searchParams.get('k')!);
        url.searchParams.delete('k');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
      try {
        const me = await fetch('/api/me').then((r) => r.json());
        if (me.authed) return setAuthed(true);
        if (k) {
          const r = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ pw: k }),
          });
          if (r.ok) return setAuthed(true);
        }
        setAuthed(false);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  // 登入＋選人後：本機與遠端比 updatedAt 新的贏，順便抓對方進度
  useEffect(() => {
    if (!authed || !user) return;
    let cancelled = false;
    const local = loadLocal(user);
    setState(local);
    fetchRemote()
      .then((remote) => {
        if (cancelled) return;
        const merged = normalize(newer(remote[user] ?? null, local));
        if (merged) {
          saveLocal(merged);
          setState(merged);
        }
        const other = USERS.find((u) => u.id !== user)!.id;
        setPeer(remote[other] ?? null);
        setOffline(false);
      })
      .catch(() => setOffline(true))
      .finally(() => !cancelled && setRemoteChecked(true));
    return () => {
      cancelled = true;
    };
  }, [authed, user]);

  const schedulePush = useCallback((s: UserState) => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushRemote(s).then(() => setOffline(false)).catch(() => setOffline(true));
    }, 1500);
  }, []);

  const update = useCallback(
    (fn: (s: UserState) => UserState) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = touch(fn(prev));
        saveLocal(next);
        schedulePush(next);
        return next;
      });
    },
    [schedulePush],
  );

  // 成就解鎖偵測：state 變動時檢查，一次入帳＋跳 toast
  useEffect(() => {
    if (!state) return;
    const unlocked = newlyUnlocked(state);
    if (unlocked.length === 0) return;
    const names = unlocked.map((id) => ACHIEVEMENTS.find((a) => a.id === id)!).map((a) => `${a.icon} 成就解鎖：${a.name}（+${COINS.achievement}🪙）`);
    sfx.unlock();
    setToasts((t) => [...t, ...names]);
    update((s) => ({ ...s, achievements: [...s.achievements, ...unlocked], coins: s.coins + unlocked.length * COINS.achievement }));
  }, [state, update]);

  // 升級偵測
  useEffect(() => {
    if (!state) return;
    const lv = levelInfo(state.xp).level;
    if (prevLevel.current !== null && lv > prevLevel.current) {
      sfx.levelup();
      setToasts((t) => [...t, `🆙 升級！Lv.${lv} ${levelInfo(state.xp).title}`]);
    }
    prevLevel.current = lv;
  }, [state]);

  // toast 佇列：一次顯示一則，2.2 秒後換下一則
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((q) => q.slice(1)), 2200);
    return () => clearTimeout(t);
  }, [toasts]);

  const refreshPeer = useCallback(() => {
    if (!user) return;
    fetchRemote()
      .then((remote) => {
        const other = USERS.find((u) => u.id !== user)!.id;
        setPeer(remote[other] ?? null);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, [user]);

  if (authed === null) return <div className="center-note">載入中…</div>;
  if (!authed) return <Gate onOk={() => setAuthed(true)} />;

  if (!user) {
    return (
      <Onboarding
        onDone={(u, known) => {
          localStorage.setItem('nng:user', u);
          const existing = loadLocal(u);
          const s = existing ?? initState(u, known);
          saveLocal(s);
          setState(s);
          setUser(u);
        }}
      />
    );
  }

  if (!state || !remoteChecked) return <div className="center-note">同步中…</div>;

  const today = tpeToday();
  const name = USERS.find((u) => u.id === user)!.name;
  const lv = levelInfo(state.xp);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          日々<span className="brand-accent">日文</span>
        </div>
        <div className="topbar-right">
          {offline && <span className="offline-dot" title="離線：進度只存在這台裝置">離線</span>}
          <button
            className="who"
            onClick={() => {
              setSoundOn(!sound);
              setSound(!sound);
            }}
            title="音效開關"
          >
            {sound ? '🔊' : '🔇'}
          </button>
          <span className="who">{name}</span>
        </div>
      </header>
      <div className="lv-strip">
        <span className="lv-badge">Lv.{lv.level} {lv.title}</span>
        <div className="exp-bar">
          <div className="exp-fill" style={{ width: `${lv.pct}%` }} />
        </div>
        <span className="exp-num">{lv.cur}/{lv.need}</span>
      </div>

      <main className="content">
        {tab === 'today' &&
          (started ? (
            <Session
              key={`${user}:${today}`}
              state={state}
              today={today}
              update={update}
              onFinished={refreshPeer}
              sprint={sprintMode}
            />
          ) : cramming ? (
            <VocabCram state={state} today={today} update={update} onExit={() => setCramming(false)} />
          ) : (
            <TodayHome state={state} today={today} onStart={(sp) => { setSprintMode(sp); setStarted(true); }} onCram={() => setCramming(true)} />
          ))}
        {tab === 'arena' && <Arena state={state} today={today} update={update} />}
        {tab === 'kana' && <KanaChart state={state} />}
        {tab === 'lib' && <Library state={state} update={update} />}
        {tab === 'stats' && (
          <Dashboard
            me={state}
            peer={peer}
            today={today}
            offline={offline}
            update={update}
            onSwitchUser={() => {
              localStorage.removeItem('nng:user');
              setUser(null);
              setState(null);
              setRemoteChecked(false);
              setTab('today');
            }}
          />
        )}
      </main>

      <nav className="tabbar">
        <button className={tab === 'today' ? 'on' : ''} onClick={() => { setTab('today'); setStarted(false); setCramming(false); }}>
          <span className="tab-icon">✍️</span>今日練習
        </button>
        <button className={tab === 'arena' ? 'on' : ''} onClick={() => setTab('arena')}>
          <span className="tab-icon">⚔️</span>對戰場
        </button>
        <button className={tab === 'kana' ? 'on' : ''} onClick={() => setTab('kana')}>
          <span className="tab-icon">あ</span>五十音
        </button>
        <button className={tab === 'lib' ? 'on' : ''} onClick={() => setTab('lib')}>
          <span className="tab-icon">📚</span>教材庫
        </button>
        <button
          className={tab === 'stats' ? 'on' : ''}
          onClick={() => {
            setTab('stats');
            refreshPeer();
          }}
        >
          <span className="tab-icon">📈</span>我們的進度
        </button>
      </nav>
      {toasts.length > 0 && <div className="toast">{toasts[0]}</div>}
    </div>
  );
}
