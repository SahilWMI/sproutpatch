import { getAudio, unlockAudio } from './audio';
import { createCricketField, type CricketField, type Pulse } from './crickets';
import { LOOKAHEAD_S, TICK_MS } from './player';

const LEVEL = 0.06;

interface Session {
  field: CricketField;
  out: GainNode;
  bed: AudioBufferSourceNode;
  /** Field time 0 in AudioContext seconds. */
  origin: number;
  scheduledUntil: number;
}

/** Summer-night crickets, synthesised. Independent of the music. */
class NightSounds {
  private session: Session | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  get playing(): boolean {
    return this.session !== null;
  }

  start(): void {
    if (this.session) return;
    const audio = getAudio();
    if (!audio) return;
    unlockAudio();
    const { ctx } = audio;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);
    out.connect(audio.dry);
    const send = ctx.createGain();
    send.gain.value = 0.25;
    out.connect(send).connect(audio.wet);

    this.session = {
      field: createCricketField(Date.now()),
      out,
      bed: this.startBed(ctx, out),
      origin: ctx.currentTime + 0.3,
      scheduledUntil: 0,
    };
    this.schedule();
    this.timer ??= setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    const session = this.session;
    this.session = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const audio = getAudio();
    if (!session || !audio) return;
    const now = audio.ctx.currentTime;
    session.out.gain.cancelScheduledValues(now);
    session.out.gain.setTargetAtTime(0, now, 0.5);
    setTimeout(() => {
      session.bed.stop();
      session.out.disconnect();
    }, (LOOKAHEAD_S + 3) * 1000);
  }

  /** A far-off chorus: band-passed noise with a slow shimmer, very quiet. */
  private startBed(ctx: AudioContext, out: GainNode): AudioBufferSourceNode {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 4600;
    band.Q.value = 12;
    const level = ctx.createGain();
    level.gain.value = LEVEL * 0.12;
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 0.3;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = LEVEL * 0.05;
    wobble.connect(wobbleDepth).connect(level.gain);
    noise.connect(band).connect(level).connect(out);
    noise.start();
    wobble.start();
    noise.addEventListener('ended', () => wobble.stop());
    return noise;
  }

  private schedule(): void {
    const audio = getAudio();
    const session = this.session;
    if (!audio || !session) return;
    const { ctx } = audio;
    if (ctx.state !== 'running') {
      // Re-anchor while suspended so the first chirps land right after the unlock tap.
      session.origin = ctx.currentTime + 0.3 - session.scheduledUntil;
      return;
    }
    const until = ctx.currentTime + LOOKAHEAD_S - session.origin;
    if (until <= session.scheduledUntil) return;
    for (const pulse of session.field.pulsesBetween(session.scheduledUntil, until)) {
      this.playPulse(ctx, session, pulse);
    }
    session.scheduledUntil = until;
  }

  private playPulse(ctx: AudioContext, session: Session, pulse: Pulse): void {
    const at = session.origin + pulse.at;
    if (at < ctx.currentTime) return;
    const env = ctx.createGain();
    const peak = LEVEL * pulse.level;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.004);
    env.gain.setValueAtTime(peak, at + pulse.length - 0.008);
    env.gain.linearRampToValueAtTime(0, at + pulse.length);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pulse.pan;
    env.connect(panner).connect(session.out);

    const tone = ctx.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(pulse.hz * 1.02, at);
    tone.frequency.linearRampToValueAtTime(pulse.hz, at + pulse.length);
    tone.connect(env);
    const buzz = ctx.createOscillator();
    buzz.type = 'sine';
    buzz.frequency.value = pulse.hz * 2;
    const buzzLevel = ctx.createGain();
    buzzLevel.gain.value = 0.15;
    buzz.connect(buzzLevel).connect(env);
    for (const osc of [tone, buzz]) {
      osc.start(at);
      osc.stop(at + pulse.length + 0.01);
    }
  }
}

export const nightSounds = new NightSounds();
