import { useState } from 'react';
import type { UserState } from '../types.ts';
import { buildDailyPlan, courseProgress, masteryPct } from '../lib/course.ts';

// 「今日課程」每日固定入口：課程/掌握度雙進度＋今天的份＋開始＋一天一課衝刺。
// 用既有主題 class（card-stage/stage-tag/goal-bar/primary/hint/tool-check）＋中性 inline 排版，不動 styles.css。
export default function TodayHome({
  state,
  today,
  onStart,
}: {
  state: UserState;
  today: string;
  onStart: (sprint: boolean) => void;
}) {
  const [sprint, setSprint] = useState(false);
  const plan = buildDailyPlan(state, today, sprint);
  const prog = courseProgress(state);
  const n5 = masteryPct(state, 'N5');
  const n4 = masteryPct(state, 'N4');
  const doneToday = state.lastDoneDate === today;
  const lessonName = plan.inKana ? '五十音（基礎假名）' : plan.lessonTitle;
  const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

  const row = { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' } as const;

  return (
    <div className="today-home card-stage">
      <div className="stage-tag">今日課程</div>

      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={row}>
          <span className="hint" style={{ width: 48, margin: 0 }}>課程</span>
          <div className="goal-bar" style={{ flex: 1 }}>
            <div className="goal-fill" style={{ width: pct((prog.done / prog.total) * 100) }} />
          </div>
          <span className="hint" style={{ width: 92, margin: 0, textAlign: 'right' }}>
            {plan.inKana ? '五十音' : `第 ${plan.lessonNo} 課`} / {prog.total}
          </span>
        </div>
        <div style={row}>
          <span className="hint" style={{ width: 48, margin: 0 }}>掌握度</span>
          <div className="goal-bar" style={{ flex: 1 }}>
            <div className="goal-fill" style={{ width: pct(n5) }} />
          </div>
          <span className="hint" style={{ width: 92, margin: 0, textAlign: 'right' }}>
            N5 {n5}%{n4 > 0 ? ` · N4 ${n4}%` : ''}
          </span>
        </div>
      </div>

      <div style={{ fontSize: '1.05rem', fontWeight: 600, margin: '14px 0 2px' }}>{lessonName}</div>
      {plan.mode === 'digest' && <p className="hint" style={{ margin: '2px 0' }}>昨天衝刺了 · 今天消化日，先不學新的、把學過的鞏固好</p>}
      {plan.mode === 'reinforce' && <p className="hint" style={{ margin: '2px 0' }}>昨天小測沒過 · 今天補強日，複習＋重考這課</p>}
      {plan.light && plan.mode === 'normal' && !plan.inKana && (
        <p className="hint" style={{ margin: '2px 0' }}>複習有點多，今天走輕量、少學一點新的</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0', width: '100%', maxWidth: 420, textAlign: 'left' }}>
        <li style={{ padding: '6px 0' }}>🔁 到期複習 <b>{plan.dueCount}</b> 張</li>
        {plan.newVocab.length + plan.newGrammar.length > 0 ? (
          <li style={{ padding: '6px 0' }}>
            ✨ 今天的新內容：<b>{plan.newVocab.length}</b> {plan.inKana ? '個假名' : '個單字'}
            {plan.newGrammar.length > 0 ? <> · <b>{plan.newGrammar.length}</b> 個文法</> : ''}
          </li>
        ) : (
          <li style={{ padding: '6px 0', color: 'var(--muted, #999)' }}>✨ 今天不學新的，先鞏固</li>
        )}
        {!plan.inKana && plan.dialog.length > 0 && <li style={{ padding: '6px 0' }}>📖 讀本課會話 {plan.dialog.length} 句</li>}
        {plan.quizLessonNo != null && <li style={{ padding: '6px 0' }}>📝 本課小測（達 70% 過關）</li>}
        <li style={{ padding: '6px 0' }}>🍮 今日一句</li>
      </ul>

      <button className="primary" onClick={() => onStart(sprint)}>
        {doneToday ? '再練一輪 →' : '開始今天的課 →'}
      </button>

      {!plan.inKana && !doneToday && (
        <label className="tool-check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={sprint} onChange={(e) => setSprint(e.target.checked)} />
          一天一課衝刺（整課吃完，隔天自動消化）
        </label>
      )}

      <p className="hint">
        {doneToday
          ? '今天的課完成了 ✓'
          : plan.inKana
            ? '大概 10–15 分鐘。練完還想學，按「再來一份」就繼續教下一批。'
            : '今天大概 20 分鐘。大課會分 2–3 天，別急。'}
      </p>
    </div>
  );
}
