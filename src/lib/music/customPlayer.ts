import { getAudio, unlockAudio } from './audio';
import { getSongBlob, listSongs, shuffled } from './songStore';

/** Plays the user's own songs, shuffled and on repeat, through the shared master volume. */
class CustomPlayer {
  private el: HTMLAudioElement | null = null;
  private queue: string[] = [];
  private index = 0;
  private url: string | null = null;
  private active = false;
  private failures = 0;
  /** Bumped on every start or stop so stale async loads can tell they've been superseded. */
  private generation = 0;

  private ensureElement(): HTMLAudioElement | null {
    if (this.el) return this.el;
    const audio = getAudio();
    if (!audio || typeof Audio === 'undefined') return null;
    const el = new Audio();
    el.preload = 'auto';
    audio.ctx.createMediaElementSource(el).connect(audio.dry);
    el.addEventListener('ended', () => void this.advance());
    el.addEventListener('error', () => {
      if (!this.active || !el.getAttribute('src')) return;
      this.failures += 1;
      if (this.failures < this.queue.length) void this.advance();
    });
    el.addEventListener('playing', () => {
      this.failures = 0;
    });
    this.el = el;
    return el;
  }

  async play(): Promise<void> {
    const generation = ++this.generation;
    this.active = true;
    this.failures = 0;
    unlockAudio();
    const songs = await listSongs().catch(() => []);
    if (generation !== this.generation) return;
    this.queue = shuffled(songs.map((s) => s.id));
    this.index = 0;
    await this.load(generation);
  }

  /** Re-reads the song list after songs are added or removed, if this player is the one playing. */
  async refresh(): Promise<void> {
    if (this.active) await this.play();
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
  }

  private async advance(): Promise<void> {
    if (!this.active || this.queue.length === 0) return;
    this.index += 1;
    if (this.index >= this.queue.length) {
      this.queue = shuffled(this.queue);
      this.index = 0;
    }
    await this.load(this.generation);
  }

  private async load(generation: number): Promise<void> {
    const el = this.ensureElement();
    const id = this.queue[this.index];
    if (!el || id === undefined) {
      this.el?.pause();
      this.clearSource();
      return;
    }
    const blob = await getSongBlob(id).catch(() => undefined);
    if (generation !== this.generation) return;
    if (!blob) {
      this.failures += 1;
      if (this.failures < this.queue.length) await this.advance();
      return;
    }
    this.clearSource();
    this.url = URL.createObjectURL(blob);
    el.src = this.url;
    el.loop = this.queue.length === 1;
    await el.play().catch(() => undefined);
  }

  private clearSource(): void {
    if (this.el) this.el.removeAttribute('src');
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}

export const customMusic = new CustomPlayer();
