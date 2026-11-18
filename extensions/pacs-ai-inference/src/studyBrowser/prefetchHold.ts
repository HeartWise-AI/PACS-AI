import { imageLoadPoolManager, Enums } from '@cornerstonejs/core';

/**
 * Thumbnails before the rest of the shown clip (P3.7).
 *
 * The stack context prefetch that cornerstone 4/5 starts on every new image
 * set (OHIF `CornerstoneViewportService`, `stackContextPrefetch.enable`) sends
 * up to `maxNumRequests.prefetch` (25) frame requests as soon as the first
 * image is shown. Our frames are uncompressed (~2 MB per echo frame) and the
 * API proxy speaks HTTP/1.1, so the browser runs 6 requests at a time and
 * every request handed to it waits in one queue: the thumbnails of the study
 * browser, released after the active viewport's first frames
 * (./viewportWarmUp.ts), waited behind the whole clip (P3.6, echo: all
 * thumbnails 13.1 s vs 6.9 s on 3.11). 3.11.1 sent the thumbnails first and
 * prefetched with about 3 requests in flight until they were in (request
 * timing, P3.7).
 *
 * While the study browser loads its first thumbnails, the prefetch limit of
 * cornerstone's image load pool is lowered to PREFETCH_DURING_THUMBNAILS; it
 * goes back to the configured value once no thumbnail request is queued or
 * running for THUMBNAILS_IDLE_MS, or after MAX_HOLD_MS, or when the panel
 * unmounts. Cine and scrolling are not held: the shown frame is an
 * interaction request, which has its own limit.
 */

/** Prefetch requests allowed while the first thumbnails load. */
export const PREFETCH_DURING_THUMBNAILS = 2;
/** No thumbnail request queued or running for this long: thumbnails are in. */
export const THUMBNAILS_IDLE_MS = 750;
/** Longest hold once the thumbnails are released. */
export const MAX_HOLD_MS = 12000;
/** Longest hold before the thumbnails are released (a viewport that never loads). */
export const MAX_WAIT_MS = 20000;
export const POLL_MS = 250;

export type PoolLike = {
  getMaxSimultaneousRequests: (type: string) => number;
  setMaxSimultaneousRequests: (type: string, max: number) => void;
  getRequestPool: () => Record<string, Record<string | number, unknown[]>>;
  numRequests?: Record<string, number>;
  startGrabbing?: () => void;
};

export type PrefetchHold = {
  /** The thumbnails were released: end the hold once they are all in. */
  thumbnailsStarted: () => void;
  /** Ends the hold now (idempotent). */
  release: () => void;
};

export type HoldDeps = {
  pool: PoolLike;
  prefetch: string;
  thumbnail: string;
  now?: () => number;
  setInterval?: typeof window.setInterval;
  clearInterval?: typeof window.clearInterval;
};

const NO_HOLD: PrefetchHold = { thumbnailsStarted: () => undefined, release: () => undefined };

/** One hold at a time: a second panel must not restore the lowered value as "original". */
let active: PrefetchHold | null = null;

/** Queued plus running thumbnail requests. */
export function thumbnailRequests(pool: PoolLike, thumbnail: string): number {
  const queued = Object.values(pool.getRequestPool()?.[thumbnail] ?? {}).reduce(
    (n, list) => n + (Array.isArray(list) ? list.length : 0),
    0
  );
  return queued + (Number(pool.numRequests?.[thumbnail]) || 0);
}

export function holdPrefetch(deps: HoldDeps): PrefetchHold {
  const { pool, prefetch, thumbnail } = deps;
  const now = deps.now ?? (() => Date.now());
  const setI = deps.setInterval ?? window.setInterval.bind(window);
  const clearI = deps.clearInterval ?? window.clearInterval.bind(window);

  if (active) {
    return NO_HOLD;
  }
  let original: number;
  try {
    original = pool.getMaxSimultaneousRequests(prefetch);
  } catch {
    return NO_HOLD;
  }
  if (!(original > PREFETCH_DURING_THUMBNAILS)) {
    return NO_HOLD;
  }
  pool.setMaxSimultaneousRequests(prefetch, PREFETCH_DURING_THUMBNAILS);

  const startedAt = now();
  let releasedThumbnailsAt: number | null = null;
  let lastBusyAt = startedAt;
  let done = false;

  const release = () => {
    if (done) {
      return;
    }
    done = true;
    clearI(poll);
    if (active === hold) {
      active = null;
    }
    try {
      // Only undo our own change: if someone set another value meanwhile, keep it.
      if (pool.getMaxSimultaneousRequests(prefetch) === PREFETCH_DURING_THUMBNAILS) {
        pool.setMaxSimultaneousRequests(prefetch, original);
      }
      // Requests queued while the limit was low go out now, not on the next request.
      pool.startGrabbing?.();
    } catch {
      // pool torn down
    }
  };

  const check = () => {
    if (done) {
      return;
    }
    const t = now();
    if (releasedThumbnailsAt === null) {
      if (t - startedAt >= MAX_WAIT_MS) {
        release();
      }
      return;
    }
    let busy = false;
    try {
      busy = thumbnailRequests(pool, thumbnail) > 0;
    } catch {
      busy = false;
    }
    if (busy) {
      lastBusyAt = t;
    }
    const idleFor = t - Math.max(lastBusyAt, releasedThumbnailsAt);
    if (idleFor >= THUMBNAILS_IDLE_MS || t - releasedThumbnailsAt >= MAX_HOLD_MS) {
      release();
    }
  };

  const poll = setI(check, POLL_MS);
  const hold: PrefetchHold = {
    thumbnailsStarted: () => {
      if (!done && releasedThumbnailsAt === null) {
        releasedThumbnailsAt = now();
        lastBusyAt = releasedThumbnailsAt;
      }
    },
    release,
  };
  active = hold;
  return hold;
}

/** `holdPrefetch` on cornerstone's image load pool. */
export function holdImagePrefetch(): PrefetchHold {
  try {
    return holdPrefetch({
      pool: imageLoadPoolManager as unknown as PoolLike,
      prefetch: Enums.RequestType.Prefetch,
      thumbnail: Enums.RequestType.Thumbnail,
    });
  } catch {
    return NO_HOLD;
  }
}

/** Tests only. */
export function _resetPrefetchHold(): void {
  active = null;
}
