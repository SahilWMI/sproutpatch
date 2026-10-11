import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { deleteAllData, exportAllData, getSetting, listEntries, saveEntry, setSetting } from './db';
import type { Entry } from './entries';

const entry = (id: string, createdAt: string, extra: Partial<Entry> = {}): Entry =>
  ({ id, createdAt, kind: 'risk', risk: true, moodBefore: -2, ...extra }) as Entry;

describe('db', () => {
  it('saves, lists newest first, skips samples, exports and deletes', async () => {
    await saveEntry(entry('a', '2026-10-10T10:00:00Z'));
    await saveEntry(entry('b', '2026-10-11T10:00:00Z'));
    await saveEntry(entry('s', '2026-10-12T10:00:00Z', { sample: true }));
    await setSetting('provider', { id: 'openai-compatible', apiKey: 'secret' });

    expect((await listEntries()).map((e) => e.id)).toEqual(['b', 'a']);
    expect(await getSetting('provider')).toEqual({ id: 'openai-compatible', apiKey: 'secret' });

    const exported = await exportAllData();
    expect(exported.entries).toHaveLength(2);
    expect(JSON.stringify(exported)).not.toContain('secret');

    await deleteAllData();
    expect(await listEntries()).toEqual([]);
    expect(await getSetting('provider')).toBeUndefined();
  });
});
