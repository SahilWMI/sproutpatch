export type RGB = readonly [number, number, number];

export interface SkyState {
  top: RGB;
  bottom: RGB;
  /** 0 = noon light, 1 = full night. Drives grass darkness, stars and fireflies. */
  night: number;
  /** Sun (0..1 visible) or moon depending on the hour. */
  sunUp: number;
}

interface Keyframe {
  hour: number;
  top: RGB;
  bottom: RGB;
  night: number;
}

const KEYFRAMES: readonly Keyframe[] = [
  { hour: 0, top: [8, 12, 32], bottom: [24, 36, 66], night: 1 },
  { hour: 4.5, top: [10, 15, 38], bottom: [30, 42, 74], night: 1 },
  { hour: 6, top: [62, 74, 128], bottom: [246, 176, 140], night: 0.45 },
  { hour: 7.5, top: [108, 176, 228], bottom: [214, 236, 244], night: 0.05 },
  { hour: 12, top: [92, 168, 230], bottom: [206, 234, 246], night: 0 },
  { hour: 16.5, top: [104, 166, 222], bottom: [232, 226, 200], night: 0.05 },
  { hour: 18, top: [64, 56, 120], bottom: [244, 140, 92], night: 0.45 },
  { hour: 19.5, top: [20, 22, 58], bottom: [72, 52, 98], night: 0.85 },
  { hour: 24, top: [8, 12, 32], bottom: [24, 36, 66], night: 1 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Smoothly blended sky for a fractional local hour (0-24). */
export function skyAt(hour: number): SkyState {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYFRAMES.length - 2 && h >= KEYFRAMES[i + 1]!.hour) i++;
  const a = KEYFRAMES[i]!;
  const b = KEYFRAMES[i + 1]!;
  const t = (h - a.hour) / (b.hour - a.hour);
  const night = lerp(a.night, b.night, t);
  return {
    top: lerpRGB(a.top, b.top, t),
    bottom: lerpRGB(a.bottom, b.bottom, t),
    night,
    sunUp: h > 5.5 && h < 19 ? 1 - night : 0,
  };
}

export function rgb([r, g, b]: RGB, alpha = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/** Arc position (0..1 across, 0..1 up) of the sun by day, or the moon by night. */
export function celestialPosition(hour: number): { x: number; y: number } {
  const h = ((hour % 24) + 24) % 24;
  const day = h >= 6 && h < 18.5;
  const progress = day ? (h - 6) / 12.5 : ((h < 6 ? h + 24 : h) - 18.5) / 11.5;
  return { x: 0.08 + progress * 0.84, y: Math.sin(progress * Math.PI) };
}

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Hello, night owl';
}
