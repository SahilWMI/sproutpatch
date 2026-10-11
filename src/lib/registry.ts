import type { NudgeStrategy, Provider } from './types';

/**
 * Plugin discovery. Any src/agents/*.ts that default-exports a Provider or a NudgeStrategy
 * shows up in Settings. Plugins only ever fill the "provider" and "strategy" slots of the
 * check-in flow; the safety check and validator are not part of the registry, so a plugin
 * has no way to reach them.
 */

export const BUILT_IN_PROVIDER_IDS = ['ollama', 'openai-compatible', 'mock', 'none'] as const;
export const BUILT_IN_STRATEGY_IDS = ['rules', 'llm'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasIdentity(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string' && value.id.trim() !== '' && typeof value.label === 'string';
}

export function isProvider(value: unknown): value is Provider {
  return isRecord(value) && hasIdentity(value) && typeof value.checkIn === 'function';
}

export function isNudgeStrategy(value: unknown): value is NudgeStrategy {
  return isRecord(value) && hasIdentity(value) && typeof value.suggest === 'function';
}

export interface AgentRegistry {
  providers: Provider[];
  strategies: NudgeStrategy[];
  /** Human-readable reasons a file was skipped. Shown in Settings, never thrown. */
  skipped: string[];
}

export function collectAgents(modules: Record<string, unknown>): AgentRegistry {
  const registry: AgentRegistry = { providers: [], strategies: [], skipped: [] };
  const taken = new Set<string>([...BUILT_IN_PROVIDER_IDS, ...BUILT_IN_STRATEGY_IDS]);

  for (const [path, mod] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
    const file = path.split('/').pop() ?? path;
    const candidate = isRecord(mod) ? mod.default : undefined;
    if (isProvider(candidate)) {
      if (taken.has(candidate.id)) {
        registry.skipped.push(`${file}: id "${candidate.id}" is already used`);
        continue;
      }
      taken.add(candidate.id);
      registry.providers.push(candidate);
    } else if (isNudgeStrategy(candidate)) {
      if (taken.has(candidate.id)) {
        registry.skipped.push(`${file}: id "${candidate.id}" is already used`);
        continue;
      }
      taken.add(candidate.id);
      registry.strategies.push(candidate);
    } else {
      registry.skipped.push(`${file}: default export is not a Provider or NudgeStrategy`);
    }
  }
  return registry;
}

const agentModules = import.meta.glob(['../agents/*.ts', '!../agents/*.test.ts'], { eager: true });

export const pluginAgents: AgentRegistry = collectAgents(agentModules);
