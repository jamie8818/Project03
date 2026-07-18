import type { UserState } from '../types.ts';

export function missionDoneToday(state: Pick<UserState, 'missions'>, id: string, today: string): boolean {
  return state.missions?.[id]?.date === today;
}

/**
 * 測試版任務只記完成狀態，不發 XP、金幣或家具。
 * 同日重玩保留當日最佳分；plays 是跨日累計遊玩次數。
 */
export function completeMission(state: UserState, id: string, today: string, score: number): UserState {
  const previous = state.missions?.[id];
  const bestScore = previous?.date === today ? Math.max(previous.bestScore, score) : score;
  return {
    ...state,
    missions: {
      ...(state.missions ?? {}),
      [id]: {
        date: today,
        bestScore,
        plays: (previous?.plays ?? 0) + 1,
      },
    },
  };
}
