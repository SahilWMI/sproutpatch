import type { ThemeMode } from '../lib/prefs';

const THEME_LABEL: Record<ThemeMode, string> = {
  auto: 'Theme: auto (light by day, dark at night)',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

const iconButton =
  'flex h-11 w-11 items-center justify-center rounded-lg text-mist-600 transition-colors hover:bg-mist-100 dark:text-mist-300 dark:hover:bg-mist-800';

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </svg>
    );
  }
  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
    </svg>
  );
}

export function ThemeToggle({ mode, onCycle }: { mode: ThemeMode; onCycle: () => void }) {
  return (
    <button type="button" onClick={onCycle} className={iconButton} aria-label={`${THEME_LABEL[mode]}. Tap to change.`} title={THEME_LABEL[mode]}>
      <ThemeIcon mode={mode} />
    </button>
  );
}

export function MusicIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
      {!on && <path d="M3 3l18 18" />}
    </svg>
  );
}

export function MusicToggle({ on, onToggle, className = iconButton }: { on: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={className}
      aria-pressed={on}
      aria-label={on ? 'Background music on. Tap to turn off.' : 'Background music off. Tap to turn on.'}
      title={on ? 'Music on' : 'Music off'}
    >
      <MusicIcon on={on} />
    </button>
  );
}
