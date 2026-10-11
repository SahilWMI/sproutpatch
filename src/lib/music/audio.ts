/** One AudioContext for all app sound, with a master volume and a shared unlock gesture. */
export interface SharedAudio {
  ctx: AudioContext;
  /** Straight to the speakers, through the master volume. */
  dry: GainNode;
  /** Through the room reverb, then the master volume. */
  wet: GainNode;
}

const MASTER_LEVEL = 0.75;
let shared: SharedAudio | null = null;
let master: GainNode | null = null;
let volume = 0.5;

function makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

export function getAudio(): SharedAudio | null {
  if (shared) return shared;
  if (typeof AudioContext === 'undefined') return null;
  const ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = volume * MASTER_LEVEL;
  master.connect(ctx.destination);

  const dry = ctx.createGain();
  dry.connect(master);
  const wet = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(ctx, 3.5);
  const reverbLevel = ctx.createGain();
  reverbLevel.gain.value = 0.6;
  wet.connect(reverb).connect(reverbLevel).connect(master);

  shared = { ctx, dry, wet };
  return shared;
}

/** Call from a user gesture (tap, click, key) so the browser lets audio start. */
export function unlockAudio(): void {
  if (shared?.ctx.state === 'suspended') void shared.ctx.resume();
}

export function audioRunning(): boolean {
  return shared?.ctx.state === 'running';
}

export function setMasterVolume(next: number): void {
  volume = Math.max(0, Math.min(1, next));
  if (shared && master) master.gain.setTargetAtTime(volume * MASTER_LEVEL, shared.ctx.currentTime, 0.2);
}
