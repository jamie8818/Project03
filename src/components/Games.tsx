import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { UserState } from '../types.ts';
import { KANA_BY_ID, HIRAGANA, KATAKANA } from '../data/kana.ts';
import { VOCAB_N5 } from '../data/vocab.ts';
import { isLearning } from '../lib/srs.ts';
import { isWordCard, wordInfo } from '../lib/session.ts';
import {
  pickTodayFoods,
  custSprite,
  pickCustomer,
  orderLine,
  buildOrder,
  maxOrderItems,
  orderPhrase,
  type FoodItem,
  type CustAction,
  type OrderMode,
  type OrderLine,
} from '../data/serving.ts';
import { courseProgress } from '../lib/course.ts';
import { speakJa } from '../lib/tts.ts';
import { sfx } from '../lib/sounds.ts';
import { COINS } from '../data/fun.ts';
import Buddy from './Buddy.tsx';

type Update = (fn: (s: UserState) => UserState) => void;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 聽寫（10 題）：用耳朵選字 ──

interface DictQ {
  speak: string;
  answer: string;
  choices: string[];
  isWord: boolean;
}

function buildDictation(state: UserState): DictQ[] {
  const learned = Object.values(state.cards).filter((c) => isLearning(c));
  const kanaPool = learned.filter((c) => !isWordCard(c.id)).map((c) => KANA_BY_ID[c.id]).filter(Boolean);
  const wordPool = learned
    .filter((c) => isWordCard(c.id))
    .map((c) => wordInfo(c.id, state))
    .filter((w): w is NonNullable<typeof w> => !!w);

  const qs: DictQ[] = [];
  for (const k of shuffle(kanaPool).slice(0, wordPool.length >= 4 ? 6 : 10)) {
    const others = shuffle(kanaPool.filter((x) => x.kana !== k.kana && x.romaji !== k.romaji)).slice(0, 3);
    if (others.length < 3) continue;
    qs.push({ speak: k.kana, answer: k.kana, choices: shuffle([k.kana, ...others.map((x) => x.kana)]), isWord: false });
  }
  for (const w of shuffle(wordPool).slice(0, 4)) {
    const others = shuffle([...wordPool.filter((x) => x.jp !== w.jp), ...VOCAB_N5.filter((v) => v.jp !== w.jp)]).slice(0, 3);
    qs.push({ speak: w.jp, answer: w.jp, choices: shuffle([w.jp, ...others.map((x) => x.jp)]), isWord: true });
  }
  return shuffle(qs).slice(0, 10);
}

