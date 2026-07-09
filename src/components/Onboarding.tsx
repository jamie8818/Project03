import { useState } from 'react';
import type { UserId } from '../types.ts';
import { USERS, loadLocal } from '../lib/store.ts';

export default function Onboarding({ onDone }: { onDone: (u: UserId, known: { hira: boolean; kata: boolean }) => void }) {
  const [picked, setPicked] = useState<UserId | null>(null);
  // JJ 平假名已背好，預設幫他勾
  const [hira, setHira] = useState(false);
  const [kata, setKata] = useState(false);

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
        <button className="primary" onClick={() => onDone(picked, { hira, kata })}>
          開始學習
        </button>
      </div>
    </div>
  );
}
