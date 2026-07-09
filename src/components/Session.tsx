import { useMemo, useRef, useState } from 'react';
import type { SessionItem, UserState } from '../types.ts';
import { KANA_BY_ID } from '../data/kana.ts';
import { PHRASES } from '../data/phrases.ts';
import { buildSession, isWordCard, isGrammarCard, quizChoices, wordInfo } from '../lib/session.ts';
import { grammarByCardId, CURRICULUM_GRAMMAR, lessonByNo } from '../data/curriculum.ts';
import { grade, isDue, newCard } from '../lib/srs.ts';
import { completeSession, displayStreak } from '../lib/store.ts';
import { addDays } from '../lib/dates.ts';
import { COINS, MYSTERY_XP, drawOmikuji, dropPudding, dueStreakMilestone, luckOf, mysteryReward, mysteryToday, type Pudding } from '../data/fun.ts';
import { duelQuestions } from '../lib/seeded.ts';
import { taughtKana, taughtWords } from '../lib/taught.ts';
import { buildDailyPlan } from '../lib/course.ts';
import { speakJa } from '../lib/tts.ts';
import Blackboard from './Blackboard.tsx';
import { sfx } from '../lib/sounds.ts';
import { XP } from '../lib/xp.ts';
import { BuddySay } from './Buddy.tsx';

interface Props {
  state: UserState;
  today: string;
  update: (fn: (s: UserState) => UserState) => void;
  onFinished: () => void;
  sprint?: boolean; // 一天一課衝刺：放掉每日新量上限
}

type Phase = 'omikuji' | 'run' | 'done' | 'already' | 'mystery';

