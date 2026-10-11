import { z } from 'zod';
import { getSetting, setSetting } from './db';

export const THEME_MODES = ['auto', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const TRACK_IDS = ['meadow', 'night-grass'] as const;
export type TrackId = (typeof TRACK_IDS)[number];

const PrefsSchema = z.object({
  theme: z.enum(THEME_MODES),
  musicOn: z.boolean(),
  track: z.enum(TRACK_IDS),
  volume: z.number().min(0).max(1),
  nightSounds: z.boolean(),
});

export type Prefs = z.infer<typeof PrefsSchema>;

export const DEFAULT_PREFS: Prefs = { theme: 'auto', musicOn: false, track: 'meadow', volume: 0.5, nightSounds: true };
const PREFS_KEY = 'prefs';

export function normalizePrefs(stored: unknown): Prefs {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_PREFS;
  const merged = PrefsSchema.safeParse({ ...DEFAULT_PREFS, ...stored });
  return merged.success ? merged.data : DEFAULT_PREFS;
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    return normalizePrefs(await getSetting<unknown>(PREFS_KEY));
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  try {
    await setSetting(PREFS_KEY, prefs);
  } catch {
    // Preferences still apply for this session.
  }
}

/** Night is 18:30 to 6:30 local time. Drives the auto theme and the cricket sounds. */
export function isNightTime(now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes < 6 * 60 + 30 || minutes >= 18 * 60 + 30;
}

/** Auto: light baby blue by day, dark navy at night. */
export function resolveTheme(mode: ThemeMode, now: Date): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  return isNightTime(now) ? 'dark' : 'light';
}

export const VOLUME_STEP = 0.1;

/** Nudges volume up or down by one step, staying in 0..1 without float drift. */
export function stepVolume(volume: number, direction: 1 | -1): number {
  return Math.max(0, Math.min(1, Math.round((volume + direction * VOLUME_STEP) * 20) / 20));
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length] ?? 'auto';
}

export function applyTheme(theme: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f2140' : '#edf6fe');
}
