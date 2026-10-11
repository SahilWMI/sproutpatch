import { describe, expect, it } from 'vitest';
import { readConfig } from './config';
import type { AgentRegistry } from './registry';
import { defaultSettings, normalizeSettings, resolveProvider, resolveStrategy } from './settings';

const cfg = readConfig({});
const registry: AgentRegistry = {
  providers: [{ id: 'plug', label: 'Plug', checkIn: async () => ({ raw: '' }) }],
  strategies: [{ id: 'plug-strategy', label: 'Plug S', suggest: () => ({ strategyId: 'x', rule: 'light', suggestion: 's', minutes: 5, reason: 'r' }) }],
  skipped: [],
};

describe('settings', () => {
  it('defaults to Ollama with no model and the rules strategy', () => {
    const s = defaultSettings(cfg);
    expect(s).toMatchObject({ providerId: 'ollama', ollamaModel: '', strategyId: 'rules', setupDone: false });
    expect(resolveProvider(s, registry)).toBeNull();
  });

  it('a configured VITE_BASE_URL switches the default to openai-compatible', () => {
    const s = defaultSettings(readConfig({ VITE_BASE_URL: 'http://localhost:8080/v1', VITE_MODEL: 'gemma' }));
    expect(s).toMatchObject({ providerId: 'openai-compatible', openaiBaseUrl: 'http://localhost:8080/v1', openaiModel: 'gemma' });
  });

  it('survives broken stored data', () => {
    expect(normalizeSettings('garbage', cfg)).toEqual(defaultSettings(cfg));
    expect(normalizeSettings({ providerId: 5 }, cfg)).toEqual(defaultSettings(cfg));
    expect(normalizeSettings({ providerId: 'mock', extra: true }, cfg).providerId).toBe('mock');
  });

  it('resolves every provider kind', () => {
    const base = defaultSettings(cfg);
    expect(resolveProvider({ ...base, providerId: 'none' }, registry)).toBeNull();
    expect(resolveProvider({ ...base, providerId: 'mock' }, registry)?.id).toBe('mock');
    expect(resolveProvider({ ...base, ollamaModel: 'gemma3:1b' }, registry)?.id).toBe('ollama');
    expect(resolveProvider({ ...base, providerId: 'openai-compatible' }, registry)?.id).toBe('openai-compatible');
    expect(resolveProvider({ ...base, providerId: 'plug' }, registry)?.id).toBe('plug');
    expect(resolveProvider({ ...base, providerId: 'missing-plugin' }, registry)).toBeNull();
  });

  it('resolves strategies, defaulting to rules', () => {
    const base = defaultSettings(cfg);
    expect(resolveStrategy(base, registry).id).toBe('rules');
    expect(resolveStrategy({ ...base, strategyId: 'llm' }, registry).id).toBe('llm');
    expect(resolveStrategy({ ...base, strategyId: 'plug-strategy' }, registry).id).toBe('plug-strategy');
    expect(resolveStrategy({ ...base, strategyId: 'nope' }, registry).id).toBe('rules');
  });
});
