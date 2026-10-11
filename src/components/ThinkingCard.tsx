import { useEffect, useState } from 'react';
import { SproutIcon } from './SproutIcon';

export const SLOW_HINT_AFTER_MS = 10_000;

interface ThinkingCardProps {
  label: string;
  onCancel: () => void;
}

export function ThinkingCard({ label, onCancel }: ThinkingCardProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_HINT_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="card flex flex-col items-center gap-4 py-10 text-center" role="status" aria-live="polite">
      <SproutIcon className="h-12 w-12 animate-pulse text-sprout-700 dark:text-sprout-400" />
      <p className="text-mist-700 dark:text-mist-200">{label}</p>
      {slow && <p className="muted">Local models can take up to a minute.</p>}
      <button type="button" className="btn-secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
