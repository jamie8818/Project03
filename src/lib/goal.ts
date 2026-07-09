// 學習目標：等級（N5/N4，課綱目前只有這兩級）＋達成日，存 UserState.goal、儀表板可改。
// 配速以「課」計算（不用時數——時數會被掛機/發呆污染，課程完成數才是真進度）。
// 預設 N4 2027-07-04（JJ 2026/7 拍板：N5 不報名省報名費，當里程碑）。
import type { UserState } from '../types.ts';
import { daysBetween } from './dates.ts';
import { LESSONS } from '../data/curriculum.ts';
import { courseProgress } from './course.ts';

export type GoalLevel = 'N5' | 'N4';
export interface Goal {
  level: GoalLevel;
  date: string; // YYYY-MM-DD
}

export const DEFAULT_GOAL: Goal = { level: 'N4', date: '2027-07-04' };

/** 該目標等級要完成的課數：N5＝N5 課；N4＝全部（N5 是 N4 的前置，一路上完）。 */
export function goalTotalLessons(level: GoalLevel): number {
  return level === 'N5' ? LESSONS.filter((l) => l.level === 'N5').length : LESSONS.length;
}

export interface LessonPace {
  done: number; // 已完成課數（連續完成，見 courseProgress）
  total: number; // 目標等級總課數
  remaining: number; // 還差幾課
  daysLeft: number; // 距離達成日幾天（過期＝0）
  weeklyNeeded: number; // 接下來每週要完成幾課才趕得上（全完成＝0）
}

export function lessonPace(state: UserState, today: string): LessonPace {
  const goal = state.goal ?? DEFAULT_GOAL;
  const total = goalTotalLessons(goal.level);
  const done = Math.min(courseProgress(state).done, total);
  const remaining = total - done;
  const daysLeft = Math.max(0, daysBetween(today, goal.date));
  const weeklyNeeded = remaining === 0 ? 0 : (remaining / Math.max(1, daysLeft)) * 7;
  return { done, total, remaining, daysLeft, weeklyNeeded };
}
