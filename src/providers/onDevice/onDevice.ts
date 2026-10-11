import type { LlmInference } from '@mediapipe/tasks-genai';
import type { Provider } from '../../lib/types';
import { CancelledError } from '../../lib/withTimeout';
import { cleanGemmaReply, formatGemmaPrompt } from './gemmaPrompt';
import { getStoredModel, openModelStream } from './modelStore';

export const ON_DEVICE_PROVIDER_ID = 'on-device';

/** Context budget (prompt + reply). The check-in prompt with its examples is well under this. */
const MAX_TOKENS = 1280;

export function webGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

let engine: Promise<LlmInference> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function loadEngine(): Promise<LlmInference> {
  if (!webGpuAvailable()) throw new Error('This browser has no WebGPU. Use Chrome on Android 12+ or a desktop browser with WebGPU.');
  if (!(await getStoredModel())) throw new Error('No model file yet. Add one in Settings.');
  const { LlmInference } = await import('@mediapipe/tasks-genai');
  const base = `${import.meta.env.BASE_URL}mediapipe/`;
  return LlmInference.createFromOptions(
    { wasmLoaderPath: `${base}genai_wasm_internal.js`, wasmBinaryPath: `${base}genai_wasm_internal.wasm` },
    {
      baseOptions: { modelAssetBuffer: await openModelStream() },
      maxTokens: MAX_TOKENS,
      topK: 20,
      temperature: 0.4,
      randomSeed: 7,
    },
  );
}

function getEngine(): Promise<LlmInference> {
  engine ??= loadEngine().catch((err: unknown) => {
    engine = null;
    throw err;
  });
  return engine;
}

/** Frees GPU memory, e.g. after the model file is replaced or removed. */
export async function unloadOnDeviceModel(): Promise<void> {
  const current = engine;
  engine = null;
  const llm = await current?.catch(() => null);
  llm?.close();
}

/** Gemma running inside this browser through MediaPipe and WebGPU. No server, works offline. */
export const onDeviceProvider: Provider = {
  id: ON_DEVICE_PROVIDER_ID,
  label: 'Gemma on this device',
  checkIn(_note, ctx) {
    // MediaPipe handles one generation at a time.
    const run = queue.then(async () => {
      if (ctx.signal.aborted) throw new CancelledError();
      const llm = await getEngine();
      if (ctx.signal.aborted) throw new CancelledError();
      const cancel = () => llm.cancelProcessing();
      ctx.signal.addEventListener('abort', cancel, { once: true });
      try {
        const text = await llm.generateResponse(formatGemmaPrompt(ctx.messages));
        if (ctx.signal.aborted) throw new CancelledError();
        return { raw: cleanGemmaReply(text) };
      } finally {
        ctx.signal.removeEventListener('abort', cancel);
      }
    });
    queue = run.catch(() => undefined);
    return run;
  },
  async healthCheck() {
    if (!webGpuAvailable()) return { ok: false, message: 'This browser has no WebGPU.' };
    if (!(await getStoredModel())) return { ok: false, message: 'No model file yet.' };
    return { ok: true };
  },
};
