import { z } from 'zod';
import type { WeatherSnapshot } from './types';
import { withTimeout } from './withTimeout';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_TIMEOUT_MS = 8000;

const OpenMeteoSchema = z.object({
  current: z.object({
    time: z.number(),
    temperature_2m: z.number(),
    weather_code: z.number(),
  }),
  hourly: z.object({
    time: z.array(z.number()),
    precipitation_probability: z.array(z.number().nullable()),
  }),
  daily: z.object({
    time: z.array(z.number()),
    sunrise: z.array(z.number()),
    sunset: z.array(z.number()),
  }),
});

/** Only coordinates leave the device, rounded to ~1 km. */
export function buildWeatherUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    current: 'temperature_2m,weather_code',
    hourly: 'precipitation_probability',
    daily: 'sunrise,sunset',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '2',
  });
  return `${OPEN_METEO_URL}?${params.toString()}`;
}

/** Turns an Open-Meteo response into a snapshot, or null if the shape is unexpected. */
export function parseOpenMeteo(json: unknown, now: Date): WeatherSnapshot | null {
  const parsed = OpenMeteoSchema.safeParse(json);
  if (!parsed.success) return null;
  const { current, hourly, daily } = parsed.data;
  const nowSec = now.getTime() / 1000;

  let dayIndex = 0;
  daily.time.forEach((t, i) => {
    if (t <= nowSec) dayIndex = i;
  });
  const sunrise = daily.sunrise[dayIndex];
  const sunset = daily.sunset[dayIndex];
  if (sunrise === undefined || sunset === undefined) return null;

  // Worst chance of rain from the last hour through the next three.
  let precip = 0;
  hourly.time.forEach((t, i) => {
    const p = hourly.precipitation_probability[i];
    if (t >= nowSec - 3600 && t <= nowSec + 3 * 3600 && typeof p === 'number') precip = Math.max(precip, p);
  });

  return {
    temperatureC: current.temperature_2m,
    precipitationProbability: precip,
    weatherCode: current.weather_code,
    sunrise: new Date(sunrise * 1000),
    sunset: new Date(sunset * 1000),
  };
}

export async function fetchWeather(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<WeatherSnapshot | null> {
  try {
    const json = await withTimeout(async (signal) => {
      const res = await fetchImpl(buildWeatherUrl(lat, lon), { signal });
      if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
      return (await res.json()) as unknown;
    }, WEATHER_TIMEOUT_MS);
    return parseOpenMeteo(json, now);
  } catch {
    return null;
  }
}
