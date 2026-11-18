import {
  fetchFrontendBuildVersion,
  getFrontendVersionUrl,
  startFrontendVersionMonitor,
} from './frontendVersionMonitor';

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('frontendVersionMonitor', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('builds the version URL beneath the configured public URL', () => {
    expect(getFrontendVersionUrl('/viewer', 'https://demo.pacsai.co')).toBe(
      'https://demo.pacsai.co/viewer/version.json'
    );
    expect(getFrontendVersionUrl('/', 'https://demo.pacsai.co')).toBe(
      'https://demo.pacsai.co/version.json'
    );
  });

  test('always bypasses caches when requesting the deployed version', async () => {
    const fetchImpl = jest.fn(() => jsonResponse({ buildId: 'new-build' }));

    await expect(
      fetchFrontendBuildVersion('https://demo.pacsai.co/version.json', fetchImpl as typeof fetch)
    ).resolves.toEqual({ buildId: 'new-build' });
    expect(fetchImpl).toHaveBeenCalledWith('https://demo.pacsai.co/version.json', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
  });

  test('reports a different deployment only once', async () => {
    const fetchImpl = jest.fn(() => jsonResponse({ buildId: 'new-build' }));
    const onUpdateAvailable = jest.fn();

    const stop = startFrontendVersionMonitor({
      currentBuildId: 'old-build',
      publicUrl: '/',
      pollIntervalMs: 60_000,
      onUpdateAvailable,
      fetchImpl: fetchImpl as typeof fetch,
    });

    await flushAsyncWork();
    window.dispatchEvent(new Event('focus'));
    await flushAsyncWork();

    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
    expect(onUpdateAvailable).toHaveBeenCalledWith({ buildId: 'new-build' });
    stop();
  });

  test('checks again on focus, visibility, and the polling interval', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn(() => jsonResponse({ buildId: 'current-build' }));
    const onUpdateAvailable = jest.fn();
    const visibilityState = jest.spyOn(document, 'visibilityState', 'get');
    visibilityState.mockReturnValue('visible');

    const stop = startFrontendVersionMonitor({
      currentBuildId: 'current-build',
      publicUrl: '/',
      pollIntervalMs: 1_000,
      onUpdateAvailable,
      fetchImpl: fetchImpl as typeof fetch,
    });

    await flushAsyncWork();
    window.dispatchEvent(new Event('focus'));
    await flushAsyncWork();
    document.dispatchEvent(new Event('visibilitychange'));
    await flushAsyncWork();
    jest.advanceTimersByTime(1_000);
    await flushAsyncWork();

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(onUpdateAvailable).not.toHaveBeenCalled();
    stop();
  });

  test('ignores unavailable or malformed version responses', async () => {
    const unavailableFetch = jest.fn(() => jsonResponse({}, false));
    const malformedFetch = jest.fn(() => jsonResponse({ buildId: '' }));

    await expect(
      fetchFrontendBuildVersion('/version.json', unavailableFetch as typeof fetch)
    ).resolves.toBeNull();
    await expect(
      fetchFrontendBuildVersion('/version.json', malformedFetch as typeof fetch)
    ).resolves.toBeNull();
  });
});
