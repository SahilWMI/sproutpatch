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

export const MOOD_AFTER_OPTIONS = [
  { value: -2, emoji: '😞', label: 'Worse' },
  { value: -1, emoji: '🙁', label: 'A bit worse' },
  { value: 0, emoji: '😐', label: 'About the same' },
  { value: 1, emoji: '🙂', label: 'A bit better' },
  { value: 2, emoji: '😄', label: 'Much better' },
] as const;

export function moodEmoji(score: number): string {
  if (score <= -2) return '😞';
  if (score < 0) return '🙁';
  if (score === 0) return '😐';
  if (score < 2) return '🙂';
  return '😄';
}
