export interface AppConfig {
  model: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  defaultLat: number;
  defaultLon: number;
}

export const DEFAULT_TIMEOUT_MS = 90_000;
export const DEFAULT_LAT = 20.2961;
export const DEFAULT_LON = 85.8245;

type EnvLike = Partial<Record<string, string | boolean | undefined>>;

function str(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function num(value: string | boolean | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(str(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function readConfig(env: EnvLike): AppConfig {
  return {
    model: str(env.VITE_MODEL),
    baseUrl: str(env.VITE_BASE_URL),
    apiKey: str(env.VITE_API_KEY),
    timeoutMs: num(env.VITE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 600_000),
    defaultLat: num(env.VITE_DEFAULT_LAT, DEFAULT_LAT, -90, 90),
    defaultLon: num(env.VITE_DEFAULT_LON, DEFAULT_LON, -180, 180),
  };
}

export const config: AppConfig = readConfig(import.meta.env as EnvLike);
