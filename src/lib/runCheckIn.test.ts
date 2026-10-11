import { describe, expect, it, vi } from 'vitest';
import {
  MAX_REPLY_LENGTH,
  runCheckIn,
  stripAdvice,
  stripCodeFences,
  truncateReply,
  validateModelOutput,
} from './runCheckIn';
import type { CheckInContext, Provider } from './types';
import { mockProvider } from '../providers/mock';

/** A provider that returns the given raw answers in order (repeating the last one). */
function scripted(...answers: unknown[]): Provider & { calls: CheckInContext[] } {
  const calls: CheckInContext[] = [];
  return {
    id: 'scripted',
    label: 'Scripted',
    calls,
    async checkIn(_note, ctx) {
      calls.push(ctx);
      const raw = answers[Math.min(calls.length - 1, answers.length - 1)];
      return { raw };
    },
  };
}

const GOOD = '{"mood_score": 1, "themes": ["work"], "risk_flag": false, "reply": "Sounds like a steady day."}';

describe('validateModelOutput', () => {
  it('accepts a well-formed answer', () => {
    expect(validateModelOutput(GOOD)).toEqual({
      mood_score: 1,
      themes: ['work'],
      risk_flag: false,
      reply: 'Sounds like a steady day.',
    });
  });

  it('accepts an object (agents may return parsed JSON)', () => {
    expect(validateModelOutput({ mood_score: 0, risk_flag: false, reply: 'Hi.' })?.themes).toEqual([]);
  });

  it('strips ```json fences and surrounding chatter', () => {
    const fenced = 'Sure! Here you go:\n```json\n' + GOOD + '\n```\nHope that helps.';
    expect(validateModelOutput(fenced)?.reply).toBe('Sounds like a steady day.');
    expect(validateModelOutput('Answer: ' + GOOD)?.mood_score).toBe(1);
    expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('rejects garbage text', () => {
    expect(validateModelOutput('I think you had a nice day!')).toBeNull();
    expect(validateModelOutput('{not json')).toBeNull();
    expect(validateModelOutput('')).toBeNull();
    expect(validateModelOutput(null)).toBeNull();
    expect(validateModelOutput(42)).toBeNull();
  });

  it('rejects wrong types', () => {
    expect(validateModelOutput('{"mood_score": "2", "risk_flag": false, "reply": "x"}')).toBeNull();
    expect(validateModelOutput('{"mood_score": 2, "risk_flag": "no", "reply": "x"}')).toBeNull();
    expect(validateModelOutput('{"mood_score": 2, "risk_flag": false, "reply": 5}')).toBeNull();
    expect(validateModelOutput('{"mood_score": 2, "themes": "work", "risk_flag": false, "reply": "x"}')).toBeNull();
    expect(validateModelOutput('{"mood_score": 2, "risk_flag": false, "reply": "   "}')).toBeNull();
  });

  it('clamps out-of-range and fractional scores', () => {
    expect(validateModelOutput('{"mood_score": 11, "risk_flag": false, "reply": "ok"}')?.mood_score).toBe(3);
    expect(validateModelOutput('{"mood_score": -40, "risk_flag": false, "reply": "ok"}')?.mood_score).toBe(-3);
    expect(validateModelOutput('{"mood_score": 1.6, "risk_flag": false, "reply": "ok"}')?.mood_score).toBe(2);
  });

  it('truncates an oversized reply to 300 characters', () => {
    const long = 'This is a really long reply that keeps going. '.repeat(30);
    const out = validateModelOutput(JSON.stringify({ mood_score: 0, risk_flag: false, reply: long }));
    expect(out?.reply.length).toBeLessThanOrEqual(MAX_REPLY_LENGTH);
    expect(out?.reply.endsWith('…')).toBe(true);
    expect(truncateReply('short')).toBe('short');
  });

  it('keeps at most 3 cleaned themes', () => {
    const out = validateModelOutput(
      JSON.stringify({ mood_score: 0, themes: [' Work ', 'work', 'sleep', 'food', 'family'], risk_flag: false, reply: 'ok' }),
    );
    expect(out?.themes).toEqual(['work', 'sleep', 'food']);
  });

  it('strips medical or therapy advice', () => {
    const out = validateModelOutput(
      JSON.stringify({
        mood_score: -1,
        risk_flag: false,
        reply: 'That sounds hard. You should consider therapy or ask a doctor about medication.',
      }),
    );
    expect(out?.reply).toBe('That sounds hard.');
    expect(stripAdvice('Try CBT. Take 50 mg of something.')).toBe('');
  });

  it('replaces a reply that is entirely advice with a warm template', () => {
    const out = validateModelOutput(
      JSON.stringify({ mood_score: -2, risk_flag: false, reply: 'You may have an anxiety disorder; see a psychiatrist.' }),
    );
    expect(out?.reply).toBeTruthy();
    expect(out?.reply).not.toMatch(/psychiatr|disorder/i);
  });
});

describe('runCheckIn', () => {
  const base = { note: 'Long day at work, kind of tired.', timeoutMs: 5000 };

  it('uses the model answer when valid', async () => {
    const p = scripted(GOOD);
    const out = await runCheckIn({ ...base, provider: p });
    expect(out.source).toBe('model');
    expect(out.attempts).toBe(1);
    expect(p.calls).toHaveLength(1);
    expect(p.calls[0]?.task).toBe('checkin');
  });

  it('retries once after invalid output and succeeds', async () => {
    const p = scripted('lol no', GOOD);
    const out = await runCheckIn({ ...base, provider: p });
    expect(out.source).toBe('model');
    expect(out.attempts).toBe(2);
    expect(p.calls[1]?.attempt).toBe(2);
    expect(p.calls[1]?.messages[0]?.content).toMatch(/previous answer was not valid/);
  });

  it.each([
    ['garbage text', 'Here is a poem about clouds.'],
    ['wrong types', '{"mood_score": "bad", "risk_flag": 0, "reply": []}'],
    ['missing keys', '{"reply": "hi"}'],
  ])('falls back to the lexicon after two bad answers (%s)', async (_label, bad) => {
    const p = scripted(bad);
    const out = await runCheckIn({ ...base, provider: p });
    expect(p.calls).toHaveLength(2);
    expect(out.source).toBe('fallback');
    expect(out.fallbackReason).toBe('invalid-output');
    expect(out.result.reply.length).toBeGreaterThan(0);
    expect(out.result.mood_score).toBeLessThanOrEqual(0);
  });

  it('falls back without a provider', async () => {
    const out = await runCheckIn({ ...base, provider: null });
    expect(out.source).toBe('fallback');
    expect(out.fallbackReason).toBe('no-provider');
  });

  it('falls back (no retry) when the provider throws', async () => {
    const checkIn = vi.fn(async () => {
      throw new Error('connection refused');
    });
    const out = await runCheckIn({ ...base, provider: { id: 'x', label: 'x', checkIn } });
    expect(checkIn).toHaveBeenCalledTimes(1);
    expect(out.fallbackReason).toBe('error');
    expect(out.errorMessage).toBe('connection refused');
  });

  it('falls back on timeout', async () => {
    const hanging: Provider = { id: 'slow', label: 'slow', checkIn: () => new Promise(() => {}) };
    const out = await runCheckIn({ ...base, timeoutMs: 30, provider: hanging });
    expect(out.source).toBe('fallback');
    expect(out.fallbackReason).toBe('timeout');
  });

  it('falls back when the user cancels', async () => {
    const controller = new AbortController();
    const hanging: Provider = { id: 'slow', label: 'slow', checkIn: () => new Promise(() => {}) };
    const pending = runCheckIn({ ...base, provider: hanging, signal: controller.signal });
    controller.abort();
    const out = await pending;
    expect(out.fallbackReason).toBe('cancelled');
  });

  it('works with the mock provider', async () => {
    const out = await runCheckIn({ ...base, provider: mockProvider });
    expect(out.source).toBe('model');
    expect(out.result.risk_flag).toBe(false);
  });
});
