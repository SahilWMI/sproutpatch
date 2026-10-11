import { afterEach, describe, expect, it, vi } from 'vitest';
import { CancelledError, TimeoutError, withTimeout } from './withTimeout';

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('resolves when the task finishes in time', async () => {
    await expect(withTimeout(async () => 42, 1000)).resolves.toBe(42);
  });

  it('rejects with TimeoutError and aborts the signal when the task hangs', async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    const p = withTimeout((signal) => {
      seen = signal;
      return new Promise<never>(() => {});
    }, 500);
    const assertion = expect(p).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(501);
    await assertion;
    expect(seen?.aborted).toBe(true);
  });

  it('rejects with CancelledError when the outer signal aborts', async () => {
    const outer = new AbortController();
    const p = withTimeout(() => new Promise<never>(() => {}), 10_000, outer.signal);
    outer.abort();
    await expect(p).rejects.toBeInstanceOf(CancelledError);
  });

  it('rejects immediately if already cancelled', async () => {
    const outer = new AbortController();
    outer.abort();
    await expect(withTimeout(async () => 1, 1000, outer.signal)).rejects.toBeInstanceOf(CancelledError);
  });

  it('passes through task errors, including synchronous throws', async () => {
    await expect(withTimeout(async () => Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
    await expect(
      withTimeout(() => {
        throw new Error('sync boom');
      }, 1000),
    ).rejects.toThrow('sync boom');
  });
});
