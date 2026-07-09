import { daysBetween } from './dates.ts';

// 主目標：2027/7/4 JLPT N4。N5 不報名（JJ 2026/7 拍板：省報名費），
// 但 2026/12 仍作為「N5 程度」學習里程碑檢查點。
// 時數假設含台灣人漢字優勢：N5 程度累計 120h、N4 累計 320h
export const GOAL = {
  start: '2026-07-06',
  n5: { date: '2026-12-06', hours: 120, label: 'N5 里程碑（2026/12）' },
  n4: { date: '2027-07-04', hours: 320, label: 'N4（2027/7/4）' },
};

/** 到今天為止「照進度應累積」的時數（線性配速，分兩段） */
export function expectedHours(today: string): number {
  const total5 = daysBetween(GOAL.start, GOAL.n5.date);
  const d = daysBetween(GOAL.start, today);
  if (d <= 0) return 0;
  if (d <= total5) return (d / total5) * GOAL.n5.hours;
  const total4 = daysBetween(GOAL.n5.date, GOAL.n4.date);
  const d2 = Math.min(d - total5, total4);
  return GOAL.n5.hours + (d2 / total4) * (GOAL.n4.hours - GOAL.n5.hours);
}

export interface PaceStatus {
  actualH: number;
  expectedH: number;
  deltaH: number; // 正=超前，負=落後
  weeklyNeededH: number; // 從今天到 N4 考試，每週需要的時數
  nextExam: { label: string; daysLeft: number };
}

export function paceStatus(totalMinutes: number, today: string): PaceStatus {
  const actualH = totalMinutes / 60;
  const expectedH = expectedHours(today);
  const toN5 = daysBetween(today, GOAL.n5.date);
  const next = toN5 >= 0 ? { label: GOAL.n5.label, daysLeft: toN5 } : { label: GOAL.n4.label, daysLeft: Math.max(0, daysBetween(today, GOAL.n4.date)) };
  const daysToN4 = Math.max(1, daysBetween(today, GOAL.n4.date));
  const weeklyNeededH = Math.max(0, ((GOAL.n4.hours - actualH) / daysToN4) * 7);
  return { actualH, expectedH, deltaH: actualH - expectedH, weeklyNeededH, nextExam: next };
}
