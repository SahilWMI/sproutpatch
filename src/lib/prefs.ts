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
});

export type Prefs = z.infer<typeof PrefsSchema>;

export const DEFAULT_PREFS: Prefs = { theme: 'auto', musicOn: false, track: 'meadow', volume: 0.5 };
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

/** Auto: light baby blue from 6:30 to 18:30 local time, dark navy otherwise. */
export function resolveTheme(mode: ThemeMode, now: Date): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 6 * 60 + 30 && minutes < 18 * 60 + 30 ? 'light' : 'dark';
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
