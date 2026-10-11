import { THEME_MODES, type Prefs, type ThemeMode } from '../lib/prefs';
import { TrackPicker } from './TrackPicker';
import { VolumeControl } from './VolumeControl';

const THEME_OPTIONS: Record<ThemeMode, string> = {
  auto: 'Auto (time of day)',
  light: 'Light',
  dark: 'Dark',
};

interface PreferencesPanelProps {
  prefs: Prefs;
  onChange: (next: Prefs) => void;
}

export function PreferencesPanel({ prefs, onChange }: PreferencesPanelProps) {
  return (
    <section className="card mt-6 space-y-5" aria-labelledby="prefs-title">
      <h2 id="prefs-title" className="text-lg font-semibold">
        Look and sound
      </h2>

      <fieldset>
        <legend className="label">Theme</legend>
        <div className="grid grid-cols-3 gap-2">
          {THEME_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={prefs.theme === mode}
              onClick={() => onChange({ ...prefs, theme: mode })}
              className={`btn px-2 text-xs sm:text-sm ${prefs.theme === mode ? 'btn-primary' : 'btn-secondary'}`}
            >
              {THEME_OPTIONS[mode]}
            </button>
          ))}
        </div>
        <p className="muted mt-2 text-xs">Auto uses light baby blue from 6:30 to 18:30 and dark blue the rest of the time.</p>
      </fieldset>

      <div className="space-y-3">
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="label mb-0">Background music</span>
          <input
            type="checkbox"
            role="switch"
            className="h-6 w-6 accent-sprout-600"
            checked={prefs.musicOn}
            onChange={(e) => onChange({ ...prefs, musicOn: e.target.checked })}
          />
        </label>
        <div>
          <span className="label">Track</span>
          <TrackPicker track={prefs.track} musicOn={prefs.musicOn} onPick={(track) => onChange({ ...prefs, track })} />
        </div>
        <div>
          <span className="label">Volume</span>
          <VolumeControl volume={prefs.volume} onChange={(volume) => onChange({ ...prefs, volume })} />
        </div>
        <p className="muted text-xs">
          Meadow and Night Grass are gentle piano generated in your browser, in the spirit of Minecraft's calm music. My music plays your own
          files, saved only on this device.
        </p>
      </div>
    </section>
  );
}
