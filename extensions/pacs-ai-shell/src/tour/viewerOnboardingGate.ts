/**
 * Keeps the viewer's own onboarding tour (ViewerTour → OHIF Onboarding) and
 * the tutorial checklist tours (TutorialProgressOverlay) from running at the
 * same time. Onboarding starts its Shepherd tour without cancelling one that
 * is already on screen, so a checklist tour resumed in the viewer waits until
 * the viewer onboarding has either started and ended, or will not start.
 *
 * ViewerTour holds the gate from mount until that is known; the overlay waits
 * for the gate to be free before it starts a tour in the viewer.
 */
let holds = 0;
let waiters: Array<() => void> = [];

/** Holds the gate; the returned function releases it (once). */
export function holdViewerOnboarding(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    holds -= 1;
    if (holds === 0) {
      const ready = waiters;
      waiters = [];
      ready.forEach(resolve => resolve());
    }
  };
}

/**
 * Resolves true once no viewer onboarding is pending or on screen, or false
 * when the signal aborts first.
 */
export function whenViewerOnboardingIdle(signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) {
    return Promise.resolve(false);
  }
  if (holds === 0) {
    return Promise.resolve(true);
  }
  return new Promise(resolve => {
    const onAbort = () => {
      waiters = waiters.filter(waiter => waiter !== onIdle);
      resolve(false);
    };
    const onIdle = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    };
    waiters.push(onIdle);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
