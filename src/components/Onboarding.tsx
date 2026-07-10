import { useState } from 'react';
import type { UserId } from '../types.ts';
import { USERS, loadLocal } from '../lib/store.ts';
import Buddy from './Buddy.tsx';

// 首次開 app 的功能導覽（選完起點後走一遍；之後不再出現——跟著 onboarding 一次性）
const TOUR = [
  '哈囉！這裡是「日々日文」——你們兩個人一起學日文、一起開喫茶店的地方。功能很多，但每天要做的只有一件事。',
  '✍️ 今日練習：每天進來按一顆鍵，複習＋新內容＋小考一輪全包，大概 10–20 分鐘。練完想加碼就「再來一份」。',
  '⚔️ 對戰場：想玩再來——限時衝刺、雙人對決、夜市打工出餐，全部都能賺金幣。',
  'あ 五十音、📚 教材庫：假名表和會話/歌/文法教材，想預習或複習才需要點過去，平常不用管。',
  '📈 我們的進度：兩人的進度、成就徽章，還有共同經營的「日々喫茶」——金幣拿去買家具，把店裝成你們的樣子。',
];

export default function Onboarding({ onDone }: { onDone: (u: UserId, known: { hira: boolean; kata: boolean }) => void }) {
  const [picked, setPicked] = useState<UserId | null>(null);
  // JJ 平假名已背好，預設幫他勾
  const [hira, setHira] = useState(false);
  const [kata, setKata] = useState(false);
  const [tourStep, setTourStep] = useState(-1); // -1＝還沒進導覽；選完起點才開始

  if (!picked) {
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="gate-logo">你是誰？</div>
          <div className="user-pick">
            {USERS.map((u) => (
              <button
                key={u.id}
                className="user-btn"
                onClick={() => {
                  if (loadLocal(u.id)) {
                    onDone(u.id, { hira: false, kata: false }); // 已有進度，直接進
                    return;
                  }
                  setPicked(u.id);
                  setHira(u.id === 'jj');
                }}
              >
                {u.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const name = USERS.find((u) => u.id === picked)!.name;

  if (tourStep >= 0) {
    return (
      <div className="gate">
        <div className="gate-card">
          <Buddy mood={tourStep >= TOUR.length - 1 ? 'cheer' : 'happy'} size={72} />
          <p className="gate-sub" style={{ minHeight: 72, textAlign: 'left' }}>{TOUR[tourStep]}</p>
          <button
            className="primary"
            onClick={() => (tourStep + 1 < TOUR.length ? setTourStep(tourStep + 1) : onDone(picked, { hira, kata }))}
          >
            {tourStep + 1 < TOUR.length ? '嗯嗯，然後呢 →' : '出發！'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-logo">{name}，先確認起點</div>
        <p className="gate-sub">已經很熟的就勾起來，會直接當作背過、只偶爾抽考</p>
        <label className="check-row">
          <input type="checkbox" checked={hira} onChange={(e) => setHira(e.target.checked)} />
          平假名（あいうえお）我已經熟了
        </label>
        <label className="check-row">
          <input type="checkbox" checked={kata} onChange={(e) => setKata(e.target.checked)} />
          片假名（アイウエオ）我已經熟了
        </label>
        <button className="primary" onClick={() => setTourStep(0)}>
          開始學習
        </button>
      </div>
    </div>
  );
}
