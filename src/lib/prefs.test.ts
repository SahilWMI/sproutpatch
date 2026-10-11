import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, isNightTime, nextThemeMode, normalizePrefs, resolveTheme } from './prefs';

const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m);

describe('theme', () => {
  it('auto follows the local time of day', () => {
    expect(resolveTheme('auto', at(6, 29))).toBe('dark');
    expect(resolveTheme('auto', at(6, 30))).toBe('light');
    expect(resolveTheme('auto', at(13))).toBe('light');
    expect(resolveTheme('auto', at(18, 29))).toBe('light');
    expect(resolveTheme('auto', at(18, 30))).toBe('dark');
    expect(resolveTheme('auto', at(2))).toBe('dark');
  });

  it('night runs from 18:30 to 6:30', () => {
    expect(isNightTime(at(18, 29))).toBe(false);
    expect(isNightTime(at(18, 30))).toBe(true);
    expect(isNightTime(at(0, 0))).toBe(true);
    expect(isNightTime(at(6, 29))).toBe(true);
    expect(isNightTime(at(6, 30))).toBe(false);
  });

  it('manual modes ignore the clock', () => {
    expect(resolveTheme('light', at(2))).toBe('light');
    expect(resolveTheme('dark', at(13))).toBe('dark');
  });

  it('cycles auto -> light -> dark -> auto', () => {
    expect(nextThemeMode('auto')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('auto');
  });
});

describe('normalizePrefs', () => {
  it('fills defaults and rejects junk', () => {
    expect(normalizePrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ theme: 'dark' })).toEqual({ ...DEFAULT_PREFS, theme: 'dark' });
    expect(normalizePrefs({ theme: 'purple' })).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ volume: 7 })).toEqual(DEFAULT_PREFS);
    // Prefs saved before night sounds existed get them switched on.
    expect(normalizePrefs({ theme: 'auto', musicOn: true, track: 'meadow', volume: 0.5 }).nightSounds).toBe(true);
  });
});
