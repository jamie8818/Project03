import type { PeerSummary, UserId, UserState } from '../types.ts';
import { introOrder } from '../data/kana.ts';
import { addDays, tpeToday } from './dates.ts';
import { seededCard } from './srs.ts';

export const USERS: { id: UserId; name: string }[] = [
  { id: 'jj', name: 'JJ' },
  { id: 'yaxuan', name: '亞軒' },
];

const stateKey = (u: UserId) => `nng:state:${u}`;

export function initState(user: UserId, known: { hira: boolean; kata: boolean }, today: string = tpeToday()): UserState {
  const state: UserState = {
    user,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    streak: 0,
    lastDoneDate: '',
    totalMinutes: 0,
    sessionsDone: 0,
    knownScripts: known,
    newPerDay: 5,
    cards: {},
    vocab: {},
    phraseIdx: 0,
    xp: 0,
    sprintBest: 0,
    maxCombo: 0,
    achievements: [],
    duel: { w: 0, l: 0, streak: 0, lastCounted: '' },
    puddings: {},
    coins: 0,
    wornBadge: '',
    bossClaimed: '',
    minigames: { dictBest: 0, pairsBest: 0, clozeBest: 0 },
    claimedStreaks: [],
    shiftBest: 0,
    goal: { level: 'N4', date: '2027-07-04' },
  };
  // 已熟的字系當作背過，到期日錯開兩週輪一遍驗證，不用從頭學
  for (const script of ['hira', 'kata'] as const) {
    if (!known[script]) continue;
    introOrder(script).forEach((id, i) => {
      state.cards[id] = seededCard(id, today, (i % 14) + 1);
    });
  }
  return state;
}

/** 舊版狀態補齊新欄位（P0 沒有 vocab、R2 前沒有 xp/成就/對決） */
export function normalize(s: UserState | null): UserState | null {
  if (!s) return s;
  s.cards ??= {}; // 缺 cards 的壞檔／手工 seed 會讓成就計算白屏整站（xp.ts Object.keys）
  s.vocab ??= {};
  s.xp ??= 0;
  s.sprintBest ??= 0;
  s.maxCombo ??= 0;
  s.achievements ??= [];
  s.duel ??= { w: 0, l: 0, streak: 0, lastCounted: '' };
  s.puddings ??= {};
  s.coins ??= 0;
  s.wornBadge ??= '';
  s.bossClaimed ??= '';
  s.minigames ??= { dictBest: 0, pairsBest: 0, clozeBest: 0 };
  s.claimedStreaks ??= [];
  s.lessonsPassed ??= [];
  s.goal ??= { level: 'N4', date: '2027-07-04' }; // 舊檔沿用原寫死目標（JJ 2026/7 拍板 N4）
  // 數值欄位一律 coerce 非有限值→0（治好早期壞掉的 NaN 存檔）
  s.shiftBest = Number.isFinite(s.shiftBest) ? s.shiftBest : 0;
  s.coins = Number.isFinite(s.coins) ? s.coins : 0;
  s.xp = Number.isFinite(s.xp) ? s.xp : 0;
  return s;
}

export function loadLocal(user: UserId): UserState | null {
  try {
    const raw = localStorage.getItem(stateKey(user));
    return normalize(raw ? (JSON.parse(raw) as UserState) : null);
  } catch {
    return null;
  }
}

export function saveLocal(state: UserState): void {
  localStorage.setItem(stateKey(state.user), JSON.stringify(state));
}

export function touch(state: UserState): UserState {
  return { ...state, updatedAt: new Date().toISOString() };
}

/** 完成一輪：累計分鐘、更新 streak（台北日界）、一句往前推。
 *  hour（台北時制 0-23，可注入供測試）記 Tier B 時段旗標：夜貓 0-4／時差清晨 6-9／時差深夜 23。 */
export function completeSession(state: UserState, minutes: number, today: string = tpeToday(), hour?: number): UserState {
  const s = { ...state };
  s.totalMinutes = Math.round((s.totalMinutes + minutes) * 10) / 10;
  s.sessionsDone += 1;
  s.phraseIdx += 1;
  if (s.lastDoneDate !== today) {
    s.streak = s.lastDoneDate === addDays(today, -1) ? s.streak + 1 : 1;
    s.lastDoneDate = today;
  }
  const h = hour ?? Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Taipei' })) % 24;
  const meta = { ...(s.meta ?? {}) };
  if (h <= 4) meta.nightOwl = 1;
  if (h >= 6 && h <= 9) meta.jetEarly = 1;
  if (h === 23) meta.jetLate = 1;
  s.meta = meta;
  return touch(s);
}

/** streak 顯示值：昨天以前斷了就歸零（狀態裡的值等下次完成才重算） */
export function displayStreak(s: Pick<UserState, 'streak' | 'lastDoneDate'>, today: string = tpeToday()): number {
  if (!s.lastDoneDate) return 0;
  if (s.lastDoneDate === today || s.lastDoneDate === addDays(today, -1)) return s.streak;
  return 0;
}

// ── 與 Worker 的同步（last-write-wins，每人單設備所以不會打架） ──

export async function fetchRemote(): Promise<Partial<Record<UserId, UserState>>> {
  const res = await fetch('/api/progress');
  if (!res.ok) throw new Error(`progress ${res.status}`);
  return (await res.json()) as Partial<Record<UserId, UserState>>;
}

export async function pushRemote(state: UserState): Promise<void> {
  await fetch('/api/progress', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: state.user, state }),
  });
}

/** 頁面切背景/關閉時的即刻推送：sendBeacon 在 unload 中仍保證送出（回 false＝排不進佇列，
 *  退回 keepalive fetch）。堵「debounce 1.5s 內關頁→換裝置」的短暫沒存到視窗。 */
export function pushRemoteNow(state: UserState): void {
  const body = JSON.stringify({ user: state.user, state });
  try {
    if (navigator.sendBeacon?.('/api/progress', new Blob([body], { type: 'application/json' }))) return;
  } catch { /* 某些瀏覽器對 Blob type 挑剔，退回 fetch */ }
  fetch('/api/progress', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
}

/** 開站：拿遠端跟本機比 updatedAt，新的贏 */
export function newer(a: UserState | null, b: UserState | null): UserState | null {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export function summarize(s: UserState): PeerSummary {
  return {
    streak: s.streak,
    lastDoneDate: s.lastDoneDate,
    totalMinutes: s.totalMinutes,
    sessionsDone: s.sessionsDone,
    updatedAt: s.updatedAt,
  };
}
