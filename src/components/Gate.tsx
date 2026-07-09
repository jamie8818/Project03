import { useState } from 'react';

/** 備援入口：正常情況用帶金鑰的專屬連結開啟就會自動進站，不會看到這頁 */
export default function Gate({ onOk }: { onOk: () => void }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const extractKey = (s: string): string => {
    const m = s.match(/[?&#]k=([^&\s]+)/);
    return m ? decodeURIComponent(m[1]) : s.trim();
  };

  const submit = async () => {
    if (!val || busy) return;
    setBusy(true);
    setErr('');
    const key = extractKey(val);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pw: key }),
      });
      if (res.ok) {
        localStorage.setItem('nng:key', key);
        onOk();
      } else setErr('連結不對，跟 JJ 要最新的專屬連結');
    } catch {
      setErr('連不上伺服器');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-logo">日々日文</div>
        <p className="gate-sub">用專屬連結開啟就會直接進來。沒有的話，把連結貼在下面：</p>
        <input
          type="text"
          value={val}
          placeholder="貼上專屬連結"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        <button className="primary" onClick={submit} disabled={busy || !val}>
          {busy ? '確認中…' : '進入'}
        </button>
        {err && <p className="gate-err">{err}</p>}
      </div>
    </div>
  );
}
