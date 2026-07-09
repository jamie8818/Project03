import { useState } from 'react';
import { pickLine, pickSprite, type BuddyContext } from '../data/buddy.ts';

// 店長（ごきげんぱんだ）：每次出場從 46 張圖隨機抽（依情境 tag 過濾）。
// 點店長會講話（509 句台詞庫），再點換一句＋換姿勢。
export type Mood = 'idle' | 'happy' | 'sad' | 'cheer' | 'sleep';

export default function Buddy({ mood, size = 96, bounce }: { mood: Mood; size?: number; bounce?: boolean }) {
  const [file, setFile] = useState(() => pickSprite(mood));
  return (
    <img
      className={`buddy${bounce ? ' bounce' : ''}`}
      src={`/sprites/pool/${file}`}
      style={{ maxWidth: size, maxHeight: size, width: 'auto', height: 'auto' }}
      alt="店長"
      draggable={false}
      onClick={() => setFile(pickSprite(mood))}
      onError={() => setFile(pickSprite(mood))}
    />
  );
}

/** 店長＋對話泡：出場先講一句應景的，之後每點一下就從廢話大池抽一句換一張圖 */
export function BuddySay({
  context,
  size = 96,
  bounce,
}: {
  context: Exclude<BuddyContext, 'happy' | 'cheer' | 'sleep' | 'sad' | 'idle' | 'tap'>;
  size?: number;
  bounce?: boolean;
}) {
  const [file, setFile] = useState(() => pickSprite(context));
  const [line, setLine] = useState(() => pickLine(context));

  const next = () => {
    setFile(pickSprite('tap'));
    setLine(pickLine('tap'));
  };

  return (
    <div className="buddy-say" onClick={next} role="button" aria-label="跟店長聊天">
      <img
        className={`buddy${bounce ? ' bounce' : ''}`}
        src={`/sprites/pool/${file}`}
        style={{ maxWidth: size, maxHeight: size, width: 'auto', height: 'auto' }}
        alt="店長"
        draggable={false}
      />
      <span className="say">{line}</span>
    </div>
  );
}
