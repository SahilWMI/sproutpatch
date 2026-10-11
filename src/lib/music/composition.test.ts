import { describe, expect, it } from 'vitest';
import { BEATS_PER_BAR, REST_EVERY, TRACKS, createComposer, midiToHz, mulberry32 } from './composition';

const bars = (seed: number, n: number, track = TRACKS.meadow) => {
  const composer = createComposer(track, seed);
  return Array.from({ length: n }, () => composer.nextBar());
};

describe('composition', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    expect(bars(7, 12)).toEqual(bars(7, 12));
    expect(bars(7, 12)).not.toEqual(bars(8, 12));
  });

  it('keeps every note inside the bar and the melody inside its range', () => {
    for (const track of Object.values(TRACKS)) {
      const low = Math.min(...track.melody);
      const high = Math.max(...track.melody) + 12 + 12;
      for (const bar of bars(42, 48, track)) {
        for (const note of bar) {
          expect(note.beat).toBeGreaterThanOrEqual(0);
          expect(note.beat).toBeLessThan(BEATS_PER_BAR);
          expect(note.velocity).toBeGreaterThan(0);
          expect(note.velocity).toBeLessThanOrEqual(1);
          if (note.voice === 'piano') {
            expect(note.midi).toBeGreaterThanOrEqual(Math.min(low, ...track.chords.flat()));
            expect(note.midi).toBeLessThanOrEqual(high);
          }
        }
      }
    }
  });

  it('stays sparse: at most five piano notes a bar, and regular rest bars', () => {
    const all = bars(3, REST_EVERY * 4);
    for (const bar of all) expect(bar.filter((n) => n.voice === 'piano').length).toBeLessThanOrEqual(5);
    for (let i = REST_EVERY - 1; i < all.length; i += REST_EVERY) {
      expect(all[i]?.some((n) => n.voice === 'piano')).toBe(false);
      expect(all[i]?.some((n) => n.voice === 'pad')).toBe(true);
    }
  });

  it('helpers', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880);
    const r = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