export default function Session({ state, today, update, onFinished, sprint = false }: Props) {
  // 今日課程計畫：配速後要新教的卡（標準日 cap，衝刺放掉）
  const plan = useMemo(() => buildDailyPlan(state, today, sprint), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [items, setItems] = useState<SessionItem[]>(
    () =>
      buildSession(state, today, Math.random, {
        newIds: [...plan.newVocab, ...plan.newGrammar],
        dialogLessonNo: plan.showDialog ? plan.lessonNo : undefined,
        quizLessonNo: plan.quizLessonNo ?? undefined,
      }).items,
  );
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>(() =>
    state.omikuji?.date !== today ? 'omikuji' : state.lastDoneDate === today ? 'already' : 'run',
  );
  const [drop, setDrop] = useState<Pudding | null>(null);
  const [milestone, setMilestone] = useState<{ day: number; coins: number } | null>(null);
  const lastTick = useRef(Date.now());
  const elapsed = useRef(0);

  // 完成一個項目就累積時間；發呆超過 90 秒不計（防掛機灌時數）
  const tick = () => {
    const now = Date.now();
    elapsed.current += Math.min(90e3, now - lastTick.current);
    lastTick.current = now;
  };

  const advance = () => {
    tick();
    if (idx + 1 >= items.length) {
      const minutes = Math.max(0.5, Math.round((elapsed.current / 60000) * 10) / 10);
      // 掉布丁：每天「首次」完成才掉（加練不重複掉，防刷）；稀有率用完成後的 streak
      const firstToday = state.lastDoneDate !== today;
      const nextStreak = !firstToday ? state.streak : state.lastDoneDate === addDays(today, -1) ? state.streak + 1 : 1;
      const dropped = firstToday ? dropPudding(nextStreak) : null;
      // 連續里程碑獎金（首次完成、命中且未領過才給）
      const milestone = firstToday ? dueStreakMilestone(nextStreak, state.claimedStreaks) : null;
      setDrop(dropped);
      setMilestone(milestone);
      update((s) => {
        const c = completeSession(s, minutes, today);
        return {
          ...c,
          xp: c.xp + XP.daily,
          coins: c.coins + (firstToday ? COINS.daily : 0) + (milestone?.coins ?? 0),
          puddings: dropped ? { ...c.puddings, [dropped.id]: (c.puddings[dropped.id] ?? 0) + 1 } : c.puddings,
          claimedStreaks: milestone ? [...c.claimedStreaks, milestone.day] : c.claimedStreaks,
          lastSprintDate: sprint ? today : c.lastSprintDate, // 衝刺過→隔天消化日
        };
      });
      sfx.clear();
      if (milestone) sfx.win();
      if (dropped?.rarity === 'SR') sfx.win();
      else if (dropped?.rarity === 'R') sfx.unlock();
      setPhase('done');
      onFinished();
    } else {
      setIdx(idx + 1);
    }
  };

  /** 測驗評分：答錯一定罰；答對只有在卡片到期（含剛教的新卡）才往前排。答對一律 +2 XP */
  // 御神籤幸運假名：今日該字答對 XP 雙倍
  const isLucky = (cardId: string) =>
    state.omikuji?.date === today && KANA_BY_ID[cardId]?.kana === state.omikuji.kana;

  const gradeQuiz = (cardId: string, ok: boolean) => {
    update((s) => {
      const card = s.cards[cardId] ?? newCard(cardId, today);
      const xp = ok ? s.xp + XP.quiz * (isLucky(cardId) ? 2 : 1) : s.xp;
      if (ok && !isDue(card, today)) return { ...s, xp };
      return { ...s, xp, cards: { ...s.cards, [cardId]: grade(card, ok, today) } };
    });
    if (!ok) {
      // 答錯的字，隔幾題再考一次
      const item = items[idx];
      if (item.kind === 'quiz') {
        const insertAt = Math.min(items.length, idx + 3);
        setItems([...items.slice(0, insertAt), { ...item, retest: true }, ...items.slice(insertAt)]);
      }
    }
  };

  const gradeFlash = (cardId: string, ok: boolean) => {
    if (ok) sfx.correct(0);
    else sfx.wrong();
    update((s) => ({
      ...s,
      xp: ok ? s.xp + XP.flash * (isLucky(cardId) ? 2 : 1) : s.xp,
      // 卡片理論上一定存在（來自到期清單），但比照 gradeQuiz 補防呆，避免組卷改動時整輪崩掉
      cards: { ...s.cards, [cardId]: grade(s.cards[cardId] ?? newCard(cardId, today), ok, today) },
    }));
  };

  const startExtra = () => {
    setItems(buildSession(state, today, Math.random, { extraOnly: true }).items);
    setIdx(0);
    elapsed.current = 0;
    lastTick.current = Date.now();
    setPhase('run');
  };

  if (phase === 'omikuji') {
    const drawn = state.omikuji?.date === today ? state.omikuji : null;
    return (
      <div className="card-stage omikuji">
        <div className="stage-tag">本日の御神籤</div>
        {!drawn ? (
          <>
            <div className="omikuji-box">🎋</div>
            <p className="hint">每天開店前抽一支，抽到幸運假名今天答對它 XP 雙倍</p>
            <button
              className="primary"
              onClick={() => {
                const res = drawOmikuji();
                sfx.unlock();
                update((s) => ({ ...s, omikuji: { date: today, ...res }, xp: s.xp + luckOf(res.luck).xp }));
              }}
            >
              抽籤！
            </button>
          </>
        ) : (
          <>
            <div className="omikuji-luck">{luckOf(drawn.luck).label}</div>
            <div className="omikuji-kana">
              今日幸運假名：<b>{drawn.kana}</b>
              <span className="hint">（答對它 XP 雙倍）</span>
            </div>
            <p className="omikuji-line">「{drawn.line}」</p>
            <p className="hint">籤金 +{luckOf(drawn.luck).xp} XP</p>
            <button className="primary" onClick={() => setPhase(state.lastDoneDate === today ? 'already' : 'run')}>
              開店，開始修行 →
            </button>
          </>
        )}
      </div>
    );
  }

  if (phase === 'mystery') {
    return (
      <MysteryPlay
        state={state}
        today={today}
        onDone={(correct) => {
          const perfect = correct === 3;
          const reward = perfect ? mysteryReward() : null;
          if (perfect) sfx.win();
          update((s) => ({
            ...s,
            mystery: { date: today, correct },
            xp: s.xp + (perfect ? MYSTERY_XP.perfect : MYSTERY_XP.partial),
            coins: s.coins + (perfect ? COINS.mysteryPerfect : 0),
            puddings: reward ? { ...s.puddings, [reward.id]: (s.puddings[reward.id] ?? 0) + 1 } : s.puddings,
          }));
          setDrop(reward);
          setPhase(state.lastDoneDate === today ? 'already' : 'run');
        }}
      />
    );
  }

  if (phase === 'already' || phase === 'done') {
    const streak = displayStreak(state, today);
    return (
      <div className="session-done">
        {phase === 'done' && (
          <div className="confetti">
            {Array.from({ length: 10 }).map((_, i) => <i key={i} />)}
          </div>
        )}
        {phase === 'done' && <div className="clear-banner">ごちそうさま！</div>}
        <BuddySay context={phase === 'done' ? 'done' : 'already'} size={110} bounce={phase === 'done'} />
        <h2>{phase === 'done' ? `今日份的日文，吃光光！+${XP.daily} XP${state.lastDoneDate === today ? ` +${COINS.daily}🪙` : ''}` : '今天這份已經吃完了'}</h2>
        {milestone && (
          <div className="milestone-banner">🎊 連續 {milestone.day} 天達成！獎金 +{milestone.coins} 🪙</div>
        )}
        <div className="done-stats">
          <div>
            <b>{streak}</b>
            <span>連續天數</span>
          </div>
          <div>
            <b>{(state.totalMinutes / 60).toFixed(1)}</b>
            <span>累計小時</span>
          </div>
          <div>
            <b>{state.sessionsDone}</b>
            <span>總場次</span>
          </div>
        </div>
        {drop && (
          <div className={`pudding-drop r-${drop.rarity}`}>
            <span className="pud" style={{ filter: `hue-rotate(${drop.hue}deg) saturate(${drop.sat ?? 1})` }}>🍮</span>
            <div className="pd-body">
              <b>
                獲得「{drop.name}」<i className="rarity">{drop.rarity}</i>
              </b>
              <small>{drop.desc}</small>
            </div>
          </div>
        )}
        {mysteryToday(state.user, today) && state.mystery?.date !== today && (
          <button className="mystery-knock" onClick={() => setPhase('mystery')}>
            🕵️ 叩叩……有神秘客上門！<small>3 題特別題，全對有稀有貨</small>
          </button>
        )}
        <Blackboard state={state} />
        <button className="primary" onClick={startExtra}>
          再來一份（10 題）
        </button>
        <p className="hint">到「我們的進度」看看對方今天練了沒 →</p>
      </div>
    );
  }

  const item = items[idx];
  return (
    <div className="session">
      <div className="progress">
        <div className="progress-fill" style={{ width: `${Math.round((idx / items.length) * 100)}%` }} />
      </div>
      <ItemView key={`${idx}:${itemKey(item)}`} item={item} state={state} today={today} update={update} onFlash={gradeFlash} onQuiz={gradeQuiz} onNext={advance} />
    </div>
  );
}

function itemKey(i: SessionItem): string {
  if (i.kind === 'phrase') return `p${i.idx}`;
  if (i.kind === 'dialog' || i.kind === 'minitest') return `${i.kind}${i.lessonNo}`;
  return `${i.kind}:${i.cardId}`;
}

function ItemView({
  item,
  state,
  today,
  update,
  onFlash,
  onQuiz,
  onNext,
}: {
  item: SessionItem;
  state: UserState;
  today: string;
  update: (fn: (s: UserState) => UserState) => void;
  onFlash: (cardId: string, ok: boolean) => void;
  onQuiz: (cardId: string, ok: boolean) => void;
  onNext: () => void;
}) {
  if (item.kind === 'teach') return <Teach cardId={item.cardId} state={state} onNext={onNext} />;
  if (item.kind === 'flash') return <Flash cardId={item.cardId} state={state} onGrade={(ok) => { onFlash(item.cardId, ok); onNext(); }} />;
  if (item.kind === 'quiz') return <Quiz item={item} state={state} onAnswer={onQuiz} onNext={onNext} />;
  if (item.kind === 'dialog') return <DialogRead lessonNo={item.lessonNo} onNext={onNext} />;
  if (item.kind === 'minitest') return <MiniTest lessonNo={item.lessonNo} today={today} update={update} onNext={onNext} />;
  return <PhraseCard idx={item.idx} onNext={onNext} />;
}

/** 讀本課會話：逐句 TTS，讀完進下一步。 */
function DialogRead({ lessonNo, onNext }: { lessonNo: number; onNext: () => void }) {
  const lines = lessonByNo(lessonNo)?.dialog ?? [];
  return (
    <div className="card-stage">
      <div className="stage-tag">📖 讀本課會話 · 第 {lessonNo} 課</div>
      <div className="bubbles" style={{ width: '100%' }}>
        {lines.map((l, i) => (
          <button key={i} className="bubble o" onClick={() => speakJa(l.jp)}>
            <span className="b-jp">{l.jp}</span>
            {l.zh && <span className="b-zh">{l.zh}</span>}
          </button>
        ))}
      </div>
      <button className="primary" onClick={onNext}>
        讀完了 →
      </button>
    </div>
  );
}

/** 本課小測：逐題揭曉、自我檢查對錯，達 70% 過關；結果寫回 lessonsPassed / quizFail。 */
function MiniTest({
  lessonNo,
  today,
  update,
  onNext,
}: {
  lessonNo: number;
  today: string;
  update: (fn: (s: UserState) => UserState) => void;
  onNext: () => void;
}) {
  const quiz = lessonByNo(lessonNo)?.quiz ?? [];
  const [qi, setQi] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const correct = useRef(0);
  const lock = useRef(false); // 防連點：同一題只計一次

  if (quiz.length === 0) {
    return (
      <div className="card-stage">
        <div className="stage-tag">本課小測</div>
        <button className="primary" onClick={onNext}>
          繼續 →
        </button>
      </div>
    );
  }

  const passed = correct.current / quiz.length >= 0.7;

  const finish = () => {
    const ok = correct.current / quiz.length >= 0.7;
    update((s) => {
      const next = { ...s };
      if (ok) {
        next.lessonsPassed = [...new Set([...(s.lessonsPassed ?? []), lessonNo])];
        if (s.quizFail?.no === lessonNo) next.quizFail = undefined;
      } else {
        next.quizFail = { no: lessonNo, date: today };
      }
      return next;
    });
    if (ok) sfx.win();
    setDone(true);
  };

  if (done) {
    return (
      <div className="card-stage">
        {passed && <div className="clear-banner">過關！</div>}
        <div className="stage-tag">小測結果</div>
        <div className="word-huge">{correct.current}/{quiz.length}</div>
        <p className="hint">{passed ? '這課學完了 🎉 明天接下一課' : '沒過沒關係，明天補強日再考一次'}</p>
        <button className="primary" onClick={onNext}>
          繼續 →
        </button>
      </div>
    );
  }

  const q = quiz[qi];
  const advance = (ok: boolean) => {
    if (lock.current) return;
    lock.current = true;
    if (ok) correct.current += 1;
    if (qi + 1 >= quiz.length) finish();
    else {
      setQi(qi + 1);
      setRevealed(false);
    }
  };

  return (
    <div className="card-stage">
      <div className="stage-tag">📝 本課小測 · {qi + 1}/{quiz.length}（達 70% 過關）</div>
      <p className="minitest-q" style={{ fontSize: '1.05rem', lineHeight: 1.6 }}>{q.q}</p>
      {!revealed ? (
        <button className="primary" onClick={() => { lock.current = false; setRevealed(true); }}>
          顯示答案
        </button>
      ) : (
        <>
          <div className="quiz-feedback">答案：{q.a}</div>
          <div className="grade-row">
            <button className="bad" onClick={() => advance(false)}>
              答錯了
            </button>
            <button className="good" onClick={() => advance(true)}>
              我答對 ✓
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** 神秘客：3 題 seeded 特別題（無計時），只考已教（無教不考），全對掉稀有布丁 */
function MysteryPlay({ state, today, onDone }: { state: UserState; today: string; onDone: (correct: number) => void }) {
  const questions = useMemo(
    () => duelQuestions(`mc:${state.user}:${today}`, { kanas: taughtKana(state), words: taughtWords(state) }).slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.user, today],
  );
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const correct = useRef(0);
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
      if (qi + 1 >= questions.length) onDone(correct.current);
      else {
        setPicked(null);
        setQi(qi + 1);
      }
    }, ok ? 600 : 1300);
  };

  return (
    <div className="card-stage">
      <div className="stage-tag">🕵️ 神秘客的考驗 · {qi + 1}/3</div>
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
        </div>
      )}
    </div>
  );
}

