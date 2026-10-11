import { describe, expect, it, vi } from 'vitest';
import type { NudgeInput, Provider, WeatherSnapshot } from '../types';
import { llmStrategy } from './llmStrategy';

const NOW = new Date(2026, 9, 12, 15, 0);
const WEATHER: WeatherSnapshot = {
  temperatureC: 22,
  precipitationProbability: 0,
  weatherCode: 0,
  sunrise: new Date(2026, 9, 12, 6, 0),
  sunset: new Date(2026, 9, 12, 18, 0),
};

const providerReturning = (raw: unknown): Provider & { checkIn: ReturnType<typeof vi.fn> } => ({
  id: 'p',
  label: 'p',
  checkIn: vi.fn(async () => ({ raw })),
});

const input = (overrides: Partial<NudgeInput> = {}): NudgeInput => ({
  moodScore: -1,
  weather: WEATHER,
  now: NOW,
  seed: 0,
  provider: null,
  ...overrides,
});

describe('llm strategy', () => {
  it('uses model wording but keeps the code-made reason and clamps minutes', async () => {
    const provider = providerReturning('{"suggestion": "Walk to the banyan tree by the lake.", "minutes": 45}');
    const nudge = await llmStrategy.suggest(input({ provider }));
    expect(nudge).toMatchObject({ strategyId: 'llm', rule: 'meh-mood', suggestion: 'Walk to the banyan tree by the lake.', minutes: 15 });
    expect(nudge.reason).toMatch(/^Dry, 22°C/);
    expect(provider.checkIn.mock.calls[0]?.[1]).toMatchObject({ task: 'nudge' });
  });

  it.each([
    ['garbage', 'go outside lol'],
    ['wrong types', '{"suggestion": 5, "minutes": "ten"}'],
    ['advice only', '{"suggestion": "Ask your therapist about it.", "minutes": 10}'],
  ])('falls back to rules on %s', async (_l, raw) => {
    const nudge = await llmStrategy.suggest(input({ provider: providerReturning(raw) }));
    expect(nudge.strategyId).toBe('rules');
  });

  it('falls back to rules when the provider throws', async () => {
    const provider: Provider = { id: 'x', label: 'x', checkIn: async () => Promise.reject(new Error('down')) };
    expect((await llmStrategy.suggest(input({ provider }))).strategyId).toBe('rules');
  });

  it('never lets the model override weather rules', async () => {
    const provider = providerReturning('{"suggestion": "Go for a long hike!", "minutes": 20}');
    const nudge = await llmStrategy.suggest(input({ provider, weather: { ...WEATHER, precipitationProbability: 90 } }));
    expect(nudge.rule).toBe('rain');
    expect(nudge.strategyId).toBe('rules');
    expect(provider.checkIn).not.toHaveBeenCalled();
  });

  it('without a provider it is just the rules', async () => {
    expect((await llmStrategy.suggest(input())).strategyId).toBe('rules');
  });
});
