export interface FrontendBuildVersion {
  buildId: string;
  builtAt?: string;
}

interface FrontendVersionMonitorOptions {
  currentBuildId?: string;
  publicUrl?: string;
  pollIntervalMs?: number;
  onUpdateAvailable: (availableVersion: FrontendBuildVersion) => void;
  fetchImpl?: typeof fetch;
  windowObject?: Window;
  documentObject?: Document;
}

export const FRONTEND_VERSION_POLL_INTERVAL_MS = 60_000;

export function getFrontendVersionUrl(publicUrl: string, origin: string): string {
  const normalizedPublicUrl = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`;
  return new URL('version.json', new URL(normalizedPublicUrl, origin)).toString();
}

export async function fetchFrontendBuildVersion(
  versionUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<FrontendBuildVersion | null> {
  const response = await fetchImpl(versionUrl, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    return null;
  }

  const version = (await response.json()) as Partial<FrontendBuildVersion>;
  const buildId = typeof version.buildId === 'string' ? version.buildId.trim() : '';

  return buildId ? { ...version, buildId } : null;
}

export function startFrontendVersionMonitor({
  currentBuildId = process.env.APP_BUILD_ID,
  publicUrl = (window as Window & { PUBLIC_URL?: string }).PUBLIC_URL || '/',
  pollIntervalMs = FRONTEND_VERSION_POLL_INTERVAL_MS,
  onUpdateAvailable,
  fetchImpl = fetch,
  windowObject = window,
  documentObject = document,
}: FrontendVersionMonitorOptions): () => void {
  const normalizedCurrentBuildId = currentBuildId?.trim();

  if (!normalizedCurrentBuildId) {
    return () => {};
  }

  const versionUrl = getFrontendVersionUrl(publicUrl, windowObject.location.origin);
  let stopped = false;
  let checkInProgress = false;
  let updateDetected = false;

  const checkForUpdate = async () => {
    if (stopped || checkInProgress || updateDetected) {
      return;
    }

    checkInProgress = true;

    try {
      const availableVersion = await fetchFrontendBuildVersion(versionUrl, fetchImpl);

      if (availableVersion && availableVersion.buildId !== normalizedCurrentBuildId) {
        updateDetected = true;
        onUpdateAvailable(availableVersion);
      }
    } catch (error) {
      console.debug('Unable to check for a frontend update.', error);
    } finally {
      checkInProgress = false;
    }
  };

  const checkWhenVisible = () => {
    if (documentObject.visibilityState === 'visible') {
      void checkForUpdate();
    }
  };

  const intervalId = windowObject.setInterval(checkForUpdate, pollIntervalMs);
  windowObject.addEventListener('focus', checkForUpdate);
  documentObject.addEventListener('visibilitychange', checkWhenVisible);
  void checkForUpdate();

  return () => {
    stopped = true;
    windowObject.clearInterval(intervalId);
    windowObject.removeEventListener('focus', checkForUpdate);
    documentObject.removeEventListener('visibilitychange', checkWhenVisible);
  };
}
