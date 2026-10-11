import { z } from 'zod';
import type { Provider } from '../lib/types';
import { defaultFetch, readError, trimSlash, type FetchLike } from './http';
import { listOllamaModels, OLLAMA_PROXY_BASE, resolvedOllamaBase } from './tags';

export { OLLAMA_PROXY_BASE };

export interface OllamaOptions {
  model: string;
  /** Defaults to the Vite proxy path, which forwards to http://localhost:11434. */
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

const ChatResponseSchema = z.object({
  message: z.object({ content: z.string() }),
});

export function createOllamaProvider({ model, baseUrl, fetchImpl = defaultFetch }: OllamaOptions): Provider {
  const resolveBase = () => trimSlash(baseUrl ?? resolvedOllamaBase()) || OLLAMA_PROXY_BASE;
  return {
    id: 'ollama',
    label: model ? `Ollama · ${model}` : 'Ollama',
    async checkIn(_note, ctx) {
      if (!model) throw new Error('No Ollama model selected.');
      const res = await fetchImpl(`${resolveBase()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: ctx.messages,
          stream: false,
          format: 'json',
          options: { temperature: 0.6, num_predict: 220 },
        }),
        signal: ctx.signal,
      });
      if (!res.ok) throw new Error(await readError(res));
      const parsed = ChatResponseSchema.safeParse(await res.json());
      // Hand malformed bodies to the validator as-is; it decides (and triggers the retry).
      return { raw: parsed.success ? parsed.data.message.content : null };
    },
    async healthCheck() {
      const tags = await listOllamaModels(resolveBase(), fetchImpl);
      if (!tags.ok) return { ok: false, message: "Can't reach Ollama. Is `ollama serve` running?" };
      if (!model) return { ok: false, message: 'Pick a model first.' };
      if (!tags.models.some((m) => m.name === model || m.name === `${model}:latest`)) {
        return { ok: false, message: `"${model}" isn't installed. Try \`ollama pull ${model}\`.` };
      }
      return { ok: true };
    },
  };
}
