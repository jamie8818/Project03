import { useState } from 'react';
import { RATE_MAX, RATE_MIN, getTtsRate, setTtsRate, speakJa } from '../lib/tts.ts';

/** 語速滑桿：🐢 0.3–1.2 🐇，放手時唸一句示範新語速；設定存本機（兩人各自調） */
export default function SpeedSlider() {
  const [rate, setRate] = useState(getTtsRate());

  const demo = () => speakJa('こんにちは');

  return (
    <label className="speed-slider">
      <span aria-hidden="true">🐢</span>
      <input
        type="range"
        min={RATE_MIN}
        max={RATE_MAX}
        step={0.05}
        value={rate}
        aria-label="發音語速"
        onChange={(e) => {
          const v = Number(e.target.value);
          setRate(v);
          setTtsRate(v);
        }}
        onPointerUp={demo}
        onKeyUp={demo}
      />
      <span aria-hidden="true">🐇</span>
      <b>{rate.toFixed(2)}×</b>
    </label>
  );
}
