import { stepVolume } from '../lib/prefs';

interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
}

const stepButton =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-mist-400 text-lg font-medium text-mist-700 transition-colors hover:bg-mist-200 disabled:opacity-40 dark:border-mist-700 dark:text-mist-200 dark:hover:bg-mist-800';

export function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const percent = Math.round(volume * 100);
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={stepButton} onClick={() => onChange(stepVolume(volume, -1))} disabled={volume <= 0} aria-label="Volume down">
        −
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        className="h-11 min-w-0 flex-1 accent-sprout-600"
        value={volume}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Volume"
        aria-valuetext={`${percent}%`}
      />
      <button type="button" className={stepButton} onClick={() => onChange(stepVolume(volume, 1))} disabled={volume >= 1} aria-label="Volume up">
        +
      </button>
      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-mist-700 dark:text-mist-300" aria-hidden="true">
        {percent}%
      </span>
    </div>
  );
}
