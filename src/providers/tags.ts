import { z } from 'zod';
import { defaultFetch, trimSlash, type FetchLike } from './http';

export interface InstalledModel {
  name: string;
  sizeBytes?: number;
  parameterSize?: string;
  family?: string;
}

const TagsSchema = z.object({
  models: z.array(
    z.object({
      name: z.string().optional(),
      model: z.string().optional(),
      size: z.number().optional(),
      details: z
        .object({
          parameter_size: z.string().optional(),
          family: z.string().optional(),
        })
        .partial()
        .nullable()
        .optional(),
    }),
  ),
});

/** Parses Ollama's GET /api/tags response. Returns null if it isn't one. */
export function parseTags(json: unknown): InstalledModel[] | null {
  const parsed = TagsSchema.safeParse(json);
  if (!parsed.success) return null;
  const out: InstalledModel[] = [];
  for (const m of parsed.data.models) {
    const name = (m.name ?? m.model ?? '').trim();
    if (!name || out.some((o) => o.name === name)) continue;
    out.push({
      name,
      sizeBytes: m.size,
      parameterSize: m.details?.parameter_size,
      family: m.details?.family,
    });
  }
  return out;
}

export function isGemma(name: string): boolean {
  return name.toLowerCase().startsWith('gemma');
}

/** The preferred tag if installed, else the first Gemma, else the first model, else ''. */
export function pickDefaultModel(models: InstalledModel[], preferred = ''): string {
  if (preferred && models.some((m) => m.name === preferred)) return preferred;
  return models.find((m) => isGemma(m.name))?.name ?? models[0]?.name ?? '';
}

export function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

export type TagsResult =
  | { ok: true; models: InstalledModel[] }
  | { ok: false; reason: 'unreachable' | 'bad-response'; message: string };

export const OLLAMA_PROXY_BASE = '/ollama';
export const OLLAMA_DIRECT_BASES = ['http://127.0.0.1:11434', 'http://localhost:11434'] as const;

/** Proxy first (dev/preview), then the daemon on this machine (hosted page or a down proxy). */
export function ollamaCandidates(): string[] {
  return [OLLAMA_PROXY_BASE, ...OLLAMA_DIRECT_BASES];
}

let resolvedBase: string | null = null;

/** Last base that answered like Ollama, or the proxy path if none has yet. */
export function resolvedOllamaBase(): string {
  return resolvedBase ?? OLLAMA_PROXY_BASE;
}

export function rememberOllamaBase(base: string | null): void {
  resolvedBase = base === null ? null : trimSlash(base) || OLLAMA_PROXY_BASE;
}

/** Tries the proxy, then localhost. Same result shape as listOllamaModels. */
export async function discoverOllamaModels(fetchImpl: FetchLike = defaultFetch, signal?: AbortSignal): Promise<TagsResult> {
  let blocked = false;
  let last: TagsResult | null = null;
  for (const base of ollamaCandidates()) {
    const result = await listOllamaModels(base, fetchImpl, signal);
    if (result.ok) {
      rememberOllamaBase(base);
      return result;
    }
    last = result;
    if (/\b403\b|forbidden/i.test(result.message)) blocked = true;
  }
  if (blocked) {
    return {
      ok: false,
      reason: 'unreachable',
      message:
        'Ollama is on this computer, but it is blocking this page. Open http://localhost:5173 (`npm run dev`), or set OLLAMA_ORIGINS=* and restart Ollama.',
    };
  }
  return last ?? { ok: false, reason: 'unreachable', message: "Can't reach Ollama." };
}

export async function listOllamaModels(baseUrl = OLLAMA_PROXY_BASE, fetchImpl: FetchLike = defaultFetch, signal?: AbortSignal): Promise<TagsResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${trimSlash(baseUrl)}/api/tags`, { signal });
  } catch (err) {
    return { ok: false, reason: 'unreachable', message: err instanceof Error ? err.message : 'Network error' };
  }
  if (!res.ok) {
    // The dev proxy answers 502/504 when nothing listens on port 11434.
    return { ok: false, reason: 'unreachable', message: `HTTP ${res.status}` };
  }
  try {
    const models = parseTags(await res.json());
    if (!models) return { ok: false, reason: 'bad-response', message: "That server didn't answer like Ollama." };
    return { ok: true, models };
  } catch {
    return { ok: false, reason: 'bad-response', message: "That server didn't answer like Ollama." };
  }
}
