import { getAudio, unlockAudio } from './audio';
import { getSongBlob, listSongs } from './songStore';

/** Wraps around either end of the list so "previous" from the first song is the last one. */
export function wrapIndex(index: number, step: number, length: number): number {
  if (length <= 0) return 0;
  return (((index + step) % length) + length) % length;
}

type Listener = () => void;

/** Plays the user's own songs in list order, through the shared master volume. Tap a song to jump to it. */
class CustomPlayer {
  private el: HTMLAudioElement | null = null;
  private queue: string[] = [];
  private index = 0;
  private url: string | null = null;
  private active = false;
  private failures = 0;
  /** Bumped on every start or stop so stale async loads can tell they've been superseded. */
  private generation = 0;
  private listeners = new Set<Listener>();

  get currentId(): string | null {
    if (!this.active) return null;
    return this.queue[this.index] ?? null;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private ensureElement(): HTMLAudioElement | null {
    if (this.el) return this.el;
    const audio = getAudio();
    if (!audio || typeof Audio === 'undefined') return null;
    const el = new Audio();
    el.preload = 'auto';
    audio.ctx.createMediaElementSource(el).connect(audio.dry);
    el.addEventListener('ended', () => void this.advance(1));
    el.addEventListener('error', () => {
      if (!this.active || !el.getAttribute('src')) return;
      this.failures += 1;
      if (this.failures < this.queue.length) void this.advance(1);
    });
    el.addEventListener('playing', () => {
      this.failures = 0;
    });
    this.el = el;
    return el;
  }

  async play(startId?: string): Promise<void> {
    if (this.active && !startId && this.queue.length > 0) {
      unlockAudio();
      this.resume();
      return;
    }
    const generation = ++this.generation;
    this.active = true;
    this.failures = 0;
    unlockAudio();
    const songs = await listSongs().catch(() => []);
    if (generation !== this.generation) return;
    this.queue = songs.map((s) => s.id);
    const fromName = startId ? this.queue.indexOf(startId) : 0;
    this.index = fromName === -1 ? 0 : fromName;
    await this.load(generation);
  }

  /** Jump to a specific song. Works for earlier songs, not only the next one. */
  async playSong(id: string): Promise<void> {
    const generation = ++this.generation;
    unlockAudio();
    this.active = true;
    this.failures = 0;
    if (!this.queue.includes(id)) {
      const songs = await listSongs().catch(() => []);
      if (generation !== this.generation) return;
      this.queue = songs.map((s) => s.id);
    }
    const next = this.queue.indexOf(id);
    if (next === -1) {
      this.notify();
      return;
    }
    this.index = next;
    this.notify();
    await this.load(generation);
  }

  /** Re-reads the song list after add/remove without forcing a jump to the next file. */
  async refresh(): Promise<void> {
    const keep = this.currentId;
    const songs = await listSongs().catch(() => []);
    this.queue = songs.map((s) => s.id);
    if (!this.active) {
      this.notify();
      return;
    }
    if (keep && this.queue.includes(keep)) {
      this.index = this.queue.indexOf(keep);
      this.notify();
      return;
    }
    this.index = 0;
    await this.load(this.generation);
  }

  /** Retries playback after the browser blocked it until a tap. */
  resume(): void {
    const el = this.el;
    if (this.active && el?.paused && el.getAttribute('src')) void el.play().catch(() => undefined);
  }

  stop(): void {
    this.generation += 1;
    this.active = false;
    this.el?.pause();
    this.clearSource();
    this.notify();
  }

  private async advance(step: 1 | -1): Promise<void> {
    if (!this.active || this.queue.length === 0) return;
    this.index = wrapIndex(this.index, step, this.queue.length);
    await this.load(this.generation);
  }

  private async load(generation: number): Promise<void> {
    const el = this.ensureElement();
    const id = this.queue[this.index];
    if (!el || id === undefined) {
      this.el?.pause();
      this.clearSource();
      this.notify();
      return;
    }
    const blob = await getSongBlob(id).catch(() => undefined);
    if (generation !== this.generation) return;
    if (!blob) {
      this.failures += 1;
      if (this.failures < this.queue.length) await this.advance(1);
      else this.notify();
      return;
    }
    this.clearSource();
    this.url = URL.createObjectURL(blob);
    el.src = this.url;
    el.loop = this.queue.length === 1;
    await el.play().catch(() => undefined);
    this.notify();
  }

  private clearSource(): void {
    if (this.el) this.el.removeAttribute('src');
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}

export const customMusic = new CustomPlayer();
