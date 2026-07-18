import { useEffect, useState } from 'react';
import type { UserState } from '../types.ts';
import { MISSION_CATALOG, missionForDate } from '../data/missions.ts';
import { completeMission, missionDoneToday } from '../lib/missions.ts';
import { sfx } from '../lib/sounds.ts';
import { speakJa, stopSpeak } from '../lib/tts.ts';

type Phase = 'brief' | 'prep' | 'prep-check' | 'travel' | 'play' | 'result';

interface Props {
  state: UserState;
  today: string;
  update: (fn: (s: UserState) => UserState) => void;
  onExit: () => void;
}

export default function StationMission({ state, today, update, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>('brief');
  const [lessonIndex, setLessonIndex] = useState(0);
  const [prepPick, setPrepPick] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [wrongOnCurrent, setWrongOnCurrent] = useState(false);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const mission = missionForDate(today);
  const doneToday = missionDoneToday(state, mission.id, today);
  const question = mission.questions[questionIndex];

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
      stopSpeak();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'travel') return;
    const timer = window.setTimeout(() => setPhase('play'), 1450);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const leave = () => {
    stopSpeak();
    onExit();
  };

  const choosePrep = (index: number) => {
    setPrepPick(index);
    if (index === 0) sfx.correct(0);
    else sfx.wrong();
  };

  const chooseAnswer = (index: number) => {
    if (pick === question.correct) return;
    setPick(index);
    if (index === question.correct) {
      sfx.correct(questionIndex);
    } else {
      sfx.wrong();
      setWrongOnCurrent(true);
    }
  };

  const advanceQuestion = () => {
    if (pick !== question.correct) return;
    const nextCorrect = firstTryCorrect + (wrongOnCurrent ? 0 : 1);
    if (questionIndex + 1 < mission.questions.length) {
      setFirstTryCorrect(nextCorrect);
      setQuestionIndex((i) => i + 1);
      setPick(null);
      setWrongOnCurrent(false);
      return;
    }
    setFinalScore(nextCorrect);
    update((s) => completeMission(s, mission.id, today, nextCorrect));
    sfx.clear();
    setPhase('result');
  };

  const restart = () => {
    setQuestionIndex(0);
    setPick(null);
    setWrongOnCurrent(false);
    setFirstTryCorrect(0);
    setFinalScore(0);
    setPhase('play');
  };

  return (
    <div className={`mission-overlay phase-${phase}`} role="dialog" aria-modal="true" aria-label={`今日委託：${mission.title}`}>
      <div className="mission-page">
        <header className="mission-head">
          <div>
            <small>本日の依頼</small>
            <b>{mission.jpTitle}</b>
          </div>
          <button className="mission-close" onClick={leave} aria-label="離開委託">あとで</button>
        </header>

        {phase === 'brief' && (
          <main className="mission-letter-wrap">
            <section className="mission-letter">
              <span className="mission-letter-kicker">今日のお願い · {mission.theme}</span>
              <h1>{mission.title}</h1>
              <p className="mission-request">{mission.request}</p>
              <p className="mission-catalog-note">日常情境 {MISSION_CATALOG.length} 種輪替中</p>
              <div className="mission-shop-line">
                <img src="/cafe/shopkeeper/idle.png" alt="熊貓店長" draggable={false} />
                <p>{mission.shopLine}</p>
              </div>
              {doneToday && <p className="mission-done-note">本日完了　今日は已完成，可以再練一次。</p>}
              <button className="mission-primary" onClick={() => { sfx.unlock(); setPhase('prep'); }}>
                準備して出発
              </button>
              <button className="mission-text-btn" onClick={leave}>あとで</button>
            </section>
          </main>
        )}

        {phase === 'prep' && (() => {
          const card = mission.lesson[lessonIndex];
          return (
            <main className="mission-prep">
              <div className="mission-progress" aria-label={`準備 ${lessonIndex + 1} / ${mission.lesson.length}`}>
                {mission.lesson.map((_, i) => <i key={i} className={i <= lessonIndex ? 'on' : ''} />)}
              </div>
              <p className="mission-eyebrow">出発前の準備</p>
              <section className="lesson-ticket">
                <button className="lesson-audio" onClick={() => speakJa(card.jp)} aria-label="播放日文">音</button>
                <b>{card.jp}</b>
                <span>{card.kana}</span>
                <p>{card.zh}</p>
              </section>
              <p className="mission-hint">點「音」聽一次，先抓住這個情境的關鍵詞。</p>
              <button
                className="mission-primary"
                onClick={() => {
                  if (lessonIndex + 1 < mission.lesson.length) setLessonIndex((i) => i + 1);
                  else setPhase('prep-check');
                  sfx.tick();
                }}
              >
                {lessonIndex + 1 < mission.lesson.length ? '下一張提示' : '來試一次'}
              </button>
            </main>
          );
        })()}

        {phase === 'prep-check' && (
          <main className="mission-prep mission-prep-check">
            <p className="mission-eyebrow">出発前の確認</p>
            <h2>{mission.prepPrompt}</h2>
            <div className="mission-choice-list compact">
              {mission.prepChoices.map((choice, i) => (
                <button
                  key={choice.label}
                  className={`mission-ticket-choice ${prepPick === i ? (i === 0 ? 'correct' : 'wrong') : ''}`}
                  onClick={() => choosePrep(i)}
                >
                  <b>{choice.label}</b>
                </button>
              ))}
            </div>
            {prepPick != null && (
              <div className={`mission-feedback ${prepPick === 0 ? 'good' : 'bad'}`} aria-live="polite">
                <b>{prepPick === 0 ? '答對，準備完了' : '答錯，但這句也有用'}</b>
                <span>{mission.prepChoices[prepPick].explain}</span>
                {prepPick === 0 && <small>{mission.phraseKana}</small>}
              </div>
            )}
            <button className="mission-primary" disabled={prepPick !== 0} onClick={() => { setPhase('travel'); sfx.unlock(); }}>
              出発
            </button>
          </main>
        )}

        {phase === 'travel' && (
          <main className="mission-travel" aria-live="polite">
            <div className="travel-card">
              <span>日々喫茶</span>
              <i><b>●</b><b>●</b><b>●</b></i>
              <span>{mission.destinationLabel}</span>
              <strong>出発</strong>
            </div>
          </main>
        )}

        {(phase === 'play' || phase === 'result') && (
          <main className="mission-play">
            <div className="mission-round-head">
              <span>{phase === 'result' ? '依頼完了' : `実戦 ${questionIndex + 1} / ${mission.questions.length}`}</span>
              {phase === 'play' && <button onClick={() => speakJa(question.line)}>▶ 聞く</button>}
            </div>

            <section className="station-postcard">
              <img className="station-bg" src={mission.image} alt={mission.imageAlt} draggable={false} />
              <img className="station-player" src={`/cafe/guests/${state.user}.png`} alt="玩家角色" draggable={false} />
              {phase === 'result' && <div className="mission-stamp">依頼<br />完了</div>}
            </section>

            {phase === 'play' ? (
              <>
                <section className="station-dialogue">
                  <span>{question.speaker}</span>
                  <button onClick={() => speakJa(question.line)} aria-label="播放這句日文">音</button>
                  <b className={question.audioOnly ? 'audio-challenge' : ''}>
                    {question.audioOnly ? '♪ 先聽聲音，作答後公布字幕' : question.line}
                  </b>
                  <p>{question.prompt}</p>
                </section>
                <div className={`mission-choice-list ${question.choices.length === 3 && question.choices.every((c) => c.label.length <= 4) ? 'ticket-row' : ''}`}>
                  {question.choices.map((choice, i) => {
                    const chosen = pick === i;
                    const cls = chosen ? (i === question.correct ? 'correct' : 'wrong') : '';
                    return (
                      <button key={choice.label} className={`mission-ticket-choice ${cls}`} onClick={() => chooseAnswer(i)}>
                        <b>{choice.label}</b>
                      </button>
                    );
                  })}
                </div>
                {pick != null && (
                  <div className={`mission-feedback ${pick === question.correct ? 'good' : 'bad'}`} aria-live="polite">
                    {question.audioOnly && (
                      <span className="mission-answer-reveal">
                        <b>{question.line}</b>
                        {question.lineKana && <small>{question.lineKana}</small>}
                      </span>
                    )}
                    <b>{pick === question.correct ? '答對，意思也一起收下' : '答錯，但這個意思先收下'}</b>
                    <span>{pick === question.correct ? question.explain : question.choices[pick].explain}</span>
                  </div>
                )}
                <button className="mission-primary" disabled={pick !== question.correct} onClick={advanceQuestion}>
                  {questionIndex + 1 < mission.questions.length ? '下一步' : '完成委託'}
                </button>
              </>
            ) : (
              <section className="mission-result">
                <p className="mission-eyebrow">今日の依頼、完了。</p>
                <h2>{finalScore} / {mission.questions.length}</h2>
                <p>{finalScore === mission.questions.length ? mission.perfectLine : mission.retryLine}</p>
                <small>今日委託是情境練習，不發正式金幣、XP 或家具。</small>
                {finalScore < mission.questions.length && <button className="mission-text-btn" onClick={restart}>再練一次</button>}
                <button className="mission-primary" onClick={leave}>回到喫茶店</button>
              </section>
            )}
          </main>
        )}
      </div>
    </div>
  );
}
