import type { CheckInFlowResult } from './checkInFlow';
import type { NudgeRuleId } from './types';

export interface WalkRecord {
  plannedMinutes: number;
  startedAt: string;
  endedAt: string;
  completed: boolean;
}

interface EntryBase {
  id: string;
  createdAt: string;
  moodBefore: number;
  /** Sample entries are made up for demos and are never written to storage. */
  sample?: boolean;
}

export interface CheckInEntry extends EntryBase {
  kind: 'checkin';
  note: string;
  themes: string[];
  reply: string;
  replySource: 'model' | 'fallback';
  nudge: { rule: NudgeRuleId; suggestion: string; minutes: number; reason: string };
  walk?: WalkRecord;
  /** Same -3..3 scale as moodBefore. */
  moodAfter?: number;
}

/** Risk entries keep only a mood score and the marker. Never any text. */
export interface RiskEntry extends EntryBase {
  kind: 'risk';
  risk: true;
}

export type Entry = CheckInEntry | RiskEntry;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function entryFromResult(note: string, result: CheckInFlowResult, now: Date, id = newId()): Entry {
  if (result.kind === 'risk') {
    return { id, createdAt: now.toISOString(), kind: 'risk', risk: true, moodBefore: result.moodScore };
  }
  return {
    id,
    createdAt: now.toISOString(),
    kind: 'checkin',
    moodBefore: result.moodScore,
    note,
    themes: result.themes,
    reply: result.reply,
    replySource: result.replySource,
    nudge: {
      rule: result.nudge.rule,
      suggestion: result.nudge.suggestion,
      minutes: result.nudge.minutes,
      reason: result.nudge.reason,
    },
  };
}

/** Absolute "how do you feel now", on the same -3..3 scale as moodBefore so the change is comparable. */
export const MOOD_AFTER_OPTIONS = [
  { value: -3, emoji: '😞', label: 'Rough' },
  { value: -1.5, emoji: '🙁', label: 'Low' },
  { value: 0, emoji: '😐', label: 'Okay' },
  { value: 1.5, emoji: '🙂', label: 'Good' },
  { value: 3, emoji: '😄', label: 'Great' },
] as const;

export const RECENT_MOOD_WINDOW_MS = 6 * 60 * 60 * 1000;

/** The newest post-walk mood from the last few hours, if any. Sample entries never count. */
export function recentMoodAfter(entries: readonly Entry[], now: Date): number | undefined {
  let newest: { at: number; mood: number } | undefined;
  for (const e of entries) {
    if (e.kind !== 'checkin' || e.sample || e.moodAfter === undefined) continue;
    const at = Date.parse(e.walk?.endedAt ?? e.createdAt);
    if (!Number.isFinite(at) || now.getTime() - at > RECENT_MOOD_WINDOW_MS || at > now.getTime()) continue;
    if (!newest || at > newest.at) newest = { at, mood: e.moodAfter };
  }
  return newest?.mood;
}

function signOff(now: Date): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Enjoy the rest of the morning.';
  if (hour >= 12 && hour < 17) return 'Enjoy the rest of the afternoon.';
  if (hour >= 17 && hour < 21) return 'Enjoy the rest of the evening.';
  return 'Try to get some rest tonight.';
}

/** Closing line after a walk: compares how you feel now with how you felt at check-in. */
export function afterWalkMessage(moodBefore: number, moodAfter: number | null, now: Date): string {
  const end = signOff(now);
  if (moodAfter === null) return `Walk saved. ${end}`;
  const change = moodAfter - moodBefore;
  if (change >= 1) {
    return moodAfter >= 1.5
      ? `You came back feeling better than when you left. Nice work getting out. ${end}`
      : `A little lighter than before the walk. That counts. ${end}`;
  }
  if (change <= -1) {
    return `Feeling worse than before. That happens, and it's not on you. Go easy on yourself. ${end}`;
  }
  if (moodAfter <= -1.5) {
    return `Still feeling low, and that's okay. You got out anyway, which is not nothing. ${end}`;
  }
  if (moodAfter >= 1.5) return `Still in a good place. Glad the walk kept it going. ${end}`;
  return `About the same as before, and that's fine. Fresh air still did something. ${end}`;
}

export function moodEmoji(score: number): string {
  if (score <= -2) return '😞';
  if (score < 0) return '🙁';
  if (score === 0) return '😐';
  if (score < 3) return '🙂';
  return '😄';
}
