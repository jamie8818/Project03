// 日期一律用台北時區的 YYYY-MM-DD，streak 與 SRS 到期都以此為準
export function tpeToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00Z`).getTime() + days * 86400e3;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400e3);
}
