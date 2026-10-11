import { z } from 'zod';
import type { Provider } from '../lib/types';
import { defaultFetch, readError, trimSlash, type FetchLike } from './http';

/**
 * Any server that speaks the OpenAI chat-completions API: LM Studio, llama.cpp `llama-server`,
 * vLLM, Ollama's own /v1 endpoint, and so on.
 */
export interface OpenAICompatibleOptions {
  /** e.g. http://localhost:1234/v1 (LM Studio) or http://localhost:8080/v1 (llama.cpp). */
  baseUrl: string;
  model: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
}

const CompletionSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

export function createOpenAICompatibleProvider({ baseUrl, model, apiKey = '', fetchImpl = defaultFetch }: OpenAICompatibleOptions): Provider {
  const base = trimSlash(baseUrl);
  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey.trim()) h.Authorization = `Bearer ${apiKey.trim()}`;
    return h;
  };

  return {
    id: 'openai-compatible',
    label: model ? `OpenAI-compatible · ${model}` : 'OpenAI-compatible server',
    async checkIn(_note, ctx) {
      if (!base) throw new Error('No base URL configured.');
      const res = await fetchImpl(`${base}/chat/completions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          model: model || 'local-model',
          messages: ctx.messages,
          stream: false,
          temperature: 0.6,
          max_tokens: 220,
        }),
        signal: ctx.signal,
      });
      if (!res.ok) throw new Error(await readError(res));
      const parsed = CompletionSchema.safeParse(await res.json());
      return { raw: parsed.success ? parsed.data.choices[0]?.message.content ?? null : null };
    },
    async healthCheck() {
      if (!base) return { ok: false, message: 'Enter a base URL.' };
      try {
        const res = await fetchImpl(`${base}/models`, { headers: headers() });
        if (!res.ok) return { ok: false, message: await readError(res) };
        return { ok: true };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
      }
    },
  };
}
