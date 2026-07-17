import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UserId, UserState } from '../types.ts';
import { USERS } from '../lib/store.ts';
import { DUEL_SECONDS, duelPoints, duelQuestions } from '../lib/seeded.ts';
import { XP, comboMultiplier } from '../lib/xp.ts';
import { BOSS_REWARD_XP, COINS, bossOfWeek, mysteryReward, weekId } from '../data/fun.ts';
import { Cloze, Dictation, Pairs, Shift } from './Games.tsx';
import { isLearning } from '../lib/srs.ts';
import { pickQuizMode, quizChoices, wordInfo, isWordCard } from '../lib/session.ts';
import { taughtKana, taughtWords } from '../lib/taught.ts';
import { KANA_BY_ID } from '../data/kana.ts';
import { speakJa } from '../lib/tts.ts';
import { sfx } from '../lib/sounds.ts';
import {
  fetchChallenges,
  fetchDuel,
  postChallenge,
  postDuel,
  replyChallenge,
  type Challenge,
  type DuelDay,
} from '../lib/arena.ts';
import { BuddySay } from './Buddy.tsx';

type View =
  | { v: 'home' }
  | { v: 'sprint' }
  | { v: 'dict' }
  | { v: 'pairs' }
  | { v: 'cloze' }
  | { v: 'shift' }
  | { v: 'duel'; seed: string; then: (score: number, correct: number) => void; title: string };

interface Props {
  state: UserState;
  today: string;
  update: (fn: (s: UserState) => UserState) => void;
}

export default function Arena({ state, today, update }: Props) {
  const [view, setView] = useState<View>({ v: 'home' });
  const me = state.user;
  const other = USERS.find((u) => u.id !== me)!;

  if (view.v === 'sprint') {
    return <Sprint state={state} update={update} onExit={() => setView({ v: 'home' })} />;
  }
  if (view.v === 'dict') return <Dictation state={state} update={update} onExit={() => setView({ v: 'home' })} />;
  if (view.v === 'pairs') return <Pairs state={state} update={update} onExit={() => setView({ v: 'home' })} />;
  if (view.v === 'cloze') return <Cloze state={state} update={update} onExit={() => setView({ v: 'home' })} />;
  if (view.v === 'shift') return <Shift state={state} update={update} onExit={() => setView({ v: 'home' })} />;
  if (view.v === 'duel') {
    return (
      <DuelPlay
        seed={view.seed}
        title={view.title}
        state={state}
        onDone={(score, correct) => {
          view.then(score, correct);
          setView({ v: 'home' });
        }}
      />
    );
  }
  return <ArenaHome state={state} today={today} update={update} me={me} otherName={other.name} openView={setView} />;
}

// ── 首頁 ──

