import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '../types';
import {
  VARIANTS,
  buildReason,
  daylightMinutesLeft,
  pickRule,
  rulesStrategy,
  suggestByRules,
  variantIndex,
} from './rules';

// Local-time dates so the formatted clock is predictable in any timezone.
const today = (h: number, m = 0) => new Date(2026, 9, 12, h, m, 0);

function weather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    temperatureC: 27,
    precipitationProbability: 10,
    weatherCode: 1,
    sunrise: today(6, 0),
    sunset: today(17, 42),
    ...overrides,
  };
}

const AFTERNOON = today(16, 22); // 80 minutes before sunset

describe('pickRule', () => {
  it('1. rain probability >= 60% wins over everything', () => {
    expect(pickRule(3, weather({ precipitationProbability: 60, temperatureC: 40 }), AFTERNOON)).toBe('rain');
    expect(pickRule(-3, weather({ precipitationProbability: 85 }), today(17, 40))).toBe('rain');
  });

  it('1. thunderstorm or heavy rain codes trigger the rain rule even at low probability', () => {
    expect(pickRule(1, weather({ weatherCode: 95, precipitationProbability: 20 }), AFTERNOON)).toBe('rain');
    expect(pickRule(1, weather({ weatherCode: 65, precipitationProbability: 20 }), AFTERNOON)).toBe('rain');
    expect(pickRule(1, weather({ weatherCode: 82, precipitationProbability: 0 }), AFTERNOON)).toBe('rain');
  });

  it('59% is not rain', () => {
    expect(pickRule(1, weather({ precipitationProbability: 59 }), AFTERNOON)).toBe('light');
  });

  it('2. temperature >= 36°C means shade or after sunset', () => {
    expect(pickRule(1, weather({ temperatureC: 36 }), AFTERNOON)).toBe('heat');
    expect(pickRule(-3, weather({ temperatureC: 41 }), today(17, 40))).toBe('heat');
    expect(pickRule(1, weather({ temperatureC: 35.9 }), AFTERNOON)).toBe('light');
  });

  it('3. less than 20 minutes of daylight means a lit street or balcony', () => {
    expect(pickRule(1, weather(), today(17, 23))).toBe('dark'); // 19 min left
    expect(pickRule(1, weather(), today(17, 22))).toBe('light'); // 20 min left
    expect(pickRule(-3, weather(), today(21, 0))).toBe('dark'); // after sunset
    expect(pickRule(1, weather(), today(4, 30))).toBe('dark'); // before sunrise
  });

  it('4. mood <= -2 means an easy 15-20 minute walk', () => {
    expect(pickRule(-2, weather(), AFTERNOON)).toBe('low-mood');
    expect(pickRule(-3, weather(), AFTERNOON)).toBe('low-mood');
  });

  it('5. mood <= 0 means a walk to green space', () => {
    expect(pickRule(-1, weather(), AFTERNOON)).toBe('meh-mood');
    expect(pickRule(0, weather(), AFTERNOON)).toBe('meh-mood');
  });

  it('6. otherwise a light, no-pressure loop', () => {
    expect(pickRule(1, weather(), AFTERNOON)).toBe('light');
    expect(pickRule(3, weather(), AFTERNOON)).toBe('light');
  });

  it('without weather, falls back to time of day only', () => {
    expect(pickRule(1, null, today(19, 0))).toBe('dark');
    expect(pickRule(1, null, today(5, 0))).toBe('dark');
    expect(pickRule(-3, null, today(10, 0))).toBe('low-mood');
    expect(pickRule(0, null, today(10, 0))).toBe('meh-mood');
    expect(pickRule(2, null, today(10, 0))).toBe('light');
  });
});

describe('wording variants', () => {
  it('has exactly 3 variants per rule', () => {
    for (const list of Object.values(VARIANTS)) expect(list).toHaveLength(3);
  });

  it('rain variants all mention the rain and suggest five minutes', () => {
    for (const v of VARIANTS.rain) {
      expect(v.suggestion).toMatch(/rain/i);
      expect(v.minutes).toBe(5);
    }
  });

  it('low-mood variants are 15-20 minutes with the phone in a pocket', () => {
    for (const v of VARIANTS['low-mood']) {
      expect(v.minutes).toBeGreaterThanOrEqual(15);
      expect(v.minutes).toBeLessThanOrEqual(20);
      expect(v.suggestion).toMatch(/pocket|tucked/i);
    }
  });

  it('meh-mood variants are 10-15 minutes toward green space', () => {
    for (const v of VARIANTS['meh-mood']) {
      expect(v.minutes).toBeGreaterThanOrEqual(10);
      expect(v.minutes).toBeLessThanOrEqual(15);
      expect(v.suggestion).toMatch(/green|park|trees/i);
    }
  });

  it('light variants start with the quick loop question', () => {
    for (const v of VARIANTS.light) expect(v.suggestion).toMatch(/^Quick 5-minute loop/);
  });

  it('the seed picks the variant deterministically, including negative seeds', () => {
    expect(variantIndex(0)).toBe(0);
    expect(variantIndex(4)).toBe(1);
    expect(variantIndex(-1)).toBe(2);
    const a = suggestByRules({ moodScore: 1, weather: weather(), now: AFTERNOON, seed: 2 });
    const b = suggestByRules({ moodScore: 1, weather: weather(), now: AFTERNOON, seed: 5 });
    expect(a.suggestion).toBe(b.suggestion);
    expect(a.suggestion).toBe(VARIANTS.light[2].suggestion);
  });
});

describe('reason', () => {
  it('describes real weather and daylight', () => {
    expect(buildReason(weather(), AFTERNOON)).toBe('Dry, 27°C, sunset at 5:42 PM, about 80 minutes of daylight left');
  });

  it('mentions rain chance and storms', () => {
    expect(buildReason(weather({ precipitationProbability: 72 }), AFTERNOON)).toMatch(/^Rain likely \(72%\)/);
    expect(buildReason(weather({ precipitationProbability: 40 }), AFTERNOON)).toMatch(/^Some chance of rain \(40%\)/);
    expect(buildReason(weather({ weatherCode: 96 }), AFTERNOON)).toMatch(/^Thunderstorms around/);
  });

  it('handles hours, sunset and pre-dawn', () => {
    expect(buildReason(weather(), today(11, 42))).toMatch(/about 6 hours of daylight left$/);
    expect(buildReason(weather(), today(19, 0))).toMatch(/the sun has already set$/);
    expect(buildReason(weather(), today(4, 0))).toMatch(/the sun is not up yet$/);
  });

  it('says so when weather is unavailable', () => {
    expect(buildReason(null, today(10, 5))).toMatch(/Couldn't get the weather.*time of day only.*10:05 AM/);
  });

  it('daylightMinutesLeft floors and never goes negative', () => {
    expect(daylightMinutesLeft(AFTERNOON, weather())).toBe(80);
    expect(daylightMinutesLeft(today(23, 0), weather())).toBe(0);
  });
});

describe('rulesStrategy', () => {
  it('returns a complete nudge', async () => {
    const nudge = await rulesStrategy.suggest({
      moodScore: -3,
      weather: weather(),
      now: AFTERNOON,
      seed: 0,
      provider: null,
    });
    expect(nudge).toMatchObject({ strategyId: 'rules', rule: 'low-mood', minutes: 15 });
    expect(nudge.reason).toContain('sunset at 5:42 PM');
  });
});
