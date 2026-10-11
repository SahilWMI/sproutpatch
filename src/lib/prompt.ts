import type { ChatMessage } from './types';

export const CHECKIN_SYSTEM_PROMPT =
  'You are Sproutpatch, a brief daily check-in companion. Reply ONLY with JSON: {"mood_score": integer -3 to 3, "themes": up to 3 short strings, "risk_flag": true only if the text suggests self-harm or acute crisis, "reply": 1-2 warm plain sentences, no medical or therapy advice}.';

// The negative-but-ordinary example goes last on purpose: small models copy the nearest example,
// and without it they tend to set risk_flag on every bad day.
const FEW_SHOT: ChatMessage[] = [
  { role: 'user', content: 'Slow morning, good coffee, called my sister. Pretty nice.' },
  {
    role: 'assistant',
    content:
      '{"mood_score": 2, "themes": ["family", "rest"], "risk_flag": false, "reply": "A slow morning and a good call sounds lovely. Glad today was kind to you."}',
  },
  { role: 'user', content: 'Deadline moved up again, skipped lunch, my head hurts. Long day.' },
  {
    role: 'assistant',
    content:
      '{"mood_score": -2, "themes": ["work", "deadline"], "risk_flag": false, "reply": "That sounds draining, especially on an empty stomach. You made it to the end of it, which is enough for today."}',
  },
];

const RETRY_REMINDER =
  'Your previous answer was not valid. Answer with a single JSON object only, exactly the keys mood_score, themes, risk_flag, reply. No code fences, no extra text.';

export function buildCheckInMessages(note: string, attempt = 1): ChatMessage[] {
  const system = attempt > 1 ? `${CHECKIN_SYSTEM_PROMPT}\n${RETRY_REMINDER}` : CHECKIN_SYSTEM_PROMPT;
  return [{ role: 'system', content: system }, ...FEW_SHOT, { role: 'user', content: note }];
}

export const NUDGE_SYSTEM_PROMPT =
  'You suggest ONE small, concrete outdoor activity of the given length. You are given the facts; do not invent weather or change the length. Reply ONLY with JSON: {"suggestion": one short sentence}.';

export function buildNudgeMessages(facts: string, moodScore: number, minutes: number): ChatMessage[] {
  return [
    { role: 'system', content: NUDGE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Facts: ${facts}. Mood today on a -3 to 3 scale: ${moodScore}. Length: ${minutes} minutes.`,
    },
  ];
}

export const TEST_PROMPT_MESSAGES: ChatMessage[] = [
  { role: 'system', content: CHECKIN_SYSTEM_PROMPT },
  { role: 'user', content: 'Quick test: it was an ordinary day.' },
];
