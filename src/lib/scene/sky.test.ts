import { describe, expect, it } from 'vitest';
import { celestialPosition, greetingFor, skyAt } from './sky';

describe('skyAt', () => {
  it('is full night at midnight and bright at noon', () => {
    expect(skyAt(0).night).toBe(1);
    expect(skyAt(12).night).toBe(0);
    expect(skyAt(12).sunUp).toBe(1);
    expect(skyAt(2).sunUp).toBe(0);
  });

  it('blends between keyframes and wraps around 24h', () => {
    const dusk = skyAt(18.75);
    expect(dusk.night).toBeGreaterThan(0.45);
    expect(dusk.night).toBeLessThan(0.85);
    expect(skyAt(24)).toEqual(skyAt(0));
    expect(skyAt(-1)).toEqual(skyAt(23));
  });

  it('keeps colours in range', () => {
    for (let h = 0; h < 24; h += 0.25) {
      for (const c of [...skyAt(h).top, ...skyAt(h).bottom]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('celestialPosition', () => {
  it('rises in the east, peaks mid-arc, sets in the west', () => {
    expect(celestialPosition(6).y).toBeCloseTo(0);
    expect(celestialPosition(12.25).y).toBeCloseTo(1);
    expect(celestialPosition(6).x).toBeLessThan(celestialPosition(17).x);
  });
});

describe('greetingFor', () => {
  it('matches the time of day', () => {
    expect(greetingFor(8)).toBe('Good morning');
    expect(greetingFor(14)).toBe('Good afternoon');
    expect(greetingFor(19)).toBe('Good evening');
    expect(greetingFor(3)).toBe('Hello, night owl');
  });
});
