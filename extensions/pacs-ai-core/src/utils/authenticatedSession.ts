import { clearSubmittedWorklistSearch } from './worklistSearchSession';

const sessionClearedListeners = new Set<() => void>();

/**
 * Runs `listener` whenever the authenticated session is cleared (logout,
 * session expiry). Returns a function that removes it.
 */
export function onAuthenticatedSessionCleared(listener: () => void): () => void {
  sessionClearedListeners.add(listener);
  return () => sessionClearedListeners.delete(listener);
}

export function clearAuthenticatedSession(): void {
  localStorage.removeItem('sessionToken');
  clearSubmittedWorklistSearch();
  sessionClearedListeners.forEach(listener => listener());
}
