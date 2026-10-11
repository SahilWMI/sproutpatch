import { afterEach, describe, expect, it, vi } from 'vitest';
import { tapFeedback } from './haptics';

describe('tap feedback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function media(matches: boolean | ((query: string) => boolean)) {
    const matchMedia = (query: string) => ({
      matches: typeof matches === 'function' ? matches(query) : matches,
      media: query,
      addListener() {},
      removeListener() {},
    });
    vi.stubGlobal('matchMedia', matchMedia);
    vi.stubGlobal('window', { matchMedia });
  }

  it('sends a short vibrate on a tap', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    media(false);
    tapFeedback();
    expect(vibrate).toHaveBeenCalledWith(12);
  });

  it('skips vibration when the user prefers reduced motion', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    media((query) => query.includes('reduced-motion'));
    tapFeedback();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
