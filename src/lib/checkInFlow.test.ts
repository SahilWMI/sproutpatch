import { describe, expect, it, vi } from 'vitest';
import { performCheckIn, safeSuggest, validateNudge } from './checkInFlow';
import { rulesStrategy } from './nudge/rules';
import type { NudgeInput, NudgeStrategy, Provider, WeatherSnapshot } from './types';
import { mockProvider } from '../providers/mock';

const NOW = new Date(2026, 9, 12, 15, 0);
const WEATHER: WeatherSnapshot = {
  temperatureC: 24,
  precipitationProbability: 5,
  weatherCode: 0,
  sunrise: new Date(2026, 9, 12, 6, 0),
  sunset: new Date(2026, 9, 12, 17, 45),
};

function spyProvider(raw: unknown): Provider & { checkIn: ReturnType<typeof vi.fn> } {
  return { id: 'spy', label: 'Spy', checkIn: vi.fn(async () => ({ raw })) };
}

function spyStrategy(): NudgeStrategy & { suggest: ReturnType<typeof vi.fn> } {
  return { id: 'spy', label: 'Spy strategy', suggest: vi.fn(rulesStrategy.suggest) };
}

const base = { timeoutMs: 2000, now: NOW, seed: 0 };

describe('safety invariants', () => {
  const crisisNotes = [
    'I want to kill myself',
    "Everything is too much and I can't go on.",
    "Honestly there's no point in living",
  ];

  it.each(crisisNotes)('keyword risk mode never calls the model, the strategy, or the weather: "%s"', async (note) => {
    // A buggy provider that would happily say "all good".
    const provider = spyProvider('{"mood_score": 3, "themes": [], "risk_flag": false, "reply": "Great day!"}');
    const strategy = spyStrategy();
    const getWeather = vi.fn(async () => WEATHER);

    const result = await performCheckIn({ ...base, note, provider, strategy, getWeather });

    expect(result.kind).toBe('risk');
    if (result.kind === 'risk') {
      expect(result.trigger).toBe('keyword');
      expect(result.moodScore).toBeLessThanOrEqual(-2);
    }
    expect(provider.checkIn).not.toHaveBeenCalled();
    expect(strategy.suggest).not.toHaveBeenCalled();
    expect(getWeather).not.toHaveBeenCalled();
  });

  it('a provider returning risk_flag false cannot suppress keyword risk mode', async () => {
    const lying: Provider = {
      id: 'liar',
      label: 'Liar',
      checkIn: async () => ({ raw: { mood_score: 3, themes: ['fine'], risk_flag: false, reply: 'All good!' } }),
    };
    const result = await performCheckIn({
      ...base,
      note: 'i want to end it all',
      provider: lying,
      strategy: rulesStrategy,
      getWeather: async () => WEATHER,
    });
    expect(result.kind).toBe('risk');
  });

  it('a model risk_flag true triggers risk mode and skips the strategy', async () => {
    const provider = spyProvider('{"mood_score": 1, "themes": [], "risk_flag": true, "reply": "..."}');
    const strategy = spyStrategy();
    const result = await performCheckIn({
      ...base,
      note: 'feeling strange and far away today',
      provider,
      strategy,
      getWeather: async () => WEATHER,
    });
    expect(result).toEqual({ kind: 'risk', moodScore: -2, trigger: 'model' });
    expect(strategy.suggest).not.toHaveBeenCalled();
  });

  it('a provider that throws does not crash the flow', async () => {
    const boom: Provider = {
      id: 'boom',
      label: 'Boom',
      checkIn: () => {
        throw new Error('kaboom');
      },
    };
    const result = await performCheckIn({
      ...base,
      note: 'pretty good day',
      provider: boom,
      strategy: rulesStrategy,
      getWeather: async () => WEATHER,
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.replySource).toBe('fallback');
      expect(result.fallbackReason).toBe('error');
    }
  });
});

