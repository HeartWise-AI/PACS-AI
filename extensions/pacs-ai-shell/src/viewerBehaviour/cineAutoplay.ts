/**
 * Cine autoplay for ultrasound and angiography (F15), as PACS-AI did by
 * editing the cornerstone extension's CinePlayer.tsx:
 *
 * - a viewport that shows a US or XA series turns cine on and plays it, each
 *   time it gets a new series (also when cine was off or closed);
 * - the frame rate is the series' acquisition rate (see cineFrameRate.ts:
 *   Cine Rate, Frame Time, Frame Time Vector, Recommended Display Frame
 *   Rate), else 24.
 *
 * OHIF's CinePlayer computes the rate from `displaySet.FrameRate`, which the
 * stack SOP class handler fills with the Frame Time in milliseconds (no other
 * code reads it). So that OHIF's player and ours agree on the rate, a display
 * set with a Cine Rate gets the matching frame time there
 * (`1000 / CineRate`), and so does a US or XA display set whose rate comes
 * from Frame Time Vector or Recommended Display Frame Rate (Shimadzu XA has
 * neither Cine Rate nor Frame Time). Autoplay of series with a frame rate in
 * other modalities stays OHIF's (`autoPlayCine` in the app config).
 */

import { FrameRateHeader, resolveFrameRate, roundFrameRate } from './cineFrameRate';

export const AUTOPLAY_MODALITIES = ['US', 'XA'];

const DEFAULT_FRAME_RATE = 24;

type DisplaySetLike = {
  displaySetInstanceUID?: string;
  Modality?: string;
  FrameRate?: number;
  instance?: FrameRateHeader;
};

/** Same test as before: the modality contains US or XA. */
export function shouldAutoplay(modality?: string): boolean {
  return typeof modality === 'string' && AUTOPLAY_MODALITIES.some(code => modality.includes(code));
}

/** Frames per second to play a display set at. */
export function preferredFrameRate(displaySet?: DisplaySetLike): number {
  const resolved = resolveFrameRate(displaySet?.instance);
  if (resolved) {
    return roundFrameRate(resolved.fps);
  }
  const frameTime = Number(displaySet?.FrameRate);
  if (Number.isFinite(frameTime) && frameTime > 0) {
    return roundFrameRate(1000 / frameTime);
  }
  return DEFAULT_FRAME_RATE;
}

/**
 * Makes OHIF's player use the series' rate (see the file comment): the
 * Cine Rate in every modality, the Frame Time Vector or Recommended Display
 * Frame Rate in US and XA. A Frame Time is already there.
 */
export function preferSeriesFrameRate(displaySet?: DisplaySetLike): void {
  const resolved = displaySet && resolveFrameRate(displaySet.instance);
  if (!resolved || resolved.source === 'FrameTime') {
    return;
  }
  if (resolved.source === 'CineRate' || shouldAutoplay(displaySet.Modality)) {
    displaySet.FrameRate = 1000 / roundFrameRate(resolved.fps);
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
  autoplayed.forEach(preferSeriesFrameRate);
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

  (displaySetService.getActiveDisplaySets?.() || []).forEach(preferSeriesFrameRate);

  const subscriptions = [
    displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      ({ displaySetsAdded }) => (displaySetsAdded || []).forEach(preferSeriesFrameRate)
    ),
    displaySetService.subscribe(displaySetService.EVENTS.DISPLAY_SETS_CHANGED, displaySets =>
      (Array.isArray(displaySets) ? displaySets : []).forEach(preferSeriesFrameRate)
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
