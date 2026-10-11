const TAP_MS = 12;
const CONTROL = 'button, [role="button"], [role="radio"], [role="switch"], [role="tab"], a[href]';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Short tick on Android Chrome. iOS Safari has no Vibration API, so the press style has to carry it there. */
export function tapFeedback(): void {
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate?.(TAP_MS);
  } catch {
    // Some browsers expose vibrate but reject it outside a user gesture.
  }
}

export function isTappable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CONTROL) !== null;
}

/** One listener for every control, plus a no-op touchstart so iOS applies :active. */
export function installTapFeedback(): () => void {
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (isTappable(event.target)) tapFeedback();
  };
  const wakeActive = () => undefined;
  document.addEventListener('pointerdown', onPointer, { passive: true });
  document.addEventListener('touchstart', wakeActive, { passive: true });
  return () => {
    document.removeEventListener('pointerdown', onPointer);
    document.removeEventListener('touchstart', wakeActive);
  };
}
