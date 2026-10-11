import { useEffect, useId, useRef, useState } from 'react';
import type { Prefs } from '../lib/prefs';
import { MusicIcon } from './QuickToggles';
import { TrackPicker } from './TrackPicker';
import { VolumeControl } from './VolumeControl';

interface MusicMenuProps {
  prefs: Prefs;
  onChange: (next: Prefs) => void;
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
      {label}
      <input type="checkbox" role="switch" className="h-6 w-6 accent-sprout-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Header button that opens quick sound controls: music, track and volume. */
export function MusicMenu({ prefs, onChange }: MusicMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Sound settings. Music is ${prefs.musicOn ? 'on' : 'off'}.`}
        title="Sound"
        className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-mist-200 dark:hover:bg-mist-800 ${
          prefs.musicOn ? 'text-sprout-700 dark:text-sprout-300' : 'text-mist-700 dark:text-mist-300'
        }`}
      >
        <MusicIcon on={prefs.musicOn} />
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Sound"
          className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-40 max-h-[calc(100dvh-env(safe-area-inset-top)-5rem)] space-y-3 overflow-y-auto rounded-2xl border border-mist-200 bg-mist-50 p-4 text-mist-800 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 dark:border-mist-700 dark:bg-mist-900 dark:text-mist-100"
        >
          <Switch label="Music" checked={prefs.musicOn} onChange={(musicOn) => onChange({ ...prefs, musicOn })} />
          <TrackPicker track={prefs.track} musicOn={prefs.musicOn} onPick={(track) => onChange({ ...prefs, track, musicOn: true })} />
          <div>
            <p className="mb-1 text-sm font-medium">Volume</p>
            <VolumeControl volume={prefs.volume} onChange={(volume) => onChange({ ...prefs, volume })} />
          </div>
        </div>
      )}
    </div>
  );
}
