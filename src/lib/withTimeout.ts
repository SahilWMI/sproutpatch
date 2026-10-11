export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

/**
 * Runs `task` with an AbortSignal that fires on timeout or when `outer` aborts.
 * Rejects with TimeoutError / CancelledError even if the task ignores the signal.
 */
export function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  ms: number,
  outer?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    if (outer?.aborted) {
      reject(new CancelledError());
      return;
    }
    const timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(ms));
    }, ms);
    const onOuterAbort = () => {
      clearTimeout(timer);
      controller.abort();
      reject(new CancelledError());
    };
    outer?.addEventListener('abort', onOuterAbort, { once: true });

    const cleanup = () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    };

    let pending: Promise<T>;
    try {
      pending = task(controller.signal);
    } catch (err) {
      cleanup();
      reject(err);
      return;
    }
    pending.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (err: unknown) => {
        cleanup();
        reject(err);
      },
    );
  });
}
