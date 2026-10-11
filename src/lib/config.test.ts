import { describe, expect, it } from 'vitest';
import { DEFAULT_LAT, DEFAULT_LON, DEFAULT_TIMEOUT_MS, readConfig } from './config';

describe('readConfig', () => {
  it('uses defaults when nothing is set', () => {
    const cfg = readConfig({});
    expect(cfg).toEqual({
      model: '',
      baseUrl: '',
      apiKey: '',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      defaultLat: DEFAULT_LAT,
      defaultLon: DEFAULT_LON,
      hosted: false,
    });
  });

  it('only treats VITE_HOSTED=true as hosted', () => {
    expect(readConfig({ VITE_HOSTED: 'true' }).hosted).toBe(true);
    expect(readConfig({ VITE_HOSTED: 'yes' }).hosted).toBe(false);
  });

  it('reads and trims provided values', () => {
    const cfg = readConfig({
      VITE_MODEL: ' gemma3:1b ',
      VITE_TIMEOUT_MS: '30000',
      VITE_DEFAULT_LAT: '51.5',
      VITE_DEFAULT_LON: '-0.12',
    });
    expect(cfg.model).toBe('gemma3:1b');
    expect(cfg.timeoutMs).toBe(30000);
    expect(cfg.defaultLat).toBe(51.5);
    expect(cfg.defaultLon).toBe(-0.12);
  });

  it('rejects nonsense numbers', () => {
    const cfg = readConfig({ VITE_TIMEOUT_MS: 'soon', VITE_DEFAULT_LAT: '200' });
    expect(cfg.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(cfg.defaultLat).toBe(DEFAULT_LAT);
  });
});
