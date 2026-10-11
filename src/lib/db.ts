import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Entry } from './entries';

interface SproutpatchDB extends DBSchema {
  entries: {
    key: string;
    value: Entry;
    indexes: { byCreatedAt: string };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DB_NAME = 'sproutpatch';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SproutpatchDB>> | null = null;

function db(): Promise<IDBPDatabase<SproutpatchDB>> {
  dbPromise ??= openDB<SproutpatchDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const entries = database.createObjectStore('entries', { keyPath: 'id' });
      entries.createIndex('byCreatedAt', 'createdAt');
      database.createObjectStore('settings', { keyPath: 'key' });
    },
  });
  return dbPromise;
}

export async function saveEntry(entry: Entry): Promise<void> {
  if (entry.sample) return;
  await (await db()).put('entries', entry);
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  return (await db()).get('entries', id);
}

/** Newest first. */
export async function listEntries(): Promise<Entry[]> {
  const all = await (await db()).getAllFromIndex('entries', 'byCreatedAt');
  return all.reverse();
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await (await db()).get('settings', key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', { key, value });
}

export async function deleteAllData(): Promise<void> {
  const database = await db();
  const tx = database.transaction(['entries', 'settings'], 'readwrite');
  await Promise.all([tx.objectStore('entries').clear(), tx.objectStore('settings').clear(), tx.done]);
}

export async function exportAllData(): Promise<{ exportedAt: string; entries: Entry[]; settings: Record<string, unknown> }> {
  const database = await db();
  const [entries, settingsRows] = await Promise.all([listEntries(), database.getAll('settings')]);
  const settings: Record<string, unknown> = {};
  for (const row of settingsRows) settings[row.key] = redactKey(row.value);
  return { exportedAt: new Date().toISOString(), entries, settings };
}

function redactKey(value: unknown): unknown {
  if (value && typeof value === 'object' && 'apiKey' in value) return { ...value, apiKey: value.apiKey ? '[redacted]' : '' };
  return value;
}
