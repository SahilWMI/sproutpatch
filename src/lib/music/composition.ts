import type { TrackId } from '../prefs';

export interface Track {
  id: TrackId;
  title: string;
  bpm: number;
  /** One chord per bar, as MIDI note numbers, looping. */
  chords: readonly (readonly number[])[];
  /** Notes the melody may wander over, low to high. */
  melody: readonly number[];
}

export const TRACKS: Record<TrackId, Track> = {
  meadow: {
    id: 'meadow',
    title: 'Meadow',
    bpm: 64,
    // Cmaj7, Am7, Fmaj7, G6
    chords: [
      [48, 55, 59, 64],
      [45, 52, 55, 60],
      [41, 48, 52, 57],
      [43, 50, 52, 59],
    ],
    melody: [67, 69, 71, 72, 74, 76, 79, 81, 83, 84],
  },
  'night-grass': {
    id: 'night-grass',
    title: 'Night Grass',
    bpm: 52,
    // Dmaj7, Bm7, Gmaj7, Em9
    chords: [
      [50, 57, 61, 66],
      [47, 54, 57, 62],
      [43, 50, 54, 59],
      [40, 47, 54, 62],
    ],
    melody: [69, 71, 73, 74, 76, 78, 81, 83, 85, 86],
  },
};

export type Voice = 'piano' | 'pad' | 'bass';

export interface NoteEvent {
  voice: Voice;
  midi: number;
  /** Start, in beats from the start of the bar (4 beats per bar). */
  beat: number;
  /** Length in beats. */
  beats: number;
  velocity: number;
}

export const BEATS_PER_BAR = 4;
/** Every Nth bar the melody rests and only the pad breathes. */
export const REST_EVERY = 6;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export interface Composer {
  nextBar(): NoteEvent[];
}

/** Sparse, slow, wandering piano over soft pads. Same seed, same music. */
export function createComposer(track: Track, seed: number): Composer {
  const rand = mulberry32(seed);
  let bar = 0;
  let position = Math.floor(track.melody.length / 2);

  const step = (): number => {
    const r = rand();
    const move = r < 0.15 ? -2 : r < 0.45 ? -1 : r < 0.55 ? 0 : r < 0.85 ? 1 : 2;
    position = Math.max(0, Math.min(track.melody.length - 1, position + move));
    return track.melody[position] ?? track.melody[0] ?? 72;
  };

  return {
    nextBar(): NoteEvent[] {
      const chord = track.chords[bar % track.chords.length] ?? [];
      const events: NoteEvent[] = chord.map((midi) => ({
        voice: 'pad',
        midi,
        beat: 0,
        beats: BEATS_PER_BAR + 0.5,
        velocity: 0.5,
      }));
      const root = chord[0];
      if (root !== undefined && bar % 2 === 0) {
        events.push({ voice: 'bass', midi: root - 12, beat: 0, beats: BEATS_PER_BAR, velocity: 0.55 });
      }

      const resting = bar % REST_EVERY === REST_EVERY - 1;
      if (!resting) {
        const count = 1 + Math.floor(rand() * 4);
        const slots = new Set<number>();
        while (slots.size < count) slots.add(Math.floor(rand() * 8) / 2);
        for (const beat of [...slots].sort((a, b) => a - b)) {
          events.push({ voice: 'piano', midi: step(), beat, beats: 2, velocity: 0.35 + rand() * 0.35 });
        }
        if (rand() < 0.25) {
          const top = chord[chord.length - 1];
          if (top !== undefined) events.push({ voice: 'piano', midi: top + 12, beat: 3.5, beats: 2, velocity: 0.25 });
        }
      }
      bar += 1;
      return events;
    },
  };
}
