import type { FallbackReason } from '../lib/runCheckIn';
import type { Nudge } from '../lib/types';
import { SproutIcon } from './SproutIcon';

interface NudgeCardProps {
  reply: string;
  nudge: Nudge;
  replySource: 'model' | 'fallback';
  fallbackReason?: FallbackReason;
  strategyNotice?: string;
  onStartWalk: () => void;
  onSkip: () => void;
}

const FALLBACK_NOTES: Record<FallbackReason, string> = {
  'no-provider': 'Running without the model.',
  'invalid-output': "Running without the model (its answer didn't make sense this time).",
  timeout: 'Running without the model (it took too long).',
  cancelled: 'Running without the model (you cancelled).',
  error: "Running without the model (it couldn't be reached).",
};

export function NudgeCard({ reply, nudge, replySource, fallbackReason, strategyNotice, onStartWalk, onSkip }: NudgeCardProps) {
  return (
    <section className="space-y-4" aria-labelledby="nudge-heading">
      <div className="card">
        <p className="text-lg leading-relaxed text-mist-800 dark:text-mist-100">{reply}</p>
        {replySource === 'fallback' && (
          <p className="mt-3 text-xs text-mist-400 dark:text-mist-500">{FALLBACK_NOTES[fallbackReason ?? 'no-provider']}</p>
        )}
      </div>

      <div className="card border-sprout-200 bg-sprout-50 dark:border-sprout-900 dark:bg-sprout-950">
        <div className="flex items-start gap-3">
          <SproutIcon className="mt-0.5 h-8 w-8 shrink-0 text-sprout-600 dark:text-sprout-400" />
          <div className="space-y-2">
            <h2 id="nudge-heading" className="text-base font-semibold text-sprout-900 dark:text-sprout-100">
              {nudge.suggestion}
            </h2>
            <p className="text-sm text-sprout-800 dark:text-sprout-300">{nudge.reason}</p>
            {strategyNotice && <p className="text-xs text-mist-500 dark:text-mist-400">{strategyNotice}</p>}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primary" onClick={onStartWalk} autoFocus>
            Start walk ({nudge.minutes} min)
          </button>
          <button type="button" className="btn-ghost" onClick={onSkip}>
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}
