import {
  IMAGE_SET_GRACE_MS,
  POLL_MS,
  TOTAL_TIMEOUT_MS,
  WARM_UP_FRAMES,
  warmUpState,
  whenActiveViewportWarmedUp,
  whenViewportWarmedUp,
} from './viewportWarmUp';

const frames = (n: number) => Array.from({ length: n }, (_, i) => `wadors:/frames/${i + 1}`);

function stack(imageIds: string[], index = 0) {
  return { getImageIds: () => imageIds, getCurrentImageIdIndex: () => index };
}

/** A fake cornerstone cache plus the change notification the real one sends. */
function harness(viewport: ReturnType<typeof stack> | null | object) {
  const loaded = new Set<string>();
  let notify: () => void = () => undefined;
  const unsubscribe = jest.fn();
  const state = { viewport };
  const deps = {
    getActiveViewport: () => state.viewport as any,
    isLoaded: (id: string) => loaded.has(id),
    subscribe: (onChange: () => void) => {
      notify = onChange;
      return [{ unsubscribe }];
    },
  };
  const load = (...ids: string[]) => {
    ids.forEach(id => loaded.add(id));
    notify();
  };
  return { deps, load, unsubscribe, state };
}

describe('warmUpState', () => {
  const ids = frames(30);
  const loadedUpTo = (n: number) => (id: string) => ids.indexOf(id) < n;

  it('waits while there is no viewport or no stack yet', () => {
    expect(warmUpState(null, () => true)).toBe('waiting');
    expect(warmUpState(stack([]), () => true)).toBe('waiting');
  });

  it('waits for the shown image, then for the next frames', () => {
    expect(warmUpState(stack(ids), loadedUpTo(0))).toBe('loading');
    expect(warmUpState(stack(ids), loadedUpTo(1))).toBe('firstImage');
    expect(warmUpState(stack(ids), loadedUpTo(WARM_UP_FRAMES))).toBe('firstImage');
    expect(warmUpState(stack(ids), loadedUpTo(WARM_UP_FRAMES + 1))).toBe('ready');
  });

  it('counts frames from the shown index and stops at the end of the stack', () => {
    const has = (id: string) => ids.indexOf(id) >= 27;
    expect(warmUpState(stack(ids, 27), has)).toBe('ready');
    expect(warmUpState(stack(frames(1)), () => true)).toBe('ready');
  });

  it('does not wait for viewports that are not stacks (video, PDF, SR, volume)', () => {
    expect(warmUpState({}, () => false)).toBe('ready');
  });
});

describe('whenViewportWarmedUp', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts thumbnails at once when the shown frame and the next frames are cached', () => {
    const ids = frames(60);
    const { deps, load, unsubscribe } = harness(stack(ids));
    const onReady = jest.fn();
    whenViewportWarmedUp(deps, onReady);

    load(ids[0]);
    expect(onReady).not.toHaveBeenCalled();
    load(...ids.slice(1, WARM_UP_FRAMES));
    expect(onReady).not.toHaveBeenCalled();
    load(ids[WARM_UP_FRAMES]);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalled();

    load(ids[10]);
    jest.advanceTimersByTime(TOTAL_TIMEOUT_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('starts thumbnails shortly after the viewport has its stack, before its frames arrive', () => {
    const { deps } = harness(stack(frames(60)));
    const onReady = jest.fn();
    whenViewportWarmedUp(deps, onReady);
    jest.advanceTimersByTime(IMAGE_SET_GRACE_MS - 1);
    expect(onReady).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('counts the grace from the moment the stack appears', () => {
    const { deps, state } = harness(null);
    const onReady = jest.fn();
    whenViewportWarmedUp(deps, onReady);
    jest.advanceTimersByTime(2 * POLL_MS);
    state.viewport = stack(frames(60));
    jest.advanceTimersByTime(POLL_MS);
    expect(onReady).not.toHaveBeenCalled();
    jest.advanceTimersByTime(IMAGE_SET_GRACE_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('never holds thumbnails longer than the total limit', () => {
    const { deps } = harness(stack([]));
    const onReady = jest.fn();
    whenViewportWarmedUp(deps, onReady);
    jest.advanceTimersByTime(TOTAL_TIMEOUT_MS - 1);
    expect(onReady).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('notices a viewport that appears later through the poll', () => {
    const ids = frames(3);
    const { deps, state } = harness(null);
    const loaded = new Set(ids);
    const onReady = jest.fn();
    whenViewportWarmedUp({ ...deps, isLoaded: id => loaded.has(id) }, onReady);
    expect(onReady).not.toHaveBeenCalled();
    state.viewport = stack(ids);
    jest.advanceTimersByTime(POLL_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('is ready at once when everything is already cached', () => {
    const ids = frames(10);
    const { deps } = harness(stack(ids));
    const onReady = jest.fn();
    whenViewportWarmedUp({ ...deps, isLoaded: () => true }, onReady);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled without calling back', () => {
    const { deps, unsubscribe } = harness(stack(frames(10)));
    const onReady = jest.fn();
    const cancel = whenViewportWarmedUp(deps, onReady);
    cancel();
    expect(unsubscribe).toHaveBeenCalled();
    jest.advanceTimersByTime(TOTAL_TIMEOUT_MS * 2);
    expect(onReady).not.toHaveBeenCalled();
  });

  it('does not hold thumbnails when the viewport throws', () => {
    const onReady = jest.fn();
    whenViewportWarmedUp(
      {
        getActiveViewport: () => {
          throw new Error('torn down');
        },
        isLoaded: () => false,
        subscribe: () => [],
      },
      onReady
    );
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

describe('whenActiveViewportWarmedUp', () => {
  it('does not wait without the cornerstone services (other viewers, tests)', () => {
    const onReady = jest.fn();
    whenActiveViewportWarmedUp({ services: {} }, onReady);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
