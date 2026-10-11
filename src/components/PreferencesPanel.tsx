import { TRACKS } from '../lib/music/composition';
import { THEME_MODES, TRACK_IDS, type Prefs, type ThemeMode } from '../lib/prefs';

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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Track</span>
            <select
              className="input"
              value={prefs.track}
              onChange={(e) => {
                const track = TRACK_IDS.find((id) => id === e.target.value);
                if (track) onChange({ ...prefs, track });
              }}
            >
              {TRACK_IDS.map((id) => (
                <option key={id} value={id}>
                  {TRACKS[id].title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="h-11 w-full accent-sprout-600"
              value={prefs.volume}
              onChange={(e) => onChange({ ...prefs, volume: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="muted text-xs">Gentle piano generated in your browser, in the spirit of Minecraft's calm music. No audio files, nothing downloaded.</p>
      </div>
    </section>
  );
}