function MissingCard({ onNext }: { onNext: () => void }) {
  return (
    <div className="card-stage">
      <div className="stage-tag">這張卡的內容不見了（可能歌曲被移除）</div>
      <button className="primary" onClick={onNext}>
        跳過 →
      </button>
    </div>
  );
}

function Speak({ text, big }: { text: string; big?: boolean }) {
  return (
    <button className={big ? 'speak big' : 'speak'} onClick={() => speakJa(text)} aria-label="發音">
      🔊
    </button>
  );
}

function Teach({ cardId, state, onNext }: { cardId: string; state: UserState; onNext: () => void }) {
  if (isGrammarCard(cardId)) {
    const entry = CURRICULUM_GRAMMAR[cardId];
    if (!entry) return <MissingCard onNext={onNext} />;
    const { no, point } = entry;
    const ex = point.examples[0];
    return (
      <div className="card-stage">
        <div className="stage-tag">新文法 · 第{no}課</div>
        <div className="phrase-jp">{point.pattern}</div>
        {point.formula.map((f, i) => (
          <div key={i} className="kana-romaji">{f}</div>
        ))}
        {ex && (
          <button className="gram-ex" onClick={() => speakJa(ex.jp)}>
            🔊 {ex.jp}　{ex.zh}
          </button>
        )}
        {point.notes.map((n, i) => (
          <p key={i} className="hint">⚠️ {n}</p>
        ))}
        <button className="primary" onClick={onNext}>
          記住了 →
        </button>
      </div>
    );
  }
  if (isWordCard(cardId)) {
    const w = wordInfo(cardId, state);
    if (!w) return <MissingCard onNext={onNext} />;
    return (
      <div className="card-stage">
        <div className="stage-tag">新單字 · N5</div>
        <div className="word-huge">{w.jp}</div>
        {w.kana !== w.jp && <div className="kana-romaji">{w.kana}</div>}
        <div className="word-zh">{w.zh}</div>
        <Speak text={w.jp} big />
        <button className="primary" onClick={onNext}>
          記住了 →
        </button>
      </div>
    );
  }
  const k = KANA_BY_ID[cardId];
  return (
    <div className="card-stage">
      <div className="stage-tag">新字 · {k.script === 'hira' ? '平假名' : '片假名'} {k.row}</div>
      <div className="kana-huge">{k.kana}</div>
      <div className="kana-romaji">{k.romaji}</div>
      <Speak text={k.kana} big />
      <button className="primary" onClick={onNext}>
        記住了 →
      </button>
    </div>
  );
}

