import { z } from 'zod';
import { config, type AppConfig } from './config';
import { getSetting, setSetting } from './db';
import { llmStrategy } from './nudge/llmStrategy';
import { rulesStrategy } from './nudge/rules';
import type { AgentRegistry } from './registry';
import type { NudgeStrategy, Provider } from './types';
import { mockProvider } from '../providers/mock';
import { createOllamaProvider } from '../providers/ollama';
import { createOpenAICompatibleProvider } from '../providers/openaiCompatible';

export const SETTINGS_KEY = 'app';

const SettingsSchema = z.object({
  /** 'ollama' | 'openai-compatible' | 'mock' | 'none' | a plugin id */
  providerId: z.string(),
  ollamaModel: z.string(),
  openaiBaseUrl: z.string(),
  openaiModel: z.string(),
  apiKey: z.string(),
  strategyId: z.string(),
  setupDone: z.boolean(),
});

export type AppSettings = z.infer<typeof SettingsSchema>;

/** Hosted builds start in no-model mode and skip the model wizard; Settings can still connect one. */
export function defaultSettings(cfg: AppConfig = config): AppSettings {
  if (cfg.hosted && !cfg.baseUrl) {
    return { ...defaultSettings({ ...cfg, hosted: false }), providerId: 'none', setupDone: true };
  }
  return {
    providerId: cfg.baseUrl ? 'openai-compatible' : 'ollama',
    ollamaModel: cfg.model,
    openaiBaseUrl: cfg.baseUrl || 'http://localhost:1234/v1',
    openaiModel: cfg.baseUrl ? cfg.model : '',
    apiKey: cfg.apiKey,
    strategyId: 'rules',
    setupDone: false,
  };
}

/** Merges whatever is stored over the defaults; unknown or broken data never blocks startup. */
export function normalizeSettings(stored: unknown, cfg: AppConfig = config): AppSettings {
  const defaults = defaultSettings(cfg);
  if (typeof stored !== 'object' || stored === null) return defaults;
  const merged = SettingsSchema.safeParse({ ...defaults, ...stored });
  return merged.success ? merged.data : defaults;
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    return normalizeSettings(await getSetting<unknown>(SETTINGS_KEY));
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await setSetting(SETTINGS_KEY, settings);
}

/** null means "no model": the app runs on the lexicon and reply templates. */
export function resolveProvider(settings: AppSettings, registry: AgentRegistry): Provider | null {
  switch (settings.providerId) {
    case 'none':
      return null;
    case 'mock':
      return mockProvider;
    case 'ollama':
      return settings.ollamaModel.trim() ? createOllamaProvider({ model: settings.ollamaModel.trim() }) : null;
    case 'openai-compatible':
      return settings.openaiBaseUrl.trim()
        ? createOpenAICompatibleProvider({
            baseUrl: settings.openaiBaseUrl,
            model: settings.openaiModel.trim(),
            apiKey: settings.apiKey,
          })
        : null;
    default:
      return registry.providers.find((p) => p.id === settings.providerId) ?? null;
  }
}

export function availableStrategies(registry: AgentRegistry): NudgeStrategy[] {
  return [rulesStrategy, llmStrategy, ...registry.strategies];
}

export function resolveStrategy(settings: AppSettings, registry: AgentRegistry): NudgeStrategy {
  return availableStrategies(registry).find((s) => s.id === settings.strategyId) ?? rulesStrategy;
}
