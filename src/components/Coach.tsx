// Coach mark（直覺式導引，JJ 2026-07-10 拍板）：目標元素上的脈動光暈＋≤8 字標籤。
// 規則：點過永久消失（localStorage 旗標，UI 層不進存檔同步）；全域同時只顯示一個（模組級佔位）。
// 用法：塞進 position:relative 的目標元素內，互動處呼叫 dismissCoach(id)。
import { useEffect, useState } from 'react';

const KEY = (id: string) => `nng:coach:${id}`;
export const coachSeen = (id: string): boolean => localStorage.getItem(KEY(id)) === '1';

let active: string | null = null; // 全域同時只一個（防兩顆光暈打架）

export const dismissCoach = (id: string): void => {
  localStorage.setItem(KEY(id), '1');
  if (active === id) active = null; // 釋放佔位，讓下一顆 coach 接棒（不能只靠 unmount——dismiss 後元件常只是 render null）
};

export default function Coach({ id, label, dx = 0, dy = 0 }: { id: string; label: string; dx?: number; dy?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (coachSeen(id) || (active !== null && active !== id)) return;
    active = id;
    setShow(true);
    return () => {
      if (active === id) active = null;
    };
  }, [id]);
  if (!show || coachSeen(id)) return null;
  return (
    <span className="coach" style={dx || dy ? { transform: `translate(${dx}px, ${dy}px)` } : undefined} aria-hidden>
      <i className="coach-ring" />
      <b className="coach-tip">{label}</b>
    </span>
  );
}

// ── 分頁漸進解鎖（直覺式導引①）：介面跟著學習內容滴漏，解鎖本身就是導引。
// 條件全由既有 UserState 導出（不加新存檔欄位）；老玩家 sessionsDone 早超標＝全開零影響。
import type { UserState } from '../types.ts';

export type TabId = 'today' | 'arena' | 'kana' | 'lib' | 'stats';
export function tabUnlocked(s: UserState, tab: TabId): boolean {
  switch (tab) {
    case 'today':
      return true; // 每天要做的那件事，永遠亮著
    case 'stats':
    case 'kana':
      return s.sessionsDone >= 1; // 完成第一輪：看進度/喫茶店＋查假名表
    case 'arena':
    case 'lib':
      return s.sessionsDone >= 2; // 第二輪起：遊戲區與教材庫
  }
}

/** 像素風掛鎖：吃美術 lock.png，未到貨/缺檔時退 CSS 畫的掛鎖（黃銅+描邊，同色票） */
export function PixelLock() {
  const [imgOk, setImgOk] = useState(true);
  return (
    <span className="px-lock" aria-label="尚未解鎖">
      {imgOk && <img src="/cafe/ui/lock.png" alt="" draggable={false} onError={() => setImgOk(false)} />}
      {!imgOk && <i className="px-lock-css" />}
    </span>
  );
}
