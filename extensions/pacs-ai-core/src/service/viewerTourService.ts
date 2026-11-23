import userRepository from '../api/userRepository';

/**
 * Viewer onboarding tour gating (HeartWise-AI/PACS-AI#489).
 *
 * The server (`/v1/user/viewer-tour`) is the source of truth so the tour shows
 * once per user across devices. The browser flag that @ohif/ui-next's
 * Onboarding has always written (`shownTours`) is kept as:
 *  - a one-time migration source: a dismissal recorded on this device before the
 *    server flag existed is copied to the account instead of showing the tour;
 *  - the fallback when the API is unreachable, so an API error never blocks the
 *    viewer and never makes the tour show repeatedly.
 */
export const VIEWER_TOUR_ID = 'basicViewerTour';

/** Same key @ohif/ui-next Onboarding uses for its local "tour shown" list. */
const SHOWN_TOURS_KEY = 'shownTours';
/** User ids whose viewer tour state has been reconciled with the server on this device. */
const SERVER_SYNCED_USERS_KEY = 'viewerTourServerSyncedUsers';
/**
 * Set when the server could not be told that the viewer tour was shown and
 * the user was not known yet (the API was down from the start of the page),
 * so the next load can still record it once the server answers.
 */
const PENDING_COMPLETION_KEY = 'viewerTourPendingCompletion';

let lastKnownUserId: string | null = null;

function readList(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
  } catch (error) {
    return [];
  }
}

function writeList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (error) {
    // storage unavailable (private mode, quota); the server flag still applies
  }
}

function addToList(key: string, value: string): void {
  const list = readList(key);
  if (!list.includes(value)) {
    writeList(key, [...list, value]);
  }
}

function removeFromList(key: string, value: string): void {
  const list = readList(key);
  if (list.includes(value)) {
    writeList(
      key,
      list.filter(item => item !== value)
    );
  }
}

export function hasLocalTourBeenShown(tourId: string): boolean {
  return readList(SHOWN_TOURS_KEY).includes(tourId);
}

function isServerSynced(userId: string): boolean {
  return readList(SERVER_SYNCED_USERS_KEY).includes(userId);
}

function markServerSynced(userId: string): void {
  addToList(SERVER_SYNCED_USERS_KEY, userId);
}

function unmarkServerSynced(userId: string): void {
  removeFromList(SERVER_SYNCED_USERS_KEY, userId);
}

function hasPendingCompletion(): boolean {
  try {
    return localStorage.getItem(PENDING_COMPLETION_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function setPendingCompletion(pending: boolean): void {
  try {
    if (pending) {
      localStorage.setItem(PENDING_COMPLETION_KEY, '1');
    } else {
      localStorage.removeItem(PENDING_COMPLETION_KEY);
    }
  } catch (error) {
    // storage unavailable; the server flag still applies
  }
}

/**
 * Decide whether a tour should start. Resolves (never rejects) so callers can
 * always render the viewer.
 */
export async function shouldShowTour(tourId: string): Promise<boolean> {
  const shownLocally = hasLocalTourBeenShown(tourId);
  if (tourId !== VIEWER_TOUR_ID) {
    return !shownLocally;
  }

  let state;
  try {
    const response = await userRepository.GetViewerTour();
    state = response ? response.data : undefined;
  } catch (error) {
    return !shownLocally;
  }
  if (!state || typeof state.userId !== 'string' || !state.userId) {
    return !shownLocally;
  }

  const { userId } = state;
  lastKnownUserId = userId;

  if (state.viewerTourCompletedAt !== null && state.viewerTourCompletedAt !== undefined) {
    addToList(SHOWN_TOURS_KEY, tourId);
    markServerSynced(userId);
    setPendingCompletion(false);
    return false;
  }

  if (shownLocally && (!isServerSynced(userId) || hasPendingCompletion())) {
    // Legacy dismissal on this device: copy it to the account, don't show again.
    try {
      await userRepository.CompleteViewerTour();
      markServerSynced(userId);
      setPendingCompletion(false);
    } catch (error) {
      // retried on the next viewer load; the local flag keeps the tour hidden
    }
    return false;
  }

  // Server says not completed and this device already trusts the server
  // (e.g. the user reset the tour from Settings on another device).
  markServerSynced(userId);
  return true;
}

/**
 * Record that a tour was shown (it is marked as soon as it starts, so closing
 * the tab mid-tour does not bring it back). Never rejects.
 */
export async function markTourShown(tourId: string): Promise<void> {
  addToList(SHOWN_TOURS_KEY, tourId);
  if (tourId !== VIEWER_TOUR_ID) {
    return;
  }

  try {
    const response = await userRepository.CompleteViewerTour();
    const userId = response && response.data ? response.data.userId : null;
    if (userId) {
      markServerSynced(userId);
    }
    setPendingCompletion(false);
  } catch (error) {
    // Server still says "not completed": force the next load on this device to
    // migrate the local flag instead of showing the tour again. The user may
    // not be known yet (the API was down when the page loaded), so the
    // pending completion is kept in storage as well.
    if (lastKnownUserId) {
      unmarkServerSynced(lastKnownUserId);
    }
    setPendingCompletion(true);
  }
}

/**
 * Settings "Show the viewer tour again": clear the local flag and the server
 * flag so the tour starts on the next viewer open. Rejects if the server call
 * fails (the local flag is cleared regardless).
 */
export async function resetViewerTour(): Promise<void> {
  removeFromList(SHOWN_TOURS_KEY, VIEWER_TOUR_ID);
  setPendingCompletion(false);
  const response = await userRepository.ResetViewerTour();
  const userId = (response && response.data && response.data.userId) || lastKnownUserId;
  if (userId) {
    lastKnownUserId = userId;
    markServerSynced(userId);
  }
}
