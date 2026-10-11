import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteAllData, exportAllData, listEntries } from '../lib/db';
import { MOOD_AFTER_OPTIONS, moodEmoji, type Entry } from '../lib/entries';
import { makeSampleEntries } from '../lib/sampleData';
import { chartPoints, formatChange, isCompletedWalk, weeklySummary } from '../lib/summary';
import { MoodChart } from './MoodChart';
import { SproutIcon } from './SproutIcon';

interface HistoryScreenProps {
  onDataDeleted: () => void;
}

type LoadState = { status: 'loading' } | { status: 'ok'; entries: Entry[] } | { status: 'error' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function afterOption(value: number) {
  return MOOD_AFTER_OPTIONS.reduce((best, o) => (Math.abs(o.value - value) < Math.abs(best.value - value) ? o : best));
}

function moodLabel(score: number): string {
  return `${score > 0 ? '+' : ''}${score}`;
}

export function HistoryScreen({ onDataDeleted }: HistoryScreenProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [showSample, setShowSample] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ok', entries: await listEntries() });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sample = useMemo(() => makeSampleEntries(now), [now]);
  const entries = showSample ? sample : state.status === 'ok' ? state.entries : [];
  const summary = weeklySummary(entries, now);
  const points = chartPoints(entries);

  async function handleExport() {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sproutpatch-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Exported. The file is in your downloads.');
    } catch {
      setMessage("Couldn't export right now.");
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete every check-in and setting stored by Sproutpatch on this device? This cannot be undone.')) return;
    try {
      await deleteAllData();
      setMessage('All your data was deleted from this device.');
      setShowSample(false);
      await load();
      onDataDeleted();
    } catch {
      setMessage("Couldn't delete right now. You can also clear this site's data in your browser settings.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-mist-800 dark:text-mist-100">History</h1>
        <button type="button" className="btn-secondary" onClick={() => setShowSample((s) => !s)} aria-pressed={showSample}>
          {showSample ? 'Back to my data' : 'Try a sample day'}
        </button>
      </div>

      {showSample && (
        <p className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100" role="status">
          Sample data: these entries are made up for the demo and are never saved.
        </p>
      )}

      {!showSample && state.status === 'loading' && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {!showSample && state.status === 'error' && (
        <div className="card space-y-2" role="alert">
          <p>Couldn't read your history from this browser's storage.</p>
          <button type="button" className="btn-secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {(showSample || state.status === 'ok') && (
        <>
          <section className="card" aria-labelledby="week-heading">
            <h2 id="week-heading" className="mb-4 font-semibold">
              This week
            </h2>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="muted">Check-ins</dt>
                <dd className="text-2xl font-semibold">{summary.checkIns}</dd>
              </div>
              <div>
                <dt className="muted">Walks taken</dt>
                <dd className="text-2xl font-semibold text-sprout-700 dark:text-sprout-300">{summary.walksTaken}</dd>
              </div>
              <div>
                <dt className="muted">Avg mood change</dt>
                <dd className="text-2xl font-semibold">{formatChange(summary.averageMoodChange)}</dd>
              </div>
            </dl>
            {summary.walksTaken > 0 && (
              <div className="mt-4 flex flex-wrap gap-1" aria-label={`${summary.walksTaken} sprouts this week`}>
                {Array.from({ length: summary.walksTaken }, (_, i) => (
                  <SproutIcon key={i} className="h-6 w-6 text-sprout-600 dark:text-sprout-400" />
                ))}
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="chart-heading">
            <h2 id="chart-heading" className="mb-3 font-semibold">
              Before and after
            </h2>
            <MoodChart points={points} />
          </section>

          <section aria-labelledby="entries-heading" className="space-y-3">
            <h2 id="entries-heading" className="font-semibold">
              Entries
            </h2>
            {entries.length === 0 && (
              <p className="muted">No check-ins yet. Your first one will show up here, along with a sprout for every walk.</p>
            )}
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="card flex items-start gap-3 p-4">
                  <div className="w-8 shrink-0 pt-0.5">
                    {isCompletedWalk(e) ? (
                      <SproutIcon className="h-7 w-7 text-sprout-600 dark:text-sprout-400" title="Walk completed" />
                    ) : (
                      <span className="block h-7 w-7 rounded-full border-2 border-dashed border-mist-300 dark:border-mist-700" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs text-mist-500 dark:text-mist-400">{formatDate(e.createdAt)}</p>
                    {e.kind === 'risk' ? (
                      <p className="text-sm">
                        Mood {moodLabel(e.moodBefore)} · <span className="text-amber-700 dark:text-amber-300">Support info shown</span>
                      </p>
                    ) : (
                      <>
                        <p className="text-sm">
                          <span aria-hidden="true">{moodEmoji(e.moodBefore)}</span> Mood {moodLabel(e.moodBefore)}
                          {typeof e.moodAfter === 'number' && (
                            <>
                              {' → '}
                              <span aria-hidden="true">{afterOption(e.moodAfter).emoji}</span> after the walk:{' '}
                              {afterOption(e.moodAfter).label.toLowerCase()}
                            </>
                          )}
                        </p>
                        {e.sample && <p className="truncate text-sm text-mist-600 dark:text-mist-300">{e.note}</p>}
                        {e.themes.length > 0 && (
                          <ul className="flex flex-wrap gap-1" aria-label="Themes">
                            {e.themes.map((t) => (
                              <li
                                key={t}
                                className="rounded-full bg-mist-100 px-2 py-0.5 text-xs text-mist-600 dark:bg-mist-800 dark:text-mist-300"
                              >
                                {t}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="card space-y-3" aria-labelledby="data-heading">
        <h2 id="data-heading" className="font-semibold">
          Your data
        </h2>
        <p className="muted">Everything lives in this browser's IndexedDB. Nothing is uploaded.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => void handleExport()}>
            Export my data (JSON)
          </button>
          <button type="button" className="btn-danger" onClick={() => void handleDelete()}>
            Delete all my data
          </button>
        </div>
        {message && (
          <p className="text-sm text-mist-600 dark:text-mist-300" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
