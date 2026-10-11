import { describe, expect, it } from 'vitest';
import { MOOD_AFTER_OPTIONS, entryFromResult } from './entries';

describe('mood-after picker', () => {
  it('has 5 options spanning the same -3..3 scale as mood before', () => {
    expect(MOOD_AFTER_OPTIONS).toHaveLength(5);
    expect(MOOD_AFTER_OPTIONS[0].value).toBe(-3);
    expect(MOOD_AFTER_OPTIONS[4].value).toBe(3);
  });
});

const NOW = new Date('2026-10-12T10:00:00Z');

describe('entryFromResult', () => {
  it('stores only the mood score and a risk marker for risk mode', () => {
    const entry = entryFromResult('I want to end it all, here are my private details', { kind: 'risk', moodScore: -3, trigger: 'keyword' }, NOW, 'id-1');
    expect(entry).toEqual({ id: 'id-1', createdAt: NOW.toISOString(), kind: 'risk', risk: true, moodBefore: -3 });
    expect(JSON.stringify(entry)).not.toContain('end it all');
    expect(JSON.stringify(entry)).not.toContain('private');
  });

  it('stores the check-in details for normal entries', () => {
    const entry = entryFromResult(
      'nice day',
      {
        kind: 'ok',
        reply: 'Lovely.',
        moodScore: 2,
        themes: ['rest'],
        weather: null,
        replySource: 'model',
        nudge: { strategyId: 'rules', rule: 'light', suggestion: 'Quick 5-minute loop?', minutes: 5, reason: 'Dry' },
      },
      NOW,
      'id-2',
    );
    expect(entry).toMatchObject({ kind: 'checkin', note: 'nice day', moodBefore: 2, themes: ['rest'], nudge: { minutes: 5 } });
  });
});
