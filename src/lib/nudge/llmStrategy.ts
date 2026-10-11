import { z } from 'zod';
import { buildNudgeMessages } from '../prompt';
import { stripAdvice, truncateReply } from '../runCheckIn';
import type { Nudge, NudgeInput, NudgeRuleId, NudgeStrategy } from '../types';
import { withTimeout } from '../withTimeout';
import { suggestByRules } from './rules';

export const LLM_NUDGE_TIMEOUT_MS = 30_000;

/** Weather and daylight rules are hard limits; the model may only reword mood-based nudges. */
const LOCKED_RULES: ReadonlySet<NudgeRuleId> = new Set(['rain', 'heat', 'dark']);

const NudgeAnswerSchema = z.object({
  suggestion: z.string().trim().min(3).max(400),
  minutes: z.number().finite().optional(),
});

function parseAnswer(raw: unknown): z.infer<typeof NudgeAnswerSchema> | null {
  let candidate = raw;
  if (typeof raw === 'string') {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      candidate = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  const parsed = NudgeAnswerSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export const llmStrategy: NudgeStrategy = {
  id: 'llm',
  label: 'Model wording (falls back to rules)',
  async suggest(input: NudgeInput): Promise<Nudge> {
    const base = suggestByRules(input);
    const provider = input.provider;
    if (!provider || LOCKED_RULES.has(base.rule)) return base;

    try {
      const facts = `${base.reason}. Rule-based idea: ${base.suggestion}`;
      const out = await withTimeout(
        (signal) =>
          provider.checkIn(facts, {
            task: 'nudge',
            messages: buildNudgeMessages(facts, input.moodScore, base.minutes),
            signal,
            attempt: 1,
          }),
        LLM_NUDGE_TIMEOUT_MS,
        input.signal,
      );
      const answer = parseAnswer(out?.raw);
      if (!answer) return base;
      const suggestion = truncateReply(stripAdvice(answer.suggestion.replace(/\s+/g, ' ')), 200);
      if (!suggestion) return base;
      // The walk length always comes from the mood tier in the rules, never from the model.
      return { ...base, strategyId: 'llm', suggestion };
    } catch {
      return base;
    }
  },
};