export function Dictation({ state, update, onExit }: { state: UserState; update: Update; onExit: () => void }) {
  const questions = useMemo(() => buildDictation(state), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const correct = useRef(0);

  if (questions.length < 5) {
    return (
      <div className="session-done">
        <Buddy mood="sad" size={80} />
        <p className="hint">學過的字還不夠出聽寫題，先去每日練習累積幾天吧</p>
        <button className="primary" onClick={onExit}>返回</button>
      </div>
    );
  }

  const q = questions[qi];

  const pick = (c: string) => {
    if (picked) return;
    setPicked(c);
    const ok = c === q.answer;
    if (ok) {
      correct.current += 1;
      sfx.correct(correct.current);
    } else sfx.wrong();
    setTimeout(() => {
      if (qi + 1 >= questions.length) {
        sfx.clear();
        update((s) => ({
          ...s,
          xp: s.xp + correct.current,
          coins: s.coins + COINS.minigame,
          minigames: { ...s.minigames, dictBest: Math.max(s.minigames.dictBest, correct.current) },
        }));
        setDone(true);
      } else {
        setPicked(null);
        setQi(qi + 1);
      }
    }, ok ? 500 : 1200);
  };

  if (done) {
    return (
      <div className="session-done">
        <div className="clear-banner">耳朵滿分！</div>
        <Buddy mood={correct.current >= 7 ? 'cheer' : 'happy'} size={90} />
        <div className="done-stats">
          <div>
            <b>{correct.current}/{questions.length}</b>
            <span>答對</span>
          </div>
          <div>
            <b>+{correct.current}</b>
            <span>XP</span>
          </div>
          <div>
            <b>{Math.max(state.minigames.dictBest, correct.current)}</b>
            <span>最佳</span>
          </div>
        </div>
        <button className="primary" onClick={onExit}>回遊戲間</button>
      </div>
    );
  }

  return (
    <div className="session">
      <div className="sprint-hud">
        <span>👂 聽寫 · {qi + 1}/{questions.length}</span>
        <span>{correct.current} 對</span>
      </div>
      <div className="card-stage">
        <div className="stage-tag">聽聲音，選出你聽到的</div>
        <button className="speak huge" onClick={() => speakJa(q.speak)}>
          🔊 播放
        </button>
        <div className={`choices ${q.isWord ? 'zh-choices' : 'kana-choices'}`}>
          {q.choices.map((c) => (
            <button
              key={c}
              className={picked ? (c === q.answer ? 'choice correct' : c === picked ? 'choice wrong' : 'choice dim') : 'choice'}
              onClick={() => pick(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {picked && <div className="quiz-feedback">正解：{q.answer}</div>}
      </div>
      <button className="linkish" onClick={onExit}>離開</button>
    </div>
  );
}

// ── 翻牌配對：假名 ↔ 羅馬音，8 組 16 張 ──

interface PairCard {
  key: number;
  pairId: string;
  face: string;
}

export function Pairs({ state, update, onExit }: { state: UserState; update: Update; onExit: () => void }) {
  const cards = useMemo<PairCard[]>(() => {
    const learned = Object.values(state.cards)
      .filter((c) => isLearning(c) && !isWordCard(c.id))
      .map((c) => KANA_BY_ID[c.id])
      .filter(Boolean);
    const base = learned.length >= 8 ? learned : [...HIRAGANA.slice(0, 46), ...KATAKANA.slice(0, 46)];
    // 同羅馬音的假名只取一個，避免一張羅馬音對到兩張假名
    const seen = new Set<string>();
    const picks = shuffle(base).filter((k) => (seen.has(k.romaji) ? false : (seen.add(k.romaji), true))).slice(0, 8);
    return shuffle(
      picks.flatMap((k, i) => [
        { key: i * 2, pairId: k.romaji, face: k.kana },
        { key: i * 2 + 1, pairId: k.romaji, face: k.romaji },
      ]),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const lock = useRef(false);

  const flip = (c: PairCard) => {
    if (lock.current || matched.has(c.pairId) || open.includes(c.key)) return;
    const now = [...open, c.key];
    setOpen(now);
    if (now.length === 2) {
      lock.current = true;
      setMoves((m) => m + 1);
      const [a, b] = now.map((k) => cards.find((x) => x.key === k)!);
      setTimeout(() => {
        if (a.pairId === b.pairId) {
          const next = new Set(matched);
          next.add(a.pairId);
          setMatched(next);
          sfx.correct(next.size);
          if (next.size === 8) {
            sfx.clear();
            const finalMoves = moves + 1;
            update((s) => ({
              ...s,
              xp: s.xp + Math.max(4, 24 - finalMoves),
              coins: s.coins + COINS.minigame,
              minigames: {
                ...s.minigames,
                pairsBest: s.minigames.pairsBest === 0 ? finalMoves : Math.min(s.minigames.pairsBest, finalMoves),
              },
            }));
          }
        } else {
          sfx.wrong();
        }
        setOpen([]);
        lock.current = false;
      }, a.pairId === b.pairId ? 250 : 750);
    }
  };

  if (matched.size === 8) {
    return (
      <div className="session-done">
        <div className="clear-banner">全部配對！</div>
        <Buddy mood="cheer" size={90} bounce />
        <div className="done-stats">
          <div>
            <b>{moves}</b>
            <span>步數（越少越強）</span>
          </div>
          <div>
            <b>+{Math.max(4, 24 - moves)}</b>
            <span>XP</span>
          </div>
        </div>
        <button className="primary" onClick={onExit}>回遊戲間</button>
      </div>
    );
  }

  return (
    <div className="session">
      <div className="sprint-hud">
        <span>🃏 翻牌配對</span>
        <span>{matched.size}/8 組</span>
        <span>{moves} 步</span>
      </div>
      <div className="pairs-grid">
        {cards.map((c) => {
          const up = open.includes(c.key) || matched.has(c.pairId);
          return (
            <button key={c.key} className={`pair-card ${up ? 'up' : ''} ${matched.has(c.pairId) ? 'ok' : ''}`} onClick={() => flip(c)}>
              {up ? c.face : '🍮'}
            </button>
          );
        })}
      </div>
      <button className="linkish" onClick={onExit}>離開</button>
    </div>
  );
}

// ── 打工接客 3.0：限時出餐動作遊戲（拖曳出餐）。詳見 docs/接客出餐版.md ──
// pre-lesson 教/複習今天 10 種食物 → 開店：客人講日文點餐，從道具欄拖對的食物給他。
// 快狠準賺小費和 Google 星，星越高客越多、越手忙腳亂。

const SHIFT_SECONDS = 60; // 一場時長（可提早打烊）
const SEATS = 4; // 同時在場客人上限（慌亂度主旋鈕）
const TICK = 200; // 主迴圈 ms
const PATIENCE_MAX = 100;
const DRAIN = 1.2; // 每 tick 掉的耐心（≈6/秒 → 約 16 秒見底）
const IMPATIENT = 35; // 耐心低於此，客人露出等待/不安表情
const COST_WRONG = 15; // 給錯客人：扣成本＋降星
const COST_TRASH = 5; // 丟垃圾桶：純食材浪費，不降星
const STAR_WINDOW = 10; // Google 星＝最近 N 位滑動平均
const BASE_STAR = 3; // 還沒有評價時的預設星（決定開場來客速度）
const ITEM_RELIEF = 30; // 複數訂單：每上對一樣，耐心回補（讓多品項客人有喘息）

let SHIFT_SEQ = 0;

type Mood = 'live' | 'happy' | 'angry';
interface Cust {
  id: number;
  slug: string;
  name: string;
  wants: FoodItem[]; // 想要的品項（1–3 樣不同食物）
  served: boolean[]; // 各品項是否已上（跟 wants 對齊）
  reveal: number; // 已「講出來」的品項數（batch＝全部；seq＝逐個追加）
  mode: OrderMode;
  line0: OrderLine; // 首個品項的變化台詞（ください/おねがい/ひとつ），單品也用它
  patience: number;
  enterAt: number;
  mood: Mood;
}

/** 客人現在這句要說什麼（依已上/已揭露的品項算，deterministic 不用 rng） */
function custSay(c: Cust): OrderLine {
  if (c.mode === 'single') return c.line0;
  const pend = c.wants.map((f, i) => ({ f, i })).filter((x) => x.i < c.reveal && !c.served[x.i]);
  if (pend.length === 0) return c.line0;
  if (c.mode === 'seq') {
    const { f, i } = pend[0];
    return i === 0 ? c.line0 : orderPhrase([f], true); // 首個用變化句、追加用「も」
  }
  return orderPhrase(pend.map((x) => x.f)); // batch：pending 用「と」串
}
interface FloatFx {
  id: number;
  custId: number;
  text: string;
  star: number;
}
interface Summary {
  cash: number;
  served: number;
  best: number;
  avgStar: number;
}

function starForTime(ms: number): number {
  if (ms < 2500) return 5;
  if (ms < 4000) return 4;
  if (ms < 6000) return 3;
  if (ms < 9000) return 2;
  return 1;
}
function comboMult(combo: number): number {
  if (combo >= 6) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}
/** 星越高客人湧入越快；保底最慢 5.5 秒必來一位（防死亡螺旋） */
function arrivalGap(star: number): number {
  return Math.min(5.5, Math.max(1.5, 5.5 - star * 0.6));
}
function custActionFor(c: Cust, now: number): CustAction {
  if (c.mood === 'happy') return 'happy';
  if (c.mood === 'angry') return 'angry';
  if (now - c.enterAt < 550) return 'walkin';
  if (c.patience < IMPATIENT) return 'wait';
  return 'talk';
}

export function Shift({ state, update, onExit }: { state: UserState; update: Update; onExit: () => void }) {
  const todayFoods = useMemo(() => pickTodayFoods(state.foodMastery ?? {}), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<'lesson' | 'play' | 'done'>('lesson');
  const [summary, setSummary] = useState<Summary | null>(null);

  if (phase === 'lesson') {
    return <PreLesson foods={todayFoods} onStart={() => setPhase('play')} onExit={onExit} />;
  }

  if (phase === 'play') {
    return (
      <ShiftPlay
        foods={todayFoods}
        state={state}
        update={update}
        onFinish={(s) => {
          setSummary(s);
          setPhase('done');
        }}
      />
    );
  }

  const s = summary!;
  return (
    <div className="session-done">
      <div className="clear-banner">お疲れさま！</div>
      <Buddy mood={s.served >= 6 ? 'cheer' : 'happy'} size={90} bounce={s.served >= 6} />
      <h2>今日の営業、終了！</h2>
      <div className="done-stats">
        <div>
          <b>{s.served}</b>
          <span>滿意出餐</span>
        </div>
        <div>
          <b>¥{s.cash}</b>
          <span>營業額 🪙</span>
        </div>
        <div>
          <b>★{s.avgStar.toFixed(1)}</b>
          <span>平均星</span>
        </div>
      </div>
      <div className="done-stats one">
        <div>
          <b>{s.best}</b>
          <span>單場最佳營業額</span>
        </div>
      </div>
      <button className="primary" onClick={onExit}>回對戰場</button>
      <p className="hint">營業額換金幣拿去商店添家具，常客會再回來坐坐！</p>
    </div>
  );
}

// ── 進場前：教/複習今天這 10 種食物（大插圖＋日文＋kana＋中文＋TTS）──
function PreLesson({ foods, onStart, onExit }: { foods: FoodItem[]; onStart: () => void; onExit: () => void }) {
  const [i, setI] = useState(0);
  const f = foods[i];
  // iOS 只在使用者手勢裡才發得出聲：翻卡＝手勢，順便念出來；點卡片也能重聽。
  // TTS 唸 kana 不唸漢字：台式/異國料理的漢字 TTS 會誤讀（臭豆腐→におい豆腐），kana 才是教的讀音
  const go = (n: number) => {
    const j = Math.max(0, Math.min(foods.length - 1, n));
    setI(j);
    speakJa(foods[j].kana);
  };

  return (
    <div className="session serve3-lesson">
      <div className="sprint-hud">
        <span>📖 今日のメニュー</span>
        <span>{i + 1}/{foods.length}</span>
      </div>
      <div className="lesson-card" role="button" tabIndex={0} onClick={() => speakJa(f.kana)}>
        <img className="lesson-art" src={f.art} alt={f.zh} draggable={false} />
        <div className="lesson-ja">{f.ja}</div>
        {f.kana !== f.ja && <div className="lesson-kana">{f.kana}</div>}
        <div className="lesson-zh">
          {f.zh}
          <span className="lesson-cat">{f.category}</span>
        </div>
        <span className="lesson-say">🔊 點卡片再聽一次</span>
      </div>
      <div className="lesson-nav">
        <button className="tool" onClick={() => go(i - 1)} disabled={i === 0}>
          ← 前
        </button>
        {i < foods.length - 1 ? (
          <button className="primary" onClick={() => go(i + 1)}>次へ →</button>
        ) : (
          <button className="primary" onClick={onStart}>開店！🏮</button>
        )}
      </div>
      <p className="hint">今天客人只會點這 10 種，先記熟再開店</p>
      <button className="linkish" onClick={onExit}>返回</button>
    </div>
  );
}

// ── 開店：拖曳出餐計時場 ──
function ShiftPlay({
  foods,
  state,
  update,
  onFinish,
}: {
  foods: FoodItem[];
  state: UserState;
  update: Update;
  onFinish: (s: Summary) => void;
}) {
  const [custs, setCusts] = useState<Cust[]>([]);
  const [timeLeft, setTimeLeft] = useState(SHIFT_SECONDS);
  const [cash, setCash] = useState(0);
  const [combo, setCombo] = useState(0);
  const [avgStar, setAvgStar] = useState(BASE_STAR);
  const [fx, setFx] = useState<FloatFx[]>([]);
  const [shatter, setShatter] = useState(false);
  const [trashHit, setTrashHit] = useState(false);
  const [drag, setDrag] = useState<{ food: FoodItem; x: number; y: number } | null>(null);
  const [hoverDrop, setHoverDrop] = useState<string | null>(null);

  const custsRef = useRef<Cust[]>([]);
  const cashRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const starsRef = useRef<number[]>([]);
  const servedRef = useRef(0);
  const regularsRef = useRef<Record<string, number>>({});
  const masteryRef = useRef<Record<string, number>>({});
  const startRef = useRef(0);
  const nextSpawnRef = useRef(0);
  const doneRef = useRef(false);
  const dragRef = useRef<{ food: FoodItem; pointerId: number } | null>(null);
  const fxSeq = useRef(0);

  const commit = (next: Cust[]) => {
    custsRef.current = next;
    setCusts(next);
  };
  const avgOf = (a: number[]) => (a.length ? a.reduce((sum, x) => sum + x, 0) / a.length : BASE_STAR);
  const pushStar = (star: number) => {
    starsRef.current = [...starsRef.current, star].slice(-STAR_WINDOW);
    setAvgStar(avgOf(starsRef.current));
  };
  const floatFor = (custId: number, text: string, star: number) => {
    const id = ++fxSeq.current;
    setFx((list) => [...list, { id, custId, text, star }]);
    window.setTimeout(() => setFx((list) => list.filter((x) => x.id !== id)), 950);
  };
  // 客人翻臉/滿意後短暫停留播動作，再離場空出座位
  const leave = (id: number, mood: Mood) => {
    commit(custsRef.current.map((c) => (c.id === id ? { ...c, mood } : c)));
    window.setTimeout(() => commit(custsRef.current.filter((c) => c.id !== id)), 560);
  };
  // 訂單品項上限隨課程進度解鎖（L16 教と/も後開 2 品、N5 全 20 課後開 3 品）；場中不變、算一次即可
  const maxItems = maxOrderItems(courseProgress(state).done);
  const spawn = (now: number) => {
    const ch = pickCustomer();
    const order = buildOrder(foods, Math.random, maxItems);
    commit([
      ...custsRef.current,
      {
        id: ++SHIFT_SEQ,
        slug: ch.id,
        name: ch.name,
        wants: order.items,
        served: order.items.map(() => false),
        reveal: order.mode === 'seq' ? 1 : order.items.length,
        mode: order.mode,
        line0: orderLine(order.items[0]),
        patience: PATIENCE_MAX,
        enterAt: now,
        mood: 'live',
      },
    ]);
  };

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    sfx.clear();
    const earned = Math.max(0, Math.round(cashRef.current));
    const reg = regularsRef.current;
    const mast = masteryRef.current;
    const prevBest = Number.isFinite(state.shiftBest) ? state.shiftBest : 0;
    update((s) => {
      const regulars = { ...(s.regulars ?? {}) };
      for (const k of Object.keys(reg)) regulars[k] = (regulars[k] ?? 0) + reg[k];
      const foodMastery = { ...(s.foodMastery ?? {}) };
      for (const k of Object.keys(mast)) foodMastery[k] = (foodMastery[k] ?? 0) + mast[k];
      return {
        ...s,
        coins: s.coins + earned,
        shiftBest: Math.max(Number.isFinite(s.shiftBest) ? s.shiftBest : 0, earned),
        regulars,
        foodMastery,
      };
    });
    onFinish({ cash: earned, served: servedRef.current, best: Math.max(prevBest, earned), avgStar: avgOf(starsRef.current) });
  };

  // 主迴圈：計時、耐心遞減、逾時翻臉、來客排程
  useEffect(() => {
    SHIFT_SEQ = 0;
    startRef.current = Date.now();
    nextSpawnRef.current = 0; // 立刻來第一位
    doneRef.current = false;
    const iv = setInterval(() => {
      if (doneRef.current) return;
      const now = Date.now();
      const remain = Math.max(0, SHIFT_SECONDS - (now - startRef.current) / 1000);
      setTimeLeft(remain);

      // 耐心遞減＋逾時翻臉離場（＝1 星、combo 歸零）
      const next: Cust[] = [];
      for (const c of custsRef.current) {
        if (c.mood !== 'live') {
          next.push(c);
          continue;
        }
        const p = c.patience - DRAIN;
        if (p <= 0) {
          pushStar(1);
          comboRef.current = 0;
          setCombo(0);
          next.push({ ...c, patience: 0, mood: 'angry' });
          window.setTimeout(() => commit(custsRef.current.filter((x) => x.id !== c.id)), 560);
        } else {
          next.push({ ...c, patience: p });
        }
      }
      commit(next);

      // 來客排程（保底＋SEATS 上限）
      const live = custsRef.current.filter((c) => c.mood === 'live').length;
      if (remain > 0 && live < SEATS && now >= nextSpawnRef.current) {
        spawn(now);
        nextSpawnRef.current = now + arrivalGap(avgOf(starsRef.current)) * 1000;
      }

      if (remain <= 0) finish();
    }, TICK);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const serve = (custArg: Cust, food: FoodItem) => {
    const cur = custsRef.current.find((c) => c.id === custArg.id);
    if (!cur || cur.mood !== 'live' || doneRef.current) return;
    // 找目前「已講出來、還沒上」的品項裡有沒有這道菜
    const idx = cur.wants.findIndex((f, i) => i < cur.reveal && !cur.served[i] && f.id === food.id);
    if (idx === -1) {
      // 給錯（不是現在點的東西）→ 翻臉、扣成本、降星、combo 歸零
      pushStar(1);
      comboRef.current = 0;
      setCombo(0);
      cashRef.current -= COST_WRONG;
      setCash(Math.round(cashRef.current));
      sfx.wrong();
      setShatter(true);
      window.setTimeout(() => setShatter(false), 420);
      floatFor(cur.id, `−¥${COST_WRONG}`, 1);
      leave(cur.id, 'angry');
      return;
    }

    // 上對一樣
    const served = cur.served.slice();
    served[idx] = true;
    masteryRef.current[food.id] = (masteryRef.current[food.id] ?? 0) + 1;

    // seq：目前揭露的都上完了、還有沒講的 → 追加下一個
    let reveal = cur.reveal;
    let justRevealed = false;
    if (cur.mode === 'seq' && reveal < cur.wants.length && cur.wants.slice(0, reveal).every((_, i) => served[i])) {
      reveal += 1;
      justRevealed = true;
    }
    const allDone = served.every(Boolean) && reveal >= cur.wants.length;

    if (allDone) {
      // 整桌上完 → 滿意離場，小費 ×品項數、combo＋1、星、常客
      const star = starForTime(Date.now() - cur.enterAt);
      const nc = comboRef.current + 1;
      comboRef.current = nc;
      maxComboRef.current = Math.max(maxComboRef.current, nc);
      setCombo(nc);
      const tip = Math.round((5 + star * 5) * comboMult(nc)) * cur.wants.length;
      cashRef.current += tip;
      setCash(Math.round(cashRef.current));
      pushStar(star);
      regularsRef.current[cur.slug] = (regularsRef.current[cur.slug] ?? 0) + 1;
      servedRef.current += 1;
      sfx.correct(nc);
      floatFor(cur.id, `+¥${tip}`, star);
      leave(cur.id, 'happy');
    } else {
      // 還沒上完 → 這樣先記帳、耐心回補、留著；追加的話念出新台詞
      const patched: Cust = { ...cur, served, reveal, patience: Math.min(PATIENCE_MAX, cur.patience + ITEM_RELIEF) };
      commit(custsRef.current.map((c) => (c.id === cur.id ? patched : c)));
      sfx.correct(served.filter(Boolean).length);
      floatFor(cur.id, '✓', 0);
      if (justRevealed) speakJa(custSay(patched).kana); // 唸 kana 句（漢字菜名 TTS 會誤讀）
    }
  };

  const trash = () => {
    cashRef.current -= COST_TRASH;
    setCash(Math.round(cashRef.current));
    sfx.wrong();
    setTrashHit(true);
    window.setTimeout(() => setTrashHit(false), 500);
  };

  // 拖曳（pointer events，鎖 iOS 捲動）
  const dropAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    return el?.closest('[data-drop]')?.getAttribute('data-drop') ?? null;
  };
  const onFoodDown = (food: FoodItem, e: RPointerEvent) => {
    if (doneRef.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { food, pointerId: e.pointerId };
    setDrag({ food, x: e.clientX, y: e.clientY });
  };
  const onFoodMove = (e: RPointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    setDrag((d) => (d ? { ...d, x, y } : d));
    setHoverDrop(dropAt(x, y));
  };
  const onFoodUp = (e: RPointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const { food } = dragRef.current;
    const drop = dropAt(e.clientX, e.clientY);
    dragRef.current = null;
    setDrag(null);
    setHoverDrop(null);
    if (!drop) return;
    if (drop === 'trash') return trash();
    if (drop.startsWith('cust:')) {
      const c = custsRef.current.find((x) => x.id === Number(drop.slice(5)));
      if (c) serve(c, food);
    }
  };

  const now = Date.now();
  // 老客靠右出餐口、新客從左進場（row-reverse 於 CSS）
  return (
    <div className="serve3">
      <div className="serve3-hud">
        <div className="hud-item">
          <b>★{avgStar.toFixed(1)}</b>
          <span>Google 星</span>
        </div>
        <div className="hud-item">
          <b className={timeLeft <= 10 ? 'low' : ''}>{Math.ceil(timeLeft)}</b>
          <span>秒</span>
        </div>
        <div className="hud-item">
          <b>¥{cash}</b>
          <span>營業額</span>
        </div>
        <button className="hud-close" onClick={finish}>打烊</button>
        {combo >= 2 && <div className={`hud-combo ${combo >= 3 ? 'hot' : ''}`}>{combo} 連 🔥</div>}
      </div>

      <div
        className={`serve3-scene ${combo >= 3 ? 'hot' : ''} ${shatter ? 'cool' : ''}`}
        style={{ filter: `brightness(${(1 + Math.min(combo, 8) * 0.05).toFixed(2)})` }}
      >
        <img className="serve3-lantern l" src="/baito/lantern.png" alt="" style={{ opacity: 0.5 + Math.min(combo, 6) * 0.08 }} />
        <img className="serve3-lantern r" src="/baito/lantern.png" alt="" style={{ opacity: 0.5 + Math.min(combo, 6) * 0.08 }} />
        {combo >= 3 && <img className="serve3-flame" src="/baito/flame.png" alt="" />}
        <div className="serve3-seats">
          {custs.length === 0 && <p className="serve3-wait">いらっしゃいませ〜（客人來的路上…）</p>}
          {custs.map((c) => {
            const lvl = c.patience > 60 ? 'ok' : c.patience > 30 ? 'warn' : 'bad';
            const over = hoverDrop === `cust:${c.id}`;
            const say = custSay(c);
            return (
              <div key={c.id} className={`serve3-cust ${c.mood} ${over ? 'over' : ''}`} data-drop={`cust:${c.id}`}>
                {fx.filter((x) => x.custId === c.id).map((x) => (
                  <span key={x.id} className={`serve3-float ${x.text.startsWith('−') ? 'bad' : 'good'}`}>
                    {x.text}
                    {x.star > 0 && <b className="stars">{'★'.repeat(x.star)}</b>}
                  </span>
                ))}
                {c.mood === 'live' && (
                  <button className="serve3-bubble" onClick={() => speakJa(say.kana)} aria-label="聽客人說">
                    {c.wants.length > 1 && (
                      <span className="b-dots">
                        {c.wants.slice(0, c.reveal).map((_, i) => (
                          <i key={i} className={c.served[i] ? 'on' : ''} />
                        ))}
                      </span>
                    )}
                    <span className="b-jp">{say.say}　🔊</span>
                  </button>
                )}
                <img className="serve3-sprite" src={custSprite(c.slug, custActionFor(c, now))} alt={c.name} draggable={false} />
                {c.mood === 'live' && (
                  <span className={`serve3-pat ${lvl}`}>
                    <i style={{ width: `${Math.max(0, Math.min(100, c.patience))}%` }} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="serve3-counter">
        <div className="serve3-tray">
          {foods.map((f) => (
            <button
              key={f.id}
              className={`serve3-food ${drag?.food.id === f.id ? 'lift' : ''}`}
              onPointerDown={(e) => onFoodDown(f, e)}
              onPointerMove={onFoodMove}
              onPointerUp={onFoodUp}
              onPointerCancel={onFoodUp}
            >
              <img src={f.art} alt={f.zh} draggable={false} />
            </button>
          ))}
        </div>
        <button className={`serve3-trash ${hoverDrop === 'trash' ? 'over' : ''} ${trashHit ? 'hit' : ''}`} data-drop="trash">
          <img src="/baito/trash.png" alt="垃圾桶" draggable={false} />
          {trashHit && <span className="trash-cost">−¥{COST_TRASH}</span>}
        </button>
      </div>

      {drag && (
        <img className="serve3-ghost" src={drag.food.art} alt="" draggable={false} style={{ left: drag.x, top: drag.y }} />
      )}
    </div>
  );
}

// ── 歌詞挖空：從歌庫抽歌，把單字挖掉選回來 ──

interface ClozeQ {
  display: string;
  answer: string;
  choices: string[];
  zh: string;
}

interface SongData {
  title: string;
  lines: { ruby: [string, string | null][]; zh: string }[];
  vocab: { jp: string; kana: string; zh: string }[];
}

export function Cloze({ update, onExit }: { state: UserState; update: Update; onExit: () => void }) {
  const [song, setSong] = useState<SongData | null>(null);
  const [qs, setQs] = useState<ClozeQ[] | null>(null);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const correct = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const [staticIdx, kvIdx] = await Promise.all([
          fetch('/data/songs/index.json').then((r) => r.json()).catch(() => []),
          fetch('/api/songs').then((r) => r.json()).then((d) => d.items ?? []).catch(() => []),
        ]);
        const all = [...kvIdx, ...staticIdx];
        if (all.length === 0) return setQs([]);
        const m = all[Math.floor(Math.random() * all.length)];
        const s: SongData = await fetch(m.kv ? `/api/songs/${m.id}` : `/data/songs/${m.file}`).then((r) => r.json());
        setSong(s);
        const questions: ClozeQ[] = [];
        for (const w of shuffle(s.vocab)) {
          const line = s.lines.find((l) => l.ruby.map(([t]) => t).join('').includes(w.jp));
          if (!line) continue;
          const text = line.ruby.map(([t]) => t).join('');
          const others = shuffle(s.vocab.filter((x) => x.jp !== w.jp)).slice(0, 3);
          if (others.length < 3) continue;
          questions.push({
            display: text.replace(w.jp, '〔？〕'),
            answer: w.jp,
            choices: shuffle([w.jp, ...others.map((x) => x.jp)]),
            zh: line.zh,
          });
          if (questions.length >= 8) break;
        }
        setQs(questions);
      } catch {
        setQs([]);
      }
    })();
  }, []);

  if (!qs) return <p className="hint">找歌中…</p>;
  if (qs.length < 3) {
    return (
      <div className="session-done">
        <Buddy mood="sad" size={80} />
        <p className="hint">歌庫還太小或這首歌不好出題，先去「教材庫→歌」加幾首吧</p>
        <button className="primary" onClick={onExit}>返回</button>
      </div>
    );
  }

  const q = qs[qi];

  const pick = (c: string) => {
    if (picked) return;
    setPicked(c);
    const ok = c === q.answer;
    if (ok) {
      correct.current += 1;
      sfx.correct(correct.current);
    } else sfx.wrong();
    setTimeout(() => {
      if (qi + 1 >= qs.length) {
        sfx.clear();
        update((s) => ({
          ...s,
          xp: s.xp + correct.current * 2,
          coins: s.coins + COINS.minigame,
          minigames: { ...s.minigames, clozeBest: Math.max(s.minigames.clozeBest, correct.current) },
        }));
        setDone(true);
      } else {
        setPicked(null);
        setQi(qi + 1);
      }
    }, ok ? 550 : 1400);
  };

  if (done) {
    return (
      <div className="session-done">
        <div className="clear-banner">歌詞通！</div>
        <Buddy mood="cheer" size={90} />
        <div className="done-stats">
          <div>
            <b>{correct.current}/{qs.length}</b>
            <span>答對</span>
          </div>
          <div>
            <b>+{correct.current * 2}</b>
            <span>XP</span>
          </div>
        </div>
        <button className="primary" onClick={onExit}>回遊戲間</button>
      </div>
    );
  }

  return (
    <div className="session">
      <div className="sprint-hud">
        <span>🎤 歌詞挖空 · {song?.title}</span>
        <span>{qi + 1}/{qs.length}</span>
      </div>
      <div className="card-stage">
        <div className="stage-tag">哪個字被挖走了？</div>
        <div className="cloze-line">{q.display}</div>
        <p className="hint">{q.zh}</p>
        <div className="choices zh-choices">
          {q.choices.map((c) => (
            <button
              key={c}
              className={picked ? (c === q.answer ? 'choice correct' : c === picked ? 'choice wrong' : 'choice dim') : 'choice'}
              onClick={() => pick(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <button className="linkish" onClick={onExit}>離開</button>
    </div>
  );
}
