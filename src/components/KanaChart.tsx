import { useState } from 'react';
import type { Script, UserState } from '../types.ts';
import { rowsOf } from '../data/kana.ts';
import { isLearning, isMastered } from '../lib/srs.ts';
import { speakJa } from '../lib/tts.ts';
import SpeedSlider from './SpeedSlider.tsx';

export default function KanaChart({ state }: { state: UserState }) {
  const [script, setScript] = useState<Script>('hira');
  const [sel, setSel] = useState<string | null>(null);
  const rows = rowsOf(script);

  const cellClass = (id: string) => {
    const c = state.cards[id];
    if (!c) return 'kana-cell';
    if (isMastered(c)) return 'kana-cell mastered';
    if (isLearning(c)) return 'kana-cell learning';
    return 'kana-cell';
  };

  return (
    <div className="kana-chart">
      <div className="seg">
        <button className={script === 'hira' ? 'on' : ''} onClick={() => setScript('hira')}>
          平假名
        </button>
        <button className={script === 'kata' ? 'on' : ''} onClick={() => setScript('kata')}>
          片假名
        </button>
      </div>
      <p className="legend">
        <span className="dot d-none" /> 未學　<span className="dot d-learn" /> 學習中　<span className="dot d-master" /> 已精熟
      </p>
      <SpeedSlider />
      <div className="chart-rows">
        {rows.map(({ row, items }) => (
          <div key={row} className="chart-row">
            <span className="row-label">{row}</span>
            <div className="row-cells">
              {items.map((k) => (
                <button
                  key={k.id}
                  className={cellClass(k.id) + (sel === k.id ? ' sel' : '')}
                  onClick={() => {
                    setSel(k.id);
                    speakJa(k.kana);
                  }}
                >
                  <span className="cell-kana">{k.kana}</span>
                  <span className="cell-roma">{sel === k.id ? k.romaji : ' '}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="hint">點一下：發音＋顯示羅馬拼音</p>
    </div>
  );
}
