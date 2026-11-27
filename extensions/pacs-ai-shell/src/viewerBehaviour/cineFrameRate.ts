/**
 * The frame rate a multi-frame series was acquired at, from its DICOM
 * header, in this order:
 *
 * 1. Cine Rate (0018,0040), frames per second;
 * 2. 1000 / Frame Time (0018,1063), milliseconds per frame;
 * 3. 1000 / the median of Frame Time Vector (0018,1065) without its first
 *    entry (the time of frame 1 is 0 by definition), ignoring zero and
 *    absurd values. Shimadzu XA writes only this, e.g. 0\133\133\134... ms,
 *    i.e. 7.5 fps;
 * 4. Recommended Display Frame Rate (0008,2144), frames per second;
 * 5. undefined: the caller's default (24 fps in OHIF).
 *
 * Rates under 10 fps keep one decimal (7.5 fps), faster ones are rounded to
 * whole frames per second as OHIF always did (1000 / 33.3 ms -> 30).
 */

/** Frames per second outside this range are treated as a bad header value. */
export const MIN_FRAME_RATE = 0.5;
export const MAX_FRAME_RATE = 1000;

/** Header tags read, as dcmjs names them in OHIF's naturalized instance. */
export type FrameRateHeader = {
  CineRate?: unknown;
  FrameTime?: unknown;
  FrameTimeVector?: unknown;
  RecommendedDisplayFrameRate?: unknown;
};

export type FrameRateSource =
  | 'CineRate'
  | 'FrameTime'
  | 'FrameTimeVector'
  | 'RecommendedDisplayFrameRate';

/** Rounds a frame rate for playback and for the FPS field of the cine bar. */
export function roundFrameRate(fps: number): number {
  return fps >= 10 ? Math.round(fps) : Math.round(fps * 10) / 10;
}

function isSaneFrameRate(fps: number): boolean {
  return Number.isFinite(fps) && fps >= MIN_FRAME_RATE && fps <= MAX_FRAME_RATE;
}

/** First value of a single- or multi-valued tag (IS/DS may come as strings). */
function firstNumber(value: unknown): number {
  const first = Array.isArray(value) ? value[0] : value;
  if (first === undefined || first === null || first === '') {
    return NaN;
  }
  return Number(first);
}

/** All values of a multi-valued DS: an array, a number, or "a\b\c". */
function numberList(value: unknown): number[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split('\\')
      : [value];
  return list.map(item => (item === '' || item === null ? NaN : Number(item)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function rateFromFrameTime(milliseconds: number): number | undefined {
  if (!(milliseconds > 0)) {
    return undefined;
  }
  const fps = 1000 / milliseconds;
  return isSaneFrameRate(fps) ? fps : undefined;
}

/** Frame rate from Frame Time Vector, or undefined. */
export function frameRateFromFrameTimeVector(value: unknown): number | undefined {
  const intervals = numberList(value)
    .slice(1)
    .filter(milliseconds => {
      const fps = 1000 / milliseconds;
      return milliseconds > 0 && isSaneFrameRate(fps);
    });
  return intervals.length ? rateFromFrameTime(median(intervals)) : undefined;
}

/**
 * The series' frame rate and the tag it came from, unrounded, or undefined
 * when no tag gives a usable rate.
 */
export function resolveFrameRate(
  header?: FrameRateHeader | null
): { fps: number; source: FrameRateSource } | undefined {
  if (!header) {
    return undefined;
  }
  const cineRate = firstNumber(header.CineRate);
  if (isSaneFrameRate(cineRate)) {
    return { fps: cineRate, source: 'CineRate' };
  }
  const fromFrameTime = rateFromFrameTime(firstNumber(header.FrameTime));
  if (fromFrameTime) {
    return { fps: fromFrameTime, source: 'FrameTime' };
  }
  const fromVector = frameRateFromFrameTimeVector(header.FrameTimeVector);
  if (fromVector) {
    return { fps: fromVector, source: 'FrameTimeVector' };
  }
  const recommended = firstNumber(header.RecommendedDisplayFrameRate);
  if (isSaneFrameRate(recommended)) {
    return { fps: recommended, source: 'RecommendedDisplayFrameRate' };
  }
  return undefined;
}

/** Rounded frames per second of a series, or undefined (use the default). */
export function cineFrameRate(header?: FrameRateHeader | null): number | undefined {
  const resolved = resolveFrameRate(header);
  return resolved ? roundFrameRate(resolved.fps) : undefined;
}
