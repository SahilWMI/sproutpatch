import { describe, expect, it } from 'vitest';
import type { CheckInEntry, Entry } from './entries';
import { chartPoints, formatChange, weeklySummary } from './summary';
import { makeSampleEntries } from './sampleData';

const NOW = new Date('2026-10-12T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function checkIn(id: string, createdAt: string, moodBefore: number, extra: Partial<CheckInEntry> = {}): CheckInEntry {
  return {
    id,
    createdAt,
    kind: 'checkin',
    moodBefore,
    note: '',
    themes: [],
    reply: '',
    replySource: 'fallback',
    nudge: { rule: 'light', suggestion: '', minutes: 5, reason: '' },
    ...extra,
  };
}

const walk = { plannedMinutes: 10, startedAt: '', endedAt: '', completed: true };

describe('weeklySummary', () => {
  it('counts walks and averages the before/after change over the last 7 days', () => {
    const entries: Entry[] = [
      checkIn('a', daysAgo(1), -2, { walk, moodAfter: 1 }), // +3
      checkIn('b', daysAgo(2), 0, { walk, moodAfter: 1 }), // +1
      checkIn('c', daysAgo(3), 1, { walk, moodAfter: 0 }), // -1
      checkIn('d', daysAgo(3), 1, { walk }), // walked, no rating
      checkIn('e', daysAgo(4), 0), // no walk
      checkIn('f', daysAgo(5), 0, { walk: { ...walk, completed: false } }),
      { id: 'r', createdAt: daysAgo(1), kind: 'risk', risk: true, moodBefore: -3 },
      checkIn('old', daysAgo(9), -3, { walk, moodAfter: 3 }), // outside window
    ];
    expect(weeklySummary(entries, NOW)).toEqual({ checkIns: 7, walksTaken: 4, averageMoodChange: 1, ratedWalks: 3 });
  });

  it('rounds to one decimal', () => {
    const entries = [
      checkIn('a', daysAgo(1), 0, { walk, moodAfter: 1 }),
      checkIn('b', daysAgo(1), 0, { walk, moodAfter: 1 }),
      checkIn('c', daysAgo(1), 0, { walk, moodAfter: 2 }),
    ];
    expect(weeklySummary(entries, NOW).averageMoodChange).toBe(1.3);
  });

  it('is empty-safe', () => {
    expect(weeklySummary([], NOW)).toEqual({ checkIns: 0, walksTaken: 0, averageMoodChange: null, ratedWalks: 0 });
  });

  it('formats changes', () => {
    expect(formatChange(null)).toBe('n/a');
    expect(formatChange(0)).toBe('±0');
    expect(formatChange(1.25)).toBe('+1.3');
    expect(formatChange(-2)).toBe('−2.0');
  });
});

describe('chartPoints', () => {
  it('returns rated walks oldest first, capped', () => {
    const entries = [
      checkIn('new', daysAgo(1), 0, { walk, moodAfter: 2 }),
      checkIn('mid', daysAgo(2), -1, { walk, moodAfter: 0 }),
      checkIn('old', daysAgo(3), -2, { walk, moodAfter: -1 }),
      checkIn('norating', daysAgo(1), 0, { walk }),
    ];
    expect(chartPoints(entries).map((p) => p.id)).toEqual(['old', 'mid', 'new']);
    expect(chartPoints(entries, 2).map((p) => p.id)).toEqual(['mid', 'new']);
  });
});

describe('sample data', () => {
  it('is clearly labelled, marked as sample, and summarizable', () => {
    const samples = makeSampleEntries(NOW);
    expect(samples.length).toBeGreaterThan(3);
    for (const s of samples) {
      expect(s.sample).toBe(true);
      if (s.kind === 'checkin') expect(s.note).toMatch(/^\(Sample\)/);
    }
    expect(weeklySummary(samples, NOW).walksTaken).toBeGreaterThan(0);
  });
});
