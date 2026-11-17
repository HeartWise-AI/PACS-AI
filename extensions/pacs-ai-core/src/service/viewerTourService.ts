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
    return false;
  }

  if (shownLocally && !isServerSynced(userId)) {
    // Legacy dismissal on this device: copy it to the account, don't show again.
    try {
      await userRepository.CompleteViewerTour();
      markServerSynced(userId);
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
  } catch (error) {
    // Server still says "not completed": force the next load on this device to
    // migrate the local flag instead of showing the tour again.
    if (lastKnownUserId) {
      unmarkServerSynced(lastKnownUserId);
    }
  }
}

/**
 * Settings "Show the viewer tour again": clear the local flag and the server
 * flag so the tour starts on the next viewer open. Rejects if the server call
 * fails (the local flag is cleared regardless).
 */
export async function resetViewerTour(): Promise<void> {
  removeFromList(SHOWN_TOURS_KEY, VIEWER_TOUR_ID);
  const response = await userRepository.ResetViewerTour();
  const userId = (response && response.data && response.data.userId) || lastKnownUserId;
  if (userId) {
    lastKnownUserId = userId;
    markServerSynced(userId);
  }
}
