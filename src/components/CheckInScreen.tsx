import { useRef, useState } from 'react';
import { performCheckIn, type CheckInFlowResult } from '../lib/checkInFlow';
import { saveEntry } from '../lib/db';
import { entryFromResult, type CheckInEntry } from '../lib/entries';
import { getCoordinates } from '../lib/location';
import { fetchWeather } from '../lib/weather';
import type { NudgeStrategy, Provider } from '../lib/types';
import { HomeScreen } from './HomeScreen';
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

  return (
    <div className="space-y-4">
      {step.kind === 'compose' && <HomeScreen onSubmit={handleSubmit} />}
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
  );
}
