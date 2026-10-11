import { estimateMood } from '../lib/fallbackMood';
import type { Provider } from '../lib/types';

/**
 * Deterministic offline provider. Same note, same answer. Useful for demos without a model
 * and for tests. It answers in the same JSON shape a real model is asked for.
 */
export const mockProvider: Provider = {
  id: 'mock',
  label: 'Mock (offline demo, no model)',
  async checkIn(note, ctx) {
    if (ctx.task === 'nudge') {
      return { raw: JSON.stringify({ suggestion: 'Walk to the end of your street and back.', minutes: 10 }) };
    }
    const { mood_score, themes } = estimateMood(note);
    const reply =
      mood_score < 0
        ? 'Thanks for sharing that, it sounds like a lot. A little time outside might help you reset.'
        : mood_score > 0
          ? 'That sounds like a good day. Some fresh air would be a nice way to keep it going.'
          : 'Thanks for checking in. A few minutes outdoors could be a gentle break.';
    return { raw: JSON.stringify({ mood_score, themes, risk_flag: false, reply }) };
  },
  async healthCheck() {
    return { ok: true, message: 'The mock provider is always available.' };
  },
};
