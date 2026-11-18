import { cache, eventTarget, Enums } from '@cornerstonejs/core';

/**
 * Holds back the study browser's thumbnail requests until the active viewport
 * has its first image and the next few frames (P3.6).
 *
 * OHIF's study browser starts every thumbnail request 250 ms (+10 ms per
 * display set) after the layout has an active viewport, "to allow the
 * viewports preferential loading". On 3.13 the DICOMweb data source adds each
 * series as its metadata arrives, so the viewport now gets its first image
 * earlier and the thumbnail burst (up to `maxNumRequests.thumbnail`, 75 for
 * PACS-AI, each a WADO-RS frame of a multi-frame instance) is already at the
 * server when cine asks for frame 2. On echo studies the first cine frame
 * advance then waited for the thumbnails (P3.5: 5.6 s vs 3.6 s on 3.11, two
 * of three runs; with 5 thumbnail requests the advance came 0.1 s after the
 * first image). Waiting for a few frames of the shown series first keeps
 * cine starting right after the first image; the thumbnails start a few
 * hundred milliseconds later. P3.7: 2 frames and 1 s (was 4 and 1.5 s), and
 * the clip's prefetch is held low until the thumbnails are in
 * (./prefetchHold.ts); with 4 frames and no hold the thumbnails queued behind
 * the whole clip.
 */

/** Frames after the shown one that must be in the cache before thumbnails start. */
export const WARM_UP_FRAMES = 2;
/** Longest wait once the first image is shown. */
export const AFTER_FIRST_IMAGE_TIMEOUT_MS = 1000;
/** Longest wait in total (a viewport that never loads must not block thumbnails). */
export const TOTAL_TIMEOUT_MS = 5000;
/** Safety net next to the cache and viewport events. */
export const POLL_MS = 250;

type StackLike = {
  getImageIds?: () => string[];
  getCurrentImageIdIndex?: () => number;
};

export type WarmUpState = 'waiting' | 'firstImage' | 'ready';

/**
 * Where the active viewport is: 'waiting' (no image shown yet), 'firstImage'
 * (shown, next frames not all cached) or 'ready'. A viewport that is not a
 * stack (volume, video, PDF, SR) has no frames to wait for and is 'ready' as
 * soon as it exists.
 */
export function warmUpState(
  viewport: StackLike | null | undefined,
  isLoaded: (imageId: string) => boolean,
  frames = WARM_UP_FRAMES
): WarmUpState {
  if (!viewport) {
    return 'waiting';
  }
  if (typeof viewport.getImageIds !== 'function') {
    return 'ready';
  }
  const imageIds = viewport.getImageIds() || [];
  if (!imageIds.length) {
    return 'waiting';
  }
  const index = Math.min(
    Math.max(Number(viewport.getCurrentImageIdIndex?.()) || 0, 0),
    imageIds.length - 1
  );
  if (!isLoaded(imageIds[index])) {
    return 'waiting';
  }
  const next = imageIds.slice(index + 1, index + 1 + frames);
  return next.every(isLoaded) ? 'ready' : 'firstImage';
}

type Subscription = { unsubscribe: () => void } | (() => void) | undefined;

export type WarmUpDeps = {
  /** The active viewport's cornerstone viewport, or null. */
  getActiveViewport: () => StackLike | null | undefined;
  isLoaded: (imageId: string) => boolean;
  /** Calls `onChange` when the cache or the viewports change; returns the unsubscribe. */
  subscribe: (onChange: () => void) => Subscription[];
  setTimeout?: typeof window.setTimeout;
  clearTimeout?: typeof window.clearTimeout;
  setInterval?: typeof window.setInterval;
  clearInterval?: typeof window.clearInterval;
};

/**
 * Calls `onReady` once: when the active viewport is 'ready', 1.5 s after its
 * first image, or 5 s after the call, whichever comes first. Returns a
 * function that cancels the wait without calling `onReady`.
 */
export function whenViewportWarmedUp(deps: WarmUpDeps, onReady: () => void): () => void {
  const setT = deps.setTimeout ?? window.setTimeout.bind(window);
  const clearT = deps.clearTimeout ?? window.clearTimeout.bind(window);
  const setI = deps.setInterval ?? window.setInterval.bind(window);
  const clearI = deps.clearInterval ?? window.clearInterval.bind(window);

  let done = false;
  let afterFirstImage: ReturnType<typeof setT> | undefined;
  let subscriptions: Subscription[] = [];

  const stop = () => {
    done = true;
    clearT(total);
    clearI(poll);
    if (afterFirstImage !== undefined) {
      clearT(afterFirstImage);
    }
    subscriptions.forEach(subscription => {
      if (typeof subscription === 'function') {
        subscription();
      } else {
        subscription?.unsubscribe?.();
      }
    });
    subscriptions = [];
  };

  const finish = () => {
    if (done) {
      return;
    }
    stop();
    onReady();
  };

  const check = () => {
    if (done) {
      return;
    }
    let state: WarmUpState;
    try {
      state = warmUpState(deps.getActiveViewport(), deps.isLoaded);
    } catch {
      // A viewport being torn down or rebuilt: do not hold thumbnails for it.
      state = 'ready';
    }
    if (state === 'ready') {
      finish();
    } else if (state === 'firstImage' && afterFirstImage === undefined) {
      afterFirstImage = setT(finish, AFTER_FIRST_IMAGE_TIMEOUT_MS);
    }
  };

  const total = setT(finish, TOTAL_TIMEOUT_MS);
  const poll = setI(check, POLL_MS);
  try {
    subscriptions = deps.subscribe(check) || [];
  } catch {
    subscriptions = [];
  }
  check();

  return () => {
    if (!done) {
      stop();
    }
  };
}

/** `whenViewportWarmedUp` on OHIF's services and the cornerstone image cache. */
export function whenActiveViewportWarmedUp(servicesManager, onReady: () => void): () => void {
  const { cornerstoneViewportService, viewportGridService } = servicesManager?.services || {};
  if (!cornerstoneViewportService || !viewportGridService) {
    onReady();
    return () => undefined;
  }
  return whenViewportWarmedUp(
    {
      getActiveViewport: () => {
        const viewportId = viewportGridService.getActiveViewportId?.();
        return viewportId ? cornerstoneViewportService.getCornerstoneViewport(viewportId) : null;
      },
      isLoaded: imageId => cache.isLoaded(imageId),
      subscribe: onChange => {
        const onCacheImageAdded = () => onChange();
        eventTarget.addEventListener(Enums.Events.IMAGE_CACHE_IMAGE_ADDED, onCacheImageAdded);
        return [
          () =>
            eventTarget.removeEventListener(
              Enums.Events.IMAGE_CACHE_IMAGE_ADDED,
              onCacheImageAdded
            ),
          cornerstoneViewportService.subscribe?.(
            cornerstoneViewportService.EVENTS?.VIEWPORT_DATA_CHANGED,
            onChange
          ),
        ];
      },
    },
    onReady
  );
}
