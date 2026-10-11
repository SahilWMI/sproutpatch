import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

interface ComposerProps {
  busy?: boolean;
  onSubmit: (note: string) => void;
}

export const MAX_NOTE_LENGTH = 2000;
const MAX_TEXTAREA_PX = 160;

/** Chat-style input pinned to the bottom of the check-in screen. */
export function Composer({ busy = false, onSubmit }: ComposerProps) {
  const [note, setNote] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const trimmed = note.trim();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [note]);

  function submit(event: FormEvent | KeyboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    // On phones Enter adds a line; the send button is right there. On desktop Enter sends.
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (e.ctrlKey || e.metaKey || (!touch && !e.shiftKey)) submit(e);
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-2xl space-y-2">
      <div className="flex items-end gap-2 rounded-3xl border border-mist-300 bg-white p-1.5 pl-4 shadow-lg shadow-mist-900/5 focus-within:border-sprout-500 dark:border-mist-700 dark:bg-mist-900 dark:shadow-black/30">
        <label htmlFor="note" className="sr-only">
          How's today going?
        </label>
        <textarea
          id="note"
          ref={ref}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="How's today going?"
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-base leading-6 text-mist-800 outline-none placeholder:text-mist-400 dark:text-mist-100"
          disabled={busy}
          enterKeyHint="send"
        />
        <button
          type="submit"
          disabled={!trimmed || busy}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sprout-600 text-white transition-colors hover:bg-sprout-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sprout-500 dark:text-sprout-950 dark:hover:bg-sprout-400"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[11px] text-mist-500 dark:text-mist-400">
        <span>🔒 Runs locally. Your entries never leave this device.</span>
        <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
      </p>
    </form>
  );
}
