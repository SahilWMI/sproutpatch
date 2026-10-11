import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { config } from '../lib/config';
import { TEST_PROMPT_MESSAGES } from '../lib/prompt';
import type { AgentRegistry } from '../lib/registry';
import { validateModelOutput } from '../lib/runCheckIn';
import { availableStrategies, resolveProvider, type AppSettings } from '../lib/settings';
import { withTimeout, TimeoutError, CancelledError } from '../lib/withTimeout';
import { isLocalUrl } from '../providers/http';
import { discoverOllamaModels, formatSize, isGemma, pickDefaultModel, type InstalledModel } from '../providers/tags';
import { ON_DEVICE_PROVIDER_ID } from '../providers/onDevice/onDevice';
import { OnDeviceModelSection } from './OnDeviceModelSection';
import { SproutIcon } from './SproutIcon';

interface SetupWizardProps {
  initial: AppSettings;
  registry: AgentRegistry;
  firstRun: boolean;
  onSave: (settings: AppSettings) => Promise<void> | void;
}

type TagsState =
  | { status: 'loading' }
  | { status: 'ok'; models: InstalledModel[] }
  | { status: 'error'; message: string };

type TestState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; latencyMs: number; validJson: boolean; detail?: string }
  | { status: 'error'; message: string };

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-mist-100 px-1.5 py-0.5 font-mono text-[0.85em] text-mist-800 dark:bg-mist-800 dark:text-mist-100">
      {children}
    </code>
  );
}

function SizesNote() {
  return (
    <p className="muted">
      Other Gemma sizes work too (for example <Code>gemma3:4b</Code> or <Code>gemma3:12b</Code>). Smaller is faster with
      weaker replies; larger is the reverse.
    </p>
  );
}

