import type { Nudge, NudgeInput, NudgeRuleId, NudgeStrategy, WeatherSnapshot } from '../types';

export const RAIN_PROBABILITY_THRESHOLD = 60;
export const HEAT_THRESHOLD_C = 36;
export const DUSK_THRESHOLD_MINUTES = 20;

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

interface Variant {
  suggestion: string;
  minutes: number;
}

export const VARIANTS: Record<NudgeRuleId, readonly [Variant, Variant, Variant]> = {
  rain: [
    { suggestion: "Rain's on the way, so step out to your doorstep or balcony for five minutes of fresh air.", minutes: 5 },
    { suggestion: 'Open the door, stand under the porch or balcony, and listen to the rain for five minutes.', minutes: 5 },
    { suggestion: "Rainy one today. Five minutes of fresh air at the doorstep or on the balcony still counts.", minutes: 5 },
  ],
  heat: [
    { suggestion: "It's very hot. Find a shady spot outside for ten minutes, or save a short walk for after sunset.", minutes: 10 },
    { suggestion: 'Too hot for a real walk. Sit somewhere shaded for ten minutes, with water, or walk once the sun is down.', minutes: 10 },
    { suggestion: 'Skip the midday heat: a slow ten minutes in the shade now, or a short loop after sunset.', minutes: 10 },
  ],
  dark: [
    { suggestion: "It's dark, or close to it. Take a short walk on a well-lit street, or do a stretch on the balcony.", minutes: 10 },
    { suggestion: 'Ten easy minutes along a lit street, or a balcony stretch if you would rather stay close.', minutes: 10 },
    { suggestion: 'Stick to the streetlights: a short loop nearby, or step onto the balcony and stretch.', minutes: 10 },
  ],
  'low-mood': [
    { suggestion: 'An easy 15-minute walk, phone in your pocket. No destination needed.', minutes: 15 },
    { suggestion: 'Twenty slow minutes outside, phone in pocket. Just notice what is around you.', minutes: 20 },
    { suggestion: 'Walk for about 15 minutes at whatever pace feels okay, phone tucked away.', minutes: 15 },
  ],
  'meh-mood': [
    { suggestion: 'A 10-minute walk to the nearest bit of green: a park, a tree-lined street, even a hedge.', minutes: 10 },
    { suggestion: 'Head for the closest green space and back, about 15 minutes.', minutes: 15 },
    { suggestion: 'Twelve minutes or so to the nearest park or patch of trees, then home.', minutes: 12 },
  ],
  light: [
    { suggestion: 'Quick 5-minute loop? No pressure.', minutes: 5 },
    { suggestion: 'Quick 5-minute loop around the block? Only if you feel like it.', minutes: 5 },
    { suggestion: 'Quick 5-minute loop? Totally optional, the day is already going fine.', minutes: 5 },
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
  const variant = VARIANTS[rule][variantIndex(input.seed)];
  return {
    strategyId: 'rules',
    rule,
    suggestion: variant.suggestion,
    minutes: variant.minutes,
    reason: buildReason(input.weather, input.now),
  };
}

export const rulesStrategy: NudgeStrategy = {
  id: 'rules',
  label: 'Rules (weather + daylight, no model)',
  suggest: suggestByRules,
};
