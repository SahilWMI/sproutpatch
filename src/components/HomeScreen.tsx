import { useState, type FormEvent, type KeyboardEvent } from 'react';

interface HomeScreenProps {
  busy?: boolean;
  onSubmit: (note: string) => void;
}

export const MAX_NOTE_LENGTH = 2000;

export function HomeScreen({ busy = false, onSubmit }: HomeScreenProps) {
  const [note, setNote] = useState('');
  const trimmed = note.trim();

  function handleSubmit(event: FormEvent | KeyboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label htmlFor="note" className="block text-2xl font-semibold text-stone-800 dark:text-stone-100">
        How's today going?
      </label>
      <p className="muted">A few lines is plenty. Then we get you outside.</p>
      <textarea
        id="note"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e);
        }}
        rows={5}
        placeholder="Long meeting, skipped lunch, feeling a bit flat…"
        className="input min-h-32 resize-y text-base"
        disabled={busy}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sprout-100 px-3 py-1 text-xs font-medium text-sprout-800 dark:bg-sprout-900 dark:text-sprout-200">
          <span aria-hidden="true">🔒</span> Runs locally. Your entries never leave this device.
        </span>
        <button type="submit" className="btn-primary" disabled={!trimmed || busy}>
          {busy ? 'Thinking…' : 'Send'}
        </button>
      </div>
      <p className="text-xs text-stone-400 dark:text-stone-500">Tip: Ctrl + Enter sends.</p>
    </form>
  );
}
