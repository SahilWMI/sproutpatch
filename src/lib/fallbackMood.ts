import { normalizeForSafety } from './safety';

/**
 * Keyword/lexicon mood estimate. Used when there is no model, when the model's answer is
 * unusable, and for risk-mode entries (which never reach a model).
 */

const LEXICON: Record<string, number> = {
  // positive
  good: 1, great: 2, nice: 1, happy: 2, calm: 1, relaxed: 1.5, peaceful: 1.5, fun: 1.5,
  love: 1.5, loved: 1.5, enjoyed: 1.5, excited: 2, grateful: 2, thankful: 1.5, proud: 1.5,
  productive: 1, rested: 1, okay: 0.3, ok: 0.3, fine: 0.3, better: 0.8, awesome: 2, amazing: 2,
  wonderful: 2, glad: 1, content: 1, chill: 1, laughed: 1.5, smiled: 1, cozy: 1, energized: 1.5,
  // negative
  bad: -1, awful: -2, terrible: -2, horrible: -2, sad: -1.5, tired: -1, exhausted: -1.5,
  stressed: -1.5, stress: -1, stressful: -1.5, anxious: -1.5, worried: -1, angry: -1.5, annoyed: -1,
  frustrated: -1.5, lonely: -1.5, alone: -0.8, bored: -0.5, overwhelmed: -2, hopeless: -2.5,
  miserable: -2.5, upset: -1.5, cry: -1.5, cried: -1.5, crying: -1.5, hate: -1.5, worst: -2,
  sick: -1, ill: -1, drained: -1.5, burnt: -1.5, burned: -1, flat: -0.8, meh: -0.5, down: -1,
  rough: -1.2, hard: -0.6, ugh: -1, failed: -1.5, fight: -1, argument: -1, scared: -1.5,
  depressed: -2, empty: -1.5, numb: -1.5, skipped: -0.4, late: -0.3, deadline: -0.5,
};

const NEGATORS = new Set(['not', 'no', 'never', 'isnt', 'wasnt', 'dont', 'didnt', 'hardly', 'barely']);
const INTENSIFIERS = new Set(['very', 'really', 'so', 'super', 'extremely', 'totally']);

const THEMES: { theme: string; words: string[] }[] = [
  { theme: 'work', words: ['work', 'job', 'boss', 'meeting', 'meetings', 'office', 'deadline', 'client', 'shift', 'manager', 'email'] },
  { theme: 'study', words: ['exam', 'exams', 'study', 'class', 'college', 'school', 'homework', 'assignment', 'lecture'] },
  { theme: 'sleep', words: ['sleep', 'slept', 'insomnia', 'nap', 'tired', 'exhausted'] },
  { theme: 'family', words: ['family', 'mom', 'mum', 'dad', 'parents', 'sister', 'brother', 'kids', 'son', 'daughter'] },
  { theme: 'friends', words: ['friend', 'friends', 'party', 'hangout', 'chat', 'called'] },
  { theme: 'health', words: ['sick', 'ill', 'headache', 'pain', 'gym', 'run', 'workout', 'doctor'] },
  { theme: 'weather', words: ['rain', 'rained', 'raining', 'sunny', 'hot', 'cold', 'weather', 'storm'] },
  { theme: 'food', words: ['lunch', 'dinner', 'breakfast', 'ate', 'cooked', 'food', 'coffee', 'tea'] },
  { theme: 'rest', words: ['relaxed', 'book', 'read', 'movie', 'calm', 'quiet', 'chill'] },
];

export interface MoodEstimate {
  mood_score: number;
  themes: string[];
}

export function clampMood(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-3, Math.min(3, Math.round(value)));
}

export function estimateMood(text: string): MoodEstimate {
  const words = normalizeForSafety(text).split(' ').filter(Boolean);
  let total = 0;
  let hits = 0;

  words.forEach((word, i) => {
    const base = LEXICON[word];
    if (base === undefined) return;
    let weight = base;
    const prev = words[i - 1];
    const prev2 = words[i - 2];
    if (prev && INTENSIFIERS.has(prev)) weight *= 1.5;
    if ((prev && NEGATORS.has(prev)) || (prev2 && NEGATORS.has(prev2) && prev && INTENSIFIERS.has(prev))) {
      weight *= -0.7;
    }
    total += weight;
    hits += 1;
  });

  // Average-ish so one long rant doesn't saturate, but several signals still add up.
  const score = hits === 0 ? 0 : total / Math.sqrt(hits);

  const themes: string[] = [];
  for (const { theme, words: keys } of THEMES) {
    if (themes.length >= 3) break;
    if (keys.some((k) => words.includes(k))) themes.push(theme);
  }

  return { mood_score: clampMood(score), themes };
}
