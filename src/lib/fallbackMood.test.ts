import { describe, expect, it } from 'vitest';
import { clampMood, estimateMood } from './fallbackMood';

describe('estimateMood', () => {
  it('scores a bad work day as negative and tags work', () => {
    const r = estimateMood('Awful day at work. My boss yelled in a meeting and I feel exhausted and stressed.');
    expect(r.mood_score).toBeLessThanOrEqual(-2);
    expect(r.themes).toContain('work');
  });

  it('scores a calm day as positive', () => {
    const r = estimateMood('Calm day. Read a book, made tea, felt relaxed and grateful.');
    expect(r.mood_score).toBeGreaterThanOrEqual(1);
    expect(r.themes).toContain('rest');
  });

  it('is neutral for text with no mood words', () => {
    expect(estimateMood('Went to the post office then came home.').mood_score).toBe(0);
    expect(estimateMood('').mood_score).toBe(0);
  });

  it('handles negation', () => {
    expect(estimateMood('not good').mood_score).toBeLessThan(0);
    expect(estimateMood('not bad at all').mood_score).toBeGreaterThanOrEqual(0);
  });

  it('never leaves the -3..3 range and returns at most 3 themes', () => {
    const r = estimateMood(
      'terrible awful horrible miserable hopeless worst work exam sleep family friends rain lunch',
    );
    expect(r.mood_score).toBe(-3);
    expect(r.themes.length).toBeLessThanOrEqual(3);
  });

  it('clampMood rounds and clamps', () => {
    expect(clampMood(7)).toBe(3);
    expect(clampMood(-9.2)).toBe(-3);
    expect(clampMood(1.6)).toBe(2);
    expect(clampMood(Number.NaN)).toBe(0);
  });
});