function Flash({ cardId, state, onGrade }: { cardId: string; state: UserState; onGrade: (ok: boolean) => void }) {
  const [revealed, setRevealed] = useState(false);
  if (isGrammarCard(cardId)) {
    const point = grammarByCardId(cardId);
    if (!point) return <MissingCard onNext={() => onGrade(true)} />;
    const ex = point.examples[0];
    return (
      <div className="card-stage">
        <div className="stage-tag">複習文法 · 記得怎麼用嗎？</div>
        <div className="phrase-jp">{point.pattern}</div>
        {!revealed ? (
          <button className="primary" onClick={() => setRevealed(true)}>
            顯示答案
          </button>
        ) : (
          <>
            {point.formula.map((f, i) => (
              <div key={i} className="kana-romaji">{f}</div>
            ))}
            {ex && (
              <button className="gram-ex" onClick={() => speakJa(ex.jp)}>
                🔊 {ex.jp}　{ex.zh}
              </button>
            )}
            <div className="grade-row">
              <button className="bad" onClick={() => onGrade(false)}>
                不會 😵
              </button>
              <button className="good" onClick={() => onGrade(true)}>
                會 ✓
              </button>
            </div>
          </>
        )}
      </div>
    );
  }
  const word = isWordCard(cardId) ? wordInfo(cardId, state) : null;
  const k = word ? null : KANA_BY_ID[cardId];
  if (isWordCard(cardId) && !word) return <MissingCard onNext={() => onGrade(true)} />;

  return (
    <div className="card-stage">
      <div className="stage-tag">{word ? '複習單字 · 意思記得嗎？' : '複習 · 唸得出來嗎？'}</div>
      {word ? <div className="word-huge">{word.jp}</div> : <div className="kana-huge">{k!.kana}</div>}
      {!revealed ? (
        <button className="primary" onClick={() => setRevealed(true)}>
          顯示答案
        </button>
      ) : (
        <>
          {word ? (
            <>
              {word.kana !== word.jp && <div className="kana-romaji">{word.kana}</div>}
              <div className="word-zh">
                {word.zh} <Speak text={word.jp} />
              </div>
            </>
          ) : (
            <div className="kana-romaji">
              {k!.romaji} <Speak text={k!.kana} />
            </div>
          )}
          <div className="grade-row">
            <button className="bad" onClick={() => onGrade(false)}>
              不會 😵
            </button>
            <button className="good" onClick={() => onGrade(true)}>
              會 ✓
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Quiz({
  item,
  state,
  onAnswer,
  onNext,
}: {
  item: Extract<SessionItem, { kind: 'quiz' }>;
  state: UserState;
  onAnswer: (cardId: string, ok: boolean) => void;
  onNext: () => void;
}) {
  const word = item.mode === 'word2zh' ? wordInfo(item.cardId, state) : null;
  const k = item.mode === 'word2zh' ? null : KANA_BY_ID[item.cardId];
  // 選項只算一次，state 之後變動不重洗（避免答題中選項跳動）
  const choices = useMemo(() => quizChoices(item.cardId, item.mode, state), [item.cardId, item.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<string | null>(null);
  if (item.mode === 'grammar') {
    const point = grammarByCardId(item.cardId);
    if (!point || !point.examples.length)
      return <MissingCard onNext={() => { onAnswer(item.cardId, true); onNext(); }} />;
    const ex = point.examples[0];
    const gPick = (c: string) => {
      if (picked) return;
      setPicked(c);
      const ok = c === ex.jp;
      if (ok) sfx.correct(0);
      else sfx.wrong();
      onAnswer(item.cardId, ok);
      setTimeout(onNext, ok ? 800 : 1800);
    };
    return (
      <div className="card-stage">
        <div className="stage-tag">{item.retest ? '再考一次 · ' : ''}這個意思，日文怎麼說？</div>
        <div className="word-zh">{ex.zh}</div>
        <p className="hint">文法：{point.pattern}</p>
        <div className="choices zh-choices">
          {choices.map((c) => (
            <button
              key={c}
              className={picked ? (c === ex.jp ? 'choice correct' : c === picked ? 'choice wrong' : 'choice dim') : 'choice'}
              onClick={() => gPick(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {picked && picked !== ex.jp && (
          <div className="quiz-feedback">
            正解：{ex.jp} <Speak text={ex.jp} />
          </div>
        )}
      </div>
    );
  }
  if (item.mode === 'word2zh' && !word) return <MissingCard onNext={() => { onAnswer(item.cardId, true); onNext(); }} />;
  const answer = word ? word.zh : item.mode === 'kana2roma' ? k!.romaji : k!.kana;

  const pick = (c: string) => {
    if (picked) return;
    setPicked(c);
    const ok = c === answer;
    if (ok) sfx.correct(0);
    else sfx.wrong();
    onAnswer(item.cardId, ok);
    setTimeout(onNext, ok ? 650 : 1600);
  };

  return (
    <div className="card-stage">
      <div className="stage-tag">
        {item.retest ? '再考一次 · ' : ''}
        {item.mode === 'kana2roma' && '這個字怎麼唸？'}
        {item.mode === 'audio2kana' && '聽聲音選字'}
        {item.mode === 'lookalike' && '長得像，看仔細！哪個是它？'}
        {item.mode === 'word2zh' && '這個單字是什麼意思？'}
      </div>
      {item.mode === 'kana2roma' && <div className="kana-huge">{k!.kana}</div>}
      {item.mode === 'audio2kana' && (
        <button className="speak huge" onClick={() => speakJa(k!.kana)}>
          🔊 播放
        </button>
      )}
      {item.mode === 'lookalike' && <div className="kana-huge romaji-question">{k!.romaji}</div>}
      {item.mode === 'word2zh' && <div className="word-huge">{word!.jp}</div>}
      <div className={`choices ${item.mode === 'kana2roma' ? '' : item.mode === 'word2zh' ? 'zh-choices' : 'kana-choices'}`}>
        {choices.map((c) => (
          <button
            key={c}
            className={picked ? (c === answer ? 'choice correct' : c === picked ? 'choice wrong' : 'choice dim') : 'choice'}
            onClick={() => pick(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {picked && picked !== answer && (
        <div className="quiz-feedback">
          {word ? (
            <>
              正解：{word.zh}（{word.kana}） <Speak text={word.jp} />
            </>
          ) : (
            <>
              正解：{answer === k!.kana ? k!.kana : `${k!.kana} = ${k!.romaji}`} <Speak text={k!.kana} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PhraseCard({ idx, onNext }: { idx: number; onNext: () => void }) {
  const p = PHRASES[idx % PHRASES.length];
  return (
    <div className="card-stage phrase-stage">
      <div className="stage-tag">今日一句 · 跟著唸三次</div>
      <div className="phrase-jp">{p.jp}</div>
      {p.kana !== p.jp && <div className="phrase-kana">{p.kana}</div>}
      <div className="phrase-romaji">{p.romaji}</div>
      <div className="phrase-zh">{p.zh}</div>
      <Speak text={p.jp} big />
      <button className="primary" onClick={onNext}>
        唸完了，收工 🎉
      </button>
    </div>
  );
}