export function SetupWizard({ initial, registry, firstRun, onSave }: SetupWizardProps) {
  const [draft, setDraft] = useState<AppSettings>(initial);
  const [tags, setTags] = useState<TagsState>({ status: 'loading' });
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const testAbort = useRef<AbortController | null>(null);

  const update = (patch: Partial<AppSettings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
    setTest({ status: 'idle' });
  };

  const checkOllama = useCallback(async () => {
    setTags({ status: 'loading' });
    const result = await discoverOllamaModels();
    if (result.ok) {
      setTags({ status: 'ok', models: result.models });
      setDraft((d) =>
        d.ollamaModel && result.models.some((m) => m.name === d.ollamaModel)
          ? d
          : { ...d, ollamaModel: pickDefaultModel(result.models, d.ollamaModel) || d.ollamaModel },
      );
    } else {
      setTags({ status: 'error', message: result.message });
    }
  }, []);

  useEffect(() => {
    void checkOllama();
    return () => testAbort.current?.abort();
  }, [checkOllama]);

  async function runTest() {
    const provider = resolveProvider(draft, registry);
    if (!provider) {
      setTest({ status: 'error', message: 'Pick a model (or a provider) first.' });
      return;
    }
    const controller = new AbortController();
    testAbort.current = controller;
    setTest({ status: 'running' });
    const started = performance.now();
    try {
      const out = await withTimeout(
        (signal) => provider.checkIn('Quick test', { task: 'test', messages: TEST_PROMPT_MESSAGES, signal, attempt: 1 }),
        config.timeoutMs,
        controller.signal,
      );
      const latencyMs = Math.round(performance.now() - started);
      const validJson = validateModelOutput(out?.raw) !== null;
      const preview = typeof out?.raw === 'string' ? out.raw.slice(0, 160) : JSON.stringify(out?.raw ?? null).slice(0, 160);
      setTest({ status: 'done', latencyMs, validJson, detail: validJson ? undefined : preview });
    } catch (err) {
      const message =
        err instanceof TimeoutError
          ? `No answer within ${Math.round(config.timeoutMs / 1000)} seconds.`
          : err instanceof CancelledError
            ? 'Test cancelled.'
            : err instanceof Error
              ? err.message
              : 'Something went wrong.';
      setTest({ status: 'error', message });
    }
  }

  async function save(next: AppSettings) {
    setSaving(true);
    try {
      await onSave({ ...next, setupDone: true });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const strategies = availableStrategies(registry);
  const remote = draft.providerId === 'openai-compatible' && !isLocalUrl(draft.openaiBaseUrl);
  const providerOptions: { id: string; label: string; hint: string }[] = [
    { id: 'ollama', label: 'Ollama (local)', hint: 'Recommended on a computer. Uses a Gemma model you installed.' },
    { id: ON_DEVICE_PROVIDER_ID, label: 'Gemma on this device', hint: 'Gemma 3 270M in the browser. Works on Android, offline.' },
    { id: 'openai-compatible', label: 'OpenAI-compatible server', hint: 'LM Studio, llama.cpp server, vLLM…' },
    { id: 'mock', label: 'Mock', hint: 'Deterministic canned replies, for demos.' },
    { id: 'none', label: 'No model', hint: 'Keyword mood estimate and reply templates only.' },
    ...registry.providers.map((p) => ({ id: p.id, label: p.label, hint: 'Plugin from src/agents' })),
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <SproutIcon className="h-10 w-10 shrink-0 text-sprout-700 dark:text-sprout-400" />
        <div>
          <h1 className="text-2xl font-semibold text-mist-800 dark:text-mist-100">
            {firstRun ? 'Bring your own Gemma' : 'Settings'}
          </h1>
          <p className="muted">
            Sproutpatch never downloads or bundles a model. It talks to one you got yourself, on your computer or on this
            device.
          </p>
        </div>
      </header>

      {config.hosted && (
        <p className="rounded-xl bg-mist-100 p-3 text-sm text-mist-700 dark:bg-mist-800 dark:text-mist-200" role="note">
          You're on the hosted version, which starts without a model: mood comes from a keyword estimate and nudges from
          the weather rules. On this computer, pick "Ollama (local)" and press Check again — it will try the Ollama app
          on this PC. If that is blocked, run <Code>npm run dev</Code> and open the local address, or pick "Gemma on this
          device".
        </p>
      )}

      <fieldset className="card space-y-3">
        <legend className="sr-only">Where replies come from</legend>
        <h2 className="font-semibold">Where replies come from</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {providerOptions.map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition-colors ${
                draft.providerId === opt.id
                  ? 'border-sprout-500 bg-sprout-50 dark:border-sprout-500 dark:bg-sprout-950'
                  : 'border-mist-200 hover:bg-mist-50 dark:border-mist-700 dark:hover:bg-mist-800'
              }`}
            >
              <input
                type="radio"
                name="provider"
                value={opt.id}
                checked={draft.providerId === opt.id}
                onChange={() => update({ providerId: opt.id })}
                className="mt-1 accent-sprout-600"
              />
              <span>
                <span className="block font-medium">{opt.label}</span>
                <span className="text-mist-700 dark:text-mist-400">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {draft.providerId === ON_DEVICE_PROVIDER_ID && <OnDeviceModelSection />}

      {draft.providerId === 'ollama' && (
        <section className="card space-y-4" aria-labelledby="ollama-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="ollama-heading" className="font-semibold">
              Installed models
            </h2>
            <button type="button" className="btn-ghost" onClick={() => void checkOllama()} disabled={tags.status === 'loading'}>
              {tags.status === 'loading' ? 'Checking…' : 'Check again'}
            </button>
          </div>

          {tags.status === 'loading' && (
            <p className="muted" role="status">
              Looking for Ollama on this computer…
            </p>
          )}

          {tags.status === 'error' && (
            <div className="space-y-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-300/10 dark:text-amber-100" role="status">
              <p className="font-medium">Can't reach Ollama yet.</p>
              {tags.message && <p>{tags.message}</p>}
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>
                  Install Ollama from <a className="underline" href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com</a> if you haven't.
                </li>
                <li>
                  Start it: <Code>ollama serve</Code>
                </li>
                <li>
                  Get a small Gemma: <Code>ollama pull gemma3:1b</Code>
                </li>
                <li>Press "Check again".</li>
              </ol>
              <SizesNote />
            </div>
          )}

          {tags.status === 'ok' && tags.models.length === 0 && (
            <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-300/10 dark:text-amber-100" role="status">
              <p className="font-medium">Ollama is running, but no models are installed.</p>
              <p>
                Run <Code>ollama pull gemma3:1b</Code>, then press "Check again".
              </p>
              <SizesNote />
            </div>
          )}

          {tags.status === 'ok' && tags.models.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="sr-only">Choose a model</legend>
              {tags.models.map((m) => (
                <label
                  key={m.name}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-mist-50 dark:hover:bg-mist-800"
                >
                  <input
                    type="radio"
                    name="ollama-model"
                    checked={draft.ollamaModel === m.name}
                    onChange={() => update({ ollamaModel: m.name })}
                    className="accent-sprout-600"
                  />
                  <span className="font-mono">{m.name}</span>
                  <span className="text-xs text-mist-700 dark:text-mist-400">
                    {[m.parameterSize, formatSize(m.sizeBytes)].filter(Boolean).join(' · ')}
                  </span>
                  {isGemma(m.name) && (
                    <span className="rounded-full bg-sprout-100 px-2 py-0.5 text-xs text-sprout-800 dark:bg-sprout-900 dark:text-sprout-200">
                      Gemma
                    </span>
                  )}
                </label>
              ))}
              <SizesNote />
            </fieldset>
          )}

          <div>
            <label htmlFor="model-tag" className="label">
              Or type any model tag
            </label>
            <input
              id="model-tag"
              className="input font-mono"
              placeholder="gemma3:1b"
              value={draft.ollamaModel}
              onChange={(e) => update({ ollamaModel: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </section>
      )}

      {draft.providerId === 'openai-compatible' && (
        <section className="card space-y-4" aria-labelledby="openai-heading">
          <h2 id="openai-heading" className="font-semibold">
            OpenAI-compatible server
          </h2>
          <p className="muted">
            LM Studio usually lives at <Code>http://localhost:1234/v1</Code>, llama.cpp's <Code>llama-server</Code> at{' '}
            <Code>http://localhost:8080/v1</Code>. The server must allow requests from this page (CORS).
          </p>
          <div>
            <label htmlFor="base-url" className="label">
              Base URL
            </label>
            <input
              id="base-url"
              className="input font-mono"
              value={draft.openaiBaseUrl}
              onChange={(e) => update({ openaiBaseUrl: e.target.value })}
              placeholder="http://localhost:1234/v1"
              spellCheck={false}
            />
          </div>
          {remote && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:bg-amber-300/10 dark:text-amber-100" role="alert">
              ⚠️ Your check-in text will be sent to this server.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="openai-model" className="label">
                Model
              </label>
              <input
                id="openai-model"
                className="input font-mono"
                value={draft.openaiModel}
                onChange={(e) => update({ openaiModel: e.target.value })}
                placeholder="gemma-3-1b-it"
                spellCheck={false}
              />
            </div>
            <div>
              <label htmlFor="api-key" className="label">
                API key (optional)
              </label>
              <input
                id="api-key"
                type="password"
                className="input font-mono"
                value={draft.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                autoComplete="off"
              />
            </div>
          </div>
          <p className="text-xs text-mist-700 dark:text-mist-400">The key is stored in this browser's IndexedDB only.</p>
        </section>
      )}

      {draft.providerId !== 'none' && (
        <section className="card space-y-3" aria-labelledby="test-heading">
          <h2 id="test-heading" className="font-semibold">
            Test model
          </h2>
          <p className="muted">Sends a tiny prompt and checks that valid JSON comes back. The first run can be slow while the model loads.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => void runTest()} disabled={test.status === 'running'}>
              {test.status === 'running' ? 'Testing…' : 'Test model'}
            </button>
            {test.status === 'running' && (
              <button type="button" className="btn-ghost" onClick={() => testAbort.current?.abort()}>
                Cancel
              </button>
            )}
          </div>
          <div aria-live="polite">
            {test.status === 'done' && (
              <p className={`text-sm ${test.validJson ? 'text-sprout-700 dark:text-sprout-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {test.validJson ? '✓ Valid JSON' : '✗ The answer was not valid JSON'} in {(test.latencyMs / 1000).toFixed(1)} s.
                {!test.validJson && ' Sproutpatch will retry once and then fall back to templates, so it still works.'}
                {test.detail && <span className="mt-1 block font-mono text-xs opacity-80">{test.detail}</span>}
              </p>
            )}
            {test.status === 'error' && <p className="text-sm text-amber-700 dark:text-amber-300">✗ {test.message}</p>}
          </div>
        </section>
      )}

      <section className="card space-y-3" aria-labelledby="strategy-heading">
        <h2 id="strategy-heading" className="font-semibold">
          Nudge strategy
        </h2>
        <label htmlFor="strategy" className="sr-only">
          Nudge strategy
        </label>
        <select id="strategy" className="input" value={draft.strategyId} onChange={(e) => update({ strategyId: e.target.value })}>
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="muted">
          Weather and daylight always come from real data. The safety check runs before any of this and cannot be changed here.
        </p>
        {registry.skipped.length > 0 && (
          <details className="text-xs text-mist-700 dark:text-mist-400">
            <summary>Some files in src/agents were skipped</summary>
            <ul className="mt-1 list-disc pl-5">
              {registry.skipped.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => void save(draft)} disabled={saving}>
          {firstRun ? 'Save and start' : 'Save'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => void save({ ...draft, providerId: 'none' })} disabled={saving}>
          Continue without the model
        </button>
        {saved && !firstRun && (
          <span className="text-sm text-sprout-700 dark:text-sprout-300" role="status">
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}
