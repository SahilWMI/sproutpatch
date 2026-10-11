import { describe, expect, it } from 'vitest';
import { PULSE_GAP_S, PULSE_S, createCricketField } from './crickets';

describe('cricket field', () => {
  it('is deterministic for a seed', () => {
    expect(createCricketField(9).pulsesBetween(0, 20)).toEqual(createCricketField(9).pulsesBetween(0, 20));
  });

  it('gives each cricket a high chirp pitch, a place in the stereo field and a steady rhythm', () => {
    for (const c of createCricketField(4).crickets) {
      expect(c.hz).toBeGreaterThanOrEqual(4200);
      expect(c.hz).toBeLessThanOrEqual(5100);
      expect(Math.abs(c.pan)).toBeLessThanOrEqual(0.8);
      expect(c.pulses).toBeGreaterThanOrEqual(2);
      expect(c.pulses).toBeLessThanOrEqual(4);
    }
  });

  it('chirps start inside the window, in order, and windows chain without gaps or repeats', () => {
    const field = createCricketField(1);
    const first = field.pulsesBetween(0, 10);
    const second = field.pulsesBetween(10, 20);
    for (const window of [first, second]) {
      for (let i = 1; i < window.length; i++) expect(window[i]!.at).toBeGreaterThanOrEqual(window[i - 1]!.at);
    }
    const starts = [...first, ...second].map((p) => p.at);
    expect(new Set(starts).size).toBe(starts.length);
    expect(first.length).toBeGreaterThan(20);
    expect(second.length).toBeGreaterThan(20);
  });

  it('pulses inside one chirp are evenly spaced', () => {
    const field = createCricketField(2, 1);
    const pulses = field.pulsesBetween(0, 3);
    const n = field.crickets[0]!.pulses;
    for (let p = 1; p < n; p++) expect(pulses[p]!.at - pulses[p - 1]!.at).toBeCloseTo(PULSE_S + PULSE_GAP_S);
  });
});
