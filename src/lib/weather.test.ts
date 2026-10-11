import { describe, expect, it, vi } from 'vitest';
import { buildWeatherUrl, fetchWeather, parseOpenMeteo } from './weather';

const NOW = new Date('2026-10-12T10:00:00Z');
const s = (iso: string) => Date.parse(iso) / 1000;

const sample = {
  current: { time: s('2026-10-12T10:00:00Z'), temperature_2m: 27.4, weather_code: 3 },
  hourly: {
    time: [s('2026-10-12T08:00:00Z'), s('2026-10-12T09:30:00Z'), s('2026-10-12T11:00:00Z'), s('2026-10-12T15:00:00Z')],
    precipitation_probability: [90, 20, 45, 100],
  },
  daily: {
    time: [s('2026-10-11T18:30:00Z'), s('2026-10-12T18:30:00Z')],
    sunrise: [s('2026-10-12T00:30:00Z'), s('2026-10-13T00:31:00Z')],
    sunset: [s('2026-10-12T12:12:00Z'), s('2026-10-13T12:11:00Z')],
  },
};

describe('parseOpenMeteo', () => {
  it('extracts temperature, code, near-term rain chance and today sunset', () => {
    const w = parseOpenMeteo(sample, NOW);
    expect(w).not.toBeNull();
    expect(w?.temperatureC).toBe(27.4);
    expect(w?.weatherCode).toBe(3);
    // Only 09:30 (20) and 11:00 (45) fall inside the window; 08:00 and 15:00 are outside.
    expect(w?.precipitationProbability).toBe(45);
    expect(w?.sunset.toISOString()).toBe('2026-10-12T12:12:00.000Z');
    expect(w?.sunrise.toISOString()).toBe('2026-10-12T00:30:00.000Z');
  });

  it('tolerates null probabilities', () => {
    const w = parseOpenMeteo(
      { ...sample, hourly: { ...sample.hourly, precipitation_probability: [null, null, null, null] } },
      NOW,
    );
    expect(w?.precipitationProbability).toBe(0);
  });

  it('returns null for unexpected shapes', () => {
    expect(parseOpenMeteo({ error: true, reason: 'nope' }, NOW)).toBeNull();
    expect(parseOpenMeteo(null, NOW)).toBeNull();
  });
});

describe('fetchWeather', () => {
  it('rounds coordinates and sends nothing else personal', () => {
    const url = new URL(buildWeatherUrl(20.296123, 85.824567));
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('20.30');
    expect(url.searchParams.get('longitude')).toBe('85.82');
  });

  it('returns a snapshot on success', async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }));
    const w = await fetchWeather(1, 2, fake as unknown as typeof fetch, NOW);
    expect(w?.temperatureC).toBe(27.4);
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it('returns null on HTTP errors or network failure', async () => {
    const http500 = vi.fn(async () => new Response('oops', { status: 500 }));
    expect(await fetchWeather(1, 2, http500 as unknown as typeof fetch, NOW)).toBeNull();
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await fetchWeather(1, 2, offline as unknown as typeof fetch, NOW)).toBeNull();
  });
});
