export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** What a provider is being asked to do. Built-in providers simply send `messages`. */
export type ProviderTask = 'checkin' | 'nudge' | 'test';

export interface CheckInContext {
  task: ProviderTask;
  /** Ready-made chat messages (system prompt, few-shot examples, the note). */
  messages: ChatMessage[];
  /** Aborted on timeout or when the user presses Cancel. Pass it to fetch. */
  signal: AbortSignal;
  /** 1 on the first try, 2 on the single retry after invalid output. */
  attempt: number;
}

/**
 * Raw provider output. Usually the model's text; an agent may also return an object.
 * Either way it goes through the same zod validator in runCheckIn.ts before anything uses it.
 */
export interface ProviderResult {
  raw: unknown;
}

export interface Provider {
  id: string;
  label: string;
  checkIn(note: string, ctx: CheckInContext): Promise<ProviderResult>;
  healthCheck?(): Promise<{ ok: boolean; message?: string }>;
}

export interface WeatherSnapshot {
  temperatureC: number;
  /** Highest precipitation probability (0-100) over roughly the next few hours. */
  precipitationProbability: number;
  /** WMO weather code as reported by Open-Meteo. */
  weatherCode: number;
  sunrise: Date;
  sunset: Date;
}

export interface NudgeInput {
  moodScore: number;
  weather: WeatherSnapshot | null;
  now: Date;
  /** Picks a wording variant. Same seed, same words. */
  seed: number;
  /** Present so model-backed strategies can ask for wording; may be null. */
  provider: Provider | null;
  signal?: AbortSignal;
}

export type NudgeRuleId = 'rain' | 'heat' | 'dark' | 'low-mood' | 'meh-mood' | 'light';

export interface Nudge {
  strategyId: string;
  rule: NudgeRuleId;
  /** One concrete activity. */
  suggestion: string;
  minutes: number;
  /** Plain facts behind the suggestion, from real weather and daylight data. */
  reason: string;
}

export interface NudgeStrategy {
  id: string;
  label: string;
  suggest(input: NudgeInput): Promise<Nudge> | Nudge;
}

export interface CheckInResult {
  mood_score: number;
  themes: string[];
  risk_flag: boolean;
  reply: string;
}
