import type { CheckInEntry, Entry } from './entries';

export interface WeeklySummary {
  checkIns: number;
  walksTaken: number;
  /** Mean of (moodAfter - moodBefore) over walks with a rating; null when there are none. */
  averageMoodChange: number | null;
  ratedWalks: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function isCompletedWalk(entry: Entry): entry is CheckInEntry & { walk: NonNullable<CheckInEntry['walk']> } {
  return entry.kind === 'checkin' && entry.walk?.completed === true;
}

export function weeklySummary(entries: Entry[], now: Date): WeeklySummary {
  const since = now.getTime() - WEEK_MS;
  const inWeek = entries.filter((e) => {
    const t = Date.parse(e.createdAt);
    return Number.isFinite(t) && t > since && t <= now.getTime();
  });

  const walks = inWeek.filter(isCompletedWalk);
  const changes = walks
    .map((e) => (typeof e.moodAfter === 'number' ? e.moodAfter - e.moodBefore : null))
    .filter((c): c is number => c !== null);

  const average = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : null;

  return {
    checkIns: inWeek.length,
    walksTaken: walks.length,
    averageMoodChange: average === null ? null : Math.round(average * 10) / 10,
    ratedWalks: changes.length,
  };
}

export function formatChange(change: number | null): string {
  if (change === null) return 'n/a';
  if (change === 0) return '±0';
  return `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(1)}`;
}

export interface ChartPoint {
  id: string;
  date: Date;
  before: number;
  after: number;
}

/** Oldest first, only walks with a mood-after rating, at most `limit` points. */
export function chartPoints(entries: Entry[], limit = 14): ChartPoint[] {
  return entries
    .filter(isCompletedWalk)
    .filter((e) => typeof e.moodAfter === 'number')
    .map((e) => ({ id: e.id, date: new Date(e.createdAt), before: e.moodBefore, after: e.moodAfter ?? 0 }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-limit);
}
