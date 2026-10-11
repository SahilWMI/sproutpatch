import type { CheckInEntry, Entry } from './entries';
import type { NudgeRuleId } from './types';

interface SampleSpec {
  daysAgo: number;
  hour: number;
  note: string;
  moodBefore: number;
  moodAfter?: number;
  themes: string[];
  rule: NudgeRuleId;
  suggestion: string;
  minutes: number;
  reason: string;
}

const SPECS: SampleSpec[] = [
  {
    daysAgo: 0,
    hour: 16,
    note: 'Back-to-back meetings, lunch at my desk again.',
    moodBefore: -1,
    moodAfter: 1.5,
    themes: ['work', 'food'],
    rule: 'meh-mood',
    suggestion: 'Head for the closest green space and wander for 15 minutes.',
    minutes: 15,
    reason: 'Dry, 29°C, sunset at 5:41 PM, about 95 minutes of daylight left',
  },
  {
    daysAgo: 1,
    hour: 18,
    note: 'Rained all afternoon, stayed in and read.',
    moodBefore: 1,
    moodAfter: 1.5,
    themes: ['weather', 'rest'],
    rule: 'rain',
    suggestion: 'Open the door, stand under the porch or balcony, and listen to the rain for five minutes.',
    minutes: 5,
    reason: 'Rain likely (80%), 24°C, sunset at 5:42 PM, the sun has already set',
  },
  {
    daysAgo: 2,
    hour: 15,
    note: 'Exam prep all day, tired and a bit anxious.',
    moodBefore: -2,
    moodAfter: 0,
    themes: ['study', 'sleep'],
    rule: 'low-mood',
    suggestion: 'An easy 10-minute walk, phone in your pocket. No destination needed.',
    minutes: 10,
    reason: 'Dry, 30°C, sunset at 5:42 PM, about 2 hours of daylight left',
  },
  {
    daysAgo: 3,
    hour: 11,
    note: 'Slow morning, good coffee, called my sister.',
    moodBefore: 2,
    moodAfter: 3,
    themes: ['family', 'food'],
    rule: 'light',
    suggestion: 'Good day for a proper walk: 45 minutes, anywhere that looks nice. No pressure.',
    minutes: 45,
    reason: 'Dry, 27°C, sunset at 5:43 PM, about 7 hours of daylight left',
  },
  {
    daysAgo: 4,
    hour: 17,
    note: 'Ordinary day. Nothing much happened.',
    moodBefore: 0,
    themes: [],
    rule: 'dark',
    suggestion: 'About 15 minutes along a lit street, or a balcony stretch if you would rather stay close.',
    minutes: 15,
    reason: 'Dry, 26°C, sunset at 5:43 PM, about 15 minutes of daylight left',
  },
  {
    daysAgo: 5,
    hour: 14,
    note: 'Argument with a friend, felt drained after.',
    moodBefore: -2,
    moodAfter: -1.5,
    themes: ['friends'],
    rule: 'low-mood',
    suggestion: '10 minutes of slow walking, phone in pocket. Just notice what is around you.',
    minutes: 10,
    reason: 'Some chance of rain (35%), 28°C, sunset at 5:44 PM, about 3 hours of daylight left',
  },
];

/** Made-up entries for demos. Marked `sample: true`, so saveEntry refuses to store them. */
export function makeSampleEntries(now: Date): Entry[] {
  return SPECS.map((spec, i): CheckInEntry => {
    const created = new Date(now);
    created.setDate(created.getDate() - spec.daysAgo);
    created.setHours(spec.hour, 5 + i * 7, 0, 0);
    if (created.getTime() > now.getTime()) created.setTime(now.getTime() - (i + 1) * 60_000);
    const walked = spec.moodAfter !== undefined;
    const started = new Date(created.getTime() + 3 * 60_000);
    return {
      id: `sample-${i}`,
      sample: true,
      createdAt: created.toISOString(),
      kind: 'checkin',
      moodBefore: spec.moodBefore,
      note: `(Sample) ${spec.note}`,
      themes: spec.themes,
      reply: '(Sample reply)',
      replySource: 'fallback',
      nudge: { rule: spec.rule, suggestion: spec.suggestion, minutes: spec.minutes, reason: spec.reason },
      walk: walked
        ? {
            plannedMinutes: spec.minutes,
            startedAt: started.toISOString(),
            endedAt: new Date(started.getTime() + spec.minutes * 60_000).toISOString(),
            completed: true,
          }
        : undefined,
      moodAfter: spec.moodAfter,
    };
  });
}
