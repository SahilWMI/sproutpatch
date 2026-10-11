import { mulberry32 } from './composition';

export interface Cricket {
  hz: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  /** 0..1; distant crickets are quieter. */
  level: number;
  /** Seconds between chirps. */
  period: number;
  /** Pulses per chirp. */
  pulses: number;
}

export interface Pulse {
  at: number;
  hz: number;
  pan: number;
  level: number;
  length: number;
}

export const PULSE_S = 0.028;
export const PULSE_GAP_S = 0.022;

export interface CricketField {
  crickets: readonly Cricket[];
  /** Every pulse that starts in [from, to). Call with increasing, contiguous windows. */
  pulsesBetween(from: number, to: number): Pulse[];
}

/** A few field crickets around you: each chirps 2-4 quick pulses on its own rhythm and sometimes pauses. */
export function createCricketField(seed: number, count = 5): CricketField {
  const rand = mulberry32(seed);
  const crickets: Cricket[] = Array.from({ length: count }, (_, i) => ({
    hz: 4200 + rand() * 900,
    pan: rand() * 1.6 - 0.8,
    level: i < 2 ? 0.7 + rand() * 0.3 : 0.2 + rand() * 0.3,
    period: 0.7 + rand() * 0.8,
    pulses: 2 + Math.floor(rand() * 3),
  }));
  const nextChirp = crickets.map(() => rand() * 2);

  return {
    crickets,
    pulsesBetween(from: number, to: number): Pulse[] {
      const out: Pulse[] = [];
      crickets.forEach((cricket, i) => {
        let t = Math.max(nextChirp[i] ?? from, from);
        while (t < to) {
          const level = cricket.level * (0.8 + rand() * 0.2);
          for (let p = 0; p < cricket.pulses; p++) {
            out.push({ at: t + p * (PULSE_S + PULSE_GAP_S), hz: cricket.hz, pan: cricket.pan, level, length: PULSE_S });
          }
          const pause = rand() < 0.08 ? 3 + rand() * 5 : 0;
          t += cricket.period * (0.9 + rand() * 0.2) + pause;
        }
        nextChirp[i] = t;
      });
      return out.sort((a, b) => a.at - b.at);
    },
  };
}
