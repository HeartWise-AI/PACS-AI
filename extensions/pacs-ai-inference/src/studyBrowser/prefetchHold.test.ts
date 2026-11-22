import {
  MAX_HOLD_MS,
  MAX_WAIT_MS,
  POLL_MS,
  PREFETCH_DURING_THUMBNAILS,
  THUMBNAILS_IDLE_MS,
  _resetPrefetchHold,
  holdPrefetch,
  thumbnailRequests,
} from './prefetchHold';

/** A fake cornerstone RequestPoolManager with the fields the hold reads. */
function fakePool(prefetchMax = 25) {
  const max: Record<string, number> = { prefetch: prefetchMax, thumbnail: 75 };
  const pool = {
    numRequests: { prefetch: 0, thumbnail: 0 } as Record<string, number>,
    queue: { prefetch: { 0: [] as unknown[] }, thumbnail: { 0: [] as unknown[] } },
    getMaxSimultaneousRequests: (type: string) => max[type],
    setMaxSimultaneousRequests: jest.fn((type: string, n: number) => {
      max[type] = n;
    }),
    getRequestPool() {
      return this.queue;
    },
    startGrabbing: jest.fn(),
  };
  return { pool, max };
}

function clock() {
  let t = 0;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
      jest.advanceTimersByTime(ms);
    },
  };
}

function hold(pool: ReturnType<typeof fakePool>['pool'], c: ReturnType<typeof clock>) {
  return holdPrefetch({ pool, prefetch: 'prefetch', thumbnail: 'thumbnail', now: c.now });
}

describe('holdPrefetch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    _resetPrefetchHold();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('lowers the prefetch limit and restores it once the thumbnails are in', () => {
    const { pool, max } = fakePool();
    const c = clock();
    const h = hold(pool, c);
    expect(max.prefetch).toBe(PREFETCH_DURING_THUMBNAILS);

    c.advance(5000); // viewport warming up: no release before the thumbnails start
    expect(max.prefetch).toBe(PREFETCH_DURING_THUMBNAILS);

    h.thumbnailsStarted();
    pool.queue.thumbnail[0].push({}, {});
    pool.numRequests.thumbnail = 6;
    c.advance(3000);
    expect(max.prefetch).toBe(PREFETCH_DURING_THUMBNAILS);

    pool.queue.thumbnail[0].length = 0;
    pool.numRequests.thumbnail = 0;
    c.advance(THUMBNAILS_IDLE_MS - POLL_MS);
    expect(max.prefetch).toBe(PREFETCH_DURING_THUMBNAILS);
    c.advance(2 * POLL_MS);
    expect(max.prefetch).toBe(25);
    expect(pool.startGrabbing).toHaveBeenCalled();
  });

  it('restores after MAX_HOLD_MS even if thumbnails keep coming', () => {
    const { pool, max } = fakePool();
    const c = clock();
    const h = hold(pool, c);
    h.thumbnailsStarted();
    pool.numRequests.thumbnail = 3;
    c.advance(MAX_HOLD_MS - POLL_MS);
    expect(max.prefetch).toBe(PREFETCH_DURING_THUMBNAILS);
    c.advance(2 * POLL_MS);
    expect(max.prefetch).toBe(25);
  });

  it('restores after MAX_WAIT_MS when the thumbnails never start', () => {
    const { pool, max } = fakePool();
    const c = clock();
    hold(pool, c);
    c.advance(MAX_WAIT_MS + POLL_MS);
    expect(max.prefetch).toBe(25);
  });

  it('release() restores at once, is idempotent, and keeps a value someone else set', () => {
    const { pool, max } = fakePool();
    const c = clock();
    const h = hold(pool, c);
    h.release();
    h.release();
    expect(max.prefetch).toBe(25);

    const h2 = hold(pool, c);
    pool.setMaxSimultaneousRequests('prefetch', 10);
    h2.release();
    expect(max.prefetch).toBe(10);
  });

  it('allows one hold at a time, and a new one after release', () => {
    const { pool, max } = fakePool();
    const c = clock();
    const h1 = hold(pool, c);
    const h2 = hold(pool, c);
    h2.release(); // no-op hold: must not restore
    expect(max.prefetch).toBe(PREFETCH_DURING_THUMBNAILS);
    h1.release();
    expect(max.prefetch).toBe(25);
    hold(pool, c);
    expect(max.prefetch).toBe(PREFETCH_DURING_THUMBNAILS);
  });

  it('does nothing when the limit is already at or below the hold value', () => {
    const { pool, max } = fakePool(2);
    const c = clock();
    hold(pool, c).release();
    expect(max.prefetch).toBe(2);
    expect(pool.setMaxSimultaneousRequests).not.toHaveBeenCalled();
  });

  it('counts queued and running thumbnail requests', () => {
    const { pool } = fakePool();
    expect(thumbnailRequests(pool, 'thumbnail')).toBe(0);
    pool.queue.thumbnail[0].push({});
    (pool.queue.thumbnail as Record<number, unknown[]>)[5] = [{}, {}];
    pool.numRequests.thumbnail = 4;
    expect(thumbnailRequests(pool, 'thumbnail')).toBe(7);
  });
});
