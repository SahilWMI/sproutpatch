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

export async function listOllamaModels(baseUrl = '/ollama', fetchImpl: FetchLike = defaultFetch, signal?: AbortSignal): Promise<TagsResult> {
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
