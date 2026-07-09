import { useMemo, useState } from 'react';
import type { UserState } from '../types.ts';
import type { WordInfo } from '../data/vocab.ts';
import { CRAM_DAILY_COIN_CAP, CRAM_SIZE, cramCategories, cramChoices, cramCoins, cramRound } from '../lib/cram.ts';
import { grade, isDue, newCard } from '../lib/srs.ts';
import { speakJa } from '../lib/tts.ts';
import { sfx } from '../lib/sounds.ts';

// 背單字（首頁入口）：挑分類 → 教 10 個 → 小考 10 題 → 依分數發金幣。
// 卡片/測驗 UI 沿用 Session 的 card-stage / choices 樣式；SRS 評分規則同 gradeQuiz。
type Phase = { v: 'pick' } | { v: 'teach'; i: number } | { v: 'quiz'; i: number } | { v: 'done' };

export default function VocabCram({
  state,
  today,
  update,
  onExit,
}: {
  state: UserState;
  today: string;
  update: (fn: (s: UserState) => UserState) => void;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ v: 'pick' });
  const [round, setRound] = useState<WordInfo[]>([]);
  const [cat, setCat] = useState('');
  const [correct, setCorrect] = useState(0);
  const [earned, setEarned] = useState(0);
  const cats = useMemo(() => cramCategories(state), [phase.v === 'pick']); // eslint-disable-line react-hooks/exhaustive-deps

  const startCat = (c: string) => {
    const r = cramRound(state, c);
    if (r.length === 0) return;
    setCat(c);
    setRound(r);
    setCorrect(0);
    setPhase({ v: 'teach', i: 0 });
    speakJa(r[0].jp);
  };

  // 評分寫 w: 卡（同 Session gradeQuiz：答錯一定罰；答對只有到期的卡才往前排，防灌排程）
  const gradeCard = (w: WordInfo, ok: boolean) => {
    update((s) => {
      const id = `w:${w.jp}`;
      const card = s.cards[id] ?? newCard(id, today);
      if (ok && !isDue(card, today)) return s;
      return { ...s, cards: { ...s.cards, [id]: grade(card, ok, today) } };
    });
  };

  const finish = (finalCorrect: number) => {
    const { earned: gain } = cramCoins(finalCorrect, state, today);
    if (gain > 0) {
      update((s) => {
        const used = s.cram?.date === today ? s.cram.coins : 0;
        const g = Math.max(0, Math.min(gain, CRAM_DAILY_COIN_CAP - used));
        return { ...s, coins: s.coins + g, cram: { date: today, coins: used + g } };
      });
    }
    setEarned(gain);
    sfx.clear();
    setPhase({ v: 'done' });
  };

  if (phase.v === 'pick') {
    return (
      <div className="card-stage">
        <div className="stage-tag">🗂 背單字</div>
        <p className="hint" style={{ marginTop: 0 }}>挑一類，一次學 {CRAM_SIZE} 個＋小考。學過的字會進每日複習，不會重教。</p>
        <div className="choices zh-choices" style={{ width: '100%' }}>
          {cats.map((c) => (
            <button key={c.cat} className="choice" onClick={() => startCat(c.cat)}>
              {c.cat}
              <small style={{ display: 'block', opacity: 0.65 }}>{c.learned}/{c.total} 學過</small>
            </button>
          ))}
        </div>
        <button className="linkish" onClick={onExit}>← 回今日課程</button>
      </div>
    );
  }

  if (phase.v === 'teach') {
    const w = round[phase.i];
    const next = () => {
      const j = phase.i + 1;
      if (j < round.length) {
        setPhase({ v: 'teach', i: j });
        speakJa(round[j].jp);
      } else {
        setPhase({ v: 'quiz', i: 0 });
      }
    };
    return (
      <div className="card-stage">
        <div className="stage-tag">背單字 · {cat} {phase.i + 1}/{round.length}</div>
        <div className="word-huge">{w.jp}</div>
        {w.kana !== w.jp && <div className="kana-romaji">{w.kana}</div>}
        <div className="word-zh">{w.zh}</div>
        <button className="speak" onClick={() => speakJa(w.jp)}>🔊</button>
        <button className="primary" onClick={next}>
          {phase.i + 1 < round.length ? '記住了 →' : '開始小考 →'}
        </button>
      </div>
    );
  }

  if (phase.v === 'quiz') {
    return (
      <CramQuiz
        key={phase.i}
        w={round[phase.i]}
        round={round}
        no={phase.i + 1}
        onDone={(ok) => {
          gradeCard(round[phase.i], ok);
          const total = correct + (ok ? 1 : 0);
          setCorrect(total);
          if (phase.i + 1 < round.length) setPhase({ v: 'quiz', i: phase.i + 1 });
          else finish(total);
        }}
      />
    );
  }

  const { capLeft } = cramCoins(0, state, today);
  return (
    <div className="card-stage">
      <div className="stage-tag">小考結果</div>
      <div className="word-huge">{correct}/{round.length}</div>
      <div className="word-zh">
        {correct === round.length ? '全対！すごい！' : correct >= round.length * 0.7 ? 'いいね、記起來了大半' : '慢慢來，忘了的明天複習會再出現'}
      </div>
      <p className="hint">
        {earned > 0 ? `獎勵 +${earned} 🪙` : '今日背單字獎勵已領滿'}
        {earned > 0 && capLeft <= 0 && '（今日額度用完）'}
      </p>
      <button className="primary" onClick={() => startCat(cat)}>再背一輪「{cat}」→</button>
      <button className="tool" onClick={() => setPhase({ v: 'pick' })}>換一類</button>
      <button className="linkish" onClick={onExit}>← 回今日課程</button>
    </div>
  );
}

function CramQuiz({ w, round, no, onDone }: { w: WordInfo; round: WordInfo[]; no: number; onDone: (ok: boolean) => void }) {
  const choices = useMemo(() => cramChoices(w, round), [w]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<string | null>(null);
  const pick = (c: string) => {
    if (picked) return;
    setPicked(c);
    const ok = c === w.zh;
    if (ok) sfx.correct(0);
    else sfx.wrong();
    setTimeout(() => onDone(ok), ok ? 650 : 1600);
  };
  return (
    <div className="card-stage">
      <div className="stage-tag">小考 {no}/{round.length} · 這個單字是什麼意思？</div>
      <div className="word-huge">{w.jp}</div>
      <div className="choices zh-choices">
        {choices.map((c) => (
          <button
            key={c}
            className={picked ? (c === w.zh ? 'choice correct' : c === picked ? 'choice wrong' : 'choice dim') : 'choice'}
            onClick={() => pick(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {picked && picked !== w.zh && (
        <div className="quiz-feedback">
          正解：{w.zh}（{w.kana}）
        </div>
      )}
    </div>
  );
}
