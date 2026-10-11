import { useEffect, useRef, useState } from 'react';
import { formatSize } from '../providers/tags';
import { unloadOnDeviceModel, webGpuAvailable } from '../providers/onDevice/onDevice';
import { deleteStoredModel, getStoredModel, modelStorageSupported, saveModelFile, type StoredModel } from '../providers/onDevice/modelStore';

const MODEL_PAGE = 'https://huggingface.co/litert-community/gemma-3-270m-it';
const RECOMMENDED_FILE = 'gemma3-270m-it-q4_0-web.task';

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; model: StoredModel | null }
  | { kind: 'saving'; fraction: number }
  | { kind: 'error'; message: string; model: StoredModel | null };

/** Settings card for running Gemma inside the browser: pick the model file once, keep it on the device. */
export function OnDeviceModelSection() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const inputRef = useRef<HTMLInputElement>(null);
  const gpu = webGpuAvailable();
  const storage = modelStorageSupported();

  useEffect(() => {
    void getStoredModel().then((model) => setStatus({ kind: 'ready', model }));
  }, []);

  const model = status.kind === 'ready' || status.kind === 'error' ? status.model : null;

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.name.endsWith('.task')) {
      setStatus({ kind: 'error', message: 'Pick a ".task" file (the web version of the model).', model });
      return;
    }
    setStatus({ kind: 'saving', fraction: 0 });
    try {
      await unloadOnDeviceModel();
      const saved = await saveModelFile(file, (fraction) => setStatus({ kind: 'saving', fraction }));
      setStatus({ kind: 'ready', model: saved });
    } catch (err) {
      const full = err instanceof DOMException && err.name === 'QuotaExceededError';
      setStatus({
        kind: 'error',
        message: full ? 'Not enough free storage on this device for the model.' : "Couldn't store the model file.",
        model: await getStoredModel(),
      });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove() {
    await unloadOnDeviceModel();
    await deleteStoredModel();
    setStatus({ kind: 'ready', model: null });
  }

  return (
    <section className="card space-y-4" aria-labelledby="on-device-heading">
      <h2 id="on-device-heading" className="font-semibold">
        Gemma on this device
      </h2>
      <p className="muted">
        Runs Gemma 3 270M inside this browser on the phone's GPU, the same model Google's on-device Android demo uses. No
        server and no internet once it's set up. Best in Chrome on Android 12 or newer.
      </p>

      {!gpu && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-300/10 dark:text-amber-100" role="alert">
          This browser doesn't support WebGPU, which the on-device model needs. Try Chrome on Android, or Chrome or Edge on a
          computer.
        </p>
      )}

      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Open the{' '}
          <a className="font-medium text-sprout-700 underline dark:text-sprout-300" href={MODEL_PAGE} target="_blank" rel="noreferrer">
            Gemma 3 270M page on Hugging Face
          </a>
          , sign in and accept Google's Gemma license (it's free).
        </li>
        <li>
          Under "Files and versions", download <span className="font-mono text-xs">{RECOMMENDED_FILE}</span> (about 250 MB).
          The <span className="font-mono text-xs">q8-web</span> file also works and is a little better, but bigger.
        </li>
        <li>Come back here and pick the downloaded file. It's copied into this browser's private storage.</li>
      </ol>

      <div className="space-y-3 rounded-xl border border-mist-300 p-3 dark:border-mist-700" aria-live="polite">
        {status.kind === 'loading' && <p className="muted">Checking for a stored model…</p>}
        {status.kind === 'saving' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Copying the model… {Math.round(status.fraction * 100)}%</p>
            <div className="h-2 overflow-hidden rounded-full bg-mist-200 dark:bg-mist-800">
              <div className="h-full bg-sprout-600 transition-[width]" style={{ width: `${Math.round(status.fraction * 100)}%` }} />
            </div>
          </div>
        )}
        {(status.kind === 'ready' || status.kind === 'error') && (
          <p className="text-sm">
            {model ? (
              <>
                <span className="font-medium">Stored:</span> <span className="font-mono text-xs">{model.name}</span> ·{' '}
                {formatSize(model.size)}
              </>
            ) : (
              'No model file stored yet.'
            )}
          </p>
        )}
        {status.kind === 'error' && (
          <p className="text-sm font-medium text-red-700 dark:text-red-300" role="alert">
            {status.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".task"
            className="sr-only"
            id="on-device-file"
            onChange={(e) => void pick(e.target.files?.[0])}
            disabled={!storage || status.kind === 'saving'}
          />
          <label
            htmlFor="on-device-file"
            className={`btn-primary cursor-pointer ${!storage || status.kind === 'saving' ? 'pointer-events-none opacity-50' : ''}`}
          >
            {model ? 'Replace model file' : 'Choose model file'}
          </label>
          {model && status.kind !== 'saving' && (
            <button type="button" className="btn-secondary" onClick={() => void remove()}>
              Remove
            </button>
          )}
        </div>
        {!storage && <p className="text-sm text-red-700 dark:text-red-300">This browser can't store files for websites.</p>}
      </div>

      <p className="muted text-xs">
        The first reply after opening the app takes a few seconds while the model loads. 270M is tiny: replies are short and
        sometimes miss the format, in which case Sproutpatch quietly falls back to its built-in replies.
      </p>
    </section>
  );
}
