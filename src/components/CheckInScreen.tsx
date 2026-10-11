import { useRef, useState } from 'react';
import { performCheckIn, type CheckInFlowResult } from '../lib/checkInFlow';
import { saveEntry } from '../lib/db';
import { entryFromResult, type CheckInEntry } from '../lib/entries';
import { getCoordinates } from '../lib/location';
import { fetchWeather } from '../lib/weather';
import type { NudgeStrategy, Provider } from '../lib/types';
import { greetingFor } from '../lib/scene/sky';
import { GrassScene } from './GrassScene';
import { Composer } from './HomeScreen';
import { NudgeCard } from './NudgeCard';
import { RiskCard } from './RiskCard';
import { ThinkingCard } from './ThinkingCard';

type Step =
  | { kind: 'compose' }
  | { kind: 'thinking' }
  | { kind: 'result'; entry: CheckInEntry; result: Extract<CheckInFlowResult, { kind: 'ok' }> }
  | { kind: 'risk'; trigger: 'keyword' | 'model' }
  | { kind: 'skipped' };

interface CheckInScreenProps {
  provider: Provider | null;
  strategy: NudgeStrategy;
  timeoutMs: number;
  onStartWalk: (entry: CheckInEntry) => void;
}

async function loadWeather() {
  const { lat, lon } = await getCoordinates();
  return fetchWeather(lat, lon);
}

export function CheckInScreen({ provider, strategy, timeoutMs, onStartWalk }: CheckInScreenProps) {
  const [step, setStep] = useState<Step>({ kind: 'compose' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  async function handleSubmit(note: string) {
    const controller = new AbortController();
    controllerRef.current = controller;
    setSaveError(null);
    setStep({ kind: 'thinking' });

    const now = new Date();
    let result: CheckInFlowResult;
    try {
      result = await performCheckIn({
        note,
        provider,
        strategy,
        getWeather: loadWeather,
        timeoutMs,
        signal: controller.signal,
        now,
      });
    } catch {
      // performCheckIn already contains its own fallbacks; this is a last-resort guard.
      result = await performCheckIn({ note, provider: null, strategy, getWeather: async () => null, timeoutMs, now });
    }

    const entry = entryFromResult(note, result, now);
    try {
      await saveEntry(entry);
    } catch {
      setSaveError("Couldn't save this check-in on this device. Everything else still works.");
    }

    if (result.kind === 'risk') setStep({ kind: 'risk', trigger: result.trigger });
    else if (entry.kind === 'checkin') setStep({ kind: 'result', entry, result });
  }

  const reset = () => setStep({ kind: 'compose' });

  const composing = step.kind === 'compose';
  const greeting = greetingFor(new Date().getHours());

  return (
    <div className="flex flex-1 flex-col">
      <GrassScene
        active={step.kind === 'thinking'}
        className={composing ? 'min-h-[260px] flex-1' : 'h-[clamp(120px,22dvh,220px)] shrink-0'}
      >
        <div className="mx-auto flex h-full max-w-2xl flex-col px-5 pt-6 sm:pt-10">
          <p className="text-sm font-medium text-white/85 [text-shadow:0_1px_8px_rgb(0_0_0/0.45)]">{greeting}</p>
          {composing && (
            <>
              <h1 className="mt-1 text-3xl font-semibold text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.5)] sm:text-4xl">
                How's today going?
              </h1>
              <p className="mt-2 max-w-xs text-sm text-white/85 [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
                A few lines is plenty. Then we get you outside.
              </p>
            </>
          )}
        </div>
      </GrassScene>

      <div className={composing && !saveError ? 'hidden' : 'mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5'}>
      {step.kind === 'thinking' && (
        <ThinkingCard
          label={provider ? `Asking ${provider.label}…` : 'Putting together a suggestion…'}
          onCancel={() => controllerRef.current?.abort()}
        />
      )}
      {step.kind === 'result' && (
        <NudgeCard
          reply={step.result.reply}
          nudge={step.result.nudge}
          replySource={step.result.replySource}
          fallbackReason={step.result.fallbackReason}
          strategyNotice={step.result.strategyNotice}
          onStartWalk={() => onStartWalk(step.entry)}
          onSkip={() => setStep({ kind: 'skipped' })}
        />
      )}
      {step.kind === 'risk' && <RiskCard trigger={step.trigger} onDone={reset} />}
      {step.kind === 'skipped' && (
        <div className="card space-y-3 text-center">
          <p className="text-stone-700 dark:text-stone-200">No problem. Your check-in is saved.</p>
          <button type="button" className="btn-secondary" onClick={reset}>
            New check-in
          </button>
        </div>
      )}
      {saveError && (
        <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
          {saveError}
        </p>
      )}
      </div>

      <div className="sticky bottom-0 z-20 border-t border-stone-200/70 bg-stone-50/90 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md dark:border-stone-800/70 dark:bg-stone-950/85">
        {composing && <Composer onSubmit={handleSubmit} />}
        <p className={`text-center text-[11px] text-stone-400 dark:text-stone-500 ${composing ? 'mt-1' : ''}`}>
          Sproutpatch is not a therapist or a medical tool.
        </p>
      </div>
    </div>
  );
}
