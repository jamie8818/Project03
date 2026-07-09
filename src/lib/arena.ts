// 對戰後端 API client（每日對決＋戰帖）
import type { UserId } from '../types.ts';

export interface DuelResult {
  score: number;
  correct: number;
  at: string;
}

export type DuelDay = Partial<Record<UserId, DuelResult | null>>;

export interface Challenge {
  id: string;
  from: UserId;
  seed: string;
  score: number;
  at: string;
  reply: { score: number; at: string } | null;
}

const jsonPost = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export async function fetchDuel(date: string): Promise<DuelDay> {
  const r = await fetch(`/api/duel?date=${date}`);
  if (!r.ok) throw new Error(`duel ${r.status}`);
  return (await r.json()) as DuelDay;
}

export async function postDuel(date: string, user: UserId, result: DuelResult): Promise<DuelDay> {
  const r = await jsonPost('/api/duel', { date, user, result });
  if (!r.ok) throw new Error(`duel post ${r.status}`);
  return (await r.json()) as DuelDay;
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const r = await fetch('/api/challenge');
  if (!r.ok) throw new Error(`challenge ${r.status}`);
  return ((await r.json()) as { items: Challenge[] }).items;
}

export async function postChallenge(c: Omit<Challenge, 'reply' | 'at'>): Promise<void> {
  await jsonPost('/api/challenge', c);
}

export async function replyChallenge(id: string, score: number): Promise<void> {
  await jsonPost('/api/challenge/reply', { id, score });
}
