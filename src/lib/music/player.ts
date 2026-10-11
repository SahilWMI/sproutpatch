import type { TrackId } from '../prefs';
import { BEATS_PER_BAR, TRACKS, createComposer, midiToHz, type Composer, type NoteEvent } from './composition';

/** Schedule this far ahead so throttled background tabs keep playing smoothly. */
const LOOKAHEAD_S = 4;
const TICK_MS = 500;
const MASTER_LEVEL = 0.5;

interface Session {
  composer: Composer;
  out: GainNode;
  secondsPerBeat: number;
  nextBarAt: number;
}

function makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

/** Calm, generated piano ambience on Web Audio. No audio files are shipped. */
class AmbientPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private session: Session | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private volume = 0.5;

  get playing(): boolean {
    return this.session !== null;
  }

  /** False while the browser is waiting for a tap before allowing sound. */
  get audible(): boolean {
    return this.ctx?.state === 'running';
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof AudioContext === 'undefined') return null;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.volume * MASTER_LEVEL;
    master.connect(ctx.destination);

    const bus = ctx.createGain();
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 3.5);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    const dry = ctx.createGain();
    dry.gain.value = 0.75;
    bus.connect(dry).connect(master);
    bus.connect(reverb).connect(wet).connect(master);

    this.ctx = ctx;
    this.master = master;
    this.bus = bus;
    return ctx;
  }

  /** Call from a user gesture (tap, click, key) so the browser lets audio start. */
  unlock(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  play(trackId: TrackId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.bus) return;
    this.unlock();
    this.fadeOutSession();

    const track = TRACKS[trackId];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
    out.connect(this.bus);
    this.session = {
      composer: createComposer(track, Date.now()),
      out,
      secondsPerBeat: 60 / track.bpm,
      nextBarAt: ctx.currentTime + 0.3,
    };
    this.schedule();
    this.timer ??= setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    this.fadeOutSession();
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.volume * MASTER_LEVEL, this.ctx.currentTime, 0.2);
  }

  private fadeOutSession(): void {
    const session = this.session;
    const ctx = this.ctx;
    this.session = null;
    if (!session || !ctx) return;
    session.out.gain.cancelScheduledValues(ctx.currentTime);
    session.out.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => session.out.disconnect(), (LOOKAHEAD_S + 6) * 1000);
  }

  private schedule(): void {
    const ctx = this.ctx;
    const session = this.session;
    if (!ctx || !session || ctx.state !== 'running') {
      // While suspended, keep the timeline anchored to now so playback starts cleanly on unlock.
      if (ctx && session) session.nextBarAt = Math.max(session.nextBarAt, ctx.currentTime + 0.3);
      return;
    }
    while (session.nextBarAt < ctx.currentTime + LOOKAHEAD_S) {
      for (const note of session.composer.nextBar()) {
        this.playNote(ctx, session, note, session.nextBarAt + note.beat * session.secondsPerBeat);
      }
      session.nextBarAt += BEATS_PER_BAR * session.secondsPerBeat;
    }
  }

  private playNote(ctx: AudioContext, session: Session, note: NoteEvent, at: number): void {
    const hz = midiToHz(note.midi);
    const env = ctx.createGain();
    env.connect(session.out);
    const length = note.beats * session.secondsPerBeat;

    if (note.voice === 'pad') {
      const peak = 0.035 * note.velocity;
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(peak, at + 1.4);
      env.gain.setValueAtTime(peak, at + length);
      env.gain.linearRampToValueAtTime(0, at + length + 2);
      for (const detune of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = hz;
        osc.detune.value = detune;
        osc.connect(env);
        osc.start(at);
        osc.stop(at + length + 2.1);
      }
      return;
    }

    const peak = (note.voice === 'bass' ? 0.12 : 0.1) * note.velocity;
    const decay = note.voice === 'bass' ? 3.5 : 2.4 + note.velocity * 1.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = note.voice === 'bass' ? 700 : 2400;
    filter.connect(env);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = hz;
    body.connect(filter);
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = hz * 2;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.2;
    shimmer.connect(shimmerGain).connect(filter);
    for (const osc of [body, shimmer]) {
      osc.start(at);
      osc.stop(at + decay + 0.05);
    }
  }
}

export const music = new AmbientPlayer();
