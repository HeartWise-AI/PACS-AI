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
 * Set when the server could not be told that the viewer tour was shown, so
 * the next load can still record it once the server answers, even when the
 * user was not known yet (the API was down from the start of the page). It
 * holds the account it belongs to (user id, else a fingerprint of the
 * sign-in) so that another account signing in on this browser ignores it.
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

/** A short fingerprint of the session token (the token itself is not copied). */
function sessionFingerprint(): string | null {
  let token: string | null = null;
  try {
    token = localStorage.getItem('sessionToken');
  } catch (error) {
    return null;
  }
  if (!token) {
    return null;
  }
  // FNV-1a, 32 bit.
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * The account a pending completion belongs to: the user when known, else the
 * current session (same sign-in, same account). Null when neither is known.
 */
function pendingOwner(userId: string | null): string | null {
  if (userId) {
    return `user:${userId}`;
  }
  const session = sessionFingerprint();
  return session ? `session:${session}` : null;
}

function readPendingCompletion(): string | null {
  try {
    return localStorage.getItem(PENDING_COMPLETION_KEY);
  } catch (error) {
    return null;
  }
}

/** Whether this user (or this sign-in) has a completion still to record. */
function hasPendingCompletion(userId: string): boolean {
  const pending = readPendingCompletion();
  return !!pending && (pending === pendingOwner(userId) || pending === pendingOwner(null));
}

function setPendingCompletion(userId: string | null): void {
  const owner = pendingOwner(userId);
  if (!owner) {
    return;
  }
  try {
    localStorage.setItem(PENDING_COMPLETION_KEY, owner);
  } catch (error) {
    // storage unavailable; the server flag still applies
  }
}

/** Clears the pending completion when it belongs to this user or sign-in. */
function clearPendingCompletion(userId: string | null): void {
  const pending = readPendingCompletion();
  if (!pending || (pending !== pendingOwner(userId) && pending !== pendingOwner(null))) {
    return;
  }
  try {
    localStorage.removeItem(PENDING_COMPLETION_KEY);
  } catch (error) {
    // storage unavailable
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
    clearPendingCompletion(userId);
    return false;
  }

  if (shownLocally && (!isServerSynced(userId) || hasPendingCompletion(userId))) {
    // Legacy dismissal on this device: copy it to the account, don't show again.
    try {
      await userRepository.CompleteViewerTour();
      markServerSynced(userId);
      clearPendingCompletion(userId);
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
    clearPendingCompletion(userId || lastKnownUserId);
  } catch (error) {
    // Server still says "not completed": force the next load on this device to
    // migrate the local flag instead of showing the tour again. The user may
    // not be known yet (the API was down when the page loaded), so the
    // pending completion is kept in storage as well.
    if (lastKnownUserId) {
      unmarkServerSynced(lastKnownUserId);
    }
    setPendingCompletion(lastKnownUserId);
  }
}

/**
 * Settings "Show the viewer tour again": clear the local flag and the server
 * flag so the tour starts on the next viewer open. Rejects if the server call
 * fails (the local flag is cleared regardless).
 */
export async function resetViewerTour(): Promise<void> {
  removeFromList(SHOWN_TOURS_KEY, VIEWER_TOUR_ID);
  clearPendingCompletion(lastKnownUserId);
  const response = await userRepository.ResetViewerTour();
  const userId = (response && response.data && response.data.userId) || lastKnownUserId;
  if (userId) {
    lastKnownUserId = userId;
    markServerSynced(userId);
  }
}
