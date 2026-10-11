import { describe, expect, it } from 'vitest';
import { collectAgents, isNudgeStrategy, isProvider, pluginAgents } from './registry';

describe('agent auto-registration', () => {
  it('registers default exports found by import.meta.glob (fixture folder)', () => {
    const modules = import.meta.glob('./__fixtures__/agents/*.ts', { eager: true });
    const registry = collectAgents(modules);
    expect(registry.providers.map((p) => p.id)).toEqual(['fixture-echo']);
    expect(registry.strategies.map((s) => s.id)).toEqual(['fixture-garden']);
    expect(registry.skipped).toEqual([
      'duplicate-id.ts: id "ollama" is already used',
      'not-an-agent.ts: default export is not a Provider or NudgeStrategy',
    ]);
  });

  it('picks up the shipped example agent from src/agents', () => {
    expect(pluginAgents.providers.map((p) => p.id)).toContain('example-agent');
    expect(pluginAgents.skipped).toEqual([]);
  });

  it('ignores modules without a default export', () => {
    expect(collectAgents({ './x.ts': { named: 1 }, './y.ts': null }).skipped).toHaveLength(2);
  });

  it('type guards check shape', () => {
    expect(isProvider({ id: 'a', label: 'A', checkIn: () => null })).toBe(true);
    expect(isProvider({ id: '', label: 'A', checkIn: () => null })).toBe(false);
    expect(isNudgeStrategy({ id: 'a', label: 'A', suggest: () => null })).toBe(true);
    expect(isNudgeStrategy({ id: 'a', label: 'A' })).toBe(false);
  });
});
