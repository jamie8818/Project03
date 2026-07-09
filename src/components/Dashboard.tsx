import type { UserState } from '../types.ts';
import { USERS, displayStreak } from '../lib/store.ts';
import { COINS, GACHA_COST, PUDDINGS, gachaRoll, luckOf, type Pudding } from '../data/fun.ts';
import { sfx } from '../lib/sounds.ts';
import { useState } from 'react';
import { DEFAULT_GOAL, lessonPace, type GoalLevel } from '../lib/goal.ts';
import { kanaPhaseEta } from '../lib/course.ts';
import { HIRAGANA, KATAKANA } from '../data/kana.ts';
import { isMastered } from '../lib/srs.ts';
import { ACHIEVEMENTS, levelInfo } from '../lib/xp.ts';
import Buddy from './Buddy.tsx';
import { ShopBanner, ShopPage } from './Shop.tsx';

function masteryCount(s: UserState, prefixes: string[]): number {
  return Object.values(s.cards).filter((c) => prefixes.some((p) => c.id.startsWith(p)) && isMastered(c)).length;
}

function PersonCard({ s, today, me }: { s: UserState; today: string; me: boolean }) {
  const name = USERS.find((u) => u.id === s.user)!.name;
  const doneToday = s.lastDoneDate === today;
  return (
    <div className={`person ${doneToday ? 'done-today' : ''}`}>
      <div className="person-head">
        <span className="person-name">
          {me && <Buddy mood={doneToday ? 'happy' : 'sleep'} size={30} />} {name}
          {s.wornBadge && <span title={ACHIEVEMENTS.find((a) => a.id === s.wornBadge)?.name}>{ACHIEVEMENTS.find((a) => a.id === s.wornBadge)?.icon}</span>}
          <small>（Lv.{levelInfo(s.xp ?? 0).level}）</small>
        </span>
        <span className={`today-badge ${doneToday ? 'ok' : ''}`}>
          {s.omikuji?.date === today && `🎋${luckOf(s.omikuji.luck).label}・${s.omikuji.kana}　`}
          {doneToday ? '今日已練 ✓' : '今天還沒練'}
        </span>
      </div>
      <div className="person-stats">
        <div>
          <b>🔥 {displayStreak(s, today)}</b>
          <span>連續天數</span>
        </div>
        <div>
          <b>{(s.totalMinutes / 60).toFixed(1)}h</b>
          <span>累計</span>
        </div>
        <div>
          <b>
            {masteryCount(s, ['h:', 'k:'])}/{HIRAGANA.length + KATAKANA.length}
          </b>
          <span>假名精熟</span>
        </div>
        <div>
          <b>{masteryCount(s, ['w:', 'v:'])}</b>
          <span>單字精熟</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({
  me,
  peer,
  today,
  offline,
  update,
  onSwitchUser,
}: {
  me: UserState;
  peer: UserState | null;
  today: string;
  offline: boolean;
  update: (fn: (s: UserState) => UserState) => void;
  onSwitchUser: () => void;
}) {
  const [gachaGot, setGachaGot] = useState<Pudding[] | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const goal = me.goal ?? DEFAULT_GOAL;
  // 目標編輯（等級 N5/N4＋達成日）；null＝非編輯中
  const [goalDraft, setGoalDraft] = useState<{ level: GoalLevel; date: string } | null>(null);
  const pace = lessonPace(me, today);
  if (shopOpen) {
    return (
      <div className="dashboard">
        <ShopPage me={me} peer={peer} today={today} update={update} onBack={() => setShopOpen(false)} />
      </div>
    );
  }
  const pct = pace.total > 0 ? Math.min(100, Math.round((pace.done / pace.total) * 100)) : 0;
  const fmtDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${y}/${+m}/${+dd}`; };
  const overdue = pace.daysLeft === 0 && pace.remaining > 0;
  const kana = kanaPhaseEta(me); // 五十音先修 ETA（remaining=0＝已學完，不顯示）

  return (
    <div className="dashboard">
      <ShopBanner me={me} peer={peer} today={today} onOpen={() => setShopOpen(true)} />
      <PersonCard s={me} today={today} me />
      {peer ? (
        <PersonCard s={peer} today={today} me={false} />
      ) : (
        <div className="person empty">{offline ? '離線中，看不到對方進度' : '對方還沒開始，把網址丟給他吧'}</div>
      )}

      <div className="goal-card">
        <div className="goal-head">
          {goalDraft ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              目標：
              <select value={goalDraft.level} onChange={(e) => setGoalDraft({ ...goalDraft, level: e.target.value as GoalLevel })}>
                <option value="N5">JLPT N5</option>
                <option value="N4">JLPT N4</option>
              </select>
              <input type="date" value={goalDraft.date} min={today} onChange={(e) => setGoalDraft({ ...goalDraft, date: e.target.value })} />
              <button
                className="linkish"
                style={{ display: 'inline' }}
                onClick={() => {
                  if (!goalDraft.date) return;
                  update((s) => ({ ...s, goal: { ...goalDraft } }));
                  setGoalDraft(null);
                }}
              >
                儲存
              </button>
              <button className="linkish" style={{ display: 'inline' }} onClick={() => setGoalDraft(null)}>取消</button>
            </span>
          ) : (
            <span>
              目標：JLPT {goal.level}（{fmtDate(goal.date)}）{' '}
              <button className="linkish" style={{ display: 'inline' }} onClick={() => setGoalDraft({ ...goal })}>改目標</button>
            </span>
          )}
          <span className="exam-count">
            {overdue ? '已到期' : <>倒數 <b>{pace.daysLeft}</b> 天</>}
          </span>
        </div>
        <div className="goal-bar">
          <div className="goal-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="goal-nums">
          <span>
            已完成 <b>{pace.done}</b> / {pace.total} 課
          </span>
          <span className={pace.remaining > 0 ? 'behind' : 'ahead'}>
            {pace.remaining > 0 ? `還差 ${pace.remaining} 課` : '課程全部完成 🎉'}
          </span>
        </div>
        <p className="goal-note">
          {pace.remaining === 0
            ? `目標 ${goal.level} 的課都上完了，保持複習就好。`
            : overdue
              ? '目標日已經過了——按「改目標」訂個新日期吧，重點是不斷鏈。'
              : <>要在 {fmtDate(goal.date)} 前完成 {goal.level}，接下來每週約 <b>{pace.weeklyNeeded.toFixed(1)} 課</b>{kana.remaining > 0 && <>（五十音先修中：還剩 {kana.remaining} 個假名，照配速約 <b>{kana.days} 天</b>學完）</>}{goal.level === 'N4' && pace.weeklyNeeded > 3 && '。壓力太大的話，先把目標改成 N5 也完全 OK。'}</>}
        </p>
      </div>

      <div className="badge-wall">
        <h3>🏅 成就牆（{(me.achievements ?? []).length}/{ACHIEVEMENTS.length}）</h3>
        <div className="duel-record">
          <div>
            <b>{me.duel?.w ?? 0}勝{me.duel?.l ?? 0}敗</b>
            <span>對決戰績</span>
          </div>
          <div>
            <b>{me.duel?.streak ?? 0}</b>
            <span>對決連勝</span>
          </div>
          <div>
            <b>{me.sprintBest ?? 0}</b>
            <span>衝刺最高分</span>
          </div>
        </div>
        <p className="legend">點已解鎖的徽章可以佩戴，會顯示在你名字旁（對方看得到）</p>
        <div className="badges" style={{ marginTop: 6 }}>
          {ACHIEVEMENTS.map((a) => {
            const got = (me.achievements ?? []).includes(a.id);
            const worn = me.wornBadge === a.id;
            return (
              <button
                key={a.id}
                className={`badge ${got ? 'unlocked' : ''} ${worn ? 'worn' : ''}`}
                title={a.desc}
                onClick={() => got && update((s) => ({ ...s, wornBadge: worn ? '' : a.id }))}
              >
                <span className="b-icon">{a.icon}</span>
                <span className="b-name">{worn ? '佩戴中' : a.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="badge-wall">
        <h3>🎰 布丁扭蛋機</h3>
        <p className="legend">
          金幣：每日完成 +{COINS.daily}、對決勝 +{COINS.duelWin}、小遊戲 +{COINS.minigame}、衝刺分÷50、神秘客全對 +{COINS.mysteryPerfect}。一轉 {GACHA_COST} 金幣，出貨機率比每日掉落大方，10% 大當たり雙顆
        </p>
        <div className="gacha-row">
          <span className="coin-chip">🪙 {me.coins}</span>
          <button
            className="primary"
            disabled={me.coins < GACHA_COST}
            onClick={() => {
              const res = gachaRoll();
              if (res.puddings.some((p) => p.rarity === 'SR')) sfx.win();
              else sfx.unlock();
              setGachaGot(res.puddings);
              update((s) => {
                const puddings = { ...s.puddings };
                for (const p of res.puddings) puddings[p.id] = (puddings[p.id] ?? 0) + 1;
                return { ...s, coins: s.coins - GACHA_COST, puddings };
              });
            }}
          >
            轉一次
          </button>
        </div>
        {gachaGot && (
          <div className="gacha-result">
            {gachaGot.length > 1 && <b className="jackpot">🎉 大当たり！</b>}
            {gachaGot.map((p, i) => (
              <div key={i} className={`pudding-drop r-${p.rarity}`}>
                <span className="pud" style={{ filter: `hue-rotate(${p.hue}deg) saturate(${p.sat ?? 1})` }}>🍮</span>
                <div className="pd-body">
                  <b>
                    {p.name}
                    <i className="rarity">{p.rarity}</i>
                  </b>
                  <small>{p.desc}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="badge-wall">
        <h3>
          🍮 布丁圖鑑（{PUDDINGS.filter((p) => (me.puddings?.[p.id] ?? 0) > 0).length}/{PUDDINGS.length}）
        </h3>
        <p className="legend">每天完成練習掉一顆，連續天數越高越容易掉稀有口味</p>
        <div className="pud-grid">
          {PUDDINGS.map((p) => {
            const n = me.puddings?.[p.id] ?? 0;
            return (
              <div key={p.id} className={`pud-cell r-${p.rarity} ${n > 0 ? 'got' : ''}`} title={n > 0 ? `${p.name}：${p.desc}` : '？？？'}>
                <span className="pud" style={n > 0 ? { filter: `hue-rotate(${p.hue}deg) saturate(${p.sat ?? 1})` } : undefined}>
                  🍮
                </span>
                <small>{n > 0 ? p.name.replace('布丁', '') : '？？？'}</small>
                {n > 0 && p.desc && <small className="pud-desc">{p.desc}</small>}
                {n > 1 && <i className="pud-count">×{n}</i>}
              </div>
            );
          })}
        </div>
      </div>

      <button className="linkish" onClick={onSwitchUser}>
        切換使用者
      </button>
    </div>
  );
}
