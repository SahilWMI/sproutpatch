import type { Nudge, NudgeInput, NudgeRuleId, NudgeStrategy, WeatherSnapshot } from '../types';

export const RAIN_PROBABILITY_THRESHOLD = 60;
export const HEAT_THRESHOLD_C = 36;
export const DUSK_THRESHOLD_MINUTES = 20;
export const RAIN_MINUTES = 5;
export const SHORT_WALK_CAP_MINUTES = 15;

/** WMO codes: 65/67 heavy (freezing) rain, 81/82 heavy/violent showers, 95-99 thunderstorms. */
const HEAVY_RAIN_CODES = new Set([65, 67, 81, 82]);
const THUNDER_CODES = new Set([95, 96, 99]);

export function isThunderstorm(code: number): boolean {
  return THUNDER_CODES.has(code);
}

export function isHeavyRain(code: number): boolean {
  return HEAVY_RAIN_CODES.has(code);
}

/** Whole minutes of daylight left right now; 0 before sunrise or after sunset. */
export function daylightMinutesLeft(now: Date, weather: Pick<WeatherSnapshot, 'sunrise' | 'sunset'>): number {
  if (now.getTime() < weather.sunrise.getTime()) return 0;
  return Math.max(0, Math.floor((weather.sunset.getTime() - now.getTime()) / 60_000));
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Walk length by mood: 10, 15, 30, 45 or 60 minutes from the lowest mood to the highest. */
export function walkMinutesForMood(moodScore: number): number {
  const mood = Math.round(moodScore);
  if (mood <= -2) return 10;
  if (mood === -1) return 15;
  if (mood === 0) return 30;
  if (mood <= 2) return 45;
  return 60;
}

/** Rain is a fixed doorstep break; heat and darkness keep the walk short; otherwise mood decides. */
export function minutesForRule(rule: NudgeRuleId, moodScore: number): number {
  if (rule === 'rain') return RAIN_MINUTES;
  const tier = walkMinutesForMood(moodScore);
  if (rule === 'heat' || rule === 'dark') return Math.min(tier, SHORT_WALK_CAP_MINUTES);
  return tier;
}

export function formatSpan(minutes: number): string {
  return minutes >= 60 ? 'an hour' : `${minutes} minutes`;
}

function adjective(minutes: number): string {
  return minutes >= 60 ? 'hour-long' : `${minutes}-minute`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Variant = (minutes: number) => string;

export const VARIANTS: Record<NudgeRuleId, readonly [Variant, Variant, Variant]> = {
  rain: [
    () => "Rain's on the way, so step out to your doorstep or balcony for five minutes of fresh air.",
    () => 'Open the door, stand under the porch or balcony, and listen to the rain for five minutes.',
    () => 'Rainy one today. Five minutes of fresh air at the doorstep or on the balcony still counts.',
  ],
  heat: [
    (m) => `It's very hot. Find a shady spot outside for ${formatSpan(m)}, or save a longer walk for after sunset.`,
    (m) => `Too hot for a real walk. Sit somewhere shaded for ${formatSpan(m)}, with water, or walk once the sun is down.`,
    (m) => `Skip the heat: spend ${formatSpan(m)} in the shade now, or take a proper walk after sunset.`,
  ],
  dark: [
    (m) => `It's dark, or close to it. Take a ${adjective(m)} walk on a well-lit street, or do a stretch on the balcony.`,
    (m) => `About ${formatSpan(m)} along a lit street, or a balcony stretch if you would rather stay close.`,
    (m) => `Stick to the streetlights: a ${adjective(m)} loop nearby, or step onto the balcony and stretch.`,
  ],
  'low-mood': [
    (m) => `An easy ${adjective(m)} walk, phone in your pocket. No destination needed.`,
    (m) => `${capitalize(formatSpan(m))} of slow walking, phone in pocket. Just notice what is around you.`,
    (m) => `Walk for about ${formatSpan(m)} at whatever pace feels okay, phone tucked away.`,
  ],
  'meh-mood': [
    (m) => `A ${adjective(m)} walk to the nearest bit of green: a park, a tree-lined street, even a hedge.`,
    (m) => `Head for the closest green space and wander for ${formatSpan(m)}.`,
    (m) => `About ${formatSpan(m)} out to the nearest park or patch of trees, then home.`,
  ],
  light: [
    (m) => `Good day for a proper walk: ${formatSpan(m)}, anywhere that looks nice. No pressure.`,
    (m) => `How about a ${adjective(m)} walk? Pick a route you haven't tried. No pressure.`,
    (m) => `You've got energy today. Take it outside for ${formatSpan(m)}, at your own pace.`,
  ],
};

/** First matching rule wins. Without weather, only the time of day is used. */
export function pickRule(moodScore: number, weather: WeatherSnapshot | null, now: Date): NudgeRuleId {
  if (weather) {
    if (
      weather.precipitationProbability >= RAIN_PROBABILITY_THRESHOLD ||
      isThunderstorm(weather.weatherCode) ||
      isHeavyRain(weather.weatherCode)
    ) {
      return 'rain';
    }
    if (weather.temperatureC >= HEAT_THRESHOLD_C) return 'heat';
    if (daylightMinutesLeft(now, weather) < DUSK_THRESHOLD_MINUTES) return 'dark';
  } else {
    const hour = now.getHours();
    if (hour >= 18 || hour < 6) return 'dark';
  }
  if (moodScore <= -2) return 'low-mood';
  if (moodScore <= 0) return 'meh-mood';
  return 'light';
}

function describeSky(weather: WeatherSnapshot): string {
  const p = Math.round(weather.precipitationProbability);
  if (isThunderstorm(weather.weatherCode)) return 'Thunderstorms around';
  if (isHeavyRain(weather.weatherCode)) return 'Heavy rain';
  if (p >= RAIN_PROBABILITY_THRESHOLD) return `Rain likely (${p}%)`;
  if (p >= 30) return `Some chance of rain (${p}%)`;
  return 'Dry';
}

function describeDaylight(minutes: number, now: Date, weather: WeatherSnapshot): string {
  if (now.getTime() < weather.sunrise.getTime()) return 'the sun is not up yet';
  if (minutes <= 0) return 'the sun has already set';
  if (minutes >= 120) return `about ${Math.round(minutes / 60)} hours of daylight left`;
  const rounded = minutes >= 30 ? Math.round(minutes / 5) * 5 : minutes;
  return `about ${rounded} minute${rounded === 1 ? '' : 's'} of daylight left`;
}

export function buildReason(weather: WeatherSnapshot | null, now: Date): string {
  if (!weather) {
    return `Couldn't get the weather right now, so this is based on the time of day only (it's ${formatClock(now)}).`;
  }
  const minutes = daylightMinutesLeft(now, weather);
  return [
    describeSky(weather),
    `${Math.round(weather.temperatureC)}°C`,
    `sunset at ${formatClock(weather.sunset)}`,
    describeDaylight(minutes, now, weather),
  ].join(', ');
}

export function variantIndex(seed: number): 0 | 1 | 2 {
  return (((Math.trunc(seed) % 3) + 3) % 3) as 0 | 1 | 2;
}

export function suggestByRules(input: Pick<NudgeInput, 'moodScore' | 'weather' | 'now' | 'seed'>): Nudge {
  const rule = pickRule(input.moodScore, input.weather, input.now);
  const minutes = minutesForRule(rule, input.moodScore);
  return {
    strategyId: 'rules',
    rule,
    suggestion: VARIANTS[rule][variantIndex(input.seed)](minutes),
    minutes,
    reason: buildReason(input.weather, input.now),
  };
}

export const rulesStrategy: NudgeStrategy = {
  id: 'rules',
  label: 'Rules (weather + daylight, no model)',
  suggest: suggestByRules,
};
