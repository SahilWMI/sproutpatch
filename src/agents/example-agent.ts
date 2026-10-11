/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Example agent: a template for bringing your own provider to Sproutpatch.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOW REGISTRATION WORKS
 *   Every file in src/agents/*.ts is loaded at startup with import.meta.glob.
 *   If its DEFAULT export looks like a Provider (id, label, checkIn) or a
 *   NudgeStrategy (id, label, suggest), it appears in Settings automatically.
 *   No other wiring needed. Copy this file, rename it, change the id.
 *
 * WHAT YOUR AGENT CAN AND CANNOT DO
 *   - It only writes the short reply (and a rough mood guess).
 *   - It never sees crisis-language notes: the keyword safety check runs first
 *     and, on a match, the app stops before calling any provider or strategy.
 *   - Whatever you return goes through the same zod validator as the built-in
 *     models (src/lib/runCheckIn.ts). Bad output is retried once, then replaced
 *     by the lexicon fallback. Throwing or hanging is fine: the user just sees
 *     the fallback reply with a small note. You cannot crash the UI.
 *   - Returning risk_flag: true switches the app into risk mode. Returning
 *     false cannot switch it off.
 *
 * THE CONTRACT
 *   checkIn(note, ctx) must resolve to { raw }, where raw is either:
 *     - a JSON string:  '{"mood_score":0,"themes":[],"risk_flag":false,"reply":"..."}'
 *     - or that object directly.
 *   ctx.messages already contains the system prompt, two few-shot examples and
 *   the note, ready to send to any chat-style API. ctx.signal is aborted on
 *   timeout or when the user presses Cancel; pass it to fetch().
 *   ctx.task is 'checkin' for the daily reply, 'nudge' when the "llm" strategy
 *   asks for activity wording, and 'test' for the Settings "Test model" button.
 *
 * PRIVACY
 *   If your agent calls a remote server, the user's note leaves their device.
 *   Say so clearly in your label, e.g. "My cloud agent (sends text to example.com)".
 *
 * This example needs no network: it answers with a canned, friendly reply so you
 * can see a plugin working end to end. Select "Example agent (template)" in Settings.
 */

import type { CheckInContext, Provider, ProviderResult } from '../lib/types';

/** A tiny word list, just to show the agent can look at the note. */
const UPBEAT = ['good', 'great', 'nice', 'calm', 'happy', 'fun', 'relaxed'];
const HEAVY = ['bad', 'tired', 'stressed', 'awful', 'sad', 'rough', 'long'];

function guessMood(note: string): number {
  const words = note.toLowerCase().split(/\W+/);
  const up = words.filter((w) => UPBEAT.includes(w)).length;
  const down = words.filter((w) => HEAVY.includes(w)).length;
  return Math.max(-3, Math.min(3, up - down));
}

const exampleAgent: Provider = {
  // Must be unique. Built-in ids (ollama, openai-compatible, mock, none, rules, llm) are reserved.
  id: 'example-agent',

  // Shown in the Settings dropdown.
  label: 'Example agent (template)',

  async checkIn(note: string, ctx: CheckInContext): Promise<ProviderResult> {
    // Respect cancellation. Real agents would pass ctx.signal to fetch() instead.
    if (ctx.signal.aborted) throw new Error('cancelled');

    if (ctx.task === 'nudge') {
      // The "llm" nudge strategy asks for {"suggestion", "minutes"}.
      return { raw: { suggestion: 'Walk to the nearest tree and say hello to it.', minutes: 10 } };
    }

    const mood = guessMood(note);

    // Example of calling a real server instead (kept as a comment so this file works offline):
    //
    //   const res = await fetch('http://localhost:8080/v1/chat/completions', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ model: 'gemma-3-1b-it', messages: ctx.messages, stream: false }),
    //     signal: ctx.signal,
    //   });
    //   const data = (await res.json()) as { choices: { message: { content: string } }[] };
    //   return { raw: data.choices[0]?.message.content ?? '' };

    return {
      raw: {
        mood_score: mood,
        themes: [],
        risk_flag: false,
        reply:
          mood < 0
            ? 'Hello from the example agent. That sounds like a lot; a few minutes outside could help.'
            : 'Hello from the example agent. Sounds like a decent day, so take it outside for a bit.',
      },
    };
  },

  // Optional. Used by the "Test model" button in Settings.
  async healthCheck() {
    return { ok: true, message: 'The example agent runs in the browser and is always ready.' };
  },
};

export default exampleAgent;
