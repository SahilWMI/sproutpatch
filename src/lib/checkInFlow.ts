import { z } from 'zod';
import { estimateMood } from './fallbackMood';
import { suggestByRules } from './nudge/rules';
import { runCheckIn, type FallbackReason } from './runCheckIn';
import { checkSafety } from './safety';
import type { Nudge, NudgeInput, NudgeStrategy, Provider, WeatherSnapshot } from './types';
import { withTimeout } from './withTimeout';

/**
 * The fixed order of a check-in. Plugins plug into steps 3 and 5 only; steps 1 and 4 are not
 * configurable, so no provider or strategy can switch off risk mode.
 *
 *   1. keyword safety check on the raw text   -> risk mode, stop
 *   2. lexicon mood estimate
 *   3. provider reply through runCheckIn (validated, retried, or templated)
 *   4. model risk_flag                         -> risk mode, stop
 *   5. nudge strategy (validated, falls back to rules)
 */

export const STRATEGY_TIMEOUT_MS = 20_000;
const RISK_MOOD_CEILING = -2;

export type CheckInFlowResult =
  | { kind: 'risk'; moodScore: number; trigger: 'keyword' | 'model' }
  | {
      kind: 'ok';
      reply: string;
      moodScore: number;
      themes: string[];
      nudge: Nudge;
      weather: WeatherSnapshot | null;
      replySource: 'model' | 'fallback';
      fallbackReason?: FallbackReason;
      strategyNotice?: string;
    };

export interface CheckInFlowOptions {
  note: string;
  provider: Provider | null;
  strategy: NudgeStrategy;
  getWeather: () => Promise<WeatherSnapshot | null>;
  timeoutMs: number;
  signal?: AbortSignal;
  now?: Date;
  seed?: number;
}

const NudgeSchema = z.object({
  strategyId: z.string().min(1).max(60),
  rule: z.enum(['rain', 'heat', 'dark', 'low-mood', 'meh-mood', 'light']),
  suggestion: z.string().trim().min(1).max(240),
  minutes: z.number().finite(),
  reason: z.string().trim().min(1).max(300),
});

export function validateNudge(value: unknown): Nudge | null {
  const parsed = NudgeSchema.safeParse(value);
  if (!parsed.success) return null;
  return { ...parsed.data, minutes: Math.max(1, Math.min(60, Math.round(parsed.data.minutes))) };
}

export function defaultSeed(now: Date): number {
  return now.getDate() + now.getHours();
}

/** Runs any strategy defensively: throws, hangs or junk output all end in the rules nudge. */
export async function safeSuggest(
  strategy: NudgeStrategy,
  input: NudgeInput,
  timeoutMs = STRATEGY_TIMEOUT_MS,
): Promise<{ nudge: Nudge; notice?: string }> {
  try {
    const out = await withTimeout(async () => strategy.suggest(input), timeoutMs, input.signal);
    const nudge = validateNudge(out);
    if (nudge) return { nudge };
  } catch {
    // fall through to the rules
  }
  return {
    nudge: suggestByRules(input),
    notice:
      strategy.id === 'rules' ? undefined : `"${strategy.label}" couldn't make a suggestion, so this one comes from the built-in rules.`,
  };
}

export async function performCheckIn(opts: CheckInFlowOptions): Promise<CheckInFlowResult> {
  const now = opts.now ?? new Date();
  const seed = opts.seed ?? defaultSeed(now);

  // 1. Safety first, on the raw text, before anything else runs.
  const safety = checkSafety(opts.note);
  const estimate = estimateMood(opts.note);
  if (safety.risk) {
    return { kind: 'risk', moodScore: Math.min(estimate.mood_score, RISK_MOOD_CEILING), trigger: 'keyword' };
  }

  // Weather only needs coordinates, so it can load while the model thinks.
  const weatherPromise = opts.getWeather().catch(() => null);

  // 3. Provider reply, always through the one validator.
  const outcome = await runCheckIn({
    provider: opts.provider,
    note: opts.note,
    timeoutMs: opts.timeoutMs,
    signal: opts.signal,
    seed,
  });

  // 4. The model can raise the alarm, never lower it.
  if (outcome.result.risk_flag) {
    return { kind: 'risk', moodScore: Math.min(outcome.result.mood_score, RISK_MOOD_CEILING), trigger: 'model' };
  }

  const moodScore = outcome.source === 'model' ? outcome.result.mood_score : estimate.mood_score;
  const themes = outcome.result.themes.length > 0 ? outcome.result.themes : estimate.themes;
  const weather = await weatherPromise;

  // 5. Nudge.
  const { nudge, notice } = await safeSuggest(opts.strategy, {
    moodScore,
    weather,
    now,
    seed,
    provider: opts.provider,
    signal: opts.signal,
  });

  return {
    kind: 'ok',
    reply: outcome.result.reply,
    moodScore,
    themes,
    nudge,
    weather,
    replySource: outcome.source,
    fallbackReason: outcome.fallbackReason,
    strategyNotice: notice,
  };
}