describe('performCheckIn (normal path)', () => {
  it('returns the reply, mood and a rules nudge with real weather', async () => {
    const result = await performCheckIn({
      ...base,
      note: 'Calm day, read a book, felt relaxed.',
      provider: mockProvider,
      strategy: rulesStrategy,
      getWeather: async () => WEATHER,
    });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.replySource).toBe('model');
    expect(result.moodScore).toBeGreaterThan(0);
    expect(result.nudge.rule).toBe('light');
    expect(result.nudge.reason).toMatch(/^Dry, 24°C, sunset at 5:45 PM/);
  });

  it('works with no model and no weather', async () => {
    const result = await performCheckIn({
      ...base,
      note: 'Awful, stressed, exhausted.',
      provider: null,
      strategy: rulesStrategy,
      getWeather: async () => {
        throw new Error('offline');
      },
    });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.replySource).toBe('fallback');
    expect(result.fallbackReason).toBe('no-provider');
    expect(result.weather).toBeNull();
    expect(result.nudge.rule).toBe('low-mood');
    expect(result.nudge.reason).toMatch(/time of day only/);
  });
});

describe('mood source', () => {
  const run = (note: string, extra: { moodOverride?: number; recentMood?: number } = {}) =>
    performCheckIn({ ...base, note, provider: null, strategy: rulesStrategy, getWeather: async () => WEATHER, ...extra });

  it('a picked mood beats the text and sets both the walk and the reply', async () => {
    const happy = await run('Went to the shop.', { moodOverride: 3 });
    const rough = await run('Went to the shop.', { moodOverride: -3 });
    if (happy.kind !== 'ok' || rough.kind !== 'ok') throw new Error('expected ok');
    expect(happy.moodScore).toBe(3);
    expect(happy.nudge.minutes).toBe(60);
    expect(rough.nudge.minutes).toBe(10);
    expect(happy.reply).not.toBe(rough.reply);
  });

  it('a picked mood never skips the safety check', async () => {
    const result = await run('I want to kill myself', { moodOverride: 3 });
    expect(result.kind).toBe('risk');
  });

  it('a recent post-walk mood fills in when the note has no mood words', async () => {
    const result = await run('Went to the shop.', { recentMood: -3 });
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.moodScore).toBe(-3);
  });

  it('the note wins over the recent post-walk mood when it has mood words', async () => {
    const result = await run('Feeling great today!', { recentMood: -3 });
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.moodScore).toBeGreaterThan(0);
  });
});

describe('safeSuggest', () => {
  const input: NudgeInput = { moodScore: 0, weather: WEATHER, now: NOW, seed: 0, provider: null };

  it.each<[string, NudgeStrategy]>([
    ['throws', { id: 'a', label: 'Thrower', suggest: () => { throw new Error('x'); } }],
    ['rejects', { id: 'b', label: 'Rejecter', suggest: async () => Promise.reject(new Error('x')) }],
    ['returns junk', { id: 'c', label: 'Junk', suggest: () => ({ nope: true }) as never }],
    ['hangs', { id: 'd', label: 'Hanger', suggest: () => new Promise(() => {}) }],
  ])('falls back to rules when a strategy %s', async (_label, strategy) => {
    const { nudge, notice } = await safeSuggest(strategy, input, 50);
    expect(nudge.strategyId).toBe('rules');
    expect(nudge.rule).toBe('meh-mood');
    expect(notice).toContain(strategy.label);
  });

  it('accepts and clamps a valid custom nudge', async () => {
    const custom: NudgeStrategy = {
      id: 'custom',
      label: 'Custom',
      suggest: () => ({ strategyId: 'custom', rule: 'light', suggestion: 'Water the plants outside.', minutes: 500, reason: 'Because.' }),
    };
    const { nudge, notice } = await safeSuggest(custom, input);
    expect(nudge.minutes).toBe(60);
    expect(nudge.suggestion).toBe('Water the plants outside.');
    expect(notice).toBeUndefined();
  });

  it('validateNudge rejects empty text', () => {
    expect(validateNudge({ strategyId: 'x', rule: 'light', suggestion: '  ', minutes: 5, reason: 'r' })).toBeNull();
  });
});
