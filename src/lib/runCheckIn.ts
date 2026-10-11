import { z } from 'zod';
import { buildCheckInMessages } from './prompt';
import { clampMood, estimateMood } from './fallbackMood';
import { templateReply } from './replyTemplates';
import type { CheckInResult, Provider } from './types';
import { CancelledError, TimeoutError, withTimeout } from './withTimeout';

/**
 * The ONE place model output is turned into something the app trusts.
 * Every provider (built-in or plugin) goes through validateModelOutput.
 */

export const MAX_REPLY_LENGTH = 300;
export const MAX_THEMES = 3;
const MAX_THEME_LENGTH = 24;

const ModelOutputSchema = z.object({
  mood_score: z.number(),
  themes: z.array(z.string()).optional(),
  risk_flag: z.boolean(),
  reply: z.string(),
});

const MEDICAL_OR_THERAPY =
  /\b(therap(y|ist|ies|eutic)|counsel(l?ing|l?or)|psychiatr\w*|psycholog\w*|diagnos\w*|disorder|medicat\w*|medicine|prescri\w*|dosage|dose|pills?|antidepressants?|ssris?|mg|treatment|clinical|doctor|physician|cbt|mental health professional|seek (professional )?help)\b/i;

export function stripCodeFences(text: string): string {
  let t = text.trim();
  const fenced = t.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) t = fenced[1].trim();
  if (!t.startsWith('{')) {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start !== -1 && end > start) t = t.slice(start, end + 1);
  }
  return t;
}

export function truncateReply(text: string, max = MAX_REPLY_LENGTH): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.!?-]+$/, '')}…`;
}

/** Drops any sentence that reads like medical or therapy advice. May return an empty string. */
export function stripAdvice(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .filter((s) => !MEDICAL_OR_THERAPY.test(s))
    .join(' ')
    .trim();
}

function cleanThemes(themes: string[] | undefined): string[] {
  if (!themes) return [];
  const out: string[] = [];
  for (const theme of themes) {
    const t = theme.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_THEME_LENGTH);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_THEMES) break;
  }
  return out;
}

/** Parses + validates + cleans raw provider output. Returns null when it can't be trusted. */
export function validateModelOutput(raw: unknown, seed = 0): CheckInResult | null {
  let candidate: unknown = raw;
  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(stripCodeFences(raw));
    } catch {
      return null;
    }
  }
  const parsed = ModelOutputSchema.safeParse(candidate);
  if (!parsed.success) return null;

  const mood = clampMood(parsed.data.mood_score);
  const collapsed = parsed.data.reply.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  const safeReply = stripAdvice(collapsed) || templateReply(mood, seed);

  return {
    mood_score: mood,
    themes: cleanThemes(parsed.data.themes),
    risk_flag: parsed.data.risk_flag,
    reply: truncateReply(safeReply),
  };
}

export type FallbackReason = 'no-provider' | 'invalid-output' | 'timeout' | 'cancelled' | 'error';

export interface CheckInOutcome {
  result: CheckInResult;
  source: 'model' | 'fallback';
  attempts: number;
  fallbackReason?: FallbackReason;
  errorMessage?: string;
}

export interface RunCheckInOptions {
  provider: Provider | null;
  note: string;
  timeoutMs: number;
  signal?: AbortSignal;
  seed?: number;
}

export function fallbackResult(note: string, seed = 0): CheckInResult {
  const estimate = estimateMood(note);
  return {
    mood_score: estimate.mood_score,
    themes: estimate.themes,
    risk_flag: false,
    reply: templateReply(estimate.mood_score, seed),
  };
}

const MAX_ATTEMPTS = 2;

export async function runCheckIn({ provider, note, timeoutMs, signal, seed = 0 }: RunCheckInOptions): Promise<CheckInOutcome> {
  const fallback = (attempts: number, fallbackReason: FallbackReason, errorMessage?: string): CheckInOutcome => ({
    result: fallbackResult(note, seed),
    source: 'fallback',
    attempts,
    fallbackReason,
    errorMessage,
  });

  if (!provider) return fallback(0, 'no-provider');

  const deadline = Date.now() + timeoutMs;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return fallback(attempt - 1, 'timeout');
    try {
      const output = await withTimeout(
        (sig) =>
          provider.checkIn(note, {
            task: 'checkin',
            messages: buildCheckInMessages(note, attempt),
            signal: sig,
            attempt,
          }),
        remaining,
        signal,
      );
      const valid = validateModelOutput(output?.raw, seed);
      if (valid) return { result: valid, source: 'model', attempts: attempt };
    } catch (err) {
      if (err instanceof TimeoutError) return fallback(attempt, 'timeout');
      if (err instanceof CancelledError) return fallback(attempt, 'cancelled');
      return fallback(attempt, 'error', err instanceof Error ? err.message : String(err));
    }
  }
  return fallback(MAX_ATTEMPTS, 'invalid-output');
}
