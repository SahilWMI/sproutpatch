import { useEffect, useRef, useState } from 'react';
import { saveEntry } from '../lib/db';
import { MOOD_AFTER_OPTIONS, type CheckInEntry } from '../lib/entries';
import { MusicToggle } from './QuickToggles';
import { SproutIcon } from './SproutIcon';

interface WalkFlowProps {
  entry: CheckInEntry;
  musicOn: boolean;
  onToggleMusic: () => void;
  onExit: () => void;
}

type Phase = 'walking' | 'after' | 'done';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Deliberately boring: a dim page, a countdown, one button. */
export function WalkFlow({ entry, musicOn, onToggleMusic, onExit }: WalkFlowProps) {
  const minutes = entry.nudge.minutes;
  const [startedAt] = useState(() => new Date());
  const endAt = startedAt.getTime() + minutes * 60_000;
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<Phase>('walking');
  const [endedAt, setEndedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);

  const remaining = endAt - now;
  const finished = remaining <= 0;

  useEffect(() => {
    if (phase !== 'walking') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    const original = document.title;
    if (phase === 'walking') document.title = finished ? "Time's up · Sproutpatch" : `${formatRemaining(remaining)} · Sproutpatch`;
    return () => {
      document.title = original;
    };
  }, [phase, remaining, finished]);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  function imBack() {
    setEndedAt(new Date());
    setPhase('after');
  }

  async function pickMood(value: number | null) {
    const updated: CheckInEntry = {
      ...entry,
      moodAfter: value ?? undefined,
      walk: {
        plannedMinutes: minutes,
        startedAt: startedAt.toISOString(),
        endedAt: (endedAt ?? new Date()).toISOString(),
        completed: true,
      },
    };
    try {
      await saveEntry(updated);
    } catch {
      setSaveError(true);
    }
    setPhase('done');
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-mist-950 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center text-mist-400">
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))]">
        <MusicToggle
          on={musicOn}
          onToggle={onToggleMusic}
          className="flex h-11 w-11 items-center justify-center rounded-full text-mist-500 transition-colors hover:bg-mist-900 hover:text-mist-300"
        />
      </div>
      {phase === 'walking' && (
        <div className="flex flex-col items-center gap-10">
          <p className="sr-only" aria-live="polite">
            {finished ? "Time's up." : `Walk timer running, ${minutes} minutes.`}
          </p>
          <p className="font-mono text-6xl font-light tabular-nums text-mist-500 sm:text-7xl" aria-hidden="true">
            {finished ? '0:00' : formatRemaining(remaining)}
          </p>
          <p className="max-w-xs text-sm text-mist-600">
            {finished ? "That's the time. Head back whenever you like." : 'Put the phone away. This page will wait.'}
          </p>
          <button
            ref={backRef}
            type="button"
            onClick={imBack}
            className="rounded-full border border-mist-700 px-6 py-3 text-sm text-mist-300 transition-colors hover:border-mist-500 hover:text-mist-100"
          >
            I'm back
          </button>
        </div>
      )}

      {phase === 'after' && (
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-xl text-mist-200">How do you feel now?</h1>
          <div className="flex flex-wrap justify-center gap-3" role="group" aria-label="Mood after the walk">
            {MOOD_AFTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => void pickMood(opt.value)}
                className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-mist-800 text-3xl transition-colors hover:border-sprout-500 hover:bg-mist-900 focus-visible:border-sprout-500"
                aria-label={opt.label}
                title={opt.label}
              >
                <span aria-hidden="true">{opt.emoji}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void pickMood(null)} className="text-xs text-mist-600 underline hover:text-mist-400">
            Skip
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col items-center gap-6">
          <SproutIcon className="animate-sprout h-16 w-16 text-sprout-500" title="A new sprout" />
          <p className="max-w-sm text-lg text-mist-200" role="status">
            Nice. Screen's closed, go enjoy the rest of the day.
          </p>
          {saveError && <p className="text-xs text-amber-400">This walk couldn't be saved on this device.</p>}
          <button type="button" onClick={onExit} className="text-xs text-mist-600 underline hover:text-mist-400">
            Back to Sproutpatch
          </button>
        </div>
      )}
    </div>
  );
}
