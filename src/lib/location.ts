import { config } from './config';

export interface Coordinates {
  lat: number;
  lon: number;
  source: 'device' | 'default';
}

export function defaultCoordinates(): Coordinates {
  return { lat: config.defaultLat, lon: config.defaultLon, source: 'default' };
}

/** Browser geolocation with a short timeout; falls back to VITE_DEFAULT_LAT/LON. */
export function getCoordinates(timeoutMs = 5000): Promise<Coordinates> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(defaultCoordinates());
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (c: Coordinates) => {
      if (settled) return;
      settled = true;
      resolve(c);
    };
    const timer = setTimeout(() => done(defaultCoordinates()), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        done({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'device' });
      },
      () => {
        clearTimeout(timer);
        done(defaultCoordinates());
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 30 * 60_000 },
    );
  });
}
