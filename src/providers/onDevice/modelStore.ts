/**
 * Keeps the user's model file in the browser's private file system (OPFS), so it survives
 * reloads and works offline. Nothing is uploaded; the file never leaves the device.
 */
const MODEL_FILE = 'gemma-model.task';
const META_FILE = 'gemma-model.json';

export interface StoredModel {
  name: string;
  size: number;
}

export function modelStorageSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

async function root(): Promise<FileSystemDirectoryHandle> {
  return navigator.storage.getDirectory();
}

export async function getStoredModel(): Promise<StoredModel | null> {
  if (!modelStorageSupported()) return null;
  try {
    const dir = await root();
    const meta = await (await dir.getFileHandle(META_FILE)).getFile();
    const parsed: unknown = JSON.parse(await meta.text());
    const file = await (await dir.getFileHandle(MODEL_FILE)).getFile();
    const name = typeof parsed === 'object' && parsed !== null && 'name' in parsed && typeof parsed.name === 'string' ? parsed.name : MODEL_FILE;
    return file.size > 0 ? { name, size: file.size } : null;
  } catch {
    return null;
  }
}

/** Copies the picked file in chunks, reporting progress from 0 to 1. */
export async function saveModelFile(file: File, onProgress?: (fraction: number) => void): Promise<StoredModel> {
  const dir = await root();
  await navigator.storage.persist?.().catch(() => false);
  const writable = await (await dir.getFileHandle(MODEL_FILE, { create: true })).createWritable();
  try {
    const reader = file.stream().getReader();
    let written = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      written += value.byteLength;
      onProgress?.(file.size ? written / file.size : 1);
    }
    await writable.close();
  } catch (err) {
    await writable.abort().catch(() => undefined);
    throw err;
  }
  const meta = await (await dir.getFileHandle(META_FILE, { create: true })).createWritable();
  await meta.write(JSON.stringify({ name: file.name }));
  await meta.close();
  return { name: file.name, size: file.size };
}

export async function openModelStream(): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const dir = await root();
  const file = await (await dir.getFileHandle(MODEL_FILE)).getFile();
  return file.stream().getReader();
}

export async function deleteStoredModel(): Promise<void> {
  if (!modelStorageSupported()) return;
  const dir = await root();
  for (const name of [MODEL_FILE, META_FILE]) await dir.removeEntry(name).catch(() => undefined);
}