function ArenaHome({
  state,
  today,
  update,
  me,
  otherName,
  openView,
}: {
  state: UserState;
  today: string;
  update: Props['update'];
  me: UserId;
  otherName: string;
  openView: (v: View) => void;
}) {
  const [duel, setDuel] = useState<DuelDay | null>(null);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [err, setErr] = useState(false);

  const refresh = useCallback(() => {
    fetchDuel(today).then(setDuel).catch(() => setErr(true));
    fetchChallenges().then(setChallenges).catch(() => setErr(true));
  }, [today]);
  useEffect(refresh, [refresh]);

  const mine = duel?.[me] ?? null;
  const theirsId = me === 'jj' ? 'yaxuan' : 'jj';
  const theirs = duel?.[theirsId] ?? null;

  // 兩人都完成且今天還沒入帳 → 結算戰績＋音效
  useEffect(() => {
    if (!mine || !theirs || state.duel.lastCounted === today) return;
    const win = mine.score > theirs.score;
    const tie = mine.score === theirs.score;
    if (win) sfx.win();
    else if (!tie) sfx.lose();
    update((s) => ({
      ...s,
      xp: s.xp + (win ? XP.duelWin : 0),
      coins: s.coins + (win ? COINS.duelWin : 0),
      duel: {
        w: s.duel.w + (win ? 1 : 0),
        l: s.duel.l + (!win && !tie ? 1 : 0),
        streak: win ? s.duel.streak + 1 : tie ? s.duel.streak : 0,
        lastCounted: today,
      },
    }));
  }, [mine, theirs, state.duel.lastCounted, today, update]);

  const learnedCount = Object.values(state.cards).filter((c) => isLearning(c)).length;
  const pendingForMe = (challenges ?? []).filter((c) => c.from !== me && !c.reply);
  const history = (challenges ?? []).slice(0, 8);

  return (
    <div className="arena">
      {err && <p className="hint">連線怪怪的，下拉重整或稍後再試</p>}

      <div className="arena-card shift-card">
        <div className="shift-head">
          <h3>🍮 夜市出餐</h3>
          <span className="coin-chip">🪙 {state.coins}</span>
        </div>
        <p className="desc">開店前先記熟今天 10 種餐點，開店後客人講日文點餐、耐心條同時倒數——從道具欄把對的食物拖給他！快狠準賺小費和 Google 星，星越高客越多、越手忙腳亂。營業額換金幣拿去商店添家具。</p>
        <div className="vs-row">
          <div className="vs-side">
            <b>{state.shiftBest}</b>
            <span>單場最高營業額</span>
          </div>
        </div>
        <button className="primary" onClick={() => openView({ v: 'shift' })}>開店準備！</button>
      </div>

      <div className="arena-card">
        <h3>⚔️ 每日對決</h3>
        <p className="desc">每天一場，各自從學過的字出 10 題（假名＋單字），答對又快分數越高。都打完才比分。</p>
        {!mine ? (
          <button
            className="primary"
            onClick={() =>
              openView({
                v: 'duel',
                seed: `duel:${today}`,
                title: '每日對決',
                then: (score, correct) => {
                  postDuel(today, me, { score, correct, at: new Date().toISOString() })
                    .then(setDuel)
                    .catch(() => setErr(true));
                },
              })
            }
          >
            開打！
          </button>
        ) : !theirs ? (
          <div className="vs-row">
            <div className="vs-side">
              <b>{mine.score}</b>
              <span>我（{mine.correct}/10）</span>
            </div>
            <span className="vs-mark">VS</span>
            <div className="vs-side">
              <b>…</b>
              <span>等 {otherName} 應戰</span>
            </div>
          </div>
        ) : (
          <>
            <div className="vs-row">
              <div className="vs-side">
                <b>{mine.score}</b>
                <span>我（{mine.correct}/10）</span>
              </div>
              <span className="vs-mark">VS</span>
              <div className="vs-side">
                <b>{theirs.score}</b>
                <span>{otherName}（{theirs.correct}/10）</span>
              </div>
            </div>
            <div className={`result-line ${mine.score > theirs.score ? 'win' : mine.score < theirs.score ? 'lose' : 'tie'}`}>
              {mine.score > theirs.score ? '🏆 勝利！+30 XP' : mine.score < theirs.score ? '敗北…明天雪恥' : '平手！'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <BuddySay context={mine.score >= theirs.score ? 'win' : 'lose'} size={84} bounce={mine.score > theirs.score} />
            </div>
          </>
        )}
      </div>

      <div className="arena-card">
        <h3>🏃 限時衝刺</h3>
        <p className="desc">60 秒盡量答，連對有 COMBO 加成（×1→×2→×3）。從你學過的字出題。</p>
        <div className="vs-row">
          <div className="vs-side">
            <b>{state.sprintBest}</b>
            <span>我的最高分</span>
          </div>
          <div className="vs-side">
            <b>{state.maxCombo}</b>
            <span>最長 COMBO</span>
          </div>
        </div>
        {learnedCount >= 20 ? (
          <button className="primary" onClick={() => openView({ v: 'sprint' })}>
            開始衝刺
          </button>
        ) : (
          <p className="hint">再學 {20 - learnedCount} 張卡就解鎖（先去每日練習累積）</p>
        )}
      </div>

      <BossCard state={state} today={today} update={update} me={me} otherName={otherName} openView={openView} />

      <div className="arena-card">
        <h3>🎮 小遊戲間</h3>
        <p className="desc">換換口味的練法，都會給 XP。</p>
        <div className="view-tools">
          <button className="tool" onClick={() => openView({ v: 'dict' })}>👂 聽寫（最佳 {state.minigames.dictBest}）</button>
          <button className="tool" onClick={() => openView({ v: 'pairs' })}>
            🃏 翻牌配對{state.minigames.pairsBest > 0 && `（最少 ${state.minigames.pairsBest} 步）`}
          </button>
          <button className="tool" onClick={() => openView({ v: 'cloze' })}>🎤 歌詞挖空（最佳 {state.minigames.clozeBest}）</button>
        </div>
      </div>

      <div className="arena-card">
        <h3>📜 戰帖</h3>
        <p className="desc">主動下戰帖：從你學過的字出 10 題，把分數丟給對方，看他敢不敢接。</p>
        <button
          className="tool"
          onClick={() => {
            const id = `c${Date.now().toString(36)}`;
            openView({
              v: 'duel',
              seed: id,
              title: '下戰帖',
              then: (score) => {
                postChallenge({ id, from: me, seed: id, score }).then(refresh).catch(() => setErr(true));
              },
            });
          }}
        >
          ＋下戰帖給 {otherName}
        </button>
        {pendingForMe.map((c) => (
          <div key={c.id} className="challenge-item">
            <div>
              <b>{otherName} 下了戰帖！</b>
              <small>他拿了 {c.score} 分 · {c.at.slice(5, 10)}</small>
            </div>
            <button
              className="tool"
              onClick={() =>
                openView({
                  v: 'duel',
                  seed: c.seed,
                  title: '應戰！',
                  then: (score) => {
                    replyChallenge(c.id, score).then(refresh).catch(() => setErr(true));
                  },
                })
              }
            >
              應戰
            </button>
          </div>
        ))}
        {history
          .filter((c) => c.reply)
          .map((c) => {
            const fromName = USERS.find((u) => u.id === c.from)!.name;
            const toName = USERS.find((u) => u.id !== c.from)!.name;
            return (
              <div key={c.id} className="challenge-item">
                <div>
                  {fromName} {c.score} vs {toName} {c.reply!.score}
                  <small>
                    {c.at.slice(5, 10)} ·{' '}
                    {c.score === c.reply!.score ? '平手' : `${c.score > c.reply!.score ? fromName : toName} 勝`}
                  </small>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ── 週間合作 Boss：兩人每日各一次出擊，合力扣血 ──

interface BossState {
  dmg: Record<string, number>;
  lastAttack: Record<string, string>;
}

function BossCard({
  state,
  today,
  update,
  me,
  otherName,
  openView,
}: {
  state: UserState;
  today: string;
  update: Props['update'];
  me: UserId;
  otherName: string;
  openView: (v: View) => void;
}) {
  const wid = weekId(today);
  const boss = bossOfWeek(wid);
  const [bs, setBs] = useState<BossState | null>(null);

  const refresh = useCallback(() => {
    fetch(`/api/boss?week=${wid}`)
      .then((r) => r.json())
      .then(setBs)
      .catch(() => setBs(null));
  }, [wid]);
  useEffect(refresh, [refresh]);

  const total = (bs?.dmg.jj ?? 0) + (bs?.dmg.yaxuan ?? 0);
  const hp = Math.max(0, boss.maxHp - total);
  const defeated = hp <= 0;
  const attackedToday = bs?.lastAttack?.[me] === today;
  const claimed = state.bossClaimed === wid;

  return (
    <div className="arena-card boss-card">
      <h3>👹 本週 Boss：{boss.name}</h3>
      <p className="desc">兩人每天各可出擊一次（10 題，答對 1 題扣 5 滴血），週一換新 Boss。打倒各領 +{BOSS_REWARD_XP} XP＋稀有布丁。</p>
      <div className="goal-bar boss-hp">
        <div className="goal-fill" style={{ width: `${(hp / boss.maxHp) * 100}%` }} />
      </div>
      <div className="goal-nums">
        <span>HP {hp}/{boss.maxHp}</span>
        <span>我 {bs?.dmg[me] ?? 0}｜{otherName} {bs?.dmg[me === 'jj' ? 'yaxuan' : 'jj'] ?? 0}</span>
      </div>
      {defeated ? (
        claimed ? (
          <p className="result-line win">已討伐！下週一新 Boss 上門</p>
        ) : (
          <button
            className="primary"
            onClick={() => {
              const reward = mysteryReward();
              sfx.win();
              update((s) => ({
                ...s,
                xp: s.xp + BOSS_REWARD_XP,
                coins: s.coins + COINS.bossClaim,
                bossClaimed: wid,
                puddings: { ...s.puddings, [reward.id]: (s.puddings[reward.id] ?? 0) + 1 },
              }));
            }}
          >
            🏆 領取討伐獎勵
          </button>
        )
      ) : attackedToday ? (
        <p className="hint">今日已出擊。{otherName} 還沒打的話催一下，合力才快</p>
      ) : (
        <button
          className="primary"
          onClick={() =>
            openView({
              v: 'duel',
              seed: `boss:${wid}:${me}:${today}`,
              title: `討伐${boss.name}`,
              then: (_score, correct) => {
                fetch('/api/boss/attack', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ week: wid, user: me, damage: correct * 5, date: today }),
                }).then(refresh).catch(refresh);
              },
            })
          }
        >
          ⚔️ 出擊！
        </button>
      )}
    </div>
  );
}

// ── 對決/戰帖共用：seeded 10 題、每題 10 秒 ──

function DuelPlay({ seed, title, state, onDone }: { seed: string; title: string; state: UserState; onDone: (score: number, correct: number) => void }) {
  // 只從自己「已教」的字出題（無教不考）；同 seed 保當日順序穩定。兩人各出各的、比分數。
  const questions = useMemo(
    () => duelQuestions(seed, { kanas: taughtKana(state), words: taughtWords(state) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed],
  );
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(DUEL_SECONDS);
  const [picked, setPicked] = useState<string | null>(null);
  const score = useRef(0);
  const correct = useRef(0);
  const answered = useRef(false);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const q = questions[idx];

  useEffect(() => {
    if (questions.length === 0) return;
    answered.current = false;
    setLeft(DUEL_SECONDS);
    setPicked(null);
    const start = Date.now();
    timer.current = setInterval(() => {
      const remain = DUEL_SECONDS - (Date.now() - start) / 1000;
      setLeft(Math.max(0, remain));
      if (remain <= 0 && !answered.current) {
        answered.current = true;
        if (timer.current) clearInterval(timer.current);
        setPicked('__timeout__');
        sfx.wrong();
        advanceTimer.current = setTimeout(() => advance(), 900);
      }
    }, 100);
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const advance = () => {
    if (idx + 1 >= questions.length) {
      if (finished.current) return;
      finished.current = true;
      onDone(score.current, correct.current);
    }
    else setIdx(idx + 1);
  };

  const pick = (c: string) => {
    if (answered.current) return;
    answered.current = true;
    if (timer.current) clearInterval(timer.current);
    setPicked(c);
    const ok = c === q.answer;
    if (ok) {
      correct.current += 1;
      score.current += duelPoints(true, left);
      sfx.correct(correct.current);
    } else {
      sfx.wrong();
    }
    advanceTimer.current = setTimeout(advance, ok ? 550 : 1100);
  };

  if (questions.length === 0) {
    return (
      <div className="session-done">
        <BuddySay context="lose" size={90} />
        <p className="hint">先去每日練習學點字，再來對決吧</p>
        <button className="primary" onClick={() => onDone(0, 0)}>返回</button>
      </div>
    );
  }

  return (
    <div className="session">
      <div className="sprint-hud">
        <span>{title} · {idx + 1}/10</span>
        <span className={`sprint-timer ${left <= 3 ? 'low' : ''}`}>{Math.ceil(left)}</span>
        <span>{score.current} 分</span>
      </div>
      <div className="progress">
        <div className="progress-fill" style={{ width: `${(left / DUEL_SECONDS) * 100}%` }} />
      </div>
      <div className="card-stage">
        <div className="stage-tag">{q.kind === 'kana' ? '這個字怎麼唸？' : '這個單字什麼意思？'}</div>
        <div className={q.kind === 'kana' ? 'kana-huge' : 'word-huge'}>{q.prompt}</div>
        <div className={`choices ${q.kind === 'word' ? 'zh-choices' : ''}`}>
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
        {picked && (
          <div className="quiz-feedback">
            {q.prompt}
            {q.sub ? `（${q.sub}）` : ''} = {q.answer}
            <button className="speak" onClick={() => speakJa(q.speak)}>🔊</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 限時衝刺：60 秒、個人卡池、COMBO ──

const SPRINT_SECONDS = 60;

function Sprint({ state, update, onExit }: { state: UserState; update: Props['update']; onExit: () => void }) {
  const pool = useMemo(
    () => Object.values(state.cards).filter((c) => isLearning(c) && (!isWordCard(c.id) || wordInfo(c.id, state))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [phase, setPhase] = useState<'run' | 'done'>('run');
  const [left, setLeft] = useState(SPRINT_SECONDS);
  const [qNo, setQNo] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const maxCombo = useRef(0);
  const scoreRef = useRef(0);
  const endedRef = useRef(false);

  const question = useMemo(() => {
    if (pool.length === 0) return null; // 可練卡池空了（例如全是已刪歌的 v: 卡）→ 防呆
    const card = pool[Math.floor(Math.random() * pool.length)];
    const mode = pickQuizMode(card.id, state, Math.random);
    const choices = quizChoices(card.id, mode, state);
    const word = isWordCard(card.id) ? wordInfo(card.id, state) : null;
    const answer = word ? word.zh : mode === 'kana2roma' ? KANA_BY_ID[card.id].romaji : KANA_BY_ID[card.id].kana;
    return { card, mode, choices, answer, word };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qNo]);
  const [picked, setPicked] = useState<string | null>(null);

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    const final = scoreRef.current;
    sfx.clear();
    update((s) => ({
      ...s,
      xp: s.xp + Math.floor(final / 10),
      coins: s.coins + Math.floor(final / 50),
      sprintBest: Math.max(s.sprintBest, final),
      maxCombo: Math.max(s.maxCombo, maxCombo.current),
    }));
    setPhase('done');
  }, [update]);

  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const remain = SPRINT_SECONDS - (Date.now() - start) / 1000;
      setLeft(Math.max(0, remain));
      if (remain <= 0) {
        clearInterval(iv);
        finish();
      }
    }, 100);
    return () => clearInterval(iv);
  }, [finish]);

  const pick = (c: string) => {
    if (picked || endedRef.current || !question) return;
    setPicked(c);
    const ok = c === question.answer;
    if (ok) {
      const nextCombo = combo + 1;
      maxCombo.current = Math.max(maxCombo.current, nextCombo);
      const pts = 10 * comboMultiplier(nextCombo);
      scoreRef.current += pts;
      setScore(scoreRef.current);
      setCombo(nextCombo);
      sfx.correct(nextCombo);
    } else {
      setCombo(0);
      sfx.wrong();
    }
    setTimeout(() => {
      setPicked(null);
      setQNo((n) => n + 1);
    }, ok ? 250 : 700);
  };

  if (phase === 'done') {
    const isBest = score >= state.sprintBest && score > 0;
    return (
      <div className="session-done">
        {isBest && (
          <div className="confetti">
            {Array.from({ length: 10 }).map((_, i) => <i key={i} />)}
          </div>
        )}
        <div className="clear-banner">TIME UP!</div>
        <BuddySay context="sprint" size={100} bounce={isBest} />
        <div className="done-stats">
          <div>
            <b>{score}</b>
            <span>{isBest ? '新紀錄！' : `最高 ${state.sprintBest}`}</span>
          </div>
          <div>
            <b>{maxCombo.current}</b>
            <span>最長 COMBO</span>
          </div>
          <div>
            <b>+{Math.floor(score / 10)}</b>
            <span>XP</span>
          </div>
        </div>
        <button className="primary" onClick={onExit}>
          回對戰場
        </button>
        <p className="hint">想跟對方比？回去「下戰帖」！</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="session-done">
        <BuddySay context="sprint" size={90} />
        <p className="hint">可練的卡片還不夠，先去每日練習累積幾天再來衝刺</p>
        <button className="primary" onClick={onExit}>回對戰場</button>
      </div>
    );
  }

  const mult = comboMultiplier(combo);
  return (
    <div className="session">
      <div className="sprint-hud">
        <span className={`combo-tag ${combo >= 3 ? 'hot' : ''}`}>{combo > 0 ? `${combo} COMBO ×${mult}` : 'COMBO ×1'}</span>
        <span className={`sprint-timer ${left <= 10 ? 'low' : ''}`}>{Math.ceil(left)}</span>
        <span>{score} 分</span>
      </div>
      <div className="progress">
        <div className="progress-fill" style={{ width: `${(left / SPRINT_SECONDS) * 100}%` }} />
      </div>
      <div className="card-stage">
        <div className="stage-tag">
          {question.word ? '什麼意思？' : question.mode === 'audio2kana' ? '聽聲音選字' : '怎麼唸？'}
        </div>
        {question.word ? (
          <div className="word-huge">{question.word.jp}</div>
        ) : question.mode === 'audio2kana' ? (
          <button className="speak huge" onClick={() => speakJa(KANA_BY_ID[question.card.id].kana)}>
            🔊 播放
          </button>
        ) : question.mode === 'lookalike' ? (
          <div className="kana-huge romaji-question">{KANA_BY_ID[question.card.id].romaji}</div>
        ) : (
          <div className="kana-huge">{KANA_BY_ID[question.card.id].kana}</div>
        )}
        <div className={`choices ${question.word ? 'zh-choices' : question.mode === 'kana2roma' ? '' : 'kana-choices'}`}>
          {question.choices.map((c) => (
            <button
              key={c}
              className={picked ? (c === question.answer ? 'choice correct' : c === picked ? 'choice wrong' : 'choice dim') : 'choice'}
              onClick={() => pick(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <button className="linkish" onClick={finish}>
        提前結束
      </button>
    </div>
  );
}
