/**
 * Cine autoplay for ultrasound and angiography (F15), as PACS-AI did by
 * editing the cornerstone extension's CinePlayer.tsx:
 *
 * - a viewport that shows a US or XA series turns cine on and plays it, each
 *   time it gets a new series (also when cine was off or closed);
 * - the frame rate is the series' preferred playback rate, Cine Rate
 *   (0018,0040), when it has one, else the rate from Frame Time (0018,1063),
 *   else 24.
 *
 * OHIF's CinePlayer computes the rate from `displaySet.FrameRate`, which the
 * stack SOP class handler fills with the Frame Time in milliseconds (no other
 * code reads it). So that OHIF's player and ours agree on the rate, a display
 * set with a Cine Rate gets the matching frame time there
 * (`1000 / CineRate`). Autoplay of series with a frame rate in other
 * modalities stays OHIF's (`autoPlayCine` in the app config).
 */

export const AUTOPLAY_MODALITIES = ['US', 'XA'];

const DEFAULT_FRAME_RATE = 24;

type DisplaySetLike = {
  displaySetInstanceUID?: string;
  Modality?: string;
  FrameRate?: number;
  instance?: { CineRate?: number | string };
};

/** Same test as before: the modality contains US or XA. */
export function shouldAutoplay(modality?: string): boolean {
  return typeof modality === 'string' && AUTOPLAY_MODALITIES.some(code => modality.includes(code));
}

function cineRateOf(displaySet?: DisplaySetLike): number | undefined {
  const cineRate = Number(displaySet?.instance?.CineRate);
  return Number.isFinite(cineRate) && cineRate > 0 ? cineRate : undefined;
}

/** Frames per second to play a display set at. */
export function preferredFrameRate(displaySet?: DisplaySetLike): number {
  const cineRate = cineRateOf(displaySet);
  if (cineRate) {
    return cineRate;
  }
  const frameTime = Number(displaySet?.FrameRate);
  if (Number.isFinite(frameTime) && frameTime > 0) {
    return Math.round(1000 / frameTime);
  }
  return DEFAULT_FRAME_RATE;
}

/** Makes OHIF's player use the Cine Rate (see the file comment). */
export function preferCineRate(displaySet?: DisplaySetLike): void {
  const cineRate = cineRateOf(displaySet);
  if (displaySet && cineRate) {
    displaySet.FrameRate = 1000 / cineRate;
  }
}

/** Starts the cine of a viewport if it shows a US or XA series. */
export function autoplayViewport(servicesManager, viewportId: string): void {
  const { cineService, displaySetService, viewportGridService } = servicesManager.services;
  const displaySetInstanceUIDs: string[] =
    viewportGridService.getDisplaySetsUIDsForViewport(viewportId) || [];
  const displaySets: DisplaySetLike[] = displaySetInstanceUIDs
    .map(uid => displaySetService.getDisplaySetByUID(uid))
    .filter(Boolean);
  const autoplayed = displaySets.filter(displaySet => shouldAutoplay(displaySet.Modality));
  if (!autoplayed.length) {
    return;
  }
  autoplayed.forEach(preferCineRate);
  if (!cineService.getState()?.isCineEnabled) {
    cineService.setIsCineEnabled(true);
  }
  // The last display set wins, as in OHIF's player.
  const frameRate = preferredFrameRate(autoplayed[autoplayed.length - 1]);
  cineService.setCine({ id: viewportId, isPlaying: true, frameRate });
}

const running = new WeakMap<object, () => void>();

/**
 * Subscribes for the current mode; returns the function that unsubscribes.
 * Starting it again for the same services while it runs returns the same
 * stop function and subscribes nothing more.
 */
export function startCineAutoplay(servicesManager): () => void {
  const services = servicesManager?.services;
  const { displaySetService, cornerstoneViewportService } = services || {};
  if (!displaySetService || !cornerstoneViewportService || !services.cineService) {
    return () => undefined;
  }
  const existing = running.get(services);
  if (existing) {
    return existing;
  }

  (displaySetService.getActiveDisplaySets?.() || []).forEach(preferCineRate);

  const subscriptions = [
    displaySetService.subscribe(displaySetService.EVENTS.DISPLAY_SETS_ADDED, ({ displaySetsAdded }) =>
      (displaySetsAdded || []).forEach(preferCineRate)
    ),
    displaySetService.subscribe(displaySetService.EVENTS.DISPLAY_SETS_CHANGED, displaySets =>
      (Array.isArray(displaySets) ? displaySets : []).forEach(preferCineRate)
    ),
    cornerstoneViewportService.subscribe(
      cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
      ({ viewportId }) => {
        if (viewportId) {
          autoplayViewport(servicesManager, viewportId);
        }
      }
    ),
  ];

  const stop = () => {
    subscriptions.forEach(subscription => subscription?.unsubscribe?.());
    if (running.get(services) === stop) {
      running.delete(services);
    }
  };
  running.set(services, stop);
  return stop;
}

/** Stops what startCineAutoplay started for these services, if it runs. */
export function stopCineAutoplay(servicesManager): void {
  const services = servicesManager?.services;
  if (services) {
    running.get(services)?.();
  }
}
