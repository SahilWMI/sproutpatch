import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { customMusic } from '../lib/music/customPlayer';
import { trackTitle } from '../lib/music/soundtrack';
import { ACCEPTED_AUDIO, addSongs, listSongs, removeSong, type SongMeta } from '../lib/music/songStore';
import { TRACK_IDS, type TrackId } from '../lib/prefs';

interface TrackPickerProps {
  track: TrackId;
  musicOn: boolean;
  onPick: (track: TrackId) => void;
}

/** One track per row; "My music" opens the user's own song list underneath. */
export function TrackPicker({ track, musicOn, onPick }: TrackPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2" role="group" aria-label="Track">
        {TRACK_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={track === id}
            onClick={() => onPick(id)}
            className={`btn w-full text-sm ${track === id && musicOn ? 'btn-primary' : 'btn-secondary'}`}
          >
            {trackTitle(id)}
          </button>
        ))}
      </div>
      {track === 'custom' && <MySongs />}
    </div>
  );
}

function MySongs() {
  const [songs, setSongs] = useState<SongMeta[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    let live = true;
    listSongs()
      .then((list) => live && setSongs(list))
      .catch(() => live && setSongs([]));
    return () => {
      live = false;
    };
  }, []);

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const { added, skipped } = await addSongs(files);
      setSongs(await listSongs());
      if (skipped.length > 0) setMessage(`Skipped ${skipped.length} file${skipped.length === 1 ? '' : 's'} that weren't audio or were too big.`);
      else setMessage(`Added ${added} song${added === 1 ? '' : 's'}.`);
      await customMusic.refresh();
    } catch {
      setMessage("Couldn't save those files. The browser may be out of storage space.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await removeSong(id).catch(() => undefined);
    setSongs(await listSongs().catch(() => []));
    await customMusic.refresh();
  }

  return (
    <div className="space-y-2 rounded-xl border border-mist-300 p-3 dark:border-mist-700">
      {songs === null ? (
        <p className="muted text-sm">Loading…</p>
      ) : songs.length === 0 ? (
        <p className="muted text-sm">No songs yet. Add MP3, OGG, M4A, WAV or FLAC files from this device.</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto" aria-label="My songs">
          {songs.map((song) => (
            <li key={song.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate" title={song.name}>
                {song.name}
              </span>
              <button
                type="button"
                onClick={() => void remove(song.id)}
                aria-label={`Remove ${song.name}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-mist-700 hover:bg-mist-200 dark:text-mist-300 dark:hover:bg-mist-800"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={inputRef} type="file" accept={ACCEPTED_AUDIO} multiple hidden tabIndex={-1} onChange={(e) => void handleFiles(e)} />
      <button type="button" className="btn btn-secondary w-full text-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Adding…' : 'Add songs'}
      </button>
      {message && (
        <p className="muted text-xs" role="status">
          {message}
        </p>
      )}
      <p className="muted text-xs">Saved only on this device. Plays shuffled, on repeat.</p>
    </div>
  );
}
