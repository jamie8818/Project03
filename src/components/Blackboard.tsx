import { useEffect, useState } from 'react';
import type { UserId, UserState } from '../types.ts';
import { USERS } from '../lib/store.ts';
import { tpeToday } from '../lib/dates.ts';

interface BoardMsg {
  text: string;
  at: string;
}

type Board = Partial<Record<UserId, BoardMsg | null>>;

/** 喫茶店黑板：每人留一句話給對方；對方的留言要「今天練完」才看得到 */
export default function Blackboard({ state }: { state: UserState }) {
  const me = state.user;
  const other = USERS.find((u) => u.id !== me)!;
  const canRead = state.lastDoneDate === tpeToday();
  const [board, setBoard] = useState<Board | null>(null);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/board')
      .then((r) => r.json())
      .then((b: Board) => {
        setBoard(b);
        setDraft(b[me]?.text ?? '');
      })
      .catch(() => setBoard({}));
  }, [me]);

  const save = () => {
    const text = draft.trim().slice(0, 100);
    fetch('/api/board', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: me, text }),
    }).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  if (!board) return null;
  const theirs = board[other.id];

  return (
    <div className="blackboard">
      <div className="bb-title">🖤 喫茶店黑板</div>
      <div className="bb-msg">
        {theirs?.text ? (
          canRead ? (
            <>
              <span className="bb-from">{other.name} 留：</span>
              <p>{theirs.text}</p>
            </>
          ) : (
            <p className="bb-locked">🔒 {other.name} 留了一句話——練完今天的份就能看</p>
          )
        ) : (
          <p className="bb-locked">{other.name} 還沒留言</p>
        )}
      </div>
      <div className="bb-write">
        <input
          value={draft}
          maxLength={100}
          placeholder={`寫一句話給 ${other.name}（日文加分）`}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="tool" onClick={save}>
          {saved ? '✓' : '掛上'}
        </button>
      </div>
    </div>
  );
}
