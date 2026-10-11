import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * The user's own songs, kept as blobs in a separate IndexedDB database on this device.
 * Nothing is uploaded.
 */

export interface SongMeta {
  id: string;
  name: string;
  size: number;
  addedAt: string;
}

interface SongRecord extends SongMeta {
  blob: Blob;
}

interface MusicDB extends DBSchema {
  songs: { key: string; value: SongRecord };
}

export const MAX_SONG_BYTES = 200 * 1024 * 1024;
const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'wav', 'flac', 'webm', 'weba'];
export const ACCEPTED_AUDIO = ['audio/*', ...AUDIO_EXTENSIONS.map((ext) => `.${ext}`)].join(',');

let dbPromise: Promise<IDBPDatabase<MusicDB>> | null = null;

function db(): Promise<IDBPDatabase<MusicDB>> {
  dbPromise ??= openDB<MusicDB>('sproutpatch-music', 1, {
    upgrade(database) {
      database.createObjectStore('songs', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

export function isAudioFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.includes(extension(file.name));
}

/** "02 - Sunny Day.mp3" -> "02 - Sunny Day". */
export function songTitle(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return base.trim() || fileName;
}

/** Fisher-Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export async function listSongs(): Promise<SongMeta[]> {
  const all = await (await db()).getAll('songs');
  return all
    .map(({ id, name, size, addedAt }) => ({ id, name, size, addedAt }))
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export async function addSongs(files: readonly File[]): Promise<{ added: number; skipped: string[] }> {
  const database = await db();
  await navigator.storage?.persist?.().catch(() => false);
  let added = 0;
  const skipped: string[] = [];
  for (const file of files) {
    if (!isAudioFile(file) || file.size === 0 || file.size > MAX_SONG_BYTES) {
      skipped.push(file.name);
      continue;
    }
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    await database.put('songs', { id, name: songTitle(file.name), size: file.size, addedAt: new Date().toISOString(), blob: file });
    added += 1;
  }
  return { added, skipped };
}

export async function getSongBlob(id: string): Promise<Blob | undefined> {
  return (await (await db()).get('songs', id))?.blob;
}

export async function removeSong(id: string): Promise<void> {
  await (await db()).delete('songs', id);
}

export async function clearSongs(): Promise<void> {
  await (await db()).clear('songs');
}
